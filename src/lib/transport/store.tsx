"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import { BUS_DOCS, SEED } from "./seed";
import { ENTITY_FIELDS, type EntityField } from "./entity-fields";
import {
  COLLECTION,
  type BusDocuments,
  type EntityName,
  type FleetRow,
  type Route,
  type SchoolTrip,
  type Stop,
  type Student,
  type TransportData,
} from "./types";

/*
 * In-memory store for the admin console.
 *
 * The handoff calls for Prisma repository functions behind server actions
 * (docs/handoff/CLAUDE.md). Until the Postgres schema in docs/handoff/prisma is
 * provisioned, every mutation runs through the reducer below; the action names
 * map one-to-one onto the REST routes in docs/handoff/API.md, so swapping the
 * dispatchers for server actions does not change any screen.
 */

export type DialogMode = "create" | "edit" | "delete";
export type PickerScope = "all" | "selected" | "unassigned";

export interface DialogStopRow {
  id: string;
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
  /** Student-picker filters. */
  q: string;
  cls: string;
  scope: PickerScope;
  /** Master stop panel (route dialog). */
  masterOpen: boolean;
  masterQ: string;
  masterPicked: string[];
}

interface State {
  data: TransportData;
  /** Bus highlighted on the live map and its detail rail. */
  selectedBus: string;
  busDocs: BusDocuments;
  dialog: DialogState | null;
  toast: string;
  driveConnected: boolean;
  backedUp: boolean;
}

type Action =
  | { type: "openDialog"; mode: DialogMode; entity: EntityName; name: string; id?: string; preset?: Record<string, string> }
  | { type: "closeDialog" }
  | { type: "setField"; key: string; value: string }
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
  | { type: "save" }
  | { type: "deleteRecord" }
  | { type: "moveStop"; id: string; dir: -1 | 1 }
  | { type: "setBusDoc"; busId: string; key: string; file: string; size: string }
  | { type: "removeBusDoc"; busId: string; key: string }
  | { type: "toast"; message: string }
  | { type: "toggleDrive" }
  | { type: "backupAll" }
  | { type: "selectBus"; id: string };

const initialState: State = {
  data: SEED,
  selectedBus: "12",
  busDocs: BUS_DOCS,
  dialog: null,
  toast: "",
  driveConnected: true,
  backedUp: false,
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
  q: "",
  cls: "",
  scope: "all",
  masterOpen: false,
  masterQ: "",
  masterPicked: [],
});

function openDialog(state: State, a: Extract<Action, { type: "openDialog" }>): State {
  const { mode, entity, name, id, preset } = a;
  const fields = ENTITY_FIELDS[entity];
  const collection = state.data[COLLECTION[entity]] as unknown as Array<Record<string, unknown>>;
  const record = id ? collection.find((x) => x.id === id) : undefined;

  const values: Record<string, string> = {};
  for (const f of fields) {
    const fromRecord = record ? record[f.key] : undefined;
    values[f.key] = preset?.[f.key] ?? (fromRecord == null ? "" : String(fromRecord));
  }

  let studentIds: string[] = [];
  if (entity === "Stop") {
    studentIds = record
      ? state.data.students.filter((s) => s.stop === (record as unknown as Stop).name).map((s) => s.id)
      : [];
  }

  let fleetRows: FleetRow[] | null = null;
  if (entity === "Trip") {
    const fleet = (record as unknown as SchoolTrip | undefined)?.fleet;
    fleetRows = fleet?.length
      ? fleet.map((f) => ({ ...f }))
      : [{ id: "newf-1", bus: "", driver: "", attendant: "", students: "" }];
  }

  let stopRows: DialogStopRow[] | null = null;
  if (entity === "Route") {
    stopRows = record
      ? state.data.stops
          .filter((s) => s.route === (record as unknown as Route).name)
          .map((s) => ({ id: s.id, name: s.name, time: s.time, drop: s.drop, students: s.students, landmark: s.landmark }))
      : [{ id: "new-1", name: "", time: "", drop: "" }];
  }

  return {
    ...state,
    dialog: { ...blankDialog(mode, entity, name), id, values, studentIds, stopRows, fleetRows },
  };
}

