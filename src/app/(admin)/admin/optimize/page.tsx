import { Card, Icon, Mono } from "@/components/transport/ui";

export const metadata = {
  title: "Route Optimization — Transport OS",
};

/**
 * Route Optimization is deliberately unbuilt (README §10). The page stays a
 * preview with disabled controls so the nav item has somewhere to land.
 */

const FEATURES = [
  { icon: "auto_awesome", title: "AI route suggestions", body: "Proposed route changes ranked by time and distance saved." },
  { icon: "low_priority", title: "Smart stop sequencing", body: "Reorder stops to cut backtracking across each zone." },
  { icon: "balance", title: "Bus capacity balancing", body: "Even out student load between under- and over-filled buses." },
  { icon: "timer", title: "Travel time reduction", body: "Model traffic patterns by time of day before publishing." },
  { icon: "savings", title: "Operational cost reduction", body: "Estimate fuel and staffing impact of every change." },
];

const SAVINGS = [
  { value: "— km", label: "distance saved per day" },
  { value: "— min", label: "travel time reduced per day" },
  { value: "— %", label: "operational cost reduction" },
];

export default function RouteOptimizationPage() {
  return (
    <div className="flex max-w-[1080px] flex-col gap-[18px]">
      <Card className="px-[30px] py-7">
        <span className="inline-block rounded-md bg-neutral-tint px-2 py-1 text-[9.5px] font-bold tracking-[0.08em] text-muted">
          COMING SOON
        </span>
        <h2 className="mt-3.5 text-[28px] font-semibold tracking-[-0.025em]">Route optimization</h2>
        <p className="mt-2 max-w-[620px] text-sm leading-[1.6] text-muted text-pretty">
          AI-powered route planning will analyse student locations, bus capacity, stop sequences and
          travel time to suggest more efficient routes. Nothing changes until you approve a
          suggestion.
        </p>
        <button
          type="button"
          disabled
          className="mt-[22px] cursor-not-allowed rounded-control bg-neutral-tint px-5 py-[11px] text-[13px] font-semibold text-faint"
        >
          Coming soon
        </button>
      </Card>

      <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]">
        {FEATURES.map((f) => (
          <Card key={f.title} className="px-5 py-[18px] opacity-[0.78]">
            <span className="grid size-[30px] place-items-center rounded-[9px] bg-neutral-tint text-faint">
              <Icon name={f.icon} size={18} />
            </span>
            <div className="mt-3 text-[13.5px] font-semibold text-ink-2">{f.title}</div>
            <p className="mt-1 text-xs leading-[1.5] text-faint text-pretty">{f.body}</p>
          </Card>
        ))}
      </div>

      <div className="rounded-card border border-dashed border-[#dadce0] bg-surface px-6 py-[22px]">
        <div className="text-[13.5px] font-semibold text-muted">Potential savings</div>
        <div className="mt-4 grid gap-5 sm:grid-cols-3">
          {SAVINGS.map((s) => (
            <div key={s.label}>
              <Mono
                className="block text-[32px] font-medium tracking-[-0.03em]"
                style={{ color: "#c9ced6" }}
              >
                {s.value}
              </Mono>
              <div className="text-[11.5px] text-faint">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="mt-[18px] text-[11.5px] text-faint">
          Preview based on future optimization capabilities.
        </div>
      </div>
    </div>
  );
}
