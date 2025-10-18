import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { X, Tag as TagIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Tag, PhotoTag } from "../../../shared/schema";

interface TagPickerProps {
  photoId: string;
  projectId: string;
  onClose: () => void;
}

const tagColorMap: Record<string, string> = {
  red: "bg-red-500",
  yellow: "bg-yellow-500",
  blue: "bg-primary",
  orange: "bg-orange-500",
  gray: "bg-gray-500",
};

export default function TagPicker({ photoId, projectId, onClose }: TagPickerProps) {
  const { toast } = useToast();
  const [isAddingTag, setIsAddingTag] = useState(false);

  // Fetch available tags (global + project-specific)
  const { data: availableTags = [] } = useQuery<Tag[]>({
    queryKey: ["/api/tags"],
  });

  // Fetch current photo tags
  const { data: photoTagsData = [] } = useQuery<(PhotoTag & { tag: Tag })[]>({
    queryKey: [`/api/photos/${photoId}/tags`],
  });

  const currentTagIds = photoTagsData.map((pt) => pt.tag.id);

  // Add tag to photo
  const addTagMutation = useMutation({
    mutationFn: async (tagId: string) => {
      setIsAddingTag(true);
      const res = await apiRequest("POST", `/api/photos/${photoId}/tags`, { tagId });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/photos/${photoId}/tags`] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Tag added",
        duration: 1500,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add tag",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsAddingTag(false);
    },
  });

  // Remove tag from photo
  const removeTagMutation = useMutation({
    mutationFn: async (tagId: string) => {
      await apiRequest("DELETE", `/api/photos/${photoId}/tags/${tagId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/photos/${photoId}/tags`] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Tag removed",
        duration: 1500,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to remove tag",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleToggleTag = (tag: Tag) => {
    const isSelected = currentTagIds.includes(tag.id);
    if (isSelected) {
      removeTagMutation.mutate(tag.id);
    } else {
      addTagMutation.mutate(tag.id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center">
      <div className="bg-background border-t sm:border sm:rounded-2xl w-full sm:max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <TagIcon className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Photo Tags</h2>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={onClose}
            data-testid="button-close-tag-picker"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Tags List */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {availableTags.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No tags available
              </p>
            ) : (
              availableTags.map((tag) => {
                const isSelected = currentTagIds.includes(tag.id);
                const colorClass = tagColorMap[tag.color] || "bg-gray-500";

                return (
                  <button
                    key={tag.id}
                    onClick={() => handleToggleTag(tag)}
                    disabled={addTagMutation.isPending || removeTagMutation.isPending}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors hover-elevate active-elevate-2 ${
                      isSelected
                        ? "bg-primary/10 border-primary"
                        : "bg-card border-border"
                    }`}
                    data-testid={`button-tag-${tag.name.toLowerCase()}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full ${colorClass}`} />
                      <span className="font-medium">{tag.name}</span>
                    </div>
                    {isSelected && (
                      <Badge variant="secondary" className="text-xs">
                        Selected
                      </Badge>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Footer Info */}
        <div className="p-4 border-t bg-muted/30">
          <p className="text-sm text-muted-foreground text-center">
            {photoTagsData.length === 0
              ? "No tags applied yet"
              : `${photoTagsData.length} tag${photoTagsData.length > 1 ? "s" : ""} applied`}
          </p>
        </div>
      </div>
    </div>
  );
}
