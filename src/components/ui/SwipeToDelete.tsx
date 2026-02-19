import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";

/**
 * SwipeToDelete
 *
 * Swipe left to reveal action buttons behind the row.
 * Supports an optional secondary action (e.g. a green Tune button)
 * rendered to the left of the red Delete button.
 *
 *   • Tap   → fires onTap (when row is closed)
 *   • Swipe left → reveals buttons; tap them to fire their action
 */

const DELETE_W = 72;   // width of red delete button
const ACTION_W = 72;   // width of optional secondary action button
const SNAP_THRESHOLD = 36;

interface SwipeToDeleteProps {
  children: React.ReactNode;
  onTap?: () => void;
  onDelete: () => void;
  /** Optional second action revealed alongside Delete */
  secondaryAction?: {
    label: string;
    icon: React.ReactNode;
    color: string;       // hsl string for background gradient
    borderColor: string; // hsl string for border
    onClick: () => void;
  };
  className?: string;
}

export const SwipeToDelete = ({
  children,
  onTap,
  onDelete,
  secondaryAction,
  className = "",
}: SwipeToDeleteProps) => {
  const REVEAL_PX = secondaryAction ? DELETE_W + ACTION_W : DELETE_W;

  const [offsetX, setOffsetX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const axis = useRef<"h" | "v" | null>(null);
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

    if (axis.current === null && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      axis.current = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
    }
    if (axis.current !== "h") return;

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

  /* ── tap handler ─────────────────────────────── */

  const handleTap = () => {
    if (snappedOpen.current || offsetX < -8) {
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

  const handleSecondary = (e: React.MouseEvent) => {
    e.stopPropagation();
    secondaryAction?.onClick();
    // Close the swipe after action
    setOffsetX(0);
    snappedOpen.current = false;
  };

  const buttonsVisible = offsetX < -SNAP_THRESHOLD;

  return (
    <div
      className={`relative ${className}`}
      style={{
        maxHeight: collapsed ? 0 : undefined,
        opacity: collapsed ? 0 : 1,
        overflow: "hidden",
        transition: collapsed
          ? "max-height 0.26s ease, opacity 0.22s ease"
          : "none",
      }}
    >
      {/* ── Action buttons (sit behind the row) ── */}
      <div
        aria-hidden
        className="absolute inset-y-0 right-0 flex items-stretch"
        style={{ width: REVEAL_PX, pointerEvents: buttonsVisible ? "auto" : "none" }}
      >
        {/* Secondary action (e.g. green Tune) */}
        {secondaryAction && (
          <button
            onClick={handleSecondary}
            className="flex flex-col items-center justify-center gap-0.5 active:opacity-70 transition-opacity"
            style={{
              width: ACTION_W,
              background: `linear-gradient(135deg, ${secondaryAction.color}, ${secondaryAction.color.replace("/ 0.9", "/ 0.7")})`,
              borderRight: `1px solid ${secondaryAction.borderColor}`,
            }}
            aria-label={secondaryAction.label}
          >
            {secondaryAction.icon}
            <span
              className="font-mono-display font-bold tracking-widest"
              style={{ fontSize: "7px", color: "hsl(0 0% 90%)" }}
            >
              {secondaryAction.label.toUpperCase()}
            </span>
          </button>
        )}

        {/* Red Delete button */}
        <button
          onClick={handleDelete}
          className="flex flex-col items-center justify-center gap-0.5 active:opacity-70 transition-opacity"
          style={{
            width: DELETE_W,
            background: "linear-gradient(135deg, hsl(0 72% 40%), hsl(0 80% 28%))",
          }}
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
