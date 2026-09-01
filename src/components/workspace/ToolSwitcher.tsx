import { useWorkspace } from "@/workspace/store";
import type { ToolId } from "@/workspace/types";
import { cn } from "@/lib/utils";

const TOOLS: { id: ToolId; label: string }[] = [
  { id: "notes", label: "Notes" },
  { id: "quote", label: "Quote" },
  { id: "rates", label: "Rates" },
];

export function ToolSwitcher() {
  const { activeTool, mode, openTool } = useWorkspace();

  return (
    <div className="flex items-center gap-1 rounded-full border border-border bg-surface p-1 shadow-desk">
      {TOOLS.map((t) => {
        const active = mode === "tool" && activeTool === t.id;
        return (
          <button
            key={t.id}
            onClick={() => openTool(t.id)}
            className={cn(
              "rounded-full px-4 py-1.5 text-[13px] font-medium tracking-wide transition-all duration-300",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            {t.label.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
