"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";

interface SwipeRevealContextValue {
  openId: string | null;
  setOpenId: (id: string | null) => void;
}

const SwipeRevealContext = createContext<SwipeRevealContextValue | null>(null);

/**
 * Provided once per widget list so opening one row's swipe actions closes
 * any other row that was already open — only one item is ever revealed.
 */
export function SwipeRevealProvider({ children }: { children: React.ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <SwipeRevealContext.Provider value={{ openId, setOpenId }}>
      {children}
    </SwipeRevealContext.Provider>
  );
}

function useSwipeReveal() {
  const ctx = useContext(SwipeRevealContext);
  if (!ctx) throw new Error("useSwipeReveal must be used within a SwipeRevealProvider");
  return ctx;
}

const SNAP_TRANSITION = { duration: 0.22, ease: [0.4, 0, 0.2, 1] as const };

/**
 * Wraps a list row so its content slides left on drag to reveal a
 * fixed-width action rail underneath. The rail's opacity is bound directly
 * to the live drag position (not just the committed open/closed state), so
 * it is truly invisible — not merely unclickable — whenever the content sits
 * at rest. That's what keeps rows with a transparent/blended resting
 * background (most rows here) from ever showing a ghost icon peeking
 * through a gap in the content; only one `SwipeableListItem` per
 * `SwipeRevealProvider` is ever open at a time.
 */
export function SwipeableListItem({
  id,
  actions,
  actionsWidth,
  children,
  className,
  style,
}: {
  id: string;
  actions: React.ReactNode;
  actionsWidth: number;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { openId, setOpenId } = useSwipeReveal();
  const isOpen = openId === id;

  const x = useMotionValue(0);
  const railOpacity = useTransform(x, [-actionsWidth, -actionsWidth * 0.15, 0], [1, 1, 0]);

  useEffect(() => {
    const controls = animate(x, isOpen ? -actionsWidth : 0, SNAP_TRANSITION);
    return () => controls.stop();
  }, [isOpen, actionsWidth, x]);

  return (
    <div className={cn("relative overflow-hidden rounded-xl", className)} style={style}>
      <motion.div
        aria-hidden={!isOpen}
        className="absolute inset-y-0 right-0 flex items-center justify-end gap-0.5 pr-2"
        style={{ width: actionsWidth, opacity: railOpacity, pointerEvents: isOpen ? "auto" : "none" }}
      >
        {actions}
      </motion.div>
      <motion.div
        drag="x"
        style={{ x }}
        dragConstraints={{ left: -actionsWidth, right: 0 }}
        dragElastic={0}
        dragMomentum={false}
        onDragEnd={(_, info) => {
          const threshold = actionsWidth * 0.4;
          setOpenId(-info.offset.x > threshold ? id : null);
        }}
        onClickCapture={(e) => {
          // Re-tapping the visible (shifted) content while open just closes
          // the rail instead of also triggering the content's own click
          // behavior (e.g. entering inline-edit) underneath the tap.
          if (isOpen) {
            e.preventDefault();
            e.stopPropagation();
            setOpenId(null);
          }
        }}
        className="relative touch-pan-y"
      >
        {children}
      </motion.div>
    </div>
  );
}

export { useSwipeReveal };
