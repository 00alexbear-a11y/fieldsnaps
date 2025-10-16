import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";

interface SwipeBackGestureProps {
  onSwipeBack?: () => void;
  disabled?: boolean;
}

export function SwipeBackGesture({ onSwipeBack, disabled = false }: SwipeBackGestureProps) {
  const [, setLocation] = useLocation();
  const [swipeProgress, setSwipeProgress] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  useEffect(() => {
    if (disabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      // Only activate if starting from left edge (within 50px)
      if (touch.clientX <= 50) {
        touchStartRef.current = {
          x: touch.clientX,
          y: touch.clientY,
          time: Date.now(),
        };
        setIsActive(true);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchStartRef.current || !isActive) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);

      // Must be horizontal swipe (more horizontal than vertical)
      if (deltaY > Math.abs(deltaX)) {
        setIsActive(false);
        touchStartRef.current = null;
        setSwipeProgress(0);
        return;
      }

      // Only track rightward swipes
      if (deltaX > 0) {
        // Prevent default to stop page scrolling during swipe
        if (deltaX > 10) {
          e.preventDefault();
        }
        
        // Calculate progress (0 to 1), max out at 150px
        const progress = Math.min(deltaX / 150, 1);
        setSwipeProgress(progress);
      } else {
        // Swipe went left, cancel
        setIsActive(false);
        touchStartRef.current = null;
        setSwipeProgress(0);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current || !isActive) return;

      const touchEnd = e.changedTouches[0];
      const deltaX = touchEnd.clientX - touchStartRef.current.x;
      const deltaY = Math.abs(touchEnd.clientY - touchStartRef.current.y);
      const deltaTime = Date.now() - touchStartRef.current.time;
      const velocity = deltaX / deltaTime; // px per ms

      // Trigger back navigation if:
      // 1. Swipe distance > 100px OR
      // 2. Fast swipe (velocity > 0.5 px/ms) with distance > 50px
      const shouldNavigateBack = 
        (deltaX > 100 && deltaY < Math.abs(deltaX)) || 
        (velocity > 0.5 && deltaX > 50 && deltaY < Math.abs(deltaX));

      if (shouldNavigateBack) {
        if (onSwipeBack) {
          onSwipeBack();
        } else {
          // Default behavior: go back in history
          window.history.back();
        }
      }

      // Reset state
      setIsActive(false);
      setSwipeProgress(0);
      touchStartRef.current = null;
    };

    const handleTouchCancel = () => {
      setIsActive(false);
      setSwipeProgress(0);
      touchStartRef.current = null;
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });
    document.addEventListener("touchcancel", handleTouchCancel, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("touchcancel", handleTouchCancel);
    };
  }, [disabled, onSwipeBack]);

  // Visual feedback overlay
  if (!isActive || swipeProgress === 0) return null;

  return (
    <div 
      className="fixed inset-0 z-50 pointer-events-none"
      style={{ 
        background: `linear-gradient(to right, rgba(0,0,0,${0.1 * swipeProgress}) 0%, transparent 50%)`,
      }}
    >
      {/* Arrow indicator */}
      <div 
        className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center justify-center w-16 h-16 transition-opacity"
        style={{
          transform: `translateY(-50%) translateX(${swipeProgress * 40}px)`,
          opacity: swipeProgress,
        }}
      >
        <div className="w-12 h-12 rounded-full bg-background/90 backdrop-blur-md border border-border shadow-lg flex items-center justify-center">
          <ArrowLeft className="w-6 h-6 text-foreground" />
        </div>
      </div>
    </div>
  );
}
