import { useState, useRef, useEffect, TouchEvent } from "react";
import { Trash2, Home, Camera, MapPin, Clock, ExternalLink, Share2, MoreVertical, CheckCircle2, Circle, Edit, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { actionSheet } from "@/lib/nativeActionSheet";
import { Browser } from "@capacitor/browser";
import type { Project, Photo } from "../../../shared/schema";

interface SwipeableProjectCardProps {
  project: Project;
  coverPhoto?: Photo;
  photoCount: number;
  pendingSyncCount: number;
  isFavorite?: boolean;
  onClick: () => void;
  onDelete: () => void;
  onCameraClick: () => void;
  onShare: () => void;
  onToggleComplete: () => void;
  onToggleFavorite?: () => void;
  onEdit: () => void;
}

const SWIPE_THRESHOLD = 100;
const DELETE_THRESHOLD = 150;

export default function SwipeableProjectCard({
  project,
  coverPhoto,
  photoCount,
  pendingSyncCount,
  isFavorite = false,
  onClick,
  onDelete,
  onCameraClick,
  onShare,
  onToggleComplete,
  onToggleFavorite,
  onEdit,
}: SwipeableProjectCardProps) {
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchCurrent, setTouchCurrent] = useState<number | null>(null);
  const [isSwiping, setIsSwiping] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const touchCurrentRef = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const isHorizontalSwipe = useRef<boolean | null>(null);

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
    touchStartY.current = touch.clientY;
    isHorizontalSwipe.current = null; // Reset swipe direction detection
    setIsSwiping(true);
  };

  const handleTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    if (touchStart === null || touchStartY.current === null) return;
    const touch = e.touches[0];
    if (!touch) return;
    
    const currentX = touch.clientX;
    const currentY = touch.clientY;
    const distanceX = Math.abs(touchStart - currentX);
    const distanceY = Math.abs(touchStartY.current - currentY);
    
    // Determine swipe direction on first significant movement
    if (isHorizontalSwipe.current === null && (distanceX > 5 || distanceY > 5)) {
      isHorizontalSwipe.current = distanceX > distanceY;
    }
    
    // Only handle horizontal swipes, allow vertical scrolling
    if (isHorizontalSwipe.current === false) {
      return; // Let vertical scroll happen naturally
    }
    
    const distance = touchStart - currentX;
    
    // Only allow left swipe (distance > 0) and limit max swipe
    if (distance > 0 && distance <= 200) {
      // Prevent default scroll when swiping horizontally
      e.preventDefault();
      
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
    
    // Reset swipe direction detection for next gesture
    touchStartY.current = null;
    isHorizontalSwipe.current = null;
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

  const handleNavigationClick = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    
    if (!project.address) return;
    
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(project.address)}`;
    
    // Try native browser first (Capacitor), fallback to window.open
    try {
      await Browser.open({ url: mapsUrl });
    } catch {
      window.open(mapsUrl, '_blank');
    }
  };

  const handleMenuClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // On iOS, show native action sheet
    if (actionSheet.isSupported()) {
      const buttons = [];
      
      buttons.push({
        title: 'Edit Project',
        handler: onEdit,
      });
      
      if (onToggleFavorite) {
        buttons.push({
          title: isFavorite ? 'Remove from Favorites' : 'Add to Favorites',
          handler: onToggleFavorite,
        });
      }
      
      if (project.address) {
        buttons.push({
          title: 'Go to Map',
          handler: () => {
            handleNavigationClick({ stopPropagation: () => {} } as React.MouseEvent);
          },
        });
      }
      
      buttons.push({
        title: project.completed ? 'Mark as Incomplete' : 'Mark as Complete',
        handler: onToggleComplete,
      });
      
      buttons.push({
        title: 'Share Project',
        handler: onShare,
      });
      
      buttons.push({
        title: 'Delete Project',
        style: 'destructive' as const,
        handler: onDelete,
      });
      
      buttons.push({
        title: 'Cancel',
        style: 'cancel' as const,
      });
      
      await actionSheet.show({
        title: project.name,
        buttons,
      });
    }
    // On web, dropdown menu will handle it
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
        className={`flex gap-3 sm:gap-4 p-3 sm:p-4 overflow-visible hover-elevate active-elevate-2 cursor-pointer bg-card backdrop-blur-xl border border-border/50 rounded-2xl ${isFavorite ? 'border-l-4 border-l-yellow-400' : ''}`}
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
        {/* Cover Photo with Navigation Overlay */}
        <div className="flex-shrink-0 relative">
          {coverPhoto ? (
            <img
              src={coverPhoto.url}
              alt={project.name}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover"
              data-testid={`img-cover-${project.id}`}
            />
          ) : (
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-muted/50 backdrop-blur-sm flex items-center justify-center border border-border/30">
              <Home className="w-7 h-7 sm:w-8 sm:h-8 text-muted-foreground/70" />
            </div>
          )}
          
          {/* Navigation Overlay - Apple Maps style location pin */}
          {project.address && (
            <button
              className="absolute inset-0 rounded-xl flex items-center justify-center border-0 p-0 group"
              onClick={handleNavigationClick}
              data-testid={`button-navigate-${project.id}`}
              aria-label={`Get directions to ${project.name}`}
              type="button"
            >
              {/* Frosted circular background - Apple style */}
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-black/30 backdrop-blur-md flex flex-col items-center justify-center gap-0.5 group-hover:bg-black/40 group-active:bg-black/50 transition-colors shadow-lg">
                {/* Location Pin Icon - SF Symbols inspired */}
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  className="pointer-events-none"
                  fill="none"
                >
                  {/* Pin shape: teardrop with circular center */}
                  <path
                    d="M10 2C7.24 2 5 4.24 5 7c0 3.5 5 9 5 9s5-5.5 5-9c0-2.76-2.24-5-5-5z"
                    fill="white"
                    fillOpacity="0.9"
                  />
                  {/* Center dot */}
                  <circle cx="10" cy="7" r="2" fill="black" fillOpacity="0.3" />
                </svg>
                
                {/* "Route" label */}
                <span className="text-[10px] font-semibold text-white/90 tracking-tight pointer-events-none">
                  Route
                </span>
              </div>
            </button>
          )}
        </div>

        {/* Project Info */}
        <div className="flex-1 min-w-0 flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold truncate" data-testid={`text-project-name-${project.id}`}>
              {project.name}
            </h3>

            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
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
              
              {/* Last updated */}
              <div className="text-xs text-muted-foreground/70" data-testid={`text-last-updated-${project.id}`}>
                {(() => {
                  const lastActivity = new Date(project.lastActivityAt || project.createdAt);
                  const now = new Date();
                  const diffMs = now.getTime() - lastActivity.getTime();
                  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                  
                  if (diffDays === 0) return 'Last updated: today';
                  if (diffDays === 1) return 'Last updated: 1 day ago';
                  return `Last updated: ${diffDays} days ago`;
                })()}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Completion Badge */}
            {project.completed && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">Done</span>
              </div>
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
            
            {/* Menu Button - Native action sheet on iOS, dropdown on web */}
            {actionSheet.isSupported() ? (
              <Button
                variant="ghost"
                size="icon"
                className="w-11 h-11"
                onClick={handleMenuClick}
                data-testid={`button-menu-${project.id}`}
                aria-label="Project options"
              >
                <MoreVertical className="w-5 h-5" />
              </Button>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-11 h-11"
                    onClick={(e) => e.stopPropagation()}
                    data-testid={`button-menu-${project.id}`}
                    aria-label="Project options"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit();
                    }}
                    data-testid={`menu-edit-${project.id}`}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Project
                  </DropdownMenuItem>
                  {onToggleFavorite && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite();
                      }}
                      data-testid={`menu-favorite-${project.id}`}
                    >
                      <Star className={`w-4 h-4 mr-2 ${isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                      {isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
                    </DropdownMenuItem>
                  )}
                  {project.address && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(project.address!)}`, '_blank');
                      }}
                      data-testid={`menu-open-map-${project.id}`}
                    >
                      <MapPin className="w-4 h-4 mr-2" />
                      Go to Map
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleComplete();
                    }}
                    data-testid={`menu-toggle-complete-${project.id}`}
                  >
                    {project.completed ? (
                      <>
                        <Circle className="w-4 h-4 mr-2" />
                        Mark as Incomplete
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Mark as Complete
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onShare();
                    }}
                    data-testid={`menu-share-${project.id}`}
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    Share Project
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete();
                    }}
                    className="text-destructive focus:text-destructive"
                    data-testid={`menu-delete-${project.id}`}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Project
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
