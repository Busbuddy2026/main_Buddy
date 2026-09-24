"use client";

import Link from "next/link";
import { useState } from "react";
import { FEATURE_GROUPS, PLANS, type PlanId } from "@/lib/marketing/content";

/** Pricing plan cards. Selecting one inverts it to paper. */
export function PlanCards() {
  const [selected, setSelected] = useState<PlanId>("smart");

  return (
    <div
      role="radiogroup"
      aria-label="Parent plans"
      className="grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-[18px]"
    >
      {PLANS.map((p) => {
        const on = selected === p.id;
        const card = on
          ? "border-bb-paper bg-bb-paper text-bb-ink"
          : "border-bb-line-2 bg-bb-surface text-bb-text";
        const muted = on ? "text-bb-paper-eyebrow" : "text-bb-muted-2";
        const cta = on
          ? "border-bb-ink bg-bb-ink text-bb-paper hover:bg-bb-ink hover:text-bb-paper"
          : "border-bb-text bg-bb-text text-bb-bg hover:bg-bb-text-2 hover:text-bb-bg";

        return (
          <div
            key={p.id}
            className={`flex flex-col rounded-[20px] border p-[30px] transition-transform duration-[250ms] hover:-translate-y-1 ${card}`}
          >
            {/*
              The selectable surface is its own button, so the plan CTA below is
              not an interactive element nested inside another one.
            */}
            <button
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setSelected(p.id)}
              className="flex-1 text-left"
            >
              <span className="flex flex-wrap items-center justify-between gap-2.5">
                <span className="text-[19px] font-semibold tracking-[-0.02em]">{p.name}</span>
                <span
                  className={`font-code text-[9.5px] uppercase tracking-[0.16em] ${muted}`}
                >
                  {p.badge}
                </span>
              </span>

              <span className="mt-5 flex items-baseline gap-[7px]">
                <span className="font-code text-[42px] font-bold tracking-[-0.04em]">
                  ₹{p.price}
                </span>
                <span className={`text-[12.5px] ${muted}`}>/ student / month</span>
              </span>

              <span className={`mt-4 block text-[13.5px] font-light leading-[1.65] ${muted}`}>
                {p.pitch}
              </span>

              <span className="mt-[22px] flex flex-col gap-2.5">
                {p.highlights.map((h) => (
                  <span key={h} className="flex items-start gap-[11px] text-[13.5px]">
                    <span aria-hidden className="mt-px shrink-0">
                      ✓
                    </span>
                    <span>{h}</span>
                  </span>
                ))}
              </span>
            </button>

            <Link
              href="/contact"
              className={`mt-[26px] inline-flex w-full items-center justify-center rounded-full border px-4 py-[13px] text-[13.5px] font-semibold ${cta}`}
            >
              {p.cta}
            </Link>
          </div>
        );
      })}
    </div>
  );
}

const COLS = ["Basic", "Smart", "Safety+"] as const;
const PRICES = ["₹129", "₹149", "₹199"] as const;

/** Full comparison table, with an "only what differs" filter. */
export function FeatureTable() {
  const [diffOnly, setDiffOnly] = useState(false);

  const groups = FEATURE_GROUPS.map((g) => ({
    name: g.name,
    rows: g.rows.filter((r) => !diffOnly || !(r[1] === r[2] && r[2] === r[3])),
  })).filter((g) => g.rows.length > 0);

  const filterBtn =
    "rounded-full border px-[15px] py-2 text-[12.5px] font-semibold hover:border-bb-hover-2";

  return (
    <>
      <div className="mb-[22px] flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-[26px] font-semibold tracking-[-0.03em]">Full feature comparison</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setDiffOnly(false)}
            aria-pressed={!diffOnly}
            className={`${filterBtn} ${diffOnly ? "border-bb-edge-2 text-bb-text" : "border-bb-text text-bb-text"}`}
          >
            All features
          </button>
          <button
            type="button"
            onClick={() => setDiffOnly(true)}
            aria-pressed={diffOnly}
            className={`${filterBtn} ${diffOnly ? "border-bb-text text-bb-text" : "border-bb-edge-2 text-bb-text"}`}
          >
            Only differences
          </button>
          <span className="font-code text-[10.5px] text-bb-eyebrow" aria-live="polite">
            {diffOnly ? "differences only" : "all features"}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-[18px] border border-bb-line-2">
        <table className="w-full min-w-[620px] border-collapse text-left">
          <caption className="sr-only">
            Capabilities included in the Basic, Smart and Safety+ parent plans
          </caption>
          <thead>
            <tr className="border-b border-bb-line-2 bg-bb-raised-2">
              <th
                scope="col"
                className="px-5 py-4 font-code text-[10px] font-medium uppercase tracking-[0.16em] text-bb-muted-3"
              >
                Capability
              </th>
              {COLS.map((c, i) => (
                <th
                  scope="col"
                  key={c}
                  className="w-[108px] px-2 py-4 text-center text-[13px] font-semibold"
                >
                  {c}
                  <span className="block font-code text-[10.5px] font-medium text-bb-muted-3">
                    {PRICES[i]}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g.name}>
              <tr>
                <th
                  scope="colgroup"
                  colSpan={4}
                  className="border-b border-[#1a1d20] bg-bb-raised-2 px-5 py-[11px] text-left font-code text-[10px] font-medium uppercase tracking-[0.18em] text-bb-muted"
                >
                  {g.name}
                </th>
              </tr>
              {g.rows.map((r) => (
                <tr key={r[0]} className="border-b border-[#141719] hover:bg-bb-raised">
                  <th
                    scope="row"
                    className="px-5 py-[13px] text-[13.5px] font-normal text-bb-text-2"
                  >
                    {r[0]}
                  </th>
                  {[r[1], r[2], r[3]].map((v, i) => (
                    <td
                      key={COLS[i]}
                      className={`px-2 py-[13px] text-center text-[14px] ${
                        v ? "text-bb-text" : "text-bb-hover"
                      }`}
                    >
                      <span aria-hidden>{v ? "✓" : "—"}</span>
                      <span className="sr-only">
                        {v ? `Included in ${COLS[i]}` : `Not in ${COLS[i]}`}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </>
  );
}
