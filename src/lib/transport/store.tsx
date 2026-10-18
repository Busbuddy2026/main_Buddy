"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { ApiRequestError, api, errorMessage } from "@/lib/api/client";
import type { TrackerSettings } from "@/lib/api/types";
import { useAdmin } from "./admin-store";
import { ENTITY_FIELDS, type EntityField } from "./entity-fields";
import { RESOURCE, dialogErrors, payloadFor } from "./payloads";
import {
  COLLECTION,
  type BusDocuments,
  type EntityName,
  type FleetRow,
  type Option,
  type SchoolTrip,
  type Student,
  type TransportData,
} from "./types";

/*
 * Admin console store.
 *
 * Master data comes from the server: the layout loads it
 * (src/server/services/masters/view.ts) and passes it in as `initial`. Every
 * change goes through the API — save, delete, reorder, upload — and the
 * response carries the refreshed data, which replaces the local copy. The
 * reducer holds only UI state: the open dialog, its form, the toast.
 */

export type DialogMode = "create" | "edit" | "delete";
export type PickerScope = "all" | "selected" | "unassigned";

export interface DialogStopRow {
  id: string;
  /** The master stop this row points at; absent for a new stop typed in. */
  stopId?: string;
  name: string;
  time: string;
  drop: string;
  students?: string;
  landmark?: string;
}

export interface DialogState {
  mode: DialogMode;
  entity: EntityName;
  /** Human label for the record — shown in the delete confirm. */
  name: string;
  fields: EntityField[];
  id?: string;
  values: Record<string, string>;
  studentIds: string[];
  stopRows: DialogStopRow[] | null;
  fleetRows: FleetRow[] | null;
  /** Files picked in upload fields, sent after the record saves. */
  files: Record<string, File>;
  /** Student-picker filters. */
  q: string;
  cls: string;
  scope: PickerScope;
  /** Master stop panel (route dialog). */
  masterOpen: boolean;
  masterQ: string;
  masterPicked: string[];
  /** Request in flight; the buttons disable. */
  saving: boolean;
  /** Field key → message from the server. "_" holds a form-level message. */
  errors: Record<string, string>;
  /** Bus only: the GPS/dashcam tracker and its settings. */
  tracker: {
    /** LivePin vehicle id; "" = none. */
    vehicleId: string;
    /** What the bus was linked to when the form opened. */
    initialVehicleId: string;
    settings: TrackerSettings | null;
    settingsDirty: boolean;
  } | null;
}

export interface AdminData extends TransportData {
  busDocs: BusDocuments;
}

interface State {
  data: TransportData;
  /** Bus highlighted on the live map and its detail rail. */
  selectedBus: string;
  busDocs: BusDocuments;
  dialog: DialogState | null;
  toast: string;
}

type Action =
  | { type: "openDialog"; mode: DialogMode; entity: EntityName; name: string; id?: string; preset?: Record<string, string> }
  | { type: "closeDialog" }
  | { type: "setField"; key: string; value: string }
  | { type: "setFile"; key: string; file: File | null }
  | { type: "toggleStudent"; id: string }
  | { type: "setPicker"; patch: Partial<Pick<DialogState, "q" | "cls" | "scope">> }
  | { type: "setMaster"; patch: Partial<Pick<DialogState, "masterOpen" | "masterQ" | "masterPicked">> }
  | { type: "toggleMasterStop"; name: string }
  | { type: "addPickedStops" }
  | { type: "addStopRow" }
  | { type: "removeStopRow"; index: number }
  | { type: "moveStopRow"; index: number; dir: -1 | 1 }
  | { type: "setStopRowField"; index: number; key: keyof DialogStopRow; value: string }
  | { type: "addFleetRow" }
  | { type: "removeFleetRow"; index: number }
  | { type: "setFleetField"; index: number; key: keyof FleetRow; value: string }
  | { type: "setTracker"; patch: Partial<NonNullable<DialogState["tracker"]>> }
  | { type: "saving"; on: boolean }
  | { type: "failed"; errors: Record<string, string> }
  | { type: "replaceData"; data: AdminData }
  | { type: "toast"; message: string }
  | { type: "selectBus"; id: string };

