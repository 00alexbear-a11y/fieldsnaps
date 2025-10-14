import { useState, useRef, useEffect, TouchEvent } from "react";
import { Trash2, FolderOpen, Camera, MapPin, Clock, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Project, Photo } from "../../../shared/schema";

interface SwipeableProjectCardProps {
  project: Project;
  coverPhoto?: Photo;
  photoCount: number;
  pendingSyncCount: number;
  onClick: () => void;
  onDelete: () => void;
  onCameraClick: () => void;
}

const SWIPE_THRESHOLD = 100;
const DELETE_THRESHOLD = 150;

export default function SwipeableProjectCard({
  project,
  coverPhoto,
  photoCount,
  pendingSyncCount,
  onClick,
  onDelete,
  onCameraClick,
}: SwipeableProjectCardProps) {
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchCurrent, setTouchCurrent] = useState<number | null>(null);
  const [isSwiping, setIsSwiping] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const touchCurrentRef = useRef<number | null>(null);

  const swipeDistance = touchStart !== null && touchCurrent !== null ? touchStart - touchCurrent : 0;
  const isSwipedLeft = swipeDistance > 0;
  const showDelete = swipeDistance >= SWIPE_THRESHOLD;

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if (!touch) return;
    setTouchStart(touch.clientX);
    setTouchCurrent(touch.clientX);
    touchCurrentRef.current = touch.clientX;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    if (touchStart === null) return;
    const touch = e.touches[0];
    if (!touch) return;
    
    const currentX = touch.clientX;
    const distance = touchStart - currentX;
    
    // Only allow left swipe (distance > 0) and limit max swipe
    if (distance > 0 && distance <= 200) {
      touchCurrentRef.current = currentX;
      
      // Cancel any pending animation frame
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      
      // Batch visual updates using RAF for smooth 60fps performance
      rafRef.current = requestAnimationFrame(() => {
        if (cardRef.current && touchCurrentRef.current !== null) {
          const newDistance = touchStart - touchCurrentRef.current;
          cardRef.current.style.transform = `translateX(-${Math.max(0, newDistance)}px)`;
        }
      });
      
      // Update state less frequently for React-managed visibility
      setTouchCurrent(currentX);
    }
  };

  const handleTouchEnd = () => {
    // Cancel any pending RAF
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    
    if (swipeDistance >= DELETE_THRESHOLD) {
      // Swipe threshold met - keep delete button visible
      setTouchStart(touchStart! - DELETE_THRESHOLD);
      setTouchCurrent(touchCurrent! - DELETE_THRESHOLD);
      touchCurrentRef.current = touchCurrent! - DELETE_THRESHOLD;
    } else {
      // Reset swipe
      setTouchStart(null);
      setTouchCurrent(null);
      touchCurrentRef.current = null;
    }
    setIsSwiping(false);
  };

  const handleCardClick = () => {
    // Don't navigate if card is swiped
    if (swipeDistance < SWIPE_THRESHOLD) {
      onClick();
    } else {
      // Reset swipe on tap when swiped
      setTouchStart(null);
      setTouchCurrent(null);
      touchCurrentRef.current = null;
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  return (
    <div className="relative mx-3 my-2 overflow-hidden rounded-2xl" data-testid={`swipeable-wrapper-${project.id}`}>
      {/* Delete button - appears behind card */}
      <div
        className="absolute inset-0 bg-destructive flex items-center justify-end pr-6"
        style={{ visibility: swipeDistance > 0 ? 'visible' : 'hidden' }}
        data-testid={`delete-background-${project.id}`}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDeleteClick}
          className="text-destructive-foreground hover:text-destructive-foreground"
          data-testid={`button-delete-project-${project.id}`}
          aria-label={`Delete ${project.name}`}
        >
          <Trash2 className="w-6 h-6" />
        </Button>
      </div>

      {/* Project Card - swipes left to reveal delete */}
      <div
        ref={cardRef}
        className="flex gap-3 sm:gap-4 p-3 sm:p-4 overflow-visible hover-elevate active-elevate-2 cursor-pointer bg-card backdrop-blur-xl border border-border/50 rounded-2xl"
        onClick={handleCardClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        style={{
          transform: `translateX(-${Math.max(0, swipeDistance)}px)`,
          transition: isSwiping ? "none" : "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
        data-testid={`card-project-${project.id}`}
      >
        {/* Cover Photo */}
        <div className="flex-shrink-0">
          {coverPhoto ? (
            <img
              src={coverPhoto.url}
              alt={project.name}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover"
              data-testid={`img-cover-${project.id}`}
            />
          ) : (
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-muted/50 backdrop-blur-sm flex items-center justify-center border border-border/30">
              <FolderOpen className="w-7 h-7 sm:w-8 sm:h-8 text-muted-foreground/70" />
            </div>
          )}
        </div>

        {/* Project Info */}
        <div className="flex-1 min-w-0 flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold truncate" data-testid={`text-project-name-${project.id}`}>
              {project.name}
            </h3>

            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Camera className="w-3.5 h-3.5" />
                <span data-testid={`text-photo-count-${project.id}`}>
                  {photoCount} {photoCount === 1 ? 'photo' : 'photos'}
                </span>
              </div>
              
              {pendingSyncCount > 0 && (
                <div className="flex items-center gap-1 text-warning" data-testid={`text-pending-sync-${project.id}`}>
                  <Clock className="w-3.5 h-3.5" />
                  <span>{pendingSyncCount} pending</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Open in Maps Button - Compact square design */}
            {project.address && (
              <button
                className="flex flex-col items-center justify-center w-11 h-11 rounded-lg bg-primary/10 border border-primary/20 text-primary hover-elevate active-elevate-2 flex-shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(project.address!)}`, '_blank');
                }}
                data-testid={`button-open-map-${project.id}`}
                aria-label="Open in Google Maps"
              >
                <div className="flex items-center gap-0.5 text-[11px] font-medium leading-none">
                  <span>Open</span>
                  <MapPin className="w-3 h-3" />
                </div>
                <div className="text-[11px] font-medium leading-none mt-0.5">
                  in Maps
                </div>
              </button>
            )}
            
            {/* Camera Button - Always visible */}
            <Button
              variant="ghost"
              size="icon"
              className="w-11 h-11"
              onClick={(e) => {
                e.stopPropagation();
                onCameraClick();
              }}
              data-testid={`button-camera-${project.id}`}
              aria-label={`Open camera for ${project.name}`}
            >
              <Camera className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
