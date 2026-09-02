/** Tiny bridge so the header toolbar can format the notes editor. */
let editor: HTMLElement | null = null;

export function registerNotesEditor(el: HTMLElement | null) {
  editor = el;
}

function withEditor(fn: (el: HTMLElement) => void) {
  if (!editor) return;
  editor.focus();
  const sel = window.getSelection();
  if (sel && sel.rangeCount === 0) {
    const r = document.createRange();
    r.selectNodeContents(editor);
    r.collapse(false);
    sel.addRange(r);
  }
  fn(editor);
  editor.dispatchEvent(new Event("input", { bubbles: true }));
}

export function execNotesCommand(command: string, value?: string) {
  withEditor(() => {
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand(command, false, value);
  });
}

/** Toggles a bulleted list (`<ul><li>`) around the current selection/line. */
export function toggleNotesList() {
  execNotesCommand("insertUnorderedList");
}

/**
 * Wraps the current selection in a `<mark style="background-color: …">` using
 * the chosen pastel color. A dark ink color is applied so the text stays
 * readable on the light highlight regardless of the editor theme.
 */
export function applyNotesHighlight(color: string) {
  withEditor(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;

    const mark = document.createElement("mark");
    mark.style.backgroundColor = color;
    mark.style.color = "#1c1c1e";
    mark.appendChild(range.extractContents());
    range.insertNode(mark);

    // Keep the highlighted text selected after applying.
    sel.removeAllRanges();
    const next = document.createRange();
    next.selectNodeContents(mark);
    sel.addRange(next);
  });
}

export function insertNotesImage(dataUrl: string) {
  withEditor(() => {
    document.execCommand(
      "insertHTML",
      false,
      `<img src="${dataUrl}" alt="" style="max-width:100%;border-radius:10px;margin:6px 0;" />`,
    );
  });
}

/**
 * Applies an exact pixel font size to the current selection.
 * execCommand("fontSize") only supports the legacy 1-7 scale, so we use size
 * "7" as a temporary marker, then swap the resulting <font size="7"> tags for
 * a <span style="font-size:Npx"> wrapper.
 */
export function applyNotesFontSize(px: number) {
  withEditor((el) => {
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand("fontSize", false, "7");
    const markers = el.querySelectorAll('font[size="7"]');
    markers.forEach((marker) => {
      const span = document.createElement("span");
      span.style.fontSize = `${px}px`;
      span.innerHTML = marker.innerHTML;
      marker.replaceWith(span);
    });
  });
}

/** Reads the font size (px) at the current caret/selection, if any. */
export function getNotesFontSize(): number | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const node = sel.anchorNode;
  if (!node) return null;
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  if (!el) return null;
  const size = window.getComputedStyle(el).fontSize;
  const parsed = Number.parseFloat(size);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}