/** Select fields hold ids; the record carries them as `<key>Id`. */
const REF_KEY: Record<string, string> = {
  bus: "busId",
  route: "routeId",
  stop: "stopId",
  driver: "driverId",
  attendant: "attendantId",
};

const blankDialog = (
  mode: DialogMode,
  entity: EntityName,
  name: string,
): Omit<DialogState, "values" | "studentIds" | "stopRows" | "fleetRows" | "id"> => ({
  mode,
  entity,
  name,
  fields: ENTITY_FIELDS[entity],
  files: {},
  q: "",
  cls: "",
  scope: "all",
  masterOpen: false,
  masterQ: "",
  masterPicked: [],
  saving: false,
  errors: {},
  tracker: entity === "Bus" ? { vehicleId: "", initialVehicleId: "", settings: null, settingsDirty: false } : null,
});

const newFleetRow = (): FleetRow => ({
  id: `newf-${Date.now()}`,
  busId: "",
  driverId: "",
  attendantId: "",
  bus: "",
  driver: "",
  attendant: "",
  students: "",
});

function openDialog(state: State, a: Extract<Action, { type: "openDialog" }>): State {
  const { mode, entity, name, id, preset } = a;
  const fields = ENTITY_FIELDS[entity];
  const collection = state.data[COLLECTION[entity]] as unknown as Array<Record<string, unknown>>;
  // Buses are addressed by number in the UI and by uid in the API.
  const record = id ? collection.find((x) => x.id === id || x.uid === id) : undefined;

  const values: Record<string, string> = {};
  for (const f of fields) {
    const source = f.opts && REF_KEY[f.key] ? REF_KEY[f.key]! : f.key;
    const fromRecord = record ? record[source] : undefined;
    values[f.key] = preset?.[f.key] ?? (fromRecord == null ? "" : String(fromRecord));
  }

  let studentIds: string[] = [];
  if (entity === "Stop" && record) {
    studentIds = state.data.students.filter((s) => s.stopId === record.id).map((s) => s.id);
  }

  let fleetRows: FleetRow[] | null = null;
  if (entity === "Trip") {
    const fleet = (record as unknown as SchoolTrip | undefined)?.fleet;
    fleetRows = fleet?.length ? fleet.map((f) => ({ ...f })) : [newFleetRow()];
  }

  let stopRows: DialogStopRow[] | null = null;
  if (entity === "Route") {
    stopRows = record
      ? state.data.stops
          .filter((s) => s.routeIds.includes(String(record.id)))
          .map((s) => {
            const at = s.onRoutes[String(record.id)];
            return {
              id: s.id,
              stopId: s.id,
              name: s.name,
              time: at?.time ?? s.time,
              drop: at?.drop ?? s.drop,
              students: s.students,
              landmark: s.landmark,
              seq: at?.seq ?? 0,
            };
          })
          .sort((x, y) => x.seq - y.seq)
          .map((row): DialogStopRow => ({
            id: row.id,
            stopId: row.stopId,
            name: row.name,
            time: row.time,
            drop: row.drop,
            students: row.students,
            landmark: row.landmark,
          }))
      : [{ id: "new-1", name: "", time: "", drop: "" }];
  }

  return {
    ...state,
    dialog: {
      ...blankDialog(mode, entity, name),
      id: (record?.uid as string | undefined) ?? (record?.id as string | undefined) ?? id,
      values,
      studentIds,
      stopRows,
      fleetRows,
    },
  };
}

function withDialog(state: State, patch: Partial<DialogState>): State {
  return state.dialog ? { ...state, dialog: { ...state.dialog, ...patch } } : state;
}

