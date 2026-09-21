"use client";

/** On-screen numeric keypad shared by both mobile login flows (B1, C1). */
export function Keypad({ onPress }: { onPress: (key: string) => void }) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"];

  return (
    <div className="mt-auto grid grid-cols-3 gap-2 pt-6 sm:gap-[9px]">
      {keys.map((k, i) =>
        k === "" ? (
          <div key={`gap-${i}`} aria-hidden />
        ) : (
          <button
            key={k}
            type="button"
            aria-label={k === "back" ? "Delete" : k}
            onClick={() => onPress(k)}
            className="min-h-12 select-none rounded-[14px] bg-canvas py-[15px] text-center font-mono text-xl font-semibold text-ink hover:bg-line-soft active:bg-line"
          >
            {k === "back" ? "⌫" : k}
          </button>
        ),
      )}
    </div>
  );
}
