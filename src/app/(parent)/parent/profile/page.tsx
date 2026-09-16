"use client";

import { useState } from "react";
import { ConfirmSheet } from "@/components/mobile/shell";
import { Icon, Mono } from "@/components/transport/ui";
import {
  CHILDREN,
  PARENT,
  PARENT_CONTACTS,
  PREFERENCE_ROWS,
  formatPhone,
} from "@/lib/transport/parent";
import { useParent } from "@/lib/transport/parent-store";

/** B7 — guardian profile, children, contacts, notification preferences. */
export default function ParentProfilePage() {
  const { phone, prefs, togglePref, signOut } = useParent();
  const [confirming, setConfirming] = useState(false);

  const accountRows = [
    { icon: "translate", label: "Language", value: "English" },
    { icon: "lock", label: "Registered number", value: `+91 ${formatPhone(phone)}` },
    { icon: "help", label: "Help and support", value: "" },
  ];

  return (
    <>
      <div className="px-5 pb-6 pt-3.5">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Profile</h1>

        <div className="mt-4 flex items-center gap-3.5 rounded-[20px] border border-line p-[18px]">
          <span className="grid size-[52px] shrink-0 place-items-center rounded-full bg-primary text-[19px] font-semibold text-white">
            {PARENT.initials}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[17px] font-semibold tracking-[-0.015em]">
              {PARENT.name}
            </div>
            <Mono className="mt-0.5 block text-[12.5px] text-faint">
              +91 {formatPhone(phone)}
            </Mono>
            <span className="mt-[7px] inline-block rounded-pill bg-primary-tint px-[9px] py-[3px] text-[11px] font-semibold text-primary-hover">
              Primary guardian
            </span>
          </div>
        </div>

        <SectionLabel>CHILDREN</SectionLabel>
        <div className="mt-2.5 flex flex-col gap-2.5">
          {CHILDREN.map((c) => (
            <div key={c.first} className="rounded-[18px] border border-line px-4 py-[15px]">
              <div className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-neutral-tint text-sm font-semibold text-muted">
                  {c.initial}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{c.name}</div>
                  <div className="text-xs text-faint">
                    {c.cls} · Roll {c.roll}
                  </div>
                </div>
              </div>
              <div className="mt-[13px] grid grid-cols-2 gap-2.5 border-t border-line-rule pt-[13px]">
                <div>
                  <div className="text-[10.5px] text-faint">BUS</div>
                  <Mono className="text-[12.5px] font-semibold">{c.bus}</Mono>
                </div>
                <div className="min-w-0">
                  <div className="text-[10.5px] text-faint">STOP</div>
                  <div className="truncate text-[12.5px] font-semibold">{c.stop}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <SectionLabel>CONTACTS</SectionLabel>
        <div className="mt-2.5 overflow-hidden rounded-[18px] border border-line">
          {PARENT_CONTACTS.map((c) => (
            <div key={c.name} className="flex items-center gap-3 border-b border-line-rule px-4 py-3.5">
              <span className="grid size-[34px] shrink-0 place-items-center rounded-[11px] bg-canvas text-muted">
                <Icon name={c.icon} size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold">{c.name}</div>
                <div className="truncate text-[11.5px] text-faint">{c.role}</div>
              </div>
              <a
                href={`tel:${c.phone.replace(/\s/g, "")}`}
                aria-label={`Call ${c.name}`}
                className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-success-tint text-success-text"
              >
                <Icon name="call" size={18} />
              </a>
            </div>
          ))}
        </div>

        <SectionLabel>PREFERENCES</SectionLabel>
        <div className="mt-2.5 overflow-hidden rounded-[18px] border border-line">
          {PREFERENCE_ROWS.map((p) => {
            const on = prefs[p.id];
            return (
              <button
                key={p.id}
                type="button"
                role="switch"
                aria-checked={on}
                onClick={() => togglePref(p.id)}
                className="flex w-full items-center gap-3 border-b border-line-rule px-4 py-[15px] text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-medium">{p.label}</span>
                  <span className="mt-px block text-[11.5px] text-faint">{p.sub}</span>
                </span>
                <span
                  className="flex h-[25px] w-[42px] shrink-0 rounded-pill p-[3px] transition-colors"
                  style={{
                    background: on ? "#1a73e8" : "#dadce0",
                    justifyContent: on ? "flex-end" : "flex-start",
                  }}
                >
                  <span className="size-[19px] rounded-full bg-white shadow-[0_1px_3px_rgba(16,24,40,.25)]" />
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 overflow-hidden rounded-[18px] border border-line">
          {accountRows.map((r) => (
            <div
              key={r.label}
              className="flex items-center gap-3 border-b border-line-rule px-4 py-[15px] hover:bg-[#fafbfc]"
            >
              <Icon name={r.icon} size={19} className="text-muted" />
              <div className="flex-1 text-[13.5px] font-medium">{r.label}</div>
              <div className="text-xs text-faint">{r.value}</div>
              <Icon name="chevron_right" size={19} style={{ color: "#c4c8ce" }} />
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-[18px] w-full rounded-[15px] border border-critical-line py-[15px] text-center text-sm font-semibold text-critical-text hover:bg-critical-tint"
        >
          Log out
        </button>
        <Mono className="mt-3 block text-center text-[11px] text-disabled">
          Bharath Vidya Mandir · v2.4.1
        </Mono>
      </div>

      {confirming ? (
        <ConfirmSheet
          title="Log out of Bharath Vidya Mandir?"
          body="You will stop receiving bus alerts on this device until you sign in again with your registered number."
          confirmLabel="Log out"
          cancelLabel="Stay signed in"
          onConfirm={signOut}
          onCancel={() => setConfirming(false)}
        />
      ) : null}
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-5 text-[11px] font-semibold tracking-[0.06em] text-faint">{children}</div>
  );
}
