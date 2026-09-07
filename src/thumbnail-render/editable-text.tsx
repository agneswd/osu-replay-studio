import { createContext, useContext, useLayoutEffect, useRef, type HTMLAttributes, type ReactNode } from "react";

export type TextEditing = { id: string; change(text: string): void; finish(cancel?: boolean, focus?: boolean): void };
export const TextEditingContext = createContext<TextEditing | null>(null);
export function useEditingText(id?: string) { return useContext(TextEditingContext)?.id === id && id !== undefined; }

// The browser owns the text nodes during editing. React still updates the layer's font and geometry.
export function EditableText({ id, children, ...props }: HTMLAttributes<HTMLDivElement> & { id?: string; children: ReactNode }) {
  const session = useContext(TextEditingContext), active = !!session && session.id === id;
  const latest = useRef(session); latest.current = session;
  const element = useRef<HTMLDivElement>(null), content = useRef(children), wasActive = useRef(false);
  if (!active || !wasActive.current) content.current = children;
  wasActive.current = active;
  useLayoutEffect(() => {
    if (!active || !element.current) return;
    element.current.focus({ preventScroll: true });
    const range = document.createRange(); range.selectNodeContents(element.current);
    const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
    const el = element.current;
    const finish = () => latest.current?.finish();
    const outside = (event: PointerEvent) => { if (!el.contains(event.target as Node)) finish(); };
    el.addEventListener("blur", finish);
    document.addEventListener("pointerdown", outside, true);
    return () => { el.removeEventListener("blur", finish); document.removeEventListener("pointerdown", outside, true); };
  }, [active]);
  function change() {
    const el = element.current; if (!el || !session) return;
    const raw = el.textContent ?? "", text = raw.replace(/[\r\n]+/g, " ").slice(0, 500);
    if (raw !== text) {
      el.textContent = text;
      const range = document.createRange(); range.selectNodeContents(el); range.collapse(false);
      const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
    }
    session.change(text);
  }
  return <div {...props} key={active ? "editing" : "display"} ref={element}
    contentEditable={active ? "plaintext-only" : undefined} suppressContentEditableWarning
    role={active ? "textbox" : undefined} aria-label={active ? "Edit thumbnail text" : undefined}
    aria-multiline={active ? false : undefined}
    onInput={active ? event => { props.onInput?.(event); if (!(event.nativeEvent as InputEvent).isComposing) change(); } : undefined}
    onCompositionEnd={active ? change : undefined}
    onKeyDown={active ? event => {
      event.stopPropagation();
      if (event.nativeEvent.isComposing) return;
      if (event.key === "Enter" || event.key === "Escape") {
        event.preventDefault(); session.finish(event.key === "Escape", true);
      }
    } : undefined}
    onPaste={active ? event => {
      event.preventDefault();
      document.execCommand("insertText", false, event.clipboardData.getData("text/plain").replace(/[\r\n]+/g, " "));
    } : undefined}
  >{active ? content.current : children}</div>;
}