function reducer(state: State, action: Action): State {
  const d = state.dialog;

  switch (action.type) {
    case "openDialog":
      return openDialog(state, action);

    case "closeDialog":
      return { ...state, dialog: null };

    case "setField":
      return d
        ? withDialog(state, { values: { ...d.values, [action.key]: action.value }, errors: { ...d.errors, [action.key]: "" } })
        : state;

    case "setFile": {
      if (!d) return state;
      const files = { ...d.files };
      if (action.file) files[action.key] = action.file;
      else delete files[action.key];
      return withDialog(state, { files });
    }

    case "toggleStudent":
      if (!d) return state;
      return withDialog(state, {
        studentIds: d.studentIds.includes(action.id)
          ? d.studentIds.filter((x) => x !== action.id)
          : [...d.studentIds, action.id],
      });

    case "setPicker":
      return withDialog(state, action.patch);

    case "setMaster":
      return withDialog(state, action.patch);

    case "toggleMasterStop":
      if (!d) return state;
      return withDialog(state, {
        masterPicked: d.masterPicked.includes(action.name)
          ? d.masterPicked.filter((x) => x !== action.name)
          : [...d.masterPicked, action.name],
      });

    case "addPickedStops": {
      if (!d || !d.stopRows) return state;
      const rows = d.stopRows.filter((r) => r.name.trim());
      const added: DialogStopRow[] = d.masterPicked.map((name, i) => {
        const master = state.data.stops.find((x) => x.name === name);
        return {
          id: `new-${Date.now()}-${i}`,
          stopId: master?.id,
          name,
          time: master && master.time !== "—" ? master.time : "",
          drop: master && master.drop !== "—" ? master.drop : "",
          students: master?.students,
          landmark: master?.landmark,
        };
      });
      return withDialog(state, {
        stopRows: [...rows, ...added],
        masterOpen: false,
        masterPicked: [],
        masterQ: "",
      });
    }

    case "addStopRow":
      if (!d || !d.stopRows) return state;
      return withDialog(state, {
        stopRows: [...d.stopRows, { id: `new-${Date.now()}`, name: "", time: "", drop: "" }],
      });

    case "removeStopRow":
      if (!d || !d.stopRows) return state;
      return withDialog(state, { stopRows: d.stopRows.filter((_, k) => k !== action.index) });

    case "moveStopRow": {
      if (!d || !d.stopRows) return state;
      const rows = [...d.stopRows];
      const j = action.index + action.dir;
      if (j < 0 || j >= rows.length) return state;
      [rows[action.index], rows[j]] = [rows[j]!, rows[action.index]!];
      return withDialog(state, { stopRows: rows });
    }

    case "setStopRowField": {
      if (!d || !d.stopRows) return state;
      const rows = [...d.stopRows];
      const row = rows[action.index]!;
      if (action.key === "name") {
        // Picking a known stop carries its id, timings and landmark across.
        const master = state.data.stops.find((x) => x.name === action.value);
        rows[action.index] = {
          ...row,
          name: action.value,
          stopId: master?.id,
          time: master && master.time !== "—" ? master.time : row.time,
          drop: master && master.drop !== "—" ? master.drop : row.drop,
          students: master ? master.students : row.students,
          landmark: master ? master.landmark : row.landmark,
        };
      } else {
        rows[action.index] = { ...row, [action.key]: action.value };
      }
      return withDialog(state, { stopRows: rows });
    }

    case "addFleetRow":
      if (!d || !d.fleetRows) return state;
      return withDialog(state, { fleetRows: [...d.fleetRows, newFleetRow()] });

    case "removeFleetRow":
      if (!d || !d.fleetRows) return state;
      return withDialog(state, { fleetRows: d.fleetRows.filter((_, k) => k !== action.index) });

    case "setFleetField": {
      if (!d || !d.fleetRows) return state;
      const rows = [...d.fleetRows];
      const row = { ...rows[action.index]!, [action.key]: action.value };
      if (action.key === "busId") {
        // Assigning a bus pulls in its regular crew.
        const bus = state.data.buses.find((b) => b.uid === action.value);
        if (bus) {
          row.driverId = bus.driverId ?? row.driverId;
          row.attendantId = bus.attendantId ?? row.attendantId;
        }
      }
      rows[action.index] = row;
      return withDialog(state, { fleetRows: rows });
    }

    case "setTracker":
      return d?.tracker ? withDialog(state, { tracker: { ...d.tracker, ...action.patch } }) : state;

    case "saving":
      return withDialog(state, { saving: action.on, ...(action.on ? { errors: {} } : {}) });

    case "failed":
      return withDialog(state, { saving: false, errors: action.errors });

    case "replaceData": {
      const { busDocs, ...data } = action.data;
      return { ...state, data, busDocs };
    }

    case "toast":
      return { ...state, toast: action.message };

    case "selectBus":
      return { ...state, selectedBus: action.id };

    default:
      return state;
  }
}

