import { Card } from "@/components/transport/ui";

export const metadata = {
  title: "Route Optimization — Transport OS",
};

/**
 * Route Optimization is deliberately unbuilt (README §10). The page stays a
 * preview with disabled controls so the nav item has somewhere to land.
 */

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
    </div>
  );
}
