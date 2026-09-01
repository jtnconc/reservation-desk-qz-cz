import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceProvider, useWorkspace } from "@/workspace/store";
import { WorkspaceHeader } from "@/components/workspace/WorkspaceHeader";
import { WidgetGrid } from "@/components/workspace/WidgetGrid";
import { NotesTool } from "@/components/tools/NotesTool";
import { RatesTool } from "@/components/tools/RatesTool";
import { QuoteTool } from "@/components/tools/QuoteTool";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Reservation Workspace — Hotel reservation desk" },
      {
        name: "description",
        content:
          "A calm digital desk for hotel reservation agents: intelligent notes, senior rate calculator and PDF quotations in one transforming workspace.",
      },
      { property: "og:title", content: "Reservation Workspace" },
      {
        property: "og:description",
        content:
          "Write, recognize, save and quote — one workspace that transforms around the reservation you are working on.",
      },
    ],
  }),
  component: WorkspacePage,
});

function WorkspacePage() {
  const [quotePreview, setQuotePreview] = useState(false);
  const [quoteHistory, setQuoteHistory] = useState(false);

  return (
    <WorkspaceProvider>
      <div className="flex min-h-screen w-full flex-col bg-background">
        <WorkspaceHeader
          quotePreview={quotePreview}
          onToggleQuotePreview={() => setQuotePreview((v) => !v)}
          quoteHistoryOpen={quoteHistory}
          onToggleQuoteHistory={() => setQuoteHistory((v) => !v)}
        />
        <main className="mx-auto flex w-full max-w-[1240px] min-h-0 flex-1 flex-col px-5 pb-3 pt-0">
          <Workspace quotePreview={quotePreview} quoteHistory={quoteHistory} />
        </main>
        <Toaster position="bottom-right" />
      </div>
    </WorkspaceProvider>
  );
}

function Workspace({
  quotePreview,
  quoteHistory,
}: {
  quotePreview: boolean;
  quoteHistory: boolean;
}) {
  const { mode, activeTool } = useWorkspace();
  const toolMode = mode === "tool";

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-2">
      {/* Tool area — expands in tool mode, retracts fully in widget mode */}
      <section
        className={cn(
          "desk-panel min-w-0 overflow-hidden transition-all duration-500 ease-[var(--ease-desk)]",
          toolMode
            ? "flex min-h-[calc(100vh-6.5rem)] flex-1 flex-col p-4 opacity-100 sm:p-6"
            : "pointer-events-none max-h-0 border-0 p-0 opacity-0 shadow-none",
        )}
        aria-hidden={!toolMode}
      >
        {toolMode && (
          <div className="flex min-h-0 flex-1 flex-col">
            {activeTool === "notes" && <NotesTool />}
            {activeTool === "rates" && <RatesTool />}
            {activeTool === "quote" && (
              <QuoteTool showPreview={quotePreview} showHistory={quoteHistory} />
            )}
          </div>
        )}
      </section>

      <WidgetGrid />
    </div>
  );
}

