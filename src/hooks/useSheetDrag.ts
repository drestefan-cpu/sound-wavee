import { useRef, useState, type CSSProperties, type TouchEvent } from "react";

/**
 * Bottom-sheet behaviour: drag down from the top of the sheet to close (or flick), with the
 * backdrop fading as you pull. `close()` animates the sheet away, then calls onClose.
 */
export function useSheetDrag(onClose: () => void, opts: { onBeforeClose?: () => void } = {}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const start = useRef<{ y: number; t: number } | null>(null);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [closing, setClosing] = useState(false);

  const close = () => {
    if (closing) return;
    opts.onBeforeClose?.();
    setClosing(true);
    setTimeout(onClose, 220);
  };

  const handlers = {
    onTouchStart: (e: TouchEvent) => {
      if ((panelRef.current?.scrollTop ?? 0) > 0) return;
      start.current = { y: e.touches[0].clientY, t: Date.now() };
    },
    onTouchMove: (e: TouchEvent) => {
      if (!start.current) return;
      const dy = e.touches[0].clientY - start.current.y;
      if (dy <= 0 && !dragging) {
        start.current = null; // scrolling the content, not dragging the sheet
        return;
      }
      setDragging(true);
      setDragY(Math.max(0, dy));
    },
    onTouchEnd: () => {
      if (!start.current) return;
      const velocity = dragY / Math.max(1, Date.now() - start.current.t);
      start.current = null;
      setDragging(false);
      if (dragY > 110 || (dragY > 40 && velocity > 0.6)) close();
      else setDragY(0);
    },
  };

  const sheetStyle: CSSProperties = {
    transform: `translateY(${closing ? "100%" : `${dragY}px`})`,
    transition: dragging ? "none" : "transform 0.22s cubic-bezier(0.32, 0.72, 0, 1)",
  };
  const backdropStyle: CSSProperties = {
    backgroundColor: `rgba(0,0,0,${closing ? 0 : 0.7 * Math.max(0.2, 1 - dragY / 400)})`,
    transition: dragging ? "none" : "background-color 0.22s ease",
  };

  return { panelRef, handlers, sheetStyle, backdropStyle, close, closing };
}
