import { useState, useRef, TouchEvent } from "react";
import { Trash2, FolderOpen, Camera, MapPin, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Project, Photo } from "../../../shared/schema";

interface SwipeableProjectCardProps {
  project: Project;
  coverPhoto?: Photo;
  photoCount: number;
  pendingSyncCount: number;
  onClick: () => void;
  onDelete: () => void;
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
}: SwipeableProjectCardProps) {
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchCurrent, setTouchCurrent] = useState<number | null>(null);
  const [isSwiping, setIsSwiping] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const swipeDistance = touchStart !== null && touchCurrent !== null ? touchStart - touchCurrent : 0;
  const isSwipedLeft = swipeDistance > 0;
  const showDelete = swipeDistance >= SWIPE_THRESHOLD;

  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if (!touch) return;
    setTouchStart(touch.clientX);
    setTouchCurrent(touch.clientX);
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
      setTouchCurrent(currentX);
    }
  };

  const handleTouchEnd = () => {
    if (swipeDistance >= DELETE_THRESHOLD) {
      // Swipe threshold met - keep delete button visible
      setTouchStart(touchStart! - DELETE_THRESHOLD);
      setTouchCurrent(touchCurrent! - DELETE_THRESHOLD);
    } else {
      // Reset swipe
      setTouchStart(null);
      setTouchCurrent(null);
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
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  return (
    <div className="relative overflow-hidden" data-testid={`swipeable-wrapper-${project.id}`}>
      {/* Delete button - appears behind card */}
      <div
        className="absolute inset-0 bg-destructive flex items-center justify-end pr-6"
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
        className="flex gap-3 sm:gap-4 p-3 sm:p-4 hover-elevate active-elevate-2 cursor-pointer bg-card/60 backdrop-blur-xl border border-border/50 mx-3 my-2 rounded-2xl overflow-visible"
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
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold truncate" data-testid={`text-project-name-${project.id}`}>
            {project.name}
          </h3>
          
          {project.address && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(project.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 mt-1 text-sm text-muted-foreground hover:text-primary transition-colors py-1.5 -mx-1 px-1 rounded"
              data-testid={`link-address-${project.id}`}
            >
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <span className="truncate underline">{project.address}</span>
            </a>
          )}

          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
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
      </div>
    </div>
  );
}
