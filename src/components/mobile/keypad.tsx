"use client";

/*
 * On-screen numeric keypad shared by both mobile login flows (B1, C1).
 *
 * Sized in `vh` between a floor and a ceiling: a browser on a short phone eats
 * ~200px for its own URL bar and toolbar, and a keypad fixed at its comfortable
 * size pushes the sign-in button off the bottom of the screen. The floor keeps
 * the keys thumb-sized; the ceiling stops them ballooning on a tall device.
 */
export function Keypad({ onPress }: { onPress: (key: string) => void }) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"];

  return (
    <div className="mt-auto grid grid-cols-3 gap-[clamp(5px,1vh,9px)] pt-[clamp(8px,2.4vh,26px)]">
      {keys.map((k, i) =>
        k === "" ? (
          <div key={`gap-${i}`} aria-hidden />
        ) : (
          <button
            key={k}
            type="button"
            aria-label={k === "back" ? "Delete" : k}
            onClick={() => onPress(k)}
            className="min-h-[clamp(38px,6.5vh,58px)] select-none rounded-[14px] bg-canvas py-[clamp(7px,1.5vh,15px)] text-center font-mono text-[clamp(16px,2.4vh,20px)] font-semibold text-ink hover:bg-line-soft active:bg-line"
          >
            {k === "back" ? "⌫" : k}
          </button>
        ),
      )}
    </div>
  );
}