interface Actions {
  /** Commit the open dialog: POST or PATCH, then any picked files. */
  save(): Promise<void>;
  /** Confirm the open delete dialog. */
  remove(): Promise<void>;
  /** Swap a stop with its neighbour on a route. */
  moveStop(routeId: string, stopId: string, dir: -1 | 1): Promise<void>;
  /** Upload a compliance document for a bus (by uid). */
  uploadBusDoc(busUid: string, kind: string, file: File): Promise<void>;
  removeDoc(documentId: string): Promise<void>;
  /** Issue a new PIN for a crew member; the toast shows it once. */
  resetPin(resource: "drivers" | "attendants", id: string): Promise<void>;
  /** Re-read everything, e.g. after another tab changed something. */
  refresh(): Promise<void>;
}

interface StoreValue extends State {
  dispatch: React.Dispatch<Action>;
  actions: Actions;
  /** Option lists for dialog selects; the empty value means "Unassigned". */
  options: Record<"buses" | "routes" | "drivers" | "attendants" | "stops", Option[]>;
}

const StoreContext = createContext<StoreValue | null>(null);

async function uploadFile(resource: string, id: string, kind: string, file: File): Promise<AdminData> {
  const contentType = file.type || "application/pdf";
  const target = await api.post<{ storageKey: string; url: string; method: "PUT" }>(
    `/api/admin/${resource}/${id}/upload-url`,
    { kind, fileName: file.name, size: file.size, contentType },
  );
  const put = await fetch(target.url, {
    method: target.method,
    body: file,
    headers: { "content-type": contentType },
  }).catch(() => null);
  if (!put?.ok) throw new ApiRequestError("NETWORK", "The upload did not finish. Try again.", put?.status ?? 0);
  const res = await api.post<{ data: AdminData }>(`/api/admin/${resource}/${id}/documents`, {
    kind,
    fileName: file.name,
    size: file.size,
    storageKey: target.storageKey,
  });
  return res.data;
}

