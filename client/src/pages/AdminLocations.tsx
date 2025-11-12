import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, MapPin, Battery, Clock, Navigation, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

interface LocationLog {
  id: string;
  userId: string;
  projectId: string | null;
  latitude: string;
  longitude: string;
  accuracy: number | null;
  batteryLevel: number | null;
  isMoving: boolean | null;
  timestamp: Date;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  };
  project: {
    id: string;
    name: string;
  } | null;
}

declare global {
  interface Window {
    google: typeof google;
  }
}

export default function AdminLocations() {
  const [timeWindow, setTimeWindow] = useState<string>('30'); // minutes
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

  // Fetch recent location logs
  const { data: locationLogs = [], isLoading, refetch } = useQuery<LocationLog[]>({
    queryKey: ['/api/locations/recent', timeWindow],
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  // Group locations by user (show most recent per user)
  const latestLocationsByUser = locationLogs.reduce((acc, log) => {
    if (!acc[log.userId] || new Date(log.timestamp) > new Date(acc[log.userId].timestamp)) {
      acc[log.userId] = log;
    }
    return acc;
  }, {} as Record<string, LocationLog>);

  const workerLocations = Object.values(latestLocationsByUser);

  // Initialize Google Maps
  useEffect(() => {
    if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY) return;
    
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (mapRef.current && !googleMapRef.current) {
        googleMapRef.current = new window.google.maps.Map(mapRef.current, {
          zoom: 12,
          center: { lat: 37.7749, lng: -122.4194 }, // Default to SF
          mapTypeId: 'roadmap',
          streetViewControl: false,
          fullscreenControl: true,
        });
        setIsMapLoaded(true);
      }
    };
    document.head.appendChild(script);
    
    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  // Update markers when locations change
  useEffect(() => {
    if (!googleMapRef.current || !isMapLoaded) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    if (workerLocations.length === 0) return;

    // Create bounds to fit all markers
    const bounds = new window.google.maps.LatLngBounds();

    // Add markers for each worker
    workerLocations.forEach((log) => {
      const lat = parseFloat(log.latitude);
      const lng = parseFloat(log.longitude);
      const position = { lat, lng };

      const workerName = `${log.user.firstName || ''} ${log.user.lastName || ''}`.trim() || 'Unknown';
      
      const marker = new window.google.maps.Marker({
        position,
        map: googleMapRef.current,
        title: workerName,
        label: {
          text: `${log.user.firstName?.[0] || 'U'}${log.user.lastName?.[0] || ''}`,
          color: '#ffffff',
          fontSize: '12px',
          fontWeight: 'bold',
        },
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 16,
          fillColor: log.isMoving ? '#3B82F6' : '#10B981',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        },
      });

      // Info window
      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="padding: 8px;">
            <h3 style="font-weight: 600; margin-bottom: 4px;">${workerName}</h3>
            ${log.project ? `<p style="font-size: 12px; color: #666;">Project: ${log.project.name}</p>` : ''}
            <p style="font-size: 12px; color: #666;">Last seen: ${format(new Date(log.timestamp), 'h:mm a')}</p>
            ${log.batteryLevel !== null ? `<p style="font-size: 12px; color: #666;">Battery: ${log.batteryLevel}%</p>` : ''}
            ${log.accuracy !== null ? `<p style="font-size: 12px; color: #666;">Accuracy: ${log.accuracy}m</p>` : ''}
          </div>
        `,
      });

      marker.addListener('click', () => {
        infoWindow.open(googleMapRef.current, marker);
      });

      markersRef.current.push(marker);
      bounds.extend(position);
    });

    // Fit map to show all markers
    if (workerLocations.length > 0) {
      googleMapRef.current.fitBounds(bounds);
      
      // Prevent over-zooming on single marker
      const listener = window.google.maps.event.addListenerOnce(googleMapRef.current, 'bounds_changed', () => {
        const zoom = googleMapRef.current?.getZoom();
        if (zoom && zoom > 15) {
          googleMapRef.current?.setZoom(15);
        }
      });
    }
  }, [workerLocations, isMapLoaded]);

  if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Google Maps Not Configured</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Please configure VITE_GOOGLE_MAPS_API_KEY to use the location tracking feature.
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
            <h1 className="text-2xl font-bold">Worker Locations</h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              disabled={isLoading}
              data-testid="button-refresh-locations"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Real-time tracking of worker locations and movement
          </p>

          <div className="space-y-2">
            <label className="text-sm font-medium">Time Window</label>
            <Select value={timeWindow} onValueChange={setTimeWindow}>
              <SelectTrigger data-testid="select-time-window">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">Last 5 minutes</SelectItem>
                <SelectItem value="15">Last 15 minutes</SelectItem>
                <SelectItem value="30">Last 30 minutes</SelectItem>
                <SelectItem value="60">Last hour</SelectItem>
                <SelectItem value="120">Last 2 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Worker List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : workerLocations.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No recent location data</p>
              <p className="text-xs mt-1">Workers need to grant location permissions</p>
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {workerLocations.map((log) => {
                const workerName = `${log.user.firstName || ''} ${log.user.lastName || ''}`.trim() || 'Unknown';
                const minutesAgo = Math.floor((Date.now() - new Date(log.timestamp).getTime()) / 1000 / 60);
                
                return (
                  <Card
                    key={log.id}
                    className="hover-elevate active-elevate-2 cursor-pointer"
                    onClick={() => {
                      if (googleMapRef.current) {
                        googleMapRef.current.setCenter({
                          lat: parseFloat(log.latitude),
                          lng: parseFloat(log.longitude),
                        });
                        googleMapRef.current.setZoom(15);
                      }
                    }}
                    data-testid={`card-worker-${log.userId}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold truncate">{workerName}</h3>
                            {log.isMoving && (
                              <Badge variant="default" className="text-xs">
                                <Navigation className="w-3 h-3 mr-1" />
                                Moving
                              </Badge>
                            )}
                          </div>
                          {log.project && (
                            <p className="text-sm text-muted-foreground truncate mb-2">
                              {log.project.name}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {minutesAgo === 0 ? 'Just now' : `${minutesAgo}m ago`}
                            </span>
                            {log.batteryLevel !== null && (
                              <span className="flex items-center gap-1">
                                <Battery className="w-3 h-3" />
                                {log.batteryLevel}%
                              </span>
                            )}
                            {log.accuracy !== null && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                ±{log.accuracy}m
                              </span>
                            )}
                          </div>
                        </div>
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
