import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Loader2, Plus, Trash2, Edit, MapPin, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { Geofence, Project } from '@shared/schema';

// Google Maps types
declare global {
  interface Window {
    google: any;
    initMap: () => void;
  }
}

export default function AdminGeofences() {
  const { toast } = useToast();
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<any>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [selectedGeofence, setSelectedGeofence] = useState<Geofence | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  // Drawing state
  const [drawingCircle, setDrawingCircle] = useState<any>(null);
  const [existingCircles, setExistingCircles] = useState<any[]>([]);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    latitude: '',
    longitude: '',
    radius: '152.4', // 500 feet default
    projectId: '',
  });

  // Fetch geofences and projects
  const { data: geofences = [], isLoading: loadingGeofences } = useQuery<Geofence[]>({
    queryKey: ['/api/geofences'],
  });

  const { data: projects = [], isLoading: loadingProjects } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest('POST', '/api/geofences', {
        name: data.name,
        latitude: data.latitude, // Keep as string - database stores text
        longitude: data.longitude, // Keep as string - database stores text
        radius: parseFloat(data.radius),
        projectId: data.projectId || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/geofences'] });
      toast({ title: 'Geofence created successfully' });
      resetForm();
      setIsCreating(false);
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to create geofence', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: { id: string } & typeof formData) => {
      return apiRequest('PUT', `/api/geofences/${data.id}`, {
        name: data.name,
        latitude: data.latitude, // Keep as string - database stores text
        longitude: data.longitude, // Keep as string - database stores text
        radius: parseFloat(data.radius),
        projectId: data.projectId || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/geofences'] });
      toast({ title: 'Geofence updated successfully' });
      resetForm();
      setSelectedGeofence(null);
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to update geofence', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/geofences/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/geofences'] });
      toast({ title: 'Geofence deleted successfully' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to delete geofence', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      latitude: '',
      longitude: '',
      radius: '152.4',
      projectId: '',
    });
    if (drawingCircle) {
      drawingCircle.setMap(null);
      setDrawingCircle(null);
    }
  };

  // Load Google Maps
  useEffect(() => {
    if (window.google?.maps) {
      setIsMapLoaded(true);
      return;
    }

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('Google Maps API key not configured');
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=drawing,geometry`;
    script.async = true;
    script.defer = true;
    script.onload = () => setIsMapLoaded(true);
    document.head.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  // Initialize map
  useEffect(() => {
    if (!isMapLoaded || !mapRef.current || googleMapRef.current) return;

    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: 37.7749, lng: -122.4194 }, // San Francisco default
      zoom: 12,
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: true,
    });

    googleMapRef.current = map;

    // Add click listener for placing geofences
    map.addListener('click', (event: { latLng: { lat: () => number; lng: () => number } }) => {
      if (isCreating) {
        const lat = event.latLng.lat();
        const lng = event.latLng.lng();
        
        setFormData(prev => ({
          ...prev,
          latitude: lat.toFixed(6),
          longitude: lng.toFixed(6),
        }));

        // Remove existing drawing circle
        if (drawingCircle) {
          drawingCircle.setMap(null);
        }

        // Create new circle
        const circle = new window.google.maps.Circle({
          strokeColor: '#3B82F6',
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: '#3B82F6',
          fillOpacity: 0.2,
          map,
          center: { lat, lng },
          radius: parseFloat(formData.radius),
          editable: true,
          draggable: true,
        });

        // Update form when circle is edited
        circle.addListener('radius_changed', () => {
          setFormData(prev => ({
            ...prev,
            radius: circle.getRadius().toFixed(1),
          }));
        });

        circle.addListener('center_changed', () => {
          const center = circle.getCenter();
          setFormData(prev => ({
            ...prev,
            latitude: center.lat().toFixed(6),
            longitude: center.lng().toFixed(6),
          }));
        });

        setDrawingCircle(circle);
      }
    });
  }, [isMapLoaded, isCreating, formData.radius]);

  // Render existing geofences on map
  useEffect(() => {
    if (!googleMapRef.current) return;

    // Always clear existing circles/markers (even when list is empty)
    existingCircles.forEach(circle => circle.setMap(null));
    setExistingCircles([]);
    
    if (!geofences.length) return;

    const circles = geofences.map((geofence: Geofence) => {
      const circle = new window.google.maps.Circle({
        strokeColor: '#10B981',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#10B981',
        fillOpacity: 0.15,
        map: googleMapRef.current,
        center: { lat: parseFloat(geofence.latitude), lng: parseFloat(geofence.longitude) },
        radius: geofence.radius,
        clickable: true,
      });

      // Add marker with label
      const marker = new window.google.maps.Marker({
        position: { lat: parseFloat(geofence.latitude), lng: parseFloat(geofence.longitude) },
        map: googleMapRef.current,
        label: {
          text: geofence.name,
          color: '#1F2937',
          fontSize: '12px',
          fontWeight: 'bold',
        },
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#10B981',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      });

      // Click to edit
      circle.addListener('click', () => {
        setSelectedGeofence(geofence);
        setFormData({
          name: geofence.name,
          latitude: geofence.latitude.toString(),
          longitude: geofence.longitude.toString(),
          radius: geofence.radius.toString(),
          projectId: geofence.projectId || '',
        });
        setIsCreating(false);
      });

      marker.addListener('click', () => {
        setSelectedGeofence(geofence);
        setFormData({
          name: geofence.name,
          latitude: geofence.latitude.toString(),
          longitude: geofence.longitude.toString(),
          radius: geofence.radius.toString(),
          projectId: geofence.projectId || '',
        });
        setIsCreating(false);
      });

      return { circle, marker };
    });

    setExistingCircles(circles.map((c: { circle: any; marker: any }) => [c.circle, c.marker]).flat());
  }, [geofences, isMapLoaded]);

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.latitude || !formData.longitude || !formData.radius) {
      toast({ 
        title: 'Missing required fields', 
        description: 'Please fill in all required fields',
        variant: 'destructive' 
      });
      return;
    }

    if (selectedGeofence) {
      updateMutation.mutate({ id: selectedGeofence.id, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  // Handle delete
  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this geofence?')) {
      deleteMutation.mutate(id);
      if (selectedGeofence?.id === id) {
        resetForm();
        setSelectedGeofence(null);
      }
    }
  };

  // Start creating new geofence
  const startCreating = () => {
    setIsCreating(true);
    setSelectedGeofence(null);
    resetForm();
  };

  const isLoading = loadingGeofences || loadingProjects;

  if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Google Maps Not Configured</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Please configure VITE_GOOGLE_MAPS_API_KEY to use the geofence management feature.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-96 border-r flex flex-col bg-background">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold">Geofence Management</h1>
            <Button 
              size="icon" 
              onClick={startCreating}
              disabled={isCreating}
              data-testid="button-create-geofence"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Create and manage job site geofences for automatic time tracking
          </p>
        </div>

        {/* Form */}
        {(isCreating || selectedGeofence) && (
          <div className="p-4 border-b bg-muted/30">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">
                  {selectedGeofence ? 'Edit Geofence' : 'New Geofence'}
                </h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    resetForm();
                    setSelectedGeofence(null);
                    setIsCreating(false);
                  }}
                  data-testid="button-cancel"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Geofence Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Main Construction Site"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                  data-testid="input-geofence-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="projectId">Linked Project (Optional)</Label>
                <Select
                  value={formData.projectId}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, projectId: value }))}
                >
                  <SelectTrigger data-testid="select-project">
                    <SelectValue placeholder="Select project..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No project</SelectItem>
                    {projects
                      .filter((p: Project) => !p.deletedAt)
                      .map((project: Project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label htmlFor="latitude">Latitude *</Label>
                  <Input
                    id="latitude"
                    type="number"
                    step="0.000001"
                    placeholder="37.7749"
                    value={formData.latitude}
                    onChange={(e) => setFormData(prev => ({ ...prev, latitude: e.target.value }))}
                    required
                    data-testid="input-latitude"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="longitude">Longitude *</Label>
                  <Input
                    id="longitude"
                    type="number"
                    step="0.000001"
                    placeholder="-122.4194"
                    value={formData.longitude}
                    onChange={(e) => setFormData(prev => ({ ...prev, longitude: e.target.value }))}
                    required
                    data-testid="input-longitude"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="radius">Radius (meters) *</Label>
                <Input
                  id="radius"
                  type="number"
                  step="0.1"
                  placeholder="152.4 (500 feet)"
                  value={formData.radius}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, radius: e.target.value }));
                    if (drawingCircle) {
                      drawingCircle.setRadius(parseFloat(e.target.value));
                    }
                  }}
                  required
                  data-testid="input-radius"
                />
                <p className="text-xs text-muted-foreground">
                  500 feet = 152.4 meters (recommended)
                </p>
              </div>

              {isCreating && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-md">
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    <MapPin className="w-4 h-4 inline mr-1" />
                    Click on the map to place the geofence
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save-geofence"
                >
                  {(createMutation.isPending || updateMutation.isPending) ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      {selectedGeofence ? 'Update' : 'Create'}
                    </>
                  )}
                </Button>
                {selectedGeofence && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => handleDelete(selectedGeofence.id)}
                    disabled={deleteMutation.isPending}
                    data-testid="button-delete-geofence"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </form>
          </div>
        )}

        {/* Geofence List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : geofences.length === 0 ? (
            <div className="p-8 text-center">
              <MapPin className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No geofences yet. Click the + button to create one.
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {geofences.map((geofence: Geofence) => {
                const project = projects.find((p: Project) => p.id === geofence.projectId);
                const isSelected = selectedGeofence?.id === geofence.id;

                return (
                  <Card
                    key={geofence.id}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => {
                      setSelectedGeofence(geofence);
                      setFormData({
                        name: geofence.name,
                        latitude: geofence.latitude.toString(),
                        longitude: geofence.longitude.toString(),
                        radius: geofence.radius.toString(),
                        projectId: geofence.projectId || '',
                      });
                      setIsCreating(false);
                      
                      // Center map on geofence
                      if (googleMapRef.current) {
                        googleMapRef.current.setCenter({
                          lat: parseFloat(geofence.latitude),
                          lng: parseFloat(geofence.longitude),
                        });
                        googleMapRef.current.setZoom(15);
                      }
                    }}
                    data-testid={`card-geofence-${geofence.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">{geofence.name}</h3>
                          {project && (
                            <p className="text-sm text-muted-foreground truncate">
                              {project.name}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                            <span>{geofence.radius}m radius</span>
                            <span>•</span>
                            <span className="truncate">
                              {parseFloat(geofence.latitude).toFixed(4)}, {parseFloat(geofence.longitude).toFixed(4)}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(geofence.id);
                          }}
                          data-testid={`button-delete-${geofence.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        {!isMapLoaded ? (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : null}
        <div ref={mapRef} className="w-full h-full" data-testid="map-container" />
      </div>
    </div>
  );
}
