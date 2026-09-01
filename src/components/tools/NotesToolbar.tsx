import { useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  ImagePlus,
  Type,
  Check,
  ChevronUp,
  ChevronDown,
  CaseSensitive,
  BookText,
  Terminal,
  Sparkles,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  execNotesCommand,
  insertNotesImage,
  applyNotesFontSize,
} from "./notes-format";

const COLORS = [
  { label: "Ink", value: "#1c1c1e" },
  { label: "Blue", value: "#2563eb" },
  { label: "Green", value: "#0f766e" },
  { label: "Amber", value: "#b45309" },
  { label: "Red", value: "#b91c1c" },
  { label: "Violet", value: "#6d28d9" },
];

const FONTS = [
  {
    label: "Inter",
    sub: "System Sans",
    value: "Inter, ui-sans-serif, system-ui, sans-serif",
    icon: CaseSensitive,
  },
  {
    label: "Merriweather",
    sub: "Serif",
    value: "Merriweather, ui-serif, Georgia, serif",
    icon: BookText,
  },
  {
    label: "JetBrains Mono",
    sub: "Monospace",
    value: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
    icon: Terminal,
  },
  {
    label: "Poppins",
    sub: "Display Geometric Sans",
    value: "Poppins, ui-sans-serif, system-ui, sans-serif",
    icon: Sparkles,
  },
];

const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 96;
const DEFAULT_FONT_SIZE = 16;

const btn =
  "flex size-8 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground shadow-desk transition-colors hover:bg-secondary hover:text-foreground";
const activeBtn =
  "bg-primary text-primary-foreground border-primary hover:bg-primary hover:text-primary-foreground";

export function NotesToolbar() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState({ bold: false, italic: false });
  const [activeFont, setActiveFont] = useState(FONTS[0]?.value ?? "");
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  const [sizeInput, setSizeInput] = useState(String(DEFAULT_FONT_SIZE));

  const syncActive = () => {
    setActive({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
    });
  };

  useEffect(() => {
    syncActive();
    document.addEventListener("selectionchange", syncActive);
    return () => document.removeEventListener("selectionchange", syncActive);
  }, []);

  useEffect(() => {
    setSizeInput(String(fontSize));
  }, [fontSize]);

  const toggle = (command: "bold" | "italic") => {
    execNotesCommand(command);
    // Reflect the new state immediately so combined bold+italic both stay lit.
    syncActive();
  };

  const setSize = (next: number) => {
    const clamped = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, next));
    setFontSize(clamped);
    applyNotesFontSize(clamped);
  };

  const pickImage = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => insertNotesImage(String(reader.result));
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        aria-label="Bold"
        aria-pressed={active.bold}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => toggle("bold")}
        className={cn(btn, active.bold && activeBtn)}
      >
        <Bold className="size-[14px]" />
      </button>
      <button
        type="button"
        aria-label="Italic"
        aria-pressed={active.italic}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => toggle("italic")}
        className={cn(btn, active.italic && activeBtn)}
      >
        <Italic className="size-[14px]" />
      </button>

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Typography"
            onMouseDown={(e) => e.preventDefault()}
            className={btn}
          >
            <Type className="size-[14px]" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 space-y-3 p-3">
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Text color
            </p>
            <div className="flex items-center gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  aria-label={c.label}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => execNotesCommand("foreColor", c.value)}
                  className="size-5 rounded-full border border-border transition-transform hover:scale-110"
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Font family
            </p>
            <div className="max-h-[300px] -mx-1 divide-y divide-border overflow-y-auto rounded-md border border-border">
              {FONTS.map((f) => {
                const Icon = f.icon;
                const isActive = activeFont === f.value;
                return (
                  <button
                    key={f.value}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setActiveFont(f.value);
                      execNotesCommand("fontName", f.value);
                    }}
                    className="flex w-full items-center gap-2 bg-surface px-2.5 py-2 text-left transition-colors hover:bg-secondary"
                  >
                    <Icon className="size-[15px] shrink-0 text-muted-foreground" />
                    <span
                      className="flex-1 truncate text-sm text-foreground"
                      style={{ fontFamily: f.value }}
                    >
                      {f.label}
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        {`(${f.sub})`}
                      </span>
                    </span>
                    {isActive && (
                      <Check className="size-[14px] shrink-0 text-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Font size
            </p>
            <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5">
              <label
                htmlFor="notes-font-size"
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Font size
              </label>
              <div className="flex items-center gap-1">
                <input
                  id="notes-font-size"
                  type="number"
                  inputMode="numeric"
                  min={MIN_FONT_SIZE}
                  max={MAX_FONT_SIZE}
                  value={sizeInput}
                  onChange={(e) => setSizeInput(e.target.value)}
                  onBlur={() => {
                    const parsed = Number.parseInt(sizeInput, 10);
                    setSize(Number.isFinite(parsed) ? parsed : fontSize);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                  className="w-12 rounded border border-border bg-background px-1.5 py-0.5 text-right text-sm text-foreground [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="text-xs text-muted-foreground">px</span>
                <div className="flex flex-col overflow-hidden rounded border border-border">
                  <button
                    type="button"
                    aria-label="Increase font size"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setSize(fontSize + 1)}
                    className="flex h-3.5 w-4 items-center justify-center bg-surface text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <ChevronUp className="size-[10px]" />
                  </button>
                  <button
                    type="button"
                    aria-label="Decrease font size"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setSize(fontSize - 1)}
                    className="flex h-3.5 w-4 items-center justify-center border-t border-border bg-surface text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <ChevronDown className="size-[10px]" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <button
        type="button"
        aria-label="Insert image"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => fileRef.current?.click()}
        className={btn}
      >
        <ImagePlus className="size-[14px]" />
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          pickImage(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
