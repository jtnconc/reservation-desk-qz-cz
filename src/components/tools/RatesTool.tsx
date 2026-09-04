import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { calculateSeniorRate, money } from "@/lib/rates";
import { todayISO } from "@/lib/quote-model";
import { DateRangeField } from "@/components/common/DateRangeField";
import { cn } from "@/lib/utils";



function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label-xs">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-xl border border-border bg-surface px-3 py-2 text-center font-mono text-[13px] outline-none transition-colors focus:border-ring [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

/** Distinctive highlight for the key "Regular rate" input. */
const rateInputCls = cn(
  inputCls,
  "border-entity-date/40 bg-entity-date-bg/70 font-semibold text-entity-date focus:border-entity-date",
);

const addDaysISO = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
};

export function RatesTool() {
  const today = todayISO();
  const [arrival, setArrival] = useState(today);
  const [departure, setDeparture] = useState(addDaysISO(today, 3));
  const [regularRate, setRegularRate] = useState(0);
  const [paxExtra, setPaxExtra] = useState(0);
  const [paxExtraRate] = useState(25);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const result = useMemo(
    () =>
      calculateSeniorRate({
        arrival,
        departure,
        regularRate,
        paxExtra,
        paxExtraRate,
        taxRate: 0.1,
      }),
    [arrival, departure, regularRate, paxExtra, paxExtraRate],
  );

  const groupedRates = useMemo(() => {
    const groups = new Map<string, { count: number; total: number }>();
    for (const n of result.nights) {
      const g = groups.get(n.ruleLabel) ?? { count: 0, total: 0 };
      g.count += 1;
      g.total += n.rate;
      groups.set(n.ruleLabel, g);
    }
    return Array.from(groups.entries()).map(([label, g]) => ({
      label,
      count: g.count,
      avg: g.count ? g.total / g.count : 0,
    }));
  }, [result.nights]);

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <DateRangeField
          start={arrival}
          end={departure}
          startLabel="Arrival"
          endLabel="Departure"
          onChange={({ start, end }) => {
            if (start) setArrival(start);
            setDeparture(end ?? "");
          }}
          renderField={(text, control) => (
            <Field key={text} label={text}>
              {control}
            </Field>
          )}
        />

        <Field label="Regular rate">
          <input
            type="number"
            value={regularRate || ""}
            placeholder="0"
            onChange={(e) => setRegularRate(Number(e.target.value))}
            className={cn(rateInputCls, "number-input-clean")}
          />
        </Field>
        <Field label="Pax extra">
          <input
            type="number"
            min={0}
            value={paxExtra || ""}
            placeholder="0"
            onChange={(e) => setPaxExtra(Number(e.target.value))}
            className={cn(inputCls, "number-input-clean")}
          />
        </Field>
        <Field label="Pax extra rate">
          <input
            type="number"
            value={paxExtraRate}
            readOnly
            className={cn(
              inputCls,
              "number-input-clean cursor-default bg-surface-2 text-muted-foreground",
            )}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Rate per night", value: money(result.avgPerNight), valueClass: "text-badge-weekday-text" },
          { label: "Nights", value: result.nightCount.toString(), valueClass: "text-foreground" },
          { label: "Total stay", value: money(result.totalStay) },
          { label: "Total + ITBMS", value: money(result.totalWithTax), valueClass: "text-entity-phone" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-surface-2 p-4">
            <p className="label-xs">{s.label}</p>
            <p className={cn("mt-1 font-mono text-[17px] tracking-tight", s.valueClass)}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border">
        <button
          type="button"
          onClick={() => setShowBreakdown((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2"
        >
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-medium">
              View daily breakdown ({result.nightCount} nights)
            </span>
            {!showBreakdown &&
              groupedRates.map((g) => {
                const isWeekday = g.label.includes("Lun-Jue");
                return (
                  <span
                    key={g.label}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-tight",
                      isWeekday
                        ? "bg-badge-weekday-bg text-badge-weekday-text"
                        : "bg-badge-weekend-bg text-badge-weekend-text",
                    )}
                  >
                    {g.label} · {g.count}n avg {money(g.avg)}
                  </span>
                );
              })}
            {!showBreakdown && groupedRates.length === 0 && (
              <span className="text-[13px] text-muted-foreground">
                Select an arrival and a later departure date.
              </span>
            )}
          </span>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              showBreakdown && "rotate-180",
            )}
          />
        </button>

        {showBreakdown && (
          <div className="min-h-0 flex-1 overflow-auto border-t border-border">
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 bg-surface-2">
                <tr>
                  {["Date", "Day", "Discount", "Rate"].map((h) => (
                    <th key={h} className="label-xs px-4 py-2.5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.nights.map((n) => {
                  const isWeekday = n.ruleLabel.includes("Lun-Jue");
                  return (
                    <tr key={n.date} className="border-t border-border">
                      <td className="px-4 py-2.5 font-mono text-[13px]">{n.date}</td>
                      <td className="px-4 py-2.5 text-[13px]">{n.day}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-tight",
                            isWeekday
                              ? "bg-badge-weekday-bg text-badge-weekday-text"
                              : "bg-badge-weekend-bg text-badge-weekend-text",
                          )}
                        >
                          {n.ruleLabel}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[13px]">{money(n.rate)}</td>
                    </tr>
                  );
                })}
                {result.nights.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-[13px] text-muted-foreground">
                      Select an arrival and a later departure date.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
