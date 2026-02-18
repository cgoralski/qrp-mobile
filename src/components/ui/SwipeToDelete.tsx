import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";

/**
 * SwipeToDelete
 *
 * A generic wrapper that implements iOS-style swipe-to-delete behaviour:
 *   • Tap   → fires onTap (select / open)
 *   • Swipe left → reveals an inline red DELETE button; tap it → fires onDelete
 *
 * Usage:
 *   <SwipeToDelete onTap={() => open(item)} onDelete={() => remove(item)}>
 *     <YourRowContent />
 *   </SwipeToDelete>
 *
 * The component handles its own animation for the deletion collapse
 * (opacity fade + height collapse) so the parent list doesn't need to.
 */

const REVEAL_PX = 80;          // how many px of the delete button are revealed
const SNAP_THRESHOLD = 36;     // swipe past this to snap-open; otherwise snap-closed

interface SwipeToDeleteProps {
  children: React.ReactNode;
  onTap?: () => void;
  onDelete: () => void;
  /** Extra class names for the outer wrapper */
  className?: string;
}

export const SwipeToDelete = ({
  children,
  onTap,
  onDelete,
  className = "",
}: SwipeToDeleteProps) => {
  const [offsetX, setOffsetX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const axis = useRef<"h" | "v" | null>(null);   // determined after first movement
  const snappedOpen = useRef(false);

  /* ── touch handlers ─────────────────────────── */

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    axis.current = null;
    setDragging(true);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (startX.current === null || startY.current === null) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    // Determine axis on first significant movement
    if (axis.current === null && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      axis.current = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
    }
    if (axis.current !== "h") return;

    // Allow swiping left (negative dx).  If already snapped open, allow right-swipe to close.
    const base = snappedOpen.current ? -REVEAL_PX : 0;
    const raw = base + dx;
    const clamped = Math.max(-REVEAL_PX, Math.min(0, raw));
    setOffsetX(clamped);
  };

  const onTouchEnd = () => {
    setDragging(false);
    axis.current = null;
    startX.current = null;
    startY.current = null;

    if (offsetX < -SNAP_THRESHOLD) {
      setOffsetX(-REVEAL_PX);
      snappedOpen.current = true;
    } else {
      setOffsetX(0);
      snappedOpen.current = false;
    }
  };

  /* ── click / tap handler ─────────────────────── */

  const handleTap = () => {
    if (snappedOpen.current || offsetX < -8) {
      // Close the swipe without triggering the item tap
      setOffsetX(0);
      snappedOpen.current = false;
      return;
    }
    onTap?.();
  };

  /* ── delete ──────────────────────────────────── */

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsed(true);
    setTimeout(() => onDelete(), 260);
  };

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        maxHeight: collapsed ? 0 : "200px",
        opacity: collapsed ? 0 : 1,
        transition: collapsed
          ? "max-height 0.26s ease, opacity 0.22s ease"
          : "none",
      }}
    >
      {/* ── Delete button (sits behind the row) ── */}
      <div
        aria-hidden
        className="absolute inset-y-0 right-0 flex items-center justify-center"
        style={{
          width: REVEAL_PX,
          background: "linear-gradient(135deg, hsl(0 72% 40%), hsl(0 80% 28%))",
        }}
      >
        <button
          onClick={handleDelete}
          className="flex flex-col items-center justify-center gap-0.5 w-full h-full active:opacity-70 transition-opacity"
          aria-label="Delete"
        >
          <Trash2 className="h-4 w-4" style={{ color: "hsl(0 0% 95%)" }} />
          <span
            className="font-mono-display font-bold tracking-widest"
            style={{ fontSize: "7px", color: "hsl(0 0% 85%)" }}
          >
            DELETE
          </span>
        </button>
      </div>

      {/* ── Sliding row content ─────────────────── */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={handleTap}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: dragging
            ? "none"
            : "transform 0.25s cubic-bezier(0.32,0.72,0,1)",
          cursor: "pointer",
          position: "relative",
          zIndex: 1,
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default SwipeToDelete;
