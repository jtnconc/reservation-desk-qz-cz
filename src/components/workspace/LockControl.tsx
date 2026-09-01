import { Lock, Unlock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Inline height-lock toggle shown in the widget header next to the size
 * selector. When active, the card's current height is pinned and any
 * overflowing content scrolls internally instead of expanding the card.
 */
export function LockControl({
  locked,
  onToggle,
}: {
  locked: boolean;
  onToggle: () => void;
}) {
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <button
      type="button"
      aria-label={locked ? "Unlock card height" : "Lock card height"}
      aria-pressed={locked}
      title={locked ? "Unlock card height" : "Lock card height"}
      onPointerDown={stop}
      onDragStart={(e) => e.preventDefault()}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-full transition-colors",
        locked ? "text-foreground" : "text-muted-foreground/50 hover:text-foreground",
      )}
    >
      {locked ? <Lock className="size-[11px]" /> : <Unlock className="size-[11px]" />}
    </button>
  );
}
