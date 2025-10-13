import { useState, useRef, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Trash2, Share2, MessageSquare, Send, Pencil, Brush, Image } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
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

interface Photo {
  id: string;
  url: string;
  caption?: string | null;
}

interface PhotoGestureViewerProps {
  photos: Photo[];
  initialIndex: number;
  onClose: () => void;
  onDelete?: (photoId: string) => void;
  onShare?: (photo: Photo) => void;
  onAnnotate?: (photo: Photo) => void;
  onSetCoverPhoto?: (photoId: string) => void;
}

export function PhotoGestureViewer({
  photos,
  initialIndex,
  onClose,
  onDelete,
  onShare,
  onAnnotate,
  onSetCoverPhoto,
}: PhotoGestureViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [showCaptionDialog, setShowCaptionDialog] = useState(false);
  const [editedCaption, setEditedCaption] = useState("");
  const { toast } = useToast();
  
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  
  // Gesture state for swipe navigation
  const gestureStateRef = useRef({
    initialTouch: { x: 0, y: 0 },
    moveDistance: 0,
    isGesturing: false,
  });
  
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const controlsTimerRef = useRef<NodeJS.Timeout | null>(null);

  const currentPhoto = photos[currentIndex];

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

  // Auto-hide controls with timer
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    
    if (controlsTimerRef.current) {
      clearTimeout(controlsTimerRef.current);
    }
    
    controlsTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, []);

  useEffect(() => {
    resetControlsTimer();
    return () => {
      if (controlsTimerRef.current) {
        clearTimeout(controlsTimerRef.current);
      }
    };
  }, [resetControlsTimer]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    resetControlsTimer();
    
    const state = gestureStateRef.current;

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      state.initialTouch = { x: touch.clientX, y: touch.clientY };
      state.moveDistance = 0;
      state.isGesturing = false;

      // Start long-press timer for delete
      if (onDelete) {
        longPressTimerRef.current = setTimeout(() => {
          if (state.moveDistance < 10) {
            navigator.vibrate?.(50);
            setShowDeleteDialog(true);
          }
        }, 500);
      }
    }
  }, [onDelete, resetControlsTimer]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const state = gestureStateRef.current;

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const deltaX = touch.clientX - state.initialTouch.x;
      const deltaY = touch.clientY - state.initialTouch.y;
      state.moveDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

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

      // Swipe to navigate (horizontal swipe with threshold)
      if (Math.abs(deltaX) > 100 && Math.abs(deltaY) < 50) {
        if (deltaX > 0 && currentIndex > 0) {
          setCurrentIndex(currentIndex - 1);
        } else if (deltaX < 0 && currentIndex < photos.length - 1) {
          setCurrentIndex(currentIndex + 1);
        }
      }
    }

    // Reset gesture state
    state.isGesturing = false;
    state.moveDistance = 0;
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
      if (navigator.share) {
        await navigator.share({
          title: currentPhoto.caption || "Construction Photo",
          text: currentPhoto.caption || "Check out this photo",
          url: currentPhoto.url,
        });
      } else if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(currentPhoto.url);
        onShare(currentPhoto);
      } else {
        onShare(currentPhoto);
      }
    } catch (error) {
      console.error("Share failed:", error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Top Controls - Close and Counter only */}
      <div
        className={`absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/60 to-transparent z-10 transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex items-center justify-between max-w-screen-xl mx-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white hover:bg-white/20"
            data-testid="button-close-viewer"
          >
            <X className="w-6 h-6" />
          </Button>

          <div className="text-white text-sm">
            {currentIndex + 1} / {photos.length}
          </div>

          <div className="w-10" />
        </div>
      </div>

      {/* Photo Container */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center overflow-hidden pointer-events-none"
      >
        <img
          ref={imageRef}
          src={currentPhoto.url}
          alt={currentPhoto.caption || "Photo"}
          className="max-w-full max-h-full object-contain pointer-events-auto"
          draggable={false}
          data-testid="photo-viewer-image"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={() => resetControlsTimer()}
        />
      </div>

      {/* Navigation Arrows */}
      {photos.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            onClick={navigatePrev}
            disabled={currentIndex === 0}
            className={`absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 disabled:opacity-0 transition-opacity duration-300 ${
              showControls ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            data-testid="button-prev-photo"
          >
            <ChevronLeft className="w-8 h-8" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={navigateNext}
            disabled={currentIndex === photos.length - 1}
            className={`absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 disabled:opacity-0 transition-opacity duration-300 ${
              showControls ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            data-testid="button-next-photo"
          >
            <ChevronRight className="w-8 h-8" />
          </Button>
        </>
      )}

      {/* Bottom Controls and Caption */}
      <div
        className={`absolute bottom-0 left-0 right-0 transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Caption */}
        {currentPhoto.caption && (
          <div className="px-4 pt-4 pb-2">
            <p className="text-white text-center text-sm max-w-screen-xl mx-auto">
              {currentPhoto.caption}
            </p>
          </div>
        )}
        
        {/* Control Bar */}
        <div className="bg-gradient-to-t from-black/80 to-black/40 backdrop-blur-sm px-4 py-3">
          <div className="flex items-center justify-center gap-1 max-w-screen-xl mx-auto">
            {onAnnotate && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onAnnotate(currentPhoto)}
                className="text-white hover:bg-white/20 flex-col h-auto py-2 px-3 gap-1"
                data-testid="button-annotate"
              >
                <Brush className="w-5 h-5" />
                <span className="text-[10px]">Edit</span>
              </Button>
            )}
            {onShare && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleShare}
                className="text-white hover:bg-white/20 flex-col h-auto py-2 px-3 gap-1"
                data-testid="button-share"
              >
                <Share2 className="w-5 h-5" />
                <span className="text-[10px]">Share</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowComments(!showComments)}
              className="text-white hover:bg-white/20 flex-col h-auto py-2 px-3 gap-1 relative"
              data-testid="button-comments"
            >
              <MessageSquare className="w-5 h-5" />
              <span className="text-[10px]">Comment</span>
              {comments.length > 0 && (
                <span className="absolute top-1 right-1 bg-primary text-primary-foreground text-xs rounded-full w-4 h-4 flex items-center justify-center text-[9px]">
                  {comments.length}
                </span>
              )}
            </Button>
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDeleteDialog(true)}
                className="text-white hover:bg-white/20 flex-col h-auto py-2 px-3 gap-1"
                data-testid="button-delete"
              >
                <Trash2 className="w-5 h-5" />
                <span className="text-[10px]">Delete</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleEditCaption}
              className="text-white hover:bg-white/20 flex-col h-auto py-2 px-3 gap-1"
              data-testid="button-edit-caption"
            >
              <Pencil className="w-5 h-5" />
              <span className="text-[10px]">Rename</span>
            </Button>
            {onSetCoverPhoto && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSetCoverPhoto}
                className="text-white hover:bg-white/20 flex-col h-auto py-2 px-3 gap-1"
                data-testid="button-set-cover-photo"
              >
                <Image className="w-5 h-5" />
                <span className="text-[10px]">Use as Icon</span>
              </Button>
            )}
          </div>
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
        className={`absolute bottom-0 left-0 right-0 bg-background border-t max-h-[50vh] flex flex-col transition-transform duration-300 ${
          showComments ? "translate-y-0" : "translate-y-full"
        }`}
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
