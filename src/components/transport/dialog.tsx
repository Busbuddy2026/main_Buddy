"use client";

import { useEffect, useMemo } from "react";
import { ENTITY_LABEL } from "@/lib/transport/entity-fields";
import { useStore } from "@/lib/transport/store";
import { pad } from "@/lib/transport/tone";
import { COMPACT, FieldLabel, MiniButton, SelectInput, TextInput } from "./form-controls";
import { Icon } from "./ui";

/** Format an attached file's size the way the prototype does. */
function fileSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * One modal serves create, edit and delete for all seven entities
 * (SCREENS.md §A28). Deletes are confirmed separately and, once the database is
 * wired, are soft and audit-logged.
 */
export function EntityDialog() {
  const { dialog, data, options, dispatch } = useStore();

  useEffect(() => {
    if (!dialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dispatch({ type: "closeDialog" });
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dialog, dispatch]);

  const classList = useMemo(() => {
    const set = new Set(data.students.map((s) => s.cls).filter(Boolean));
    return [...set].sort();
  }, [data.students]);

  const stopMaster = useMemo(() => {
    const set = new Set(data.stops.map((s) => s.name));
    return [...set];
  }, [data.stops]);

  if (!dialog) return null;

  const entityLabel = ENTITY_LABEL[dialog.entity];
  const isDelete = dialog.mode === "delete";
  const title = isDelete
    ? `Delete ${entityLabel}`
    : dialog.mode === "create"
      ? `New ${entityLabel}`
      : `Edit ${entityLabel}`;
  const subtitle = isDelete
    ? dialog.name
    : dialog.mode === "edit"
      ? dialog.name
      : `Add a new ${entityLabel} record`;

  const plainFields = dialog.fields.filter((f) => !f.picker && !f.upload);
  const uploadFields = dialog.fields.filter((f) => f.upload);
  const pickerField = dialog.fields.find((f) => f.picker === "students");

  /* Student picker ------------------------------------------------------- */
  const q = dialog.q.trim().toLowerCase();
  const picked = dialog.studentIds;
  const pickerRows = pickerField
    ? data.students.filter((s) => {
        const on = picked.includes(s.id);
        if (dialog.scope === "selected" && !on) return false;
        if (dialog.scope === "unassigned" && s.stop && !on) return false;
        if (dialog.cls && s.cls !== dialog.cls) return false;
        if (q && !s.name.toLowerCase().includes(q) && !s.cls.toLowerCase().includes(q)) return false;
        return true;
      })
    : [];

  /* Stops master panel --------------------------------------------------- */
  const inRoute = dialog.stopRows?.map((r) => r.name).filter(Boolean) ?? [];
  const mq = dialog.masterQ.trim().toLowerCase();
  const masterOptions = data.stops
    .filter((s) => !inRoute.includes(s.name))
    .filter((s) => !mq || s.name.toLowerCase().includes(mq) || s.route.toLowerCase().includes(mq));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={() => dispatch({ type: "closeDialog" })}
      className="fixed inset-0 z-[900] grid place-items-center bg-[rgba(16,24,40,0.42)] p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-[640px] max-w-full overflow-y-auto rounded-[18px] bg-surface"
        style={{ boxShadow: "var(--shadow-modal)" }}
      >
        <div className="border-b border-line-soft px-6 pb-4 pt-5">
          <div className="text-[17px] font-semibold tracking-[-0.015em]">{title}</div>
          <div className="mt-0.5 text-[12.5px] text-faint">{subtitle}</div>
        </div>

        {isDelete ? (
          <>
            <div className="px-6 py-5">
              <div className="flex items-start gap-3">
                <span className="grid size-[34px] shrink-0 place-items-center rounded-control bg-critical-tint text-critical-text">
                  <Icon name="delete" size={19} />
                </span>
                <p className="text-[13px] leading-[1.55] text-ink-2">
                  Deleting <strong className="font-semibold">{dialog.name}</strong> removes it from
                  all future trips, routes and attendance sheets. Past attendance and CCTV records
                  are kept for audit.
                </p>
              </div>
            </div>
            <div className="sticky bottom-0 flex justify-end gap-2 bg-surface px-6 pb-5 pt-2">
              <button
                type="button"
                onClick={() => dispatch({ type: "closeDialog" })}
                className="focus-ring rounded-[9px] border border-line px-4 py-2.5 text-[13px] font-semibold hover:bg-canvas"
              >
                Keep
              </button>
              <button
                type="button"
                onClick={() => dispatch({ type: "deleteRecord" })}
                className="focus-ring rounded-[9px] bg-critical px-[18px] py-2.5 text-[13px] font-semibold text-white hover:bg-critical-hover"
              >
                Delete {entityLabel}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="grid max-h-[60vh] grid-cols-1 gap-3.5 overflow-auto px-6 py-5 sm:grid-cols-2">
              {plainFields.map((f) => (
                <div key={f.key}>
                  <FieldLabel>{f.label}</FieldLabel>
                  <div className="mt-1.5">
                    {f.opts ? (
                      <SelectInput
                        ariaLabel={f.label}
                        value={dialog.values[f.key] ?? ""}
                        onChange={(v) => dispatch({ type: "setField", key: f.key, value: v })}
                        options={options[f.opts]}
                        placeholder={`Select ${f.label}`}
                      />
                    ) : (
                      <TextInput
                        ariaLabel={f.label}
                        value={dialog.values[f.key] ?? ""}
                        onChange={(v) => dispatch({ type: "setField", key: f.key, value: v })}
                        placeholder={f.ph}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {uploadFields.map((f) => {
              const value = dialog.values[f.key] ?? "";
              return (
                <div key={f.key} className="px-6 pb-5">
                  <div className="border-t border-line-soft pt-3.5">
                    <div className="text-[13px] font-semibold">{f.label}</div>
                    <div className="mt-px text-[11.5px] text-faint">
                      PDF, JPG or PNG up to 5 MB. Stored against the driver record.
                    </div>

                    {value ? (
                      <div className="mt-[11px] flex items-center gap-[11px] rounded-[11px] border border-line bg-[#fafbfc] px-[13px] py-3">
                        <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-primary-tint text-primary-hover">
                          <Icon name="description" size={18} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[12.5px] font-semibold">{value}</div>
                          <div className="text-[11px] text-faint">Attached</div>
                        </div>
                        <MiniButton
                          icon="delete"
                          title="Remove attachment"
                          danger
                          onClick={() => dispatch({ type: "setField", key: f.key, value: "" })}
                        />
                      </div>
                    ) : null}

                    <label className="mt-[11px] flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#cfd4da] bg-surface p-4 hover:border-primary hover:bg-[#f7faff]">
                      <Icon name="upload_file" size={19} className="text-muted" />
                      <span className="text-[12.5px] font-semibold text-ink-2">
                        Choose a file to upload
                      </span>
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          dispatch({
                            type: "setField",
                            key: f.key,
                            value: `${file.name} · ${fileSize(file.size)}`,
                          });
                        }}
                      />
                    </label>
                  </div>
                </div>
              );
            })}

            {dialog.fleetRows ? (
              <div className="px-6 pb-5">
                <div className="flex items-center gap-2.5 border-t border-line-soft pb-2.5 pt-3.5">
                  <div className="flex-1">
                    <div className="text-[13px] font-semibold">Buses on this trip</div>
                    <div className="mt-px text-[11.5px] text-faint">
                      Add one row per bus. Crew prefills from the bus record.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: "addFleetRow" })}
                    className="focus-ring flex items-center gap-1.5 rounded-chip border border-line px-3 py-[7px] text-xs font-semibold hover:bg-canvas"
                  >
                    <Icon name="add" size={16} />
                    Add bus
                  </button>
                </div>

                <div className="grid grid-cols-[22px_104px_minmax(0,1fr)_minmax(0,1fr)_74px_28px] gap-2 pb-1.5 text-[10px] font-semibold tracking-[0.04em] text-faint">
                  <div>#</div>
                  <div>BUS</div>
                  <div>DRIVER</div>
                  <div>ATTENDANT</div>
                  <div>STUDENTS</div>
                  <div />
                </div>
                <div className="flex max-h-[220px] flex-col gap-2 overflow-auto">
                  {dialog.fleetRows.map((row, i) => (
                    <div
                      key={row.id}
                      className="grid grid-cols-[22px_104px_minmax(0,1fr)_minmax(0,1fr)_74px_28px] items-center gap-2"
                    >
                      <span className="font-mono text-[11.5px] text-faint">{pad(i + 1)}</span>
                      <select
                        aria-label={`Bus for row ${i + 1}`}
                        className={COMPACT}
                        value={row.bus}
                        onChange={(e) =>
                          dispatch({ type: "setFleetField", index: i, key: "bus", value: e.target.value })
                        }
                      >
                        <option value="">Bus</option>
                        {data.buses.map((b) => (
                          <option key={b.id} value={`Bus ${b.id}`}>{`Bus ${b.id}`}</option>
                        ))}
                      </select>
                      <select
                        aria-label={`Driver for row ${i + 1}`}
                        className={COMPACT}
                        value={row.driver}
                        onChange={(e) =>
                          dispatch({ type: "setFleetField", index: i, key: "driver", value: e.target.value })
                        }
                      >
                        <option value="">Driver</option>
                        {data.drivers.map((x) => (
                          <option key={x.id} value={x.name}>
                            {x.name}
                          </option>
                        ))}
                      </select>
                      <select
                        aria-label={`Attendant for row ${i + 1}`}
                        className={COMPACT}
                        value={row.attendant}
                        onChange={(e) =>
                          dispatch({ type: "setFleetField", index: i, key: "attendant", value: e.target.value })
                        }
                      >
                        <option value="">Attendant</option>
                        {data.attendants.map((x) => (
                          <option key={x.id} value={x.name}>
                            {x.name}
                          </option>
                        ))}
                      </select>
                      <input
                        aria-label={`Students for row ${i + 1}`}
                        className={`${COMPACT} font-mono`}
                        placeholder="38"
                        value={row.students}
                        onChange={(e) =>
                          dispatch({ type: "setFleetField", index: i, key: "students", value: e.target.value })
                        }
                      />
                      <MiniButton
                        icon="close"
                        title="Remove bus"
                        danger
                        onClick={() => dispatch({ type: "removeFleetRow", index: i })}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {pickerField ? (
              <div className="px-6 pb-5">
                <div className="flex items-center gap-2.5 border-t border-line-soft pb-2.5 pt-3.5">
                  <div className="flex-1">
                    <div className="text-[13px] font-semibold">{pickerField.label}</div>
                    <div className="mt-px text-[11.5px] text-faint">
                      From the students master. {picked.length}{" "}
                      {picked.length === 1 ? "student selected" : "students selected"} ·{" "}
                      {pickerRows.length} of {data.students.length} shown.
                    </div>
                  </div>
                </div>

                <div className="mb-2.5 flex flex-wrap items-center gap-2">
                  <div className="flex min-w-[180px] flex-1 items-center gap-2 rounded-[9px] border border-line px-[11px] focus-within:border-primary">
                    <Icon name="search" size={17} className="text-faint" />
                    <input
                      aria-label="Search students"
                      value={dialog.q}
                      onChange={(e) => dispatch({ type: "setPicker", patch: { q: e.target.value } })}
                      placeholder="Search name or class"
                      className="min-w-0 flex-1 border-0 bg-transparent py-[9px] text-[12.5px] text-ink outline-none placeholder:text-disabled"
                    />
                  </div>
                  <select
                    aria-label="Filter by class"
                    value={dialog.cls}
                    onChange={(e) => dispatch({ type: "setPicker", patch: { cls: e.target.value } })}
                    className="rounded-[9px] border border-line bg-surface px-[11px] py-[9px] text-[12.5px] text-ink outline-none focus:border-primary"
                  >
                    <option value="">All classes</option>
                    {classList.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-1.5">
                    {(
                      [
                        ["all", "All"],
                        ["selected", "Selected"],
                        ["unassigned", "Unassigned"],
                      ] as const
                    ).map(([id, label]) => {
                      const on = dialog.scope === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => dispatch({ type: "setPicker", patch: { scope: id } })}
                          className="rounded-[9px] border px-3 py-2 text-xs font-semibold"
                          style={{
                            background: on ? "#16181b" : "#fff",
                            color: on ? "#fff" : "#5f6672",
                            borderColor: on ? "#16181b" : "#e4e7eb",
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {pickerRows.length ? (
                  <div className="grid max-h-[220px] grid-cols-1 gap-2 overflow-auto sm:grid-cols-2">
                    {pickerRows.map((s) => {
                      const on = picked.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => dispatch({ type: "toggleStudent", id: s.id })}
                          className="flex items-center gap-2.5 rounded-control border px-[11px] py-[9px] text-left"
                          style={{ borderColor: on ? "#1a73e8" : "#e4e7eb", background: on ? "#f7faff" : "#fff" }}
                        >
                          <Icon
                            name={on ? "check_box" : "check_box_outline_blank"}
                            size={19}
                            style={{ color: on ? "#1a73e8" : "#a8aeb7" }}
                          />
                          <span className="grid size-[26px] shrink-0 place-items-center rounded-full bg-neutral-tint text-[11.5px] font-semibold text-muted">
                            {s.name.charAt(0)}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[12.5px] font-medium">{s.name}</span>
                            <span className="block text-[10.5px] text-faint">{s.cls}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-line p-[22px] text-center">
                    <div className="text-[12.5px] font-semibold">No students match</div>
                    <div className="mt-0.5 text-[11.5px] text-faint">
                      Clear the search or switch back to All.
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {dialog.stopRows ? (
              <div className="px-6 pb-5">
                <div className="flex flex-wrap items-center gap-2.5 border-t border-line-soft pb-2.5 pt-3.5">
                  <div className="min-w-[200px] flex-1">
                    <div className="text-[13px] font-semibold">Stops on this route</div>
                    <div className="mt-px text-[11.5px] text-faint">
                      Pick from the stops master. Times prefill and can be overridden per route.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      dispatch({
                        type: "setMaster",
                        patch: { masterOpen: !dialog.masterOpen, masterPicked: [], masterQ: "" },
                      })
                    }
                    className="focus-ring flex items-center gap-1.5 rounded-chip border border-line px-3 py-[7px] text-xs font-semibold hover:bg-canvas"
                  >
                    <Icon name="playlist_add" size={16} />
                    Add from master
                  </button>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: "addStopRow" })}
                    className="focus-ring flex items-center gap-1.5 rounded-chip border border-line px-3 py-[7px] text-xs font-semibold hover:bg-canvas"
                  >
                    <Icon name="add" size={16} />
                    Blank row
                  </button>
                </div>

                {dialog.masterOpen ? (
                  <div className="mb-3 rounded-xl border border-line bg-[#fafbfc] px-3.5 py-[13px]">
                    <div className="flex items-center gap-2">
                      <div className="flex min-w-0 flex-1 items-center gap-2 rounded-[9px] border border-line bg-surface px-[11px] focus-within:border-primary">
                        <Icon name="search" size={17} className="text-faint" />
                        <input
                          aria-label="Search the stops master"
                          value={dialog.masterQ}
                          onChange={(e) =>
                            dispatch({ type: "setMaster", patch: { masterQ: e.target.value } })
                          }
                          placeholder="Search the stops master"
                          className="min-w-0 flex-1 border-0 bg-transparent py-[9px] text-[12.5px] outline-none placeholder:text-disabled"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => dispatch({ type: "addPickedStops" })}
                        disabled={!dialog.masterPicked.length}
                        className="rounded-[9px] px-3.5 py-[9px] text-[12.5px] font-semibold"
                        style={{
                          background: dialog.masterPicked.length ? "#1a73e8" : "#f1f3f4",
                          color: dialog.masterPicked.length ? "#fff" : "#a8aeb7",
                        }}
                      >
                        {dialog.masterPicked.length
                          ? `Add ${dialog.masterPicked.length} ${dialog.masterPicked.length === 1 ? "stop" : "stops"}`
                          : "Select stops to add"}
                      </button>
                      <MiniButton
                        icon="close"
                        title="Close the stops master"
                        onClick={() => dispatch({ type: "setMaster", patch: { masterOpen: false } })}
                      />
                    </div>

                    {masterOptions.length ? (
                      <div className="mt-[11px] grid max-h-[200px] grid-cols-1 gap-2 overflow-auto sm:grid-cols-2">
                        {masterOptions.map((s) => {
                          const on = dialog.masterPicked.includes(s.name);
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => dispatch({ type: "toggleMasterStop", name: s.name })}
                              className="flex items-center gap-2.5 rounded-control border px-[11px] py-[9px] text-left"
                              style={{ borderColor: on ? "#1a73e8" : "#e4e7eb", background: on ? "#f7faff" : "#fff" }}
                            >
                              <Icon
                                name={on ? "check_box" : "check_box_outline_blank"}
                                size={19}
                                style={{ color: on ? "#1a73e8" : "#a8aeb7" }}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[12.5px] font-medium">{s.name}</span>
                                <span className="block truncate text-[10.5px] text-faint">
                                  {s.route || "Unassigned"}
                                </span>
                              </span>
                              <span className="shrink-0 font-mono text-[10.5px] text-faint">
                                {s.time || "—"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mt-[11px] rounded-control border border-dashed border-line bg-surface p-[18px] text-center">
                        <div className="text-[12.5px] font-semibold">Nothing left to add</div>
                        <div className="mt-0.5 text-[11.5px] text-faint">
                          Every matching stop is already on this route.
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}

                <div className="grid grid-cols-[26px_minmax(0,1fr)_96px_96px_84px] gap-2 pb-1.5 text-[10px] font-semibold tracking-[0.04em] text-faint">
                  <div>#</div>
                  <div>STOP NAME</div>
                  <div>PICKUP</div>
                  <div>DROP</div>
                  <div />
                </div>
                <div className="flex max-h-[240px] flex-col gap-2 overflow-auto">
                  {dialog.stopRows.map((row, i) => (
                    <div
                      key={row.id}
                      className="grid grid-cols-[26px_minmax(0,1fr)_96px_96px_84px] items-center gap-2"
                    >
                      <span className="font-mono text-[11.5px] text-faint">{pad(i + 1)}</span>
                      <select
                        aria-label={`Stop ${i + 1}`}
                        className={COMPACT}
                        value={row.name}
                        onChange={(e) =>
                          dispatch({ type: "setStopRowField", index: i, key: "name", value: e.target.value })
                        }
                      >
                        <option value="">Select a stop</option>
                        {stopMaster.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                      <input
                        aria-label={`Pickup time for stop ${i + 1}`}
                        className={`${COMPACT} font-mono`}
                        placeholder="7:05 AM"
                        value={row.time}
                        onChange={(e) =>
                          dispatch({ type: "setStopRowField", index: i, key: "time", value: e.target.value })
                        }
                      />
                      <input
                        aria-label={`Drop time for stop ${i + 1}`}
                        className={`${COMPACT} font-mono`}
                        placeholder="4:44 PM"
                        value={row.drop}
                        onChange={(e) =>
                          dispatch({ type: "setStopRowField", index: i, key: "drop", value: e.target.value })
                        }
                      />
                      <div className="flex justify-end gap-1">
                        <MiniButton
                          icon="arrow_upward"
                          title="Move stop earlier"
                          color={i === 0 ? "#dadce0" : "#5f6672"}
                          onClick={() => dispatch({ type: "moveStopRow", index: i, dir: -1 })}
                        />
                        <MiniButton
                          icon="arrow_downward"
                          title="Move stop later"
                          color={i === dialog.stopRows!.length - 1 ? "#dadce0" : "#5f6672"}
                          onClick={() => dispatch({ type: "moveStopRow", index: i, dir: 1 })}
                        />
                        <MiniButton
                          icon="close"
                          title="Remove stop"
                          danger
                          onClick={() => dispatch({ type: "removeStopRow", index: i })}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="sticky bottom-0 flex justify-end gap-2 border-t border-line-soft bg-surface px-6 pb-5 pt-4">
              <button
                type="button"
                onClick={() => dispatch({ type: "closeDialog" })}
                className="focus-ring rounded-[9px] border border-line px-4 py-2.5 text-[13px] font-semibold hover:bg-canvas"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => dispatch({ type: "save" })}
                className="focus-ring rounded-[9px] bg-primary px-[18px] py-2.5 text-[13px] font-semibold text-white hover:bg-primary-hover"
              >
                Save {entityLabel}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function Toast() {
  const { toast, dispatch } = useStore();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => dispatch({ type: "toast", message: "" }), 4000);
    return () => clearTimeout(t);
  }, [toast, dispatch]);

  if (!toast) return null;
  return (
    <button
      type="button"
      onClick={() => dispatch({ type: "toast", message: "" })}
      className="fixed bottom-[26px] left-1/2 z-[2000] flex -translate-x-1/2 items-center gap-2.5 rounded-xl bg-ink px-[18px] py-[13px] text-[13px] font-medium text-white"
      style={{ boxShadow: "0 12px 34px rgba(16,24,40,.28)" }}
    >
      <Icon name="check_circle" size={18} />
      {toast}
    </button>
  );
}
