import { useEffect, useRef, useState } from "react";
import type { WidgetSize } from "@/workspace/types";
import { cn } from "@/lib/utils";

const SIZES: WidgetSize[] = ["1x1", "1x2", "2x1"];

/** Graphical mini-glyph of a widget size (no text). */
function SizeGlyph({ size, active }: { size: WidgetSize; active: boolean }) {
  const [w, h] = size.split("x").map(Number) as [number, number];
  return (
    <span
      className={cn(
        "block rounded-[2px] transition-colors",
        active ? "bg-foreground/70" : "bg-muted-foreground/35",
      )}
      style={{ width: w * 5 + (w - 1) * 1, height: h * 5 + (h - 1) * 1 }}
    />
  );
}

/**
 * Inline size selector: a single dot that expands into three mini-glyphs
 * inside the widget header itself (no popup / overlay).
 */
export function SizeControl({
  value,
  onChange,
}: {
  value: WidgetSize;
  onChange: (size: WidgetSize) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const stop = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      ref={ref}
      onClick={stop}
      onPointerDown={stop}
      onDragStart={(e) => e.preventDefault()}
      className="flex shrink-0 items-center"
    >
      {open ? (
        <div className="flex items-center gap-1.5">
          {SIZES.map((s) => (
            <button
              key={s}
              type="button"
              aria-label={s}
              onClick={(e) => {
                e.stopPropagation();
                onChange(s);
                setOpen(false);
              }}
              className="flex size-[18px] items-center justify-center rounded-[5px] transition-colors hover:bg-secondary"
            >
              <SizeGlyph size={s} active={s === value} />
            </button>
          ))}
        </div>
      ) : (
        <button
          type="button"
          aria-label="Widget size"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          className="flex size-4 items-center justify-center rounded-full text-muted-foreground/50 transition-colors hover:text-foreground"
        >
          <span className="size-[5px] rounded-full bg-current" />
        </button>
      )}
    </div>
  );
}
