import { useState, useRef, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Trash2, Share2, MessageSquare, Send, Pencil, Brush, Image, Tag, MoreHorizontal, Play } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { haptics } from "@/lib/nativeHaptics";
import { nativeShare, type ShareResult } from "@/lib/nativeShare";
import { nativeClipboard } from "@/lib/nativeClipboard";
import { nativeDialogs } from "@/lib/nativeDialogs";
import { Capacitor } from "@capacitor/core";
import type { Comment } from "../../../shared/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Photo {
  id: string;
  url: string;
  caption?: string | null;
  mediaType?: string;
}

interface PhotoGestureViewerProps {
  photos: Photo[];
  initialIndex: number;
  onClose: () => void;
  onDelete?: (photoId: string) => void;
  onShare?: (photo: Photo) => void;
  onAnnotate?: (photo: Photo) => void;
  onTag?: (photo: Photo) => void;
  onSetCoverPhoto?: (photoId: string) => void;
}

export function PhotoGestureViewer({
  photos,
  initialIndex,
  onClose,
  onDelete,
  onShare,
  onAnnotate,
  onTag,
  onSetCoverPhoto,
}: PhotoGestureViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [showCaptionDialog, setShowCaptionDialog] = useState(false);
  const [editedCaption, setEditedCaption] = useState("");
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();
  
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Gesture state for swipe navigation with velocity tracking
  const gestureStateRef = useRef({
    initialTouch: { x: 0, y: 0 },
    initialTime: 0,
    moveDistance: 0,
    isGesturing: false,
    velocity: 0,
  });
  
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const currentPhoto = photos[currentIndex];
  const photoUrl = currentPhoto?.url;

  // Fetch comments for current photo
  const { data: comments = [], isLoading: commentsLoading } = useQuery<Comment[]>({
    queryKey: [`/api/photos/${currentPhoto.id}/comments`],
    enabled: !!currentPhoto.id,
  });

  // Create comment mutation
  const createCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      return await apiRequest("POST", `/api/photos/${currentPhoto.id}/comments`, {
        content,
        mentions: [],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/photos/${currentPhoto.id}/comments`] });
      setNewComment("");
      toast({ title: "Comment added" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to add comment", description: error.message, variant: "destructive" });
    },
  });

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    createCommentMutation.mutate(newComment);
  };

  // Update caption mutation
  const updateCaptionMutation = useMutation({
    mutationFn: async (caption: string) => {
      return await apiRequest("PATCH", `/api/photos/${currentPhoto.id}`, { caption });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setShowCaptionDialog(false);
      toast({ title: "Caption updated" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update caption", description: error.message, variant: "destructive" });
    },
  });

  const handleEditCaption = () => {
    setEditedCaption(currentPhoto.caption || "");
    setShowCaptionDialog(true);
  };

  const handleSaveCaption = () => {
    updateCaptionMutation.mutate(editedCaption);
  };

  const handleSetCoverPhoto = () => {
    if (onSetCoverPhoto) {
      onSetCoverPhoto(currentPhoto.id);
    }
  };

  // Close comments when photo changes
  useEffect(() => {
    setShowComments(false);
  }, [currentIndex]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    
    const state = gestureStateRef.current;

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      
      // Block iOS edge-swipe gestures to prevent double navigation animations
      // Only block if touch starts within 50px of screen edges
      if (touch.clientX <= 50 || touch.clientX >= window.innerWidth - 50) {
        e.preventDefault();
      }
      
      state.initialTouch = { x: touch.clientX, y: touch.clientY };
      state.initialTime = Date.now();
      state.moveDistance = 0;
      state.isGesturing = false;
      state.velocity = 0;
      setIsDragging(true);

      // Start long-press timer for delete
      if (onDelete) {
        longPressTimerRef.current = setTimeout(() => {
          if (state.moveDistance < 10) {
            haptics.medium();
            handleDeleteClick();
          }
        }, 500);
      }
    }
  }, [onDelete]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const state = gestureStateRef.current;

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const deltaX = touch.clientX - state.initialTouch.x;
      const deltaY = touch.clientY - state.initialTouch.y;
      state.moveDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // Update drag offset for real-time visual feedback
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Horizontal drag - update offset
        setDragOffset(deltaX);
        
        // Calculate velocity (pixels per millisecond)
        const deltaTime = Date.now() - state.initialTime;
        if (deltaTime > 0) {
          state.velocity = deltaX / deltaTime;
        }
      }

      // Cancel long-press if moved too much
      if (state.moveDistance > 10 && longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const state = gestureStateRef.current;

    // Cancel long-press
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (e.changedTouches.length === 1 && !state.isGesturing) {
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - state.initialTouch.x;
      const deltaY = touch.clientY - state.initialTouch.y;

      // Determine if swipe should trigger navigation
      // Velocity-based: fast flick (>0.5 px/ms) even with shorter distance
      // Distance-based: 30% of screen width or 100px minimum
      const screenWidth = window.innerWidth;
      const threshold = Math.max(screenWidth * 0.3, 100);
      const shouldNavigate = 
        Math.abs(state.velocity) > 0.5 || // Fast flick
        Math.abs(deltaX) > threshold;      // Sufficient distance
      
      if (shouldNavigate && Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX > 0 && currentIndex > 0) {
          setCurrentIndex(currentIndex - 1);
        } else if (deltaX < 0 && currentIndex < photos.length - 1) {
          setCurrentIndex(currentIndex + 1);
        }
      }
    }

    // Reset drag state
    setIsDragging(false);
    setDragOffset(0);
    state.isGesturing = false;
    state.moveDistance = 0;
    state.velocity = 0;
  }, [currentIndex, photos.length]);

  const navigateNext = () => {
    if (currentIndex < photos.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const navigatePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  // Video control functions
  const toggleVideoPlayback = useCallback(() => {
    if (videoRef.current) {
      if (isVideoPlaying) {
        videoRef.current.pause();
        setIsVideoPlaying(false);
      } else {
        videoRef.current.play();
        setIsVideoPlaying(true);
      }
    }
  }, [isVideoPlaying]);

  // Reset video state when switching photos
  useEffect(() => {
    // Always reset playing state when navigating
    setIsVideoPlaying(false);
    
    // Pause video if it exists and is playing
    if (videoRef.current) {
      videoRef.current.pause();
    }
  }, [currentIndex]);

  const handleDeleteClick = async () => {
    // On iOS: use native confirmation dialog
    if (Capacitor.isNativePlatform()) {
      const confirmed = await nativeDialogs.confirm({
        title: "Delete Photo?",
        message: "This action cannot be undone. This will permanently delete the photo from this project.",
        okButtonTitle: "Delete",
        cancelButtonTitle: "Cancel"
      });
      
      if (confirmed && onDelete && currentPhoto) {
        // Calculate next index BEFORE deletion (using current photos array)
        const willClose = photos.length === 1;
        const nextIndex = currentIndex >= photos.length - 1 ? photos.length - 2 : currentIndex;
        
        // Delete the photo
        onDelete(currentPhoto.id);
        
        // Update state after deletion
        if (willClose) {
          onClose();
        } else {
          setCurrentIndex(nextIndex);
        }
      }
    } else {
      // On web: use AlertDialog component
      setShowDeleteDialog(true);
    }
  };

  const handleDelete = () => {
    if (onDelete && currentPhoto) {
      onDelete(currentPhoto.id);
      setShowDeleteDialog(false);
      
      // Update index before closing if needed
      if (photos.length === 1) {
        onClose();
      } else if (currentIndex >= photos.length - 1) {
        setCurrentIndex(photos.length - 2);
      }
    }
  };

  const handleShare = async () => {
    if (!currentPhoto || !onShare) return;

    try {
      haptics.light();
      const result: ShareResult = await nativeShare.share({
        title: currentPhoto.caption || "Construction Photo",
        text: currentPhoto.caption || "Check out this photo",
        url: currentPhoto.url,
        files: [currentPhoto.url],
        dialogTitle: "Share Photo",
      });

      if (result.shared) {
        onShare(currentPhoto);
        if (result.method === 'native') {
          haptics.success();
          toast({ 
            title: "Photo shared",
            description: "Shared via AirDrop/native sharing",
            duration: 1500,
          });
        } else if (result.method === 'web-share') {
          toast({ 
            title: "Photo shared",
            duration: 1500,
          });
        } else if (result.method === 'clipboard') {
          toast({ 
            title: "Photo URL copied",
            description: "Link copied to clipboard",
            duration: 1500,
          });
        }
      }
      // If share was cancelled (shared: false), do nothing - respect user's choice
    } catch (error) {
      console.error("Share failed:", error);
      haptics.error();
      toast({ 
        title: "Share failed",
        description: "Could not share photo",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Top Controls - Counter only */}
      <div
        className="absolute top-0 left-0 right-0 px-4 pb-4 pt-safe-4 bg-gradient-to-b from-black/60 to-transparent z-10"
      >
        <div className="flex items-center justify-center max-w-screen-xl mx-auto">
          <div className="text-white text-sm">
            {currentIndex + 1} / {photos.length}
          </div>
        </div>
      </div>

      {/* Carousel Container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden pointer-events-none relative"
      >
        {/* Carousel Track - slides horizontally */}
        <div
          className="h-full flex items-center"
          style={{
            transform: `translate3d(calc(-${currentIndex * 100}% + ${dragOffset}px), 0, 0)`,
            transition: isDragging ? 'none' : 'transform 300ms cubic-bezier(0.4, 0, 0.22, 1)',
            willChange: isDragging ? 'transform' : 'auto',
          }}
        >
          {photos.map((photo, index) => (
            <div
              key={photo.id}
              className="flex-shrink-0 w-screen h-full flex items-center justify-center"
            >
              {photo.mediaType === 'video' ? (
                <>
                  <video
                    ref={index === currentIndex ? videoRef : null}
                    src={photo.url}
                    playsInline
                    crossOrigin="use-credentials"
                    className="max-w-full max-h-full object-contain pointer-events-auto"
                    data-testid={`photo-viewer-video-${index}`}
                    onClick={index === currentIndex ? toggleVideoPlayback : undefined}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onPlay={() => index === currentIndex && setIsVideoPlaying(true)}
                    onPause={() => index === currentIndex && setIsVideoPlaying(false)}
                    onEnded={() => index === currentIndex && setIsVideoPlaying(false)}
                  />
                  {/* Custom play button overlay - only shows when paused on current video */}
                  {index === currentIndex && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      {!isVideoPlaying && (
                        <button
                          onClick={toggleVideoPlayback}
                          onTouchStart={handleTouchStart}
                          onTouchMove={handleTouchMove}
                          onTouchEnd={handleTouchEnd}
                          className="rounded-full bg-white/90 backdrop-blur-sm p-4 pointer-events-auto"
                          data-testid="button-video-toggle"
                          aria-label="Play video"
                        >
                          <Play className="w-12 h-12 text-primary fill-primary" />
                        </button>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <img
                  ref={index === currentIndex ? imageRef : null}
                  src={photo.url}
                  alt={photo.caption || "Photo"}
                  crossOrigin="use-credentials"
                  className="max-w-full max-h-full object-contain pointer-events-auto"
                  draggable={false}
                  data-testid={`photo-viewer-image-${index}`}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Arrows - Centered vertically on sides */}
      {photos.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            onClick={navigatePrev}
            disabled={currentIndex === 0}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 disabled:opacity-30 bg-black/50 backdrop-blur-md w-16 h-16 shadow-lg z-10"
            data-testid="button-prev-photo"
            aria-label="Previous photo"
          >
            <ChevronLeft className="w-10 h-10" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={navigateNext}
            disabled={currentIndex === photos.length - 1}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 disabled:opacity-30 bg-black/50 backdrop-blur-md w-16 h-16 shadow-lg z-10"
            data-testid="button-next-photo"
            aria-label="Next photo"
          >
            <ChevronRight className="w-10 h-10" />
          </Button>
        </>
      )}

      {/* Bottom Controls - Clean 3-column grid layout */}
      <div 
        className="absolute bottom-0 left-0 right-0 z-20 bg-black/50 backdrop-blur-md border-t border-white/10"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-3 max-w-screen-xl mx-auto">
          {/* Left: Back button */}
          <div className="flex justify-start">
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="flex flex-col gap-1 w-14 h-14 text-white hover:bg-white/10"
              data-testid="button-close-viewer"
              aria-label="Close photo viewer"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-[10px] hidden sm:inline">Back</span>
            </Button>
          </div>

          {/* Center: Action buttons */}
          <div className="flex items-center gap-2">
            {/* Annotate */}
            {onAnnotate && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onAnnotate(currentPhoto)}
                className="flex flex-col gap-0.5 w-14 h-14 text-white hover:bg-white/10"
                data-testid="button-annotate"
                aria-label="Annotate photo"
              >
                <Brush className="w-5 h-5" />
                <span className="text-[10px] hidden sm:inline">Annotate</span>
              </Button>
            )}

            {/* Edit dropdown - contains Tag, Rename, Comment, Icon */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="flex flex-col gap-0.5 w-14 h-14 text-white hover:bg-white/10 relative"
                  data-testid="button-edit-menu"
                  aria-label="Edit options"
                >
                  <MoreHorizontal className="w-5 h-5" />
                  <span className="text-[10px] hidden sm:inline">Edit</span>
                  {comments.length > 0 && (
                    <span className="absolute top-1 right-1 bg-primary text-primary-foreground text-xs rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-semibold">
                      {comments.length}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-48">
                {onTag && (
                  <DropdownMenuItem onClick={() => onTag(currentPhoto)} data-testid="menu-item-tag">
                    <Tag className="w-4 h-4 mr-2" />
                    Tag Photo
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleEditCaption} data-testid="menu-item-rename">
                  <Pencil className="w-4 h-4 mr-2" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setShowComments(!showComments)} 
                  data-testid="menu-item-comment"
                  className="relative"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  <span className="flex-1">Comment</span>
                  {comments.length > 0 && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({comments.length})
                    </span>
                  )}
                </DropdownMenuItem>
                {onSetCoverPhoto && (
                  <DropdownMenuItem onClick={handleSetCoverPhoto} data-testid="menu-item-set-cover">
                    <Image className="w-4 h-4 mr-2" />
                    Use as Icon
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Share */}
            {onShare && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleShare}
                className="flex flex-col gap-0.5 w-14 h-14 text-white hover:bg-white/10"
                data-testid="button-share"
                aria-label="Share photo"
              >
                <Share2 className="w-5 h-5" />
                <span className="text-[10px] hidden sm:inline">Share</span>
              </Button>
            )}

            {/* Delete */}
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDeleteClick}
                className="flex flex-col gap-0.5 w-14 h-14 text-white hover:bg-white/10"
                data-testid="button-delete"
                aria-label="Delete photo"
              >
                <Trash2 className="w-5 h-5" />
                <span className="text-[10px] hidden sm:inline">Delete</span>
              </Button>
            )}
          </div>

          {/* Right: Empty for balance */}
          <div />
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Photo?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the photo
              from this project.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Caption Dialog */}
      <Dialog open={showCaptionDialog} onOpenChange={setShowCaptionDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Caption</DialogTitle>
            <DialogDescription>
              Update the caption for this photo
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={editedCaption}
              onChange={(e) => setEditedCaption(e.target.value)}
              placeholder="Add a caption..."
              className="min-h-[100px]"
              data-testid="input-edit-caption"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCaptionDialog(false)}
              disabled={updateCaptionMutation.isPending}
              data-testid="button-cancel-edit-caption"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveCaption}
              disabled={updateCaptionMutation.isPending}
              data-testid="button-save-caption"
            >
              {updateCaptionMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Comments Panel */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-background border-t max-h-[50vh] flex flex-col pb-safe transition-transform duration-300 ${
          showComments ? "translate-y-0" : "translate-y-full"
        } ${!showComments ? "pointer-events-none" : ""}`}
        aria-hidden={!showComments}
        {...(!showComments && { inert: '' })}
      >
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Comments ({comments.length})
          </h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowComments(false)}
            data-testid="button-close-comments"
            aria-label="Close comments"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {commentsLoading ? (
            <p className="text-center text-muted-foreground py-8">
              Loading comments...
            </p>
          ) : comments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No comments yet. Be the first to comment!
            </p>
          ) : (
            comments.map((comment) => (
              <div
                key={comment.id}
                className="bg-muted p-3 rounded-lg"
                data-testid={`comment-${comment.id}`}
              >
                <p className="text-sm">{comment.content}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(comment.createdAt).toLocaleString()}
                </p>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleAddComment();
                }
              }}
              disabled={createCommentMutation.isPending}
              data-testid="input-new-comment"
            />
            <Button
              onClick={handleAddComment}
              disabled={!newComment.trim() || createCommentMutation.isPending}
              size="icon"
              data-testid="button-send-comment"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
