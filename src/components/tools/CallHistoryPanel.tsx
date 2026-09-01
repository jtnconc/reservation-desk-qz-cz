import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { CallLogEntry } from "@/workspace/types";
import { CALL_HASHTAGS, PROPERTY_STYLES } from "@/lib/property-codes";
import { cn } from "@/lib/utils";
import { sanitizeHtml } from "@/lib/sanitize-html";

interface CallHistoryPanelProps {
  entries: CallLogEntry[];
}

/**
 * Sidebar panel showing the isolated Call History log (separate from the
 * general Notes widget), with search + hashtag + date-range filters.
 */
export function CallHistoryPanel({ entries }: CallHistoryPanelProps) {
  const [query, setQuery] = useState("");
  const [hashtagFilter, setHashtagFilter] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (hashtagFilter && !e.hashtags.includes(hashtagFilter)) return false;
      const day = e.savedAtISO.slice(0, 10);
      if (dateFrom && day < dateFrom) return false;
      if (dateTo && day > dateTo) return false;
      if (q && !e.text.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [entries, query, hashtagFilter, dateFrom, dateTo]);

  const hasActiveFilters = !!hashtagFilter || !!dateFrom || !!dateTo || !!query.trim();

  return (
    <aside className="flex w-72 shrink-0 flex-col overflow-hidden border-l border-border pl-4">
      <p className="label-xs mb-2">Call History</p>

      <div className="mb-3 flex shrink-0 flex-col gap-2">
        <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-1.5">
          <Search className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search call details"
            className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {CALL_HASHTAGS.map((tag) => {
            const active = hashtagFilter === tag;
            return (
              <button
                key={tag}
                type="button"
                onClick={() => setHashtagFilter(active ? null : tag)}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10.5px] font-medium transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-surface-2 text-muted-foreground hover:text-foreground",
                )}
              >
                {tag}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            aria-label="From date"
            className="min-w-0 flex-1 rounded-md border border-border bg-surface-2 px-1.5 py-1 text-[11px] text-foreground outline-none"
          />
          <span className="text-[10px] text-muted-foreground">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            aria-label="To date"
            className="min-w-0 flex-1 rounded-md border border-border bg-surface-2 px-1.5 py-1 text-[11px] text-foreground outline-none"
          />
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setHashtagFilter(null);
              setDateFrom("");
              setDateTo("");
            }}
            className="self-start text-[11px] text-muted-foreground hover:text-foreground"
          >
            Clear filters
          </button>
        )}
      </div>

      <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
        {filtered.length === 0 && (
          <li className="text-[12px] text-muted-foreground">
            {entries.length === 0 ? "No calls logged yet." : "No calls match these filters."}
          </li>
        )}
        {filtered.map((e) => {
          const style = PROPERTY_STYLES[e.property];
          return (
            <li key={e.id} className="rounded-xl bg-surface-2 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span
                  className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{ backgroundColor: style.hex, color: style.fg }}
                >
                  {style.code}
                </span>
                <p className="font-mono text-[10.5px] text-muted-foreground">{e.savedAt}</p>
              </div>
              <div
                className="notes-rich mt-1.5 line-clamp-2 text-[12px]"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(e.html) }}
              />
              {e.hashtags.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {e.hashtags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                      style={{ backgroundColor: `${style.hex}33`, color: style.hex }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <button
                onClick={() => setPreview(preview === e.id ? null : e.id)}
                className="mt-1.5 text-[11px] text-muted-foreground hover:text-foreground"
              >
                {preview === e.id ? "Hide" : "View"}
              </button>
              {preview === e.id && (
                <div
                  className="notes-rich mt-2 text-[11.5px] leading-snug"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(e.html) }}
                />
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
