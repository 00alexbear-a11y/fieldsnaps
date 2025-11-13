import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import Autocomplete from "react-google-autocomplete";
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
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [unitCount, setUnitCount] = useState(1);
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: async (data: { 
      name: string; 
      description?: string; 
      address?: string; 
      city?: string;
      state?: string;
      zipCode?: string;
      unitCount?: number 
    }) => {
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
      setCity("");
      setState("");
      setZipCode("");
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

  const handlePlaceSelected = (place: any) => {
    console.log('[Autocomplete] Place selected:', place);
    if (!place.formatted_address) {
      console.log('[Autocomplete] No formatted address found');
      return;
    }

    setAddress(place.formatted_address);

    const addressComponents = place.address_components || [];
    let cityValue = "";
    let stateValue = "";
    let zipValue = "";

    for (const component of addressComponents) {
      const types = component.types;
      
      if (types.includes("locality")) {
        cityValue = component.long_name;
      }
      
      if (types.includes("administrative_area_level_1")) {
        stateValue = component.short_name;
      }
      
      if (types.includes("postal_code")) {
        zipValue = component.long_name;
      }
    }

    console.log('[Autocomplete] Parsed:', { city: cityValue, state: stateValue, zip: zipValue });
    setCity(cityValue);
    setState(stateValue);
    setZipCode(zipValue);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate({ name, description, address, city, state, zipCode, unitCount });
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
            <div className="relative" style={{ zIndex: 9999 }}>
              <Autocomplete
                apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
                value={address}
                onChange={(e: any) => {
                  console.log('[Autocomplete] Text changed:', e.target.value);
                  setAddress(e.target.value);
                }}
                onPlaceSelected={handlePlaceSelected}
                options={{
                  types: ['address'],
                  fields: ['formatted_address', 'address_components', 'geometry'],
                }}
                placeholder="Start typing address..."
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                data-testid="input-project-address"
                style={{ position: 'relative', zIndex: 1 }}
              />
            </div>
            {city && (
              <p className="text-xs text-muted-foreground mt-1">
                {city}, {state} {zipCode}
              </p>
            )}
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