/** Commit the dialog. Mirrors POST/PATCH /api/<resource> in docs/handoff/API.md. */
function save(state: State): State {
  const d = state.dialog;
  if (!d) return state;

  const collectionName = COLLECTION[d.entity];
  const list = [...state.data[collectionName]] as unknown as Array<Record<string, unknown>>;

  let saved: Record<string, unknown> | undefined;
  if (d.mode === "create") {
    saved = { id: `${d.entity.charAt(0)}-${Date.now()}`, ...d.values };
    list.unshift(saved);
  } else {
    const i = list.findIndex((x) => x.id === d.id);
    if (i > -1) {
      saved = { ...list[i], ...d.values };
      list[i] = saved;
    }
  }
  if (!saved) return { ...state, dialog: null };

  const next: TransportData = { ...state.data, [collectionName]: list } as TransportData;

  if (d.entity === "Trip" && d.fleetRows) {
    const fleet: FleetRow[] = d.fleetRows
      .filter((r) => r.bus.trim())
      .map((r, i) => ({
        id: r.id && !r.id.startsWith("newf-") ? r.id : `F-${Date.now()}-${i}`,
        bus: r.bus,
        driver: r.driver || "Unassigned",
        attendant: r.attendant || "Unassigned",
        students: r.students || "0",
      }));
    const i = list.findIndex((x) => x.id === saved.id);
    if (i > -1) list[i] = { ...saved, fleet };
    next.trips = list as unknown as SchoolTrip[];
  }

  if (d.entity === "Stop") {
    const picked = d.studentIds;
    const stopName = String(saved.name ?? "");
    const stopRoute = String(saved.route ?? "");
    next.students = state.data.students.map((s) => {
      if (picked.includes(s.id)) return { ...s, stop: stopName, route: stopRoute || s.route };
      if (s.stop === stopName) return { ...s, stop: "" };
      return s;
    });
    const i = list.findIndex((x) => x.id === saved.id);
    if (i > -1) {
      list[i] = {
        ...saved,
        students: `${picked.length} ${picked.length === 1 ? "student" : "students"}`,
      };
    }
    next.stops = list as unknown as Stop[];
  }

  if (d.entity === "Route" && d.stopRows) {
    const previousName = d.id ? state.data.routes.find((r) => r.id === d.id)?.name : undefined;
    const routeName = String(saved.name ?? "");
    const kept = state.data.stops.filter((s) => s.route !== previousName && s.route !== routeName);
    const rebuilt: Stop[] = d.stopRows
      .filter((r) => r.name.trim())
      .map((r, i) => ({
        id: r.id && !r.id.startsWith("new-") ? r.id : `S-${Date.now()}-${i}`,
        name: r.name,
        route: routeName,
        time: r.time || "—",
        drop: r.drop || "—",
        students: r.students || "0 students",
        landmark: r.landmark || "",
      }));
    next.stops = [...kept, ...rebuilt];
    const i = d.mode === "create" ? 0 : list.findIndex((x) => x.id === saved.id);
    if (i > -1) list[i] = { ...saved, stopCount: String(rebuilt.length) };
    next.routes = list as unknown as Route[];
  }

  return { ...state, data: next, dialog: null };
}

