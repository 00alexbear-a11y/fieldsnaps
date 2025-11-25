import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Loader2, MapPin, Battery, Clock, Navigation, Locate, Plus, Minus, Layers } from 'lucide-react';
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
  const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('roadmap');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isBottomSheetExpanded, setIsBottomSheetExpanded] = useState(false);
  const [hasInitialCentered, setHasInitialCentered] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const workerMarkersRef = useRef<google.maps.Marker[]>([]);
  const geofenceMarkersRef = useRef<google.maps.Marker[]>([]);
  const geofenceCirclesRef = useRef<google.maps.Circle[]>([]);
  const userMarkerRef = useRef<google.maps.Marker | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number>(0);
  const isDragging = useRef<boolean>(false);

  // Fetch recent location logs
  const { data: locationLogs = [], isLoading, refetch } = useQuery<LocationLog[]>({
    queryKey: ['/api/locations/recent', { minutes: timeWindow }],
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  // Fetch geofences (project locations)
  const { data: geofences = [] } = useQuery<Array<{
    id: string;
    projectId: string;
    latitude: string;
    longitude: string;
    radiusMeters: number;
    project?: { id: string; name: string };
  }>>({
    queryKey: ['/api/geofences'],
    refetchInterval: 60000, // Refresh every minute to catch project updates
  });

  // Group locations by user (show most recent per user)
  const latestLocationsByUser = locationLogs.reduce((acc, log) => {
    if (!acc[log.userId] || new Date(log.timestamp) > new Date(acc[log.userId].timestamp)) {
      acc[log.userId] = log;
    }
    return acc;
  }, {} as Record<string, LocationLog>);

  const workerLocations = Object.values(latestLocationsByUser);

  // Filter worker locations based on search
  const filteredWorkers = workerLocations.filter(log => {
    if (!searchQuery.trim()) return true;
    const workerName = `${log.user.firstName || ''} ${log.user.lastName || ''}`.trim().toLowerCase();
    const projectName = log.project?.name.toLowerCase() || '';
    const query = searchQuery.toLowerCase();
    return workerName.includes(query) || projectName.includes(query);
  });

  // Watch user's current location (continuous tracking)
  useEffect(() => {
    if (navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error('Error watching user location:', error);
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
      );
    }

    // Cleanup watch on unmount
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Auto-center map on user location when it first becomes available
  useEffect(() => {
    if (googleMapRef.current && userLocation && !hasInitialCentered && isMapLoaded) {
      googleMapRef.current.setCenter(userLocation);
      googleMapRef.current.setZoom(14);
      setHasInitialCentered(true);
    }
  }, [userLocation, isMapLoaded, hasInitialCentered]);

  // Update user location marker
  useEffect(() => {
    if (!googleMapRef.current || !isMapLoaded || !userLocation) return;

    // Remove existing user marker
    if (userMarkerRef.current) {
      userMarkerRef.current.setMap(null);
    }

    // Create blue pulsing dot for user location
    userMarkerRef.current = new window.google.maps.Marker({
      position: userLocation,
      map: googleMapRef.current,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#3B82F6',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 3,
      },
      zIndex: 1000,
    });
  }, [userLocation, isMapLoaded]);

  // Toggle map type
  useEffect(() => {
    if (googleMapRef.current && isMapLoaded) {
      googleMapRef.current.setMapTypeId(mapType);
    }
  }, [mapType, isMapLoaded]);

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
          center: userLocation || { lat: 37.7749, lng: -122.4194 }, // Default to user or SF
          mapTypeId: 'roadmap',
          streetViewControl: false,
          fullscreenControl: false,
          mapTypeControl: false,
          zoomControl: false,
          gestureHandling: 'greedy',
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

  // Update geofence circles when geofences change
  useEffect(() => {
    if (!googleMapRef.current || !isMapLoaded) return;

    // Clear existing geofence circles and markers
    geofenceCirclesRef.current.forEach(circle => circle.setMap(null));
    geofenceCirclesRef.current = [];
    geofenceMarkersRef.current.forEach(marker => marker.setMap(null));
    geofenceMarkersRef.current = [];

    if (geofences.length === 0) return;

    // Add circle for each geofence
    geofences.forEach((geofence) => {
      const lat = parseFloat(geofence.latitude);
      const lng = parseFloat(geofence.longitude);
      const position = { lat, lng };

      // Create circle
      const circle = new window.google.maps.Circle({
        strokeColor: '#3B82F6',
        strokeOpacity: 0.6,
        strokeWeight: 2,
        fillColor: '#3B82F6',
        fillOpacity: 0.15,
        map: googleMapRef.current,
        center: position,
        radius: geofence.radiusMeters,
      });

      geofenceCirclesRef.current.push(circle);

      // Add marker at center
      const marker = new window.google.maps.Marker({
        position,
        map: googleMapRef.current,
        title: geofence.project?.name || 'Job Site',
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#3B82F6',
          fillOpacity: 0.8,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      });

      // Info window
      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="padding: 8px;">
            <h3 style="font-weight: 600; margin-bottom: 4px;">${geofence.project?.name || 'Job Site'}</h3>
            <p style="font-size: 12px; color: #666;">Geofence radius: ${geofence.radiusMeters}m</p>
          </div>
        `,
      });

      marker.addListener('click', () => {
        infoWindow.open(googleMapRef.current, marker);
      });

      geofenceMarkersRef.current.push(marker);
    });
  }, [geofences, isMapLoaded]);

  // Update worker markers when locations change
  useEffect(() => {
    if (!googleMapRef.current || !isMapLoaded) return;

    // Clear existing worker markers only
    workerMarkersRef.current.forEach(marker => marker.setMap(null));
    workerMarkersRef.current = [];

    if (filteredWorkers.length === 0) return;

    // Create bounds to fit all markers
    const bounds = new window.google.maps.LatLngBounds();

    // Add markers for each worker
    filteredWorkers.forEach((log) => {
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
        zIndex: 500, // Higher than geofence markers
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

      workerMarkersRef.current.push(marker);
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
  }, [filteredWorkers, isMapLoaded]);

  // Helper function to center map on user location
  const centerOnUser = () => {
    if (googleMapRef.current && userLocation) {
      googleMapRef.current.setCenter(userLocation);
      googleMapRef.current.setZoom(15);
    }
  };

  // Helper function to zoom in/out
  const handleZoom = (direction: 'in' | 'out') => {
    if (!googleMapRef.current) return;
    const currentZoom = googleMapRef.current.getZoom() || 12;
    googleMapRef.current.setZoom(currentZoom + (direction === 'in' ? 1 : -1));
  };

  // Bottom sheet swipe gesture handlers
  const handleSheetPointerDown = (e: React.PointerEvent) => {
    dragStartY.current = e.clientY;
    isDragging.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (sheetRef.current) {
      sheetRef.current.style.transition = 'none';
    }
  };

  const handleSheetPointerMove = (e: React.PointerEvent) => {
    if (dragStartY.current === 0) return;
    
    const deltaY = e.clientY - dragStartY.current;
    
    // Mark as dragging if moved more than 3px
    if (Math.abs(deltaY) > 3) {
      isDragging.current = true;
    }
    
    if (sheetRef.current) {
      if (isBottomSheetExpanded) {
        // When expanded: allow dragging down (positive deltaY), clamp at 0
        const translateY = Math.max(0, deltaY);
        sheetRef.current.style.transform = `translateY(${translateY}px)`;
      } else {
        // When collapsed: allow dragging up (negative deltaY), start from collapsed position
        // Collapsed position is calc(100% - 120px), so upward drag reduces this
        const translateY = Math.min(0, deltaY); // Negative values for upward drag
        sheetRef.current.style.transform = `translateY(calc(100% - 120px + ${translateY}px))`;
      }
    }
  };

  const handleSheetPointerUp = (e: React.PointerEvent) => {
    if (dragStartY.current === 0) return;
    
    const deltaY = e.clientY - dragStartY.current;
    const threshold = 50;
    
    e.currentTarget.releasePointerCapture(e.pointerId);
    
    if (sheetRef.current) {
      sheetRef.current.style.transition = 'transform 0.3s ease-out';
      sheetRef.current.style.transform = '';
    }
    
    // Only process swipe if user actually dragged
    if (isDragging.current) {
      // Swipe down to collapse
      if (isBottomSheetExpanded && deltaY > threshold) {
        setIsBottomSheetExpanded(false);
      }
      // Swipe up to expand
      else if (!isBottomSheetExpanded && deltaY < -threshold) {
        setIsBottomSheetExpanded(true);
      }
    }
    
    dragStartY.current = 0;
  };

  const handleSheetClick = () => {
    // Only toggle on click if user didn't drag
    if (!isDragging.current) {
      setIsBottomSheetExpanded(!isBottomSheetExpanded);
    }
  };

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
    <div className="relative h-screen w-full overflow-hidden">
      {/* Full Viewport Map */}
      <div ref={mapRef} className="absolute inset-0" data-testid="map-container" />
      
      {!isMapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Frosted Glass Top Control Bar */}
      <div className="absolute top-0 left-0 right-0 z-10 p-3 backdrop-blur-md bg-background/80 border-b">
        <div className="flex items-center gap-2 max-w-7xl mx-auto">
          <Input
            type="search"
            placeholder={`Search ${workerLocations.length} worker${workerLocations.length !== 1 ? 's' : ''} or projects...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 h-9 bg-background/50"
            data-testid="input-search-workers"
          />
          <Select value={timeWindow} onValueChange={setTimeWindow}>
            <SelectTrigger className="w-32 h-9 bg-background/50" data-testid="select-time-window">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5 min</SelectItem>
              <SelectItem value="15">15 min</SelectItem>
              <SelectItem value="30">30 min</SelectItem>
              <SelectItem value="60">1 hour</SelectItem>
              <SelectItem value="120">2 hours</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Floating Map/Satellite Toggle (Bottom-Left) */}
      <div className="absolute bottom-24 left-3 z-10 flex gap-0 rounded-lg overflow-hidden shadow-lg">
        <Button
          variant={mapType === 'roadmap' ? 'default' : 'secondary'}
          size="sm"
          onClick={() => setMapType('roadmap')}
          className="rounded-none rounded-l-lg"
          data-testid="button-map-type-road"
        >
          Map
        </Button>
        <Button
          variant={mapType === 'satellite' ? 'default' : 'secondary'}
          size="sm"
          onClick={() => setMapType('satellite')}
          className="rounded-none rounded-r-lg"
          data-testid="button-map-type-satellite"
        >
          Satellite
        </Button>
      </div>

      {/* Floating Zoom & Locate Controls (Bottom-Right) */}
      <div className="absolute bottom-24 right-3 z-10 flex flex-col gap-2">
        {userLocation && (
          <Button
            variant="secondary"
            size="icon"
            onClick={centerOnUser}
            className="shadow-lg"
            data-testid="button-locate-user"
          >
            <Locate className="w-4 h-4" />
          </Button>
        )}
        <Button
          variant="secondary"
          size="icon"
          onClick={() => handleZoom('in')}
          className="shadow-lg"
          data-testid="button-zoom-in"
        >
          <Plus className="w-4 h-4" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          onClick={() => handleZoom('out')}
          className="shadow-lg"
          data-testid="button-zoom-out"
        >
          <Minus className="w-4 h-4" />
        </Button>
      </div>

      {/* Bottom Sheet - Worker List */}
      <div 
        ref={sheetRef}
        className={`absolute left-0 right-0 bottom-0 z-20 bg-background rounded-t-2xl shadow-2xl border-t transition-transform duration-300 ${
          isBottomSheetExpanded ? 'translate-y-0' : 'translate-y-[calc(100%-120px)]'
        }`}
        data-testid="bottom-sheet-workers"
      >
        {/* Handle for swipe */}
        <div 
          className="flex justify-center pt-3 pb-2 cursor-pointer touch-none"
          onPointerDown={handleSheetPointerDown}
          onPointerMove={handleSheetPointerMove}
          onPointerUp={handleSheetPointerUp}
          onClick={handleSheetClick}
          data-testid="button-toggle-bottom-sheet"
        >
          <div className="w-12 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Worker List Header */}
        <div className="px-4 pb-3 flex items-center justify-between">
          <h2 className="font-semibold">
            {filteredWorkers.length} Worker{filteredWorkers.length !== 1 ? 's' : ''} Nearby
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            disabled={isLoading}
            data-testid="button-refresh-locations"
          >
            <Loader2 className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Worker List Content */}
        <div className="overflow-y-auto pb-safe" style={{ maxHeight: '60vh' }}>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredWorkers.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>{searchQuery ? 'No workers found' : 'No recent location data'}</p>
              {!searchQuery && (
                <p className="text-xs mt-1">Workers need to grant location permissions</p>
              )}
            </div>
          ) : (
            <div className="px-3 pb-4 space-y-2">
              {filteredWorkers.map((log) => {
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
                        setIsBottomSheetExpanded(false);
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
                            <span className="flex items-center gap-1" title="Time since last location update">
                              <Clock className="w-3 h-3" />
                              {minutesAgo === 0 ? 'Just now' : `Seen ${minutesAgo}m ago`}
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
    </div>
  );
}
