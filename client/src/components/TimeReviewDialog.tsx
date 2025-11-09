import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Clock, MapPin, Pencil } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { ClockEntry } from "@shared/schema";

interface TimeReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmClockOut: () => void;
  isClockingOut: boolean;
  totalHoursToday: number;
}

export function TimeReviewDialog({
  open,
  onOpenChange,
  onConfirmClockOut,
  isClockingOut,
  totalHoursToday,
}: TimeReviewDialogProps) {
  const { toast } = useToast();
  const [editingEntry, setEditingEntry] = useState<ClockEntry | null>(null);
  const [editTimestamp, setEditTimestamp] = useState("");
  const [editReason, setEditReason] = useState("");

  // Get today's date range for filtering entries
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Fetch today's clock entries
  const { data: entries = [], isLoading } = useQuery<ClockEntry[]>({
    queryKey: ['/api/clock/entries', { startDate: today.toISOString(), endDate: tomorrow.toISOString() }],
    enabled: open, // Only fetch when dialog is open
  });

  // Edit entry mutation
  const editMutation = useMutation({
    mutationFn: async (data: { id: string; timestamp: string; editReason: string }) => {
      return await apiRequest('PATCH', `/api/clock/${data.id}`, {
        timestamp: data.timestamp,
        editReason: data.editReason,
      });
    },
    onSuccess: () => {
      // Invalidate all clock entries queries (using predicate to match any query key starting with '/api/clock/entries')
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === '/api/clock/entries'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/clock/status'] });
      setEditingEntry(null);
      setEditTimestamp("");
      setEditReason("");
      toast({
        title: "Entry Updated",
        description: "Clock entry has been successfully updated",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update clock entry",
      });
    },
  });

  const handleEditClick = (entry: ClockEntry) => {
    setEditingEntry(entry);
    // Format timestamp for datetime-local input
    const date = new Date(entry.timestamp);
    const formattedDate = format(date, "yyyy-MM-dd'T'HH:mm");
    setEditTimestamp(formattedDate);
    setEditReason("");
  };

  const handleSaveEdit = () => {
    if (!editingEntry || !editTimestamp || !editReason) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please provide both a timestamp and an edit reason",
      });
      return;
    }

    editMutation.mutate({
      id: editingEntry.id,
      timestamp: new Date(editTimestamp).toISOString(),
      editReason,
    });
  };

  const formatHours = (hours: number): string => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const getTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      clock_in: "Clock In",
      clock_out: "Clock Out",
      break_start: "Break Start",
      break_end: "Break End",
    };
    return labels[type] || type;
  };

  const getTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      clock_in: "bg-green-500/10 text-green-700 dark:text-green-400",
      clock_out: "bg-red-500/10 text-red-700 dark:text-red-400",
      break_start: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
      break_end: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    };
    return colors[type] || "bg-gray-500/10 text-gray-700 dark:text-gray-400";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col" data-testid="dialog-time-review">
        <DialogHeader>
          <DialogTitle>Review Your Day</DialogTitle>
          <DialogDescription>
            Review your clock entries for today before ending your day. Total time worked: {formatHours(totalHoursToday)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 py-4" data-testid="time-review-entries">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No clock entries found for today
            </div>
          ) : (
            entries.map((entry) => (
              <Card key={entry.id} className="p-4" data-testid={`entry-${entry.id}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-md text-xs font-medium ${getTypeColor(entry.type)}`}>
                        {getTypeLabel(entry.type)}
                      </span>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {format(new Date(entry.timestamp), 'h:mm a')}
                      </div>
                    </div>

                    {entry.location && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        {entry.location}
                      </div>
                    )}

                    {entry.notes && (
                      <p className="text-sm text-muted-foreground">{entry.notes}</p>
                    )}

                    {entry.editedBy && (
                      <p className="text-xs text-orange-600 dark:text-orange-400">
                        Edited: {entry.editReason}
                      </p>
                    )}
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleEditClick(entry)}
                    data-testid={`button-edit-entry-${entry.id}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>

        <DialogFooter className="flex-row justify-between gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isClockingOut}
            data-testid="button-cancel-review"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirmClockOut}
            disabled={isClockingOut}
            data-testid="button-confirm-clock-out"
          >
            {isClockingOut ? "Clocking Out..." : "Confirm & Clock Out"}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Edit Entry Dialog */}
      <Dialog open={!!editingEntry} onOpenChange={(open) => !open && setEditingEntry(null)}>
        <DialogContent data-testid="dialog-edit-entry">
          <DialogHeader>
            <DialogTitle>Edit Clock Entry</DialogTitle>
            <DialogDescription>
              Modify the timestamp for this entry. A reason is required for audit purposes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-timestamp">Timestamp</Label>
              <Input
                id="edit-timestamp"
                type="datetime-local"
                value={editTimestamp}
                onChange={(e) => setEditTimestamp(e.target.value)}
                data-testid="input-edit-timestamp"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-reason">Reason for Edit *</Label>
              <Textarea
                id="edit-reason"
                placeholder="Explain why this entry needs to be updated..."
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                data-testid="textarea-edit-reason"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingEntry(null)}
              disabled={editMutation.isPending}
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={editMutation.isPending || !editReason.trim()}
              data-testid="button-save-edit"
            >
              {editMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