/** Swap a stop with its neighbour inside the same route (PATCH /api/routes/:id/stops). */
function moveStop(state: State, id: string, dir: -1 | 1): State {
  const list = [...state.data.stops];
  const index = list.findIndex((x) => x.id === id);
  if (index < 0) return state;
  const route = list[index].route;
  const siblings = list.map((x, k) => ({ x, k })).filter((o) => o.x.route === route);
  const pos = siblings.findIndex((o) => o.x.id === id);
  const target = siblings[pos + dir];
  if (!target) return state;
  const a = siblings[pos].k;
  const b = target.k;
  [list[a], list[b]] = [list[b], list[a]];
  return { ...state, data: { ...state.data, stops: list } };
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
        ? withDialog(state, { values: { ...d.values, [action.key]: action.value } })
        : state;

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
          name,
          time: master?.time ?? "",
          drop: master?.drop ?? "",
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
      [rows[action.index], rows[j]] = [rows[j], rows[action.index]];
      return withDialog(state, { stopRows: rows });
    }

    case "setStopRowField": {
      if (!d || !d.stopRows) return state;
      const rows = [...d.stopRows];
      if (action.key === "name") {
        // Picking a known stop carries its timings and landmark across.
        const master = state.data.stops.find((x) => x.name === action.value);
        rows[action.index] = {
          ...rows[action.index],
          name: action.value,
          time: master ? master.time : rows[action.index].time,
          drop: master ? master.drop : rows[action.index].drop,
          students: master ? master.students : rows[action.index].students,
          landmark: master ? master.landmark : rows[action.index].landmark,
        };
      } else {
        rows[action.index] = { ...rows[action.index], [action.key]: action.value };
      }
      return withDialog(state, { stopRows: rows });
    }

    case "addFleetRow":
      if (!d || !d.fleetRows) return state;
      return withDialog(state, {
        fleetRows: [
          ...d.fleetRows,
          { id: `newf-${Date.now()}`, bus: "", driver: "", attendant: "", students: "" },
        ],
      });

    case "removeFleetRow":
      if (!d || !d.fleetRows) return state;
      return withDialog(state, { fleetRows: d.fleetRows.filter((_, k) => k !== action.index) });

    case "setFleetField": {
      if (!d || !d.fleetRows) return state;
      const rows = [...d.fleetRows];
      const row = { ...rows[action.index], [action.key]: action.value };
      if (action.key === "bus") {
        // Assigning a bus pulls in its regular crew.
        const bus = state.data.buses.find((b) => `Bus ${b.id}` === action.value);
        if (bus) {
          row.driver = bus.driver || row.driver;
          row.attendant = bus.attendant || row.attendant;
        }
      }
      rows[action.index] = row;
      return withDialog(state, { fleetRows: rows });
    }

    case "save":
      return save(state);

    case "deleteRecord": {
      if (!d || !d.id) return state;
      const collectionName = COLLECTION[d.entity];
      const list = (state.data[collectionName] as Array<{ id: string }>).filter(
        (x) => x.id !== d.id,
      );
      return {
        ...state,
        data: { ...state.data, [collectionName]: list } as TransportData,
        dialog: null,
      };
    }

    case "moveStop":
      return moveStop(state, action.id, action.dir);

    case "setBusDoc":
      return {
        ...state,
        busDocs: {
          ...state.busDocs,
          [action.busId]: {
            ...(state.busDocs[action.busId] ?? {}),
            [action.key]: { file: action.file, size: action.size, on: "Just now", exp: "—" },
          },
        },
      };

    case "removeBusDoc": {
      const forBus = { ...(state.busDocs[action.busId] ?? {}) };
      delete forBus[action.key];
      return { ...state, busDocs: { ...state.busDocs, [action.busId]: forBus } };
    }

    case "toast":
      return { ...state, toast: action.message };

    case "toggleDrive":
      return { ...state, driveConnected: !state.driveConnected };

    case "backupAll":
      return { ...state, backedUp: true };

    case "selectBus":
      return { ...state, selectedBus: action.id };

    default:
      return state;
  }
}

interface StoreValue extends State {
  dispatch: React.Dispatch<Action>;
  /** Option lists for dialog selects, always prefixed with "Unassigned". */
  options: Record<"buses" | "routes" | "drivers" | "attendants" | "stops", string[]>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function TransportStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const options = useMemo(
    () => ({
      buses: ["Unassigned", ...state.data.buses.map((b) => `Bus ${b.id}`)],
      routes: ["Unassigned", ...state.data.routes.map((r) => r.name)],
      drivers: ["Unassigned", ...state.data.drivers.map((x) => x.name)],
      attendants: ["Unassigned", ...state.data.attendants.map((x) => x.name)],
      stops: ["Unassigned", ...state.data.stops.map((s) => s.name)],
    }),
    [state.data],
  );

  const value = useMemo<StoreValue>(
    () => ({ ...state, dispatch, options }),
    [state, options],
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

/** Row-level edit and delete handlers for any table or card. */
export function useRowActions() {
  const { dispatch } = useStore();
  return useCallback(
    (entity: EntityName, name: string, id: string) => ({
      onEdit: () => dispatch({ type: "openDialog", mode: "edit", entity, name, id }),
      onDelete: () => dispatch({ type: "openDialog", mode: "delete", entity, name, id }),
    }),
    [dispatch],
  );
}

export function useOpenCreate() {
  const { dispatch } = useStore();
  return useCallback(
    (entity: EntityName, name: string, preset?: Record<string, string>) =>
      () =>
        dispatch({ type: "openDialog", mode: "create", entity, name, preset }),
    [dispatch],
  );
}

/** Students grouped by the name of the stop they board at. */
export function studentsAtStop(data: TransportData, stopName: string): Student[] {
  return data.students.filter((s) => s.stop === stopName);
}
