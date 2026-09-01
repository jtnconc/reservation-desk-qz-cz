import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger, PopoverAnchor } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { parseISODate, toISO } from "@/components/common/DateField";

const MONTHS_ES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

function label(value?: string) {
  const d = parseISODate(value);
  if (!d) return null;
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS_ES[d.getMonth()]} ${d.getFullYear()}`;
}

interface TriggerProps {
  value?: string | undefined;
  placeholder: string;
  size: "default" | "sm";
  active: boolean;
  onClick: () => void;
  ariaLabel: string;
}

function FieldButton({ value, placeholder, size, active, onClick, ariaLabel }: TriggerProps) {
  const text = label(value);
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-xl border bg-surface text-left font-mono outline-none transition-colors hover:border-ring",
        active ? "border-ring" : "border-border",
        size === "sm" ? "px-2 py-1 text-[11px]" : "px-3 py-2 text-[13px]",
        !text && "text-muted-foreground",
      )}
    >
      <CalendarIcon className={size === "sm" ? "size-3 shrink-0" : "size-3.5 shrink-0"} />
      <span className="truncate">{text ?? placeholder}</span>
    </button>
  );
}

interface DateRangeFieldProps {
  start?: string | undefined;
  end?: string | undefined;
  onChange: (range: { start?: string | undefined; end?: string | undefined }) => void;
  startLabel: string;
  endLabel: string;
  size?: "default" | "sm";
  /** wrapper for each field (label + button) */
  renderField?: (labelText: string, control: React.ReactNode) => React.ReactNode;
}

/**
 * Single range calendar driving both Arrival and Departure inputs.
 * First click sets the start date, second click sets the end date.
 */
export function DateRangeField({
  start,
  end,
  onChange,
  startLabel,
  endLabel,
  size = "default",
  renderField,
}: DateRangeFieldProps) {
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState<"start" | "end">("start");
  /** "start" = next click begins a new range, "end" = next click closes it */
  const [phase, setPhase] = useState<"start" | "end">("start");
  const [draft, setDraft] = useState<DateRange | undefined>(undefined);

  const selected: DateRange | undefined =
    draft ??
    (parseISODate(start) ? { from: parseISODate(start)!, to: parseISODate(end) } : undefined);

  const openWith = (which: "start" | "end") => {
    setFocus(which);
    setPhase("start");
    setDraft(undefined);
    setOpen(true);
  };

  const handleDayClick = (day: Date) => {
    const iso = toISO(day);
    if (phase === "start" || !draft?.from || day < draft.from) {
      setDraft({ from: day, to: undefined });
      setPhase("end");
      setFocus("end");
      onChange({ start: iso, end: undefined });
      return;
    }
    setDraft({ from: draft.from, to: day });
    setPhase("start");
    onChange({ start: toISO(draft.from), end: iso });
    setOpen(false);
  };


  const wrap = (text: string, control: React.ReactNode) =>
    renderField ? (
      renderField(text, control)
    ) : (
      <label className="flex flex-col gap-1.5">
        <span className="label-xs">{text}</span>
        {control}
      </label>
    );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {wrap(
        startLabel,
        <PopoverAnchor asChild>
          <div>
            <PopoverTrigger asChild>
              <div>
                <FieldButton
                  value={start}
                  placeholder={startLabel}
                  size={size}
                  active={open && focus === "start"}
                  onClick={() => openWith("start")}
                  ariaLabel={startLabel}
                />
              </div>
            </PopoverTrigger>
          </div>
        </PopoverAnchor>,
      )}
      {wrap(
        endLabel,
        <FieldButton
          value={end}
          placeholder={endLabel}
          size={size}
          active={open && focus === "end"}
          onClick={() => openWith("end")}
          ariaLabel={endLabel}
        />,
      )}
      <PopoverContent align="start" className="w-auto rounded-xl p-0">
        <Calendar
          mode="range"
          numberOfMonths={1}
          selected={selected}
          defaultMonth={parseISODate(start) ?? new Date()}
          onSelect={() => {}}
          onDayClick={handleDayClick}

          autoFocus
          className="pointer-events-auto p-3 [--cell-size:2rem]"
        />
      </PopoverContent>
    </Popover>
  );
}
