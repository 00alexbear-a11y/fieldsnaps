import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { X, Trash2, Edit3, User, Save, ArrowLeft, Check, AlertCircle, Loader2 } from "lucide-react";
import { useTodoSession, type TodoSessionItem } from "@/contexts/TodoSessionContext";
import { useQuery } from "@tanstack/react-query";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { Capacitor } from "@capacitor/core";

interface SessionReviewScreenProps {
  isOpen: boolean;
  projectId: string;
  onBack: () => void;
  onSave: () => void;
  onAnnotate: (localId: string) => void;
}

export function SessionReviewScreen({
  isOpen,
  projectId,
  onBack,
  onSave,
  onAnnotate,
}: SessionReviewScreenProps) {
  const { items, updateItem, removeItem } = useTodoSession();
  const [isVisible, setIsVisible] = useState(false);

  // Fetch project members for assignment dropdown
  const { data: members = [] } = useQuery<Array<{ id: string; firstName: string | null; lastName: string | null; email: string; profileImageUrl: string | null }>>({
    queryKey: ['/api/projects', projectId, 'members'],
    enabled: isOpen && !!projectId,
  });

  const handleBack = async () => {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Light });
    }
    setIsVisible(false);
    setTimeout(onBack, 300);
  };

  const handleSave = async () => {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Medium });
    }
    onSave();
  };

  const handleDelete = async (localId: string) => {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Light });
    }
    removeItem(localId);
  };

  const handleAnnotate = async (localId: string) => {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Light });
    }
    onAnnotate(localId);
  };

  if (!isOpen) return null;

  // Calculate save status
  const savedCount = items.filter(item => item.isSaved).length;
  const unsavedCount = items.length - savedCount;
  const allSaved = unsavedCount === 0;

  return (
    <div
      className={`fixed inset-0 z-[280] bg-background transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      data-testid="screen-session-review"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center justify-between px-4 pt-safe-4 pb-4">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 hover-elevate active-elevate-2 px-3 py-2 rounded-lg"
            data-testid="button-back-review"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back</span>
          </button>
          <div className="text-center">
            <h1 className="text-xl font-semibold tracking-tight">
              Review To-Dos ({items.length})
            </h1>
            {!allSaved && unsavedCount > 0 && (
              <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                {unsavedCount} need{unsavedCount > 1 ? '' : 's'} retry
              </p>
            )}
            {allSaved && savedCount > 0 && (
              <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                All saved ✓
              </p>
            )}
          </div>
          <Button
            onClick={handleSave}
            disabled={items.length === 0}
            className={allSaved ? "bg-green-600 hover:bg-green-700 text-white" : "bg-orange-600 hover:bg-orange-700 text-white"}
            data-testid="button-save-all"
          >
            {allSaved ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Done
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Retry ({unsavedCount})
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Items List */}
      <div className="p-4 pb-safe-24 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 80px)' }}>
        {items.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No to-dos to review</p>
          </div>
        ) : (
          items.map((item) => (
            <TodoReviewCard
              key={item.localId}
              item={item}
              members={members}
              onUpdate={(updates) => updateItem(item.localId, updates)}
              onDelete={() => handleDelete(item.localId)}
              onAnnotate={() => handleAnnotate(item.localId)}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface TodoReviewCardProps {
  item: TodoSessionItem;
  members: Array<{ id: string; firstName: string | null; lastName: string | null; email: string }>;
  onUpdate: (updates: Partial<Omit<TodoSessionItem, 'localId'>>) => void;
  onDelete: () => void;
  onAnnotate: () => void;
}

function TodoReviewCard({ item, members, onUpdate, onDelete, onAnnotate }: TodoReviewCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(item.transcript);

  const handleSaveEdit = async () => {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Light });
    }
    onUpdate({ transcript: editedText });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedText(item.transcript);
    setIsEditing(false);
  };

  const getMemberName = (userId: string) => {
    const member = members.find(m => m.id === userId);
    if (!member) return 'Unknown';
    return `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.email;
  };

  return (
    <Card className="p-4" data-testid={`card-todo-${item.localId}`}>
      <div className="flex gap-4">
        {/* Thumbnail */}
        <div className="flex-shrink-0">
          <img
            src={item.photoUrl}
            alt="Task photo"
            className="w-24 h-24 object-cover rounded-lg"
            data-testid="img-todo-thumbnail"
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Text */}
          {isEditing ? (
            <div className="mb-3">
              <Input
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className="mb-2"
                placeholder="Task description"
                data-testid="input-edit-todo"
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleSaveEdit}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  data-testid="button-save-edit"
                >
                  Save
                </Button>
                <Button
                  onClick={handleCancelEdit}
                  size="sm"
                  variant="outline"
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-base mb-3 line-clamp-3" data-testid="text-todo-description">
              {item.transcript}
            </p>
          )}

          {/* Assignment */}
          <div className="mb-3">
            <label className="text-xs text-muted-foreground mb-1 block">Assign to</label>
            <Select
              value={item.assignedTo || "unassigned"}
              onValueChange={(value) => onUpdate({ assignedTo: value === "unassigned" ? undefined : value })}
            >
              <SelectTrigger className="w-full" data-testid="select-assignee">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {members.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    <div className="flex items-center gap-2">
                      <User className="w-3 h-3" />
                      {getMemberName(member.id)}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              onClick={() => setIsEditing(true)}
              size="sm"
              variant="outline"
              disabled={isEditing}
              data-testid="button-edit-todo"
            >
              <Edit3 className="w-3 h-3 mr-1" />
              Edit
            </Button>
            <Button
              onClick={onAnnotate}
              size="sm"
              variant="outline"
              data-testid="button-annotate-todo"
            >
              <Edit3 className="w-3 h-3 mr-1" />
              Annotate
            </Button>
            <Button
              onClick={onDelete}
              size="sm"
              variant="outline"
              className="text-red-600 hover:text-red-700"
              data-testid="button-delete-todo"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Delete
            </Button>
          </div>

          {/* Annotation indicator */}
          {item.annotations.length > 0 && (
            <div className="mt-2 text-xs text-blue-600" data-testid="text-annotation-count">
              {item.annotations.length} annotation{item.annotations.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
