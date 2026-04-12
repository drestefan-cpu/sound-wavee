import { useRef, useEffect, useState, useCallback } from "react";

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
  maxPull?: number;
}

export function usePullToRefresh({
  onRefresh,
  threshold = 70,
  maxPull = 120,
}: UsePullToRefreshOptions) {
  const disabled = true;
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [released, setReleased] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const cooldown = useRef(false);

  const isAtTop = useCallback(() => window.scrollY <= 0, []);

  useEffect(() => {
    if (disabled) return;

    const onTouchStart = (e: TouchEvent) => {
      if (cooldown.current || refreshing) return;
      if (!isAtTop()) return;
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pulling.current || refreshing) return;
      if (!isAtTop()) {
        pulling.current = false;
        setPullDistance(0);
        return;
      }
      const dy = e.touches[0].clientY - startY.current;
      if (dy < 0) {
        pulling.current = false;
        setPullDistance(0);
        return;
      }
      // Dampen the pull for a subtle feel
      const dampened = Math.min(dy * 0.45, maxPull);
      setPullDistance(dampened);
    };

    const onTouchEnd = async () => {
      if (!pulling.current) return;
      pulling.current = false;

      if (pullDistance >= threshold && !refreshing) {
        setReleased(true);
        setRefreshing(true);
        cooldown.current = true;
        try {
          await onRefresh();
        } finally {
          // Brief glow hold then fade
          setTimeout(() => {
            setPullDistance(0);
            setRefreshing(false);
            setReleased(false);
            setTimeout(() => {
              cooldown.current = false;
            }, 500);
          }, 600);
        }
      } else {
        setPullDistance(0);
      }
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [disabled, pullDistance, refreshing, onRefresh, threshold, maxPull, isAtTop]);

  const progress = Math.min(pullDistance / threshold, 1);
  const ready = pullDistance >= threshold;

  return { pullDistance, progress, ready, refreshing, released };
}
