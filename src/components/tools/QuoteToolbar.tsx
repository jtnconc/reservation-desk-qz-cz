import { Eye, FileDown, History } from "lucide-react";
import { useWorkspace } from "@/workspace/store";
import { getHotel } from "@/lib/hotels";
import { generateQuotePdf } from "@/lib/quote-pdf";
import { cn } from "@/lib/utils";

const btn =
  "flex size-8 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground shadow-desk transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40 disabled:hover:bg-surface";
const activeBtn =
  "bg-primary text-primary-foreground border-primary hover:bg-primary hover:text-primary-foreground";

interface Props {
  preview: boolean;
  onTogglePreview: () => void;
  history: boolean;
  onToggleHistory: () => void;
}

export function QuoteToolbar({ preview, onTogglePreview, history, onToggleHistory }: Props) {
  const { quote, hotelLogos, archiveQuote, resetQuote } = useWorkspace();
  const selected = quote.hotelId ? getHotel(quote.hotelId) : null;

  const download = () => {
    if (!selected) return;
    archiveQuote();
    generateQuotePdf(quote, selected, hotelLogos[quote.hotelId] ?? selected.logoUrl);
    // Fresh blank form, ready for the next quotation.
    resetQuote();
  };

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        aria-label="Preview quotation"
        disabled={!selected}
        onClick={onTogglePreview}
        className={cn(btn, preview && activeBtn)}
      >
        <Eye className="size-[14px]" />
      </button>
      <button
        type="button"
        aria-label="Download PDF"
        disabled={!selected}
        onClick={download}
        className={btn}
      >
        <FileDown className="size-[14px]" />
      </button>
      <button
        type="button"
        aria-label="Quote history"
        onClick={onToggleHistory}
        className={cn(btn, history && activeBtn)}
      >
        <History className="size-[14px]" />
      </button>
    </div>
  );
}
