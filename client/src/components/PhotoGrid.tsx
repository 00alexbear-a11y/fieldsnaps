import { useState, useEffect, useMemo } from "react";
import { Upload, Image as ImageIcon, X, Edit, Send, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PhotoAnnotationEditor } from "@/components/PhotoAnnotationEditor";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Comment } from "@shared/schema";
import { Grid } from "react-window";
import LazyImage from "@/components/LazyImage";

type Photo = {
  id: string;
  url: string;
  caption: string;
  uploadedBy: string;
  date: string;
  tags?: string[];
};

interface Annotation {
  id: string;
  type: "text" | "arrow" | "line" | "circle";
  content?: string;
  color: string;
  strokeWidth: number;
  fontSize?: number;
  position: {
    x: number;
    y: number;
    x2?: number;
    y2?: number;
    width?: number;
    height?: number;
  };
}

type PhotoGridProps = {
  photos: Photo[];
  onUpload: () => void;
  onDelete: (id: string) => void;
  onAnnotate?: (photoId: string, annotations: Annotation[]) => void;
};

// Hook to calculate responsive column count
function useResponsiveColumns(viewSize: "small" | "medium" | "large") {
  const [columnCount, setColumnCount] = useState(2);

  useEffect(() => {
    const calculateColumns = () => {
      const width = window.innerWidth;
      
      if (viewSize === "small") {
        if (width >= 1024) return 6; // lg
        if (width >= 768) return 4;  // md
        return 3; // mobile
      } else if (viewSize === "medium") {
        if (width >= 1024) return 4; // lg
        if (width >= 768) return 3;  // md
        return 2; // mobile
      } else { // large
        if (width >= 1024) return 3; // lg
        if (width >= 768) return 2;  // md
        return 1; // mobile
      }
    };

    setColumnCount(calculateColumns());

    const handleResize = () => {
      setColumnCount(calculateColumns());
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [viewSize]);

  return columnCount;
}

// Wrapper component that fetches annotations before rendering editor
function AnnotationEditorWithData({ 
  photo, 
  onSave 
}: { 
  photo: Photo; 
  onSave: (annotations: Annotation[]) => void;
}) {
  const [existingAnnotations, setExistingAnnotations] = useState<Annotation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch existing annotations when photo changes
  useEffect(() => {
    const fetchAnnotations = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/photos/${photo.id}/annotations`);
        if (response.ok) {
          const data = await response.json();
          setExistingAnnotations(Array.isArray(data) ? data : []);
        } else {
          setExistingAnnotations([]);
        }
      } catch (error) {
        console.error("Error fetching annotations:", error);
        setExistingAnnotations([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnnotations();
  }, [photo.id]);

  if (isLoading) {
    return <div className="flex items-center justify-center p-8">Loading annotations...</div>;
  }

  return (
    <PhotoAnnotationEditor
      photoUrl={photo.url}
      photoId={photo.id}
      existingAnnotations={existingAnnotations}
      onSave={onSave}
    />
  );
}

export function PhotoGrid({ photos, onUpload, onDelete, onAnnotate }: PhotoGridProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [annotatingPhoto, setAnnotatingPhoto] = useState<Photo | null>(null);
  const [photoAnnotations, setPhotoAnnotations] = useState<Record<string, Annotation[]>>({});
  const [viewSize, setViewSize] = useState<"small" | "medium" | "large">("medium");
  const [commentText, setCommentText] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [selectedMentions, setSelectedMentions] = useState<string[]>([]);
  
  // Calculate responsive columns
  const columnCount = useResponsiveColumns(viewSize);

  // Fetch team members for @mentions
  const { data: teamMembers = [] } = useQuery<any[]>({
    queryKey: ["/api/team-members"],
    queryFn: async () => {
      const response = await fetch("/api/team-members");
      if (!response.ok) throw new Error("Failed to fetch team members");
      return response.json();
    },
  });

  // Fetch comments for selected photo
  const { data: comments = [] } = useQuery<Comment[]>({
    queryKey: ["/api/comments", "photo", selectedPhoto?.id],
    queryFn: async () => {
      if (!selectedPhoto) return [];
      const response = await fetch(`/api/comments/photo/${selectedPhoto.id}`);
      if (!response.ok) throw new Error("Failed to fetch comments");
      return response.json();
    },
    enabled: !!selectedPhoto,
  });

  // Create comment mutation
  const createCommentMutation = useMutation({
    mutationFn: (data: { entityType: string; entityId: string; authorId: string; content: string; mentions?: string[] }) =>
      apiRequest("POST", "/api/comments", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/comments", "photo", selectedPhoto?.id] });
      setCommentText("");
    },
  });

  const handleCommentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCommentText(value);
    
    // Detect @ mention
    const lastAtIndex = value.lastIndexOf("@");
    if (lastAtIndex !== -1 && lastAtIndex === value.length - 1) {
      setShowMentions(true);
      setMentionSearch("");
    } else if (lastAtIndex !== -1 && value.substring(lastAtIndex).includes(" ")) {
      setShowMentions(false);
    } else if (lastAtIndex !== -1) {
      setMentionSearch(value.substring(lastAtIndex + 1));
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  };

  const handleSelectMention = (member: any) => {
    const lastAtIndex = commentText.lastIndexOf("@");
    // Find the end of the current mention text (next space or end of string)
    const afterAt = commentText.substring(lastAtIndex + 1);
    const spaceIndex = afterAt.indexOf(" ");
    const mentionEnd = spaceIndex === -1 ? commentText.length : lastAtIndex + 1 + spaceIndex;
    
    // Preserve text before @ and after the mention
    const before = commentText.substring(0, lastAtIndex);
    const after = commentText.substring(mentionEnd);
    const newText = before + `@${member.name} ` + after;
    
    setCommentText(newText);
    setShowMentions(false);
    if (!selectedMentions.includes(member.id)) {
      setSelectedMentions([...selectedMentions, member.id]);
    }
  };

  const handleAddComment = async () => {
    if (!selectedPhoto || !commentText.trim()) return;
    
    // TODO: Replace with actual authenticated user ID from auth context
    // For now, use first team member as placeholder
    const authorId = teamMembers[0]?.id || "temp-user-id";
    
    createCommentMutation.mutate({
      entityType: "photo",
      entityId: selectedPhoto.id,
      authorId,
      content: commentText,
      mentions: selectedMentions.length > 0 ? selectedMentions : undefined,
    });
    setSelectedMentions([]);
  };

  // Calculate grid dimensions for virtualization
  const gridDimensions = useMemo(() => {
    const gap = 16; // gap-4 = 1rem = 16px
    const containerWidth = window.innerWidth - 32; // Account for padding
    const columnWidth = (containerWidth - (gap * (columnCount - 1))) / columnCount;
    const rowHeight = columnWidth + 100; // Square image + card content (~100px for caption, date, tags)
    const rowCount = Math.ceil(photos.length / columnCount);

    return {
      columnWidth: Math.floor(columnWidth),
      rowHeight: Math.floor(rowHeight),
      rowCount,
      containerWidth: Math.floor(containerWidth),
    };
  }, [columnCount, photos.length]);

  // Cell renderer for virtualized grid
  const Cell = ({ columnIndex, rowIndex, style }: any) => {
    const photoIndex = rowIndex * columnCount + columnIndex;
    if (photoIndex >= photos.length) return null;

    const photo = photos[photoIndex];

    return (
      <div style={{...style, padding: '8px'}} data-testid={`photo-cell-${photo.id}`}>
        <Card
          className="overflow-hidden hover-elevate cursor-pointer group h-full"
          onClick={() => setSelectedPhoto(photo)}
          data-testid={`photo-${photo.id}`}
        >
          <div className="aspect-square bg-muted relative overflow-hidden">
            <LazyImage
              src={photo.url}
              alt={photo.caption || "Project photo"}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
              <Button
                size="icon"
                variant="secondary"
                className="h-8 w-8 border-2 border-primary/20"
                onClick={(e) => {
                  e.stopPropagation();
                  setAnnotatingPhoto(photo);
                }}
                data-testid={`button-quick-edit-${photo.id}`}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="destructive"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(photo.id);
                }}
                data-testid={`button-delete-photo-${photo.id}`}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <CardContent className="p-3">
            <p className="text-sm font-medium truncate">{photo.caption}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {photo.date}
            </p>
            {photo.tags && (
              <div className="flex gap-1 mt-2 flex-wrap">
                {photo.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Project Photos</h3>
        <Button onClick={onUpload} size="default" data-testid="button-upload-photo">
          <Upload className="h-4 w-4 mr-2" />
          Upload Photo
        </Button>
      </div>

      {photos.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
              <ImageIcon className="h-10 w-10 text-muted-foreground" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              No photos uploaded yet
            </p>
            <Button onClick={onUpload} className="mt-4" variant="outline" data-testid="button-upload-empty">
              <Upload className="h-4 w-4 mr-2" />
              Upload First Photo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={viewSize} onValueChange={(value) => setViewSize(value as "small" | "medium" | "large")}>
          <TabsList data-testid="tabs-view-size">
            <TabsTrigger value="small" data-testid="tab-small">Small</TabsTrigger>
            <TabsTrigger value="medium" data-testid="tab-medium">Medium</TabsTrigger>
            <TabsTrigger value="large" data-testid="tab-large">Large</TabsTrigger>
          </TabsList>

          <TabsContent value={viewSize} className="mt-4">
            <Grid
              columnCount={columnCount}
              columnWidth={gridDimensions.columnWidth}
              height={Math.min(window.innerHeight - 300, gridDimensions.rowHeight * gridDimensions.rowCount)}
              rowCount={gridDimensions.rowCount}
              rowHeight={gridDimensions.rowHeight}
              width={gridDimensions.containerWidth}
            >
              {Cell}
            </Grid>
          </TabsContent>
        </Tabs>
      )}

      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <Card className="max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>{selectedPhoto.caption}</CardTitle>
              <div className="flex gap-2">
                <Button
                  size="default"
                  variant="outline"
                  onClick={() => {
                    setAnnotatingPhoto(selectedPhoto);
                    setSelectedPhoto(null);
                  }}
                  data-testid={`button-annotate-lightbox-${selectedPhoto.id}`}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Annotate
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setSelectedPhoto(null)}
                  data-testid="button-close-lightbox"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative bg-muted rounded-md overflow-hidden">
                <img
                  src={selectedPhoto.url}
                  alt={selectedPhoto.caption || "Project photo"}
                  className="w-full h-auto max-h-[60vh] object-contain"
                  onError={(e) => {
                    // Fallback to placeholder only if image fails to load
                    e.currentTarget.style.display = "none";
                    e.currentTarget.nextElementSibling?.classList.remove("hidden");
                  }}
                />
                <div className="hidden aspect-video flex items-center justify-center">
                  <ImageIcon className="h-24 w-24 text-muted-foreground" />
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                Uploaded by {selectedPhoto.uploadedBy} on {selectedPhoto.date}
              </div>

              <Separator />

              {/* Comments Section */}
              <div className="space-y-4">
                <h4 className="font-semibold">Comments</h4>
                
                {/* Comment List */}
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {comments.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No comments yet. Be the first to comment!
                    </p>
                  ) : (
                    comments.map((comment) => (
                      <div key={comment.id} className="flex gap-3" data-testid={`comment-${comment.id}`}>
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {comment.authorId.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{comment.authorId}</span>
                            <span className="text-xs text-muted-foreground">
                              {comment.createdAt ? new Date(comment.createdAt).toLocaleDateString() : ""}
                            </span>
                          </div>
                          <p className="text-sm mt-1">{comment.content}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Add Comment */}
                <div className="relative">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add a comment... (type @ to mention)"
                      value={commentText}
                      onChange={handleCommentChange}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !showMentions) {
                          handleAddComment();
                        } else if (e.key === "Escape") {
                          setShowMentions(false);
                        }
                      }}
                      data-testid="input-comment"
                    />
                    <Button
                      size="icon"
                      onClick={handleAddComment}
                      disabled={!commentText.trim() || createCommentMutation.isPending}
                      data-testid="button-add-comment"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {/* @Mention Autocomplete */}
                  {showMentions && (
                    <Card className="absolute bottom-full mb-2 w-full max-h-48 overflow-y-auto z-50">
                      <CardContent className="p-2">
                        {teamMembers
                          .filter((member) =>
                            member.name?.toLowerCase().includes(mentionSearch.toLowerCase())
                          )
                          .map((member) => (
                            <button
                              key={member.id}
                              onClick={() => handleSelectMention(member)}
                              className="w-full text-left px-3 py-2 rounded hover-elevate active-elevate-2 flex items-center gap-2"
                              data-testid={`mention-option-${member.id}`}
                            >
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-xs">
                                  {member.name?.substring(0, 2).toUpperCase() || "?"}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm">{member.name}</span>
                            </button>
                          ))}
                        {teamMembers.filter((member) =>
                          member.name?.toLowerCase().includes(mentionSearch.toLowerCase())
                        ).length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-2">
                            No team members found
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Annotation Dialog */}
      <Dialog open={!!annotatingPhoto} onOpenChange={() => setAnnotatingPhoto(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Annotate Photo</DialogTitle>
            <DialogDescription>
              Add text, arrows, lines, or circles to highlight areas of the photo
            </DialogDescription>
          </DialogHeader>
          {annotatingPhoto && (
            <AnnotationEditorWithData
              photo={annotatingPhoto}
              onSave={async (annotations) => {
                try {
                  // Delete all existing annotations for this photo first
                  const existingResponse = await fetch(`/api/photos/${annotatingPhoto.id}/annotations`);
                  if (existingResponse.ok) {
                    const existingAnnotations = await existingResponse.json();
                    await Promise.all(
                      existingAnnotations.map((anno: any) =>
                        fetch(`/api/annotations/${anno.id}`, { method: 'DELETE' })
                      )
                    );
                  }

                  // Save all new annotations
                  await Promise.all(
                    annotations.map((annotation) =>
                      fetch(`/api/photos/${annotatingPhoto.id}/annotations`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(annotation),
                      })
                    )
                  );

                  setPhotoAnnotations((prev) => ({
                    ...prev,
                    [annotatingPhoto.id]: annotations,
                  }));
                  if (onAnnotate) {
                    onAnnotate(annotatingPhoto.id, annotations);
                  }
                  setAnnotatingPhoto(null);
                } catch (error) {
                  console.error('Error saving annotations:', error);
                }
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
