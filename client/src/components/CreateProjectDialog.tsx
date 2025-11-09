import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface CreateProjectDialogProps {
  canWrite: boolean;
  onUpgradeRequired: () => void;
}

export function CreateProjectDialog({ canWrite, onUpgradeRequired }: CreateProjectDialogProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [unitCount, setUnitCount] = useState(1);
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; address?: string; unitCount?: number }) => {
      const res = await apiRequest("POST", "/api/projects", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects/with-counts"] });
      setDialogOpen(false);
      setName("");
      setDescription("");
      setAddress("");
      setUnitCount(1);
      toast({ title: "Project created successfully" });
    },
    onError: (error: any) => {
      console.error('Project creation error:', error);
      toast({ 
        title: "Error creating project", 
        description: error.message || "Please try again",
        variant: "destructive"
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate({ name, description, address, unitCount });
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <Button 
        size="default"
        data-testid="button-create-project"
        onClick={() => {
          if (!canWrite) {
            onUpgradeRequired();
          } else {
            setDialogOpen(true);
          }
        }}
      >
        <Plus className="w-4 h-4 mr-1" />
        New
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Enter details for your new construction project.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Project Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter project name"
              data-testid="input-project-name"
              required
            />
          </div>
          <div>
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Job site address"
              data-testid="input-project-address"
            />
          </div>
          <div>
            <Label htmlFor="unitCount">Number of Units</Label>
            <Input
              id="unitCount"
              type="number"
              min="1"
              max="999"
              value={unitCount}
              onChange={(e) => setUnitCount(parseInt(e.target.value) || 1)}
              placeholder="1 for single-site projects"
              data-testid="input-project-unit-count"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Set to 1 for single-site projects. For multi-unit buildings, specify the number of units to enable unit labels in camera.
            </p>
          </div>
          <div>
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter project description"
              rows={3}
              data-testid="input-project-description"
            />
          </div>
          <Button 
            type="submit" 
            className="w-full" 
            disabled={createMutation.isPending}
            data-testid="button-submit-project"
          >
            {createMutation.isPending ? "Creating..." : "Create Project"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