export function TransportStoreProvider({ initial, children }: { initial: AdminData; children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial, (init): State => {
    const { busDocs, ...data } = init;
    return {
      data,
      busDocs,
      selectedBus: "12",
      dialog: null,
      toast: "",
    };
  });

  // Async actions read the latest dialog without re-creating on each keystroke.
  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
  }, [state]);

  const fail = useCallback((error: unknown) => {
    const fields = error instanceof ApiRequestError ? dialogErrors(error.fields) : {};
    dispatch({ type: "failed", errors: { ...fields, _: errorMessage(error) } });
  }, []);

  const actions = useMemo<Actions>(() => {
    const done = (data: AdminData, message: string) => {
      dispatch({ type: "replaceData", data });
      dispatch({ type: "closeDialog" });
      dispatch({ type: "toast", message });
    };

    return {
      save: async () => {
        const d = latest.current.dialog;
        if (!d || d.saving) return;
        dispatch({ type: "saving", on: true });
        const resource = RESOURCE[d.entity];
        try {
          const body = payloadFor(d);
          const res =
            d.mode === "create"
              ? await api.post<{ id: string; data: AdminData; pin?: string; crewId?: string }>(`/api/admin/${resource}`, body)
              : await api.patch<{ id: string; data: AdminData; pin?: string; crewId?: string }>(`/api/admin/${resource}/${d.id}`, body);
          let data = res.data;
          for (const [key, file] of Object.entries(d.files)) {
            const kind = key === "licenceDoc" ? "licence" : key;
            data = await uploadFile(resource, res.id, kind, file);
          }
          const label = d.values.name || (d.entity === "Bus" ? `Bus ${d.values.id}` : d.name) || "Record";
          const pin = res.pin ? ` Crew ID ${res.crewId}, first PIN ${res.pin}.` : "";
          // Tracker settings go to the vendor only after the bus is saved.
          let tracker = "";
          const t = d.tracker;
          if (t?.vehicleId && t.settings && (t.settingsDirty || t.vehicleId !== t.initialVehicleId)) {
            try {
              await api.put(`/api/admin/telematics/${res.id}/settings`, t.settings);
              tracker = " GPS & camera settings applied.";
            } catch (error) {
              tracker = ` Saved, but LivePin settings were not applied: ${errorMessage(error)}`;
            }
          }
          done(data, `${label} saved.${pin}${tracker}`);
        } catch (error) {
          fail(error);
        }
      },

      remove: async () => {
        const d = latest.current.dialog;
        if (!d || !d.id || d.saving) return;
        dispatch({ type: "saving", on: true });
        try {
          const res = await api.delete<{ data: AdminData }>(`/api/admin/${RESOURCE[d.entity]}/${d.id}`);
          done(res.data, `${d.name} deleted.`);
        } catch (error) {
          fail(error);
        }
      },

      moveStop: async (routeId, stopId, dir) => {
        try {
          const res = await api.post<{ data: AdminData }>(`/api/admin/routes/${routeId}/move-stop`, { stopId, dir });
          dispatch({ type: "replaceData", data: res.data });
        } catch (error) {
          dispatch({ type: "toast", message: errorMessage(error) });
        }
      },

      uploadBusDoc: async (busUid, kind, file) => {
        try {
          dispatch({ type: "toast", message: `Uploading ${file.name}…` });
          dispatch({ type: "replaceData", data: await uploadFile("buses", busUid, kind, file) });
          dispatch({ type: "toast", message: `${file.name} uploaded.` });
        } catch (error) {
          dispatch({ type: "toast", message: errorMessage(error) });
        }
      },

      removeDoc: async (documentId) => {
        try {
          const res = await api.delete<{ data: AdminData }>(`/api/admin/documents/${documentId}`);
          dispatch({ type: "replaceData", data: res.data });
          dispatch({ type: "toast", message: "Document removed." });
        } catch (error) {
          dispatch({ type: "toast", message: errorMessage(error) });
        }
      },

      resetPin: async (resource, id) => {
        try {
          const res = await api.post<{ crewId: string; pin: string }>(`/api/admin/${resource}/${id}/reset-pin`);
          dispatch({ type: "toast", message: `New PIN for ${res.crewId}: ${res.pin}` });
        } catch (error) {
          dispatch({ type: "toast", message: errorMessage(error) });
        }
      },

      refresh: async () => {
        try {
          dispatch({ type: "replaceData", data: await api.get<AdminData>("/api/admin/masters") });
        } catch {
          // Keep showing what we have; the next action retries.
        }
      },
    };
  }, [fail]);

  const options = useMemo(
    () => ({
      buses: state.data.buses.map((b) => ({ value: b.uid, label: `Bus ${b.id}` })),
      routes: state.data.routes.map((r) => ({ value: r.id, label: r.name })),
      drivers: state.data.drivers.map((x) => ({ value: x.id, label: x.name })),
      attendants: state.data.attendants.map((x) => ({ value: x.id, label: x.name })),
      stops: state.data.stops.map((s) => ({ value: s.id, label: s.name })),
    }),
    [state.data],
  );

  const value = useMemo<StoreValue>(
    () => ({ ...state, dispatch, actions, options }),
    [state, actions, options],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <TransportStoreProvider>");
  return ctx;
}

export function useData(): TransportData {
  return useStore().data;
}

const READ_ONLY = "Your role can view but not change records.";

/** Row-level edit and delete handlers for any table or card. Viewers get a note instead. */
export function useRowActions() {
  const { dispatch } = useStore();
  const { canEdit } = useAdmin();
  return useCallback(
    (entity: EntityName, name: string, id: string) => ({
      onEdit: () =>
        canEdit
          ? dispatch({ type: "openDialog", mode: "edit", entity, name, id })
          : dispatch({ type: "toast", message: READ_ONLY }),
      onDelete: () =>
        canEdit
          ? dispatch({ type: "openDialog", mode: "delete", entity, name, id })
          : dispatch({ type: "toast", message: READ_ONLY }),
    }),
    [dispatch, canEdit],
  );
}

export function useOpenCreate() {
  const { dispatch } = useStore();
  const { canEdit } = useAdmin();
  return useCallback(
    (entity: EntityName, name: string, preset?: Record<string, string>) =>
      () =>
        canEdit
          ? dispatch({ type: "openDialog", mode: "create", entity, name, preset })
          : dispatch({ type: "toast", message: READ_ONLY }),
    [dispatch, canEdit],
  );
}

/** Students who board at a stop. */
export function studentsAtStop(data: TransportData, stopId: string): Student[] {
  return data.students.filter((s) => s.stopId === stopId);
}
