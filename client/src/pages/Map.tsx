import { useEffect, useRef, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Navigation, MapPin, Search, Star, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLocation } from 'wouter';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import type { Project } from '@shared/schema';

// Google Maps types
declare global {
  interface Window {
    google: any;
    initMap: () => void;
  }
}

// Calculate distance between two coordinates in km using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

type ProjectWithDistance = Project & { distance?: number };

export default function Map() {
  const [, setLocation] = useLocation();
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const markerClustererRef = useRef<any>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  
  // GPS and UI state
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'distance'>('name');
  const [showProjectList, setShowProjectList] = useState(false);

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });
  
  // Get user's favorites
  const { data: favoriteIds = [] } = useQuery<string[]>({
    queryKey: ['/api/user/favorite-projects'],
  });

  // Filter projects with valid coordinates and calculate distances
  const projectsWithCoords = useMemo(() => {
    const filtered = projects.filter(
      p => p.latitude && p.longitude && !p.deletedAt
    );
    
    // Add distance calculation if user location is available
    if (userLocation) {
      return filtered.map(project => ({
        ...project,
        distance: calculateDistance(
          userLocation.lat,
          userLocation.lng,
          parseFloat(project.latitude!),
          parseFloat(project.longitude!)
        ),
      })) as ProjectWithDistance[];
    }
    
    return filtered as ProjectWithDistance[];
  }, [projects, userLocation]);
  
  // Filter and sort projects based on search and sort options
  const filteredSortedProjects = useMemo(() => {
    let result = projectsWithCoords;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.address?.toLowerCase().includes(query)
      );
    }
    
    // Apply sorting
    if (sortBy === 'distance' && userLocation) {
      result = [...result].sort((a, b) => (a.distance || 0) - (b.distance || 0));
    } else {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    }
    
    return result;
  }, [projectsWithCoords, searchQuery, sortBy, userLocation]);
  
  // Get user's current location
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.log('Location access denied or unavailable:', error.message);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
      );
    }
  }, []);

  // Load Google Maps script and MarkerClusterer
  useEffect(() => {
    if (window.google?.maps) {
      setIsMapLoaded(true);
      return;
    }

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('Google Maps API key not found');
      return;
    }

    // Check if script already exists in document to prevent duplication
    const existingScript = document.querySelector(
      'script[src^="https://maps.googleapis.com/maps/api/js"]'
    );
    
    if (existingScript) {
      // Script is already loading or loaded, wait for it
      const checkLoaded = setInterval(() => {
        if (window.google?.maps) {
          setIsMapLoaded(true);
          clearInterval(checkLoaded);
        }
      }, 100);
      
      return () => clearInterval(checkLoaded);
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=marker,places&loading=async`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      // Wait for google.maps.Map to actually be available
      const checkMapReady = setInterval(() => {
        if (window.google?.maps?.Map) {
          setIsMapLoaded(true);
          clearInterval(checkMapReady);
        }
      }, 50);
      
      // Fallback timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkMapReady);
        if (!window.google?.maps?.Map) {
          console.error('Google Maps API failed to load within timeout');
        }
      }, 10000);
    };

    document.head.appendChild(script);

    return () => {
      // Don't remove the script on unmount - it can be reused
      // This prevents re-downloading the Maps SDK on navigation
      if ('initMap' in window) {
        delete (window as any).initMap;
      }
    };
  }, []);

  // Initialize map
  useEffect(() => {
    if (!isMapLoaded || !mapRef.current || googleMapRef.current) return;

    // Double-check that Google Maps API is actually available
    if (!window.google?.maps?.Map) {
      console.error('Google Maps API not ready yet');
      return;
    }

    try {
      const defaultCenter = { lat: 37.7749, lng: -122.4194 }; // San Francisco
      
      googleMapRef.current = new window.google.maps.Map(mapRef.current, {
        center: defaultCenter,
        zoom: 12,
        gestureHandling: 'greedy', // Enable one-finger panning on mobile
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }],
          },
        ],
      });
    } catch (error) {
      console.error('Failed to initialize Google Maps:', error);
    }
  }, [isMapLoaded]);

  // Add markers for projects - using filtered/sorted list with clustering
  useEffect(() => {
    if (!googleMapRef.current || !window.google?.maps) return;

    // Properly dispose of old clusterer to prevent memory leaks
    if (markerClustererRef.current) {
      markerClustererRef.current.clearMarkers();
      markerClustererRef.current.setMap(null);
      markerClustererRef.current = null;
    }
    
    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    if (filteredSortedProjects.length === 0) return;

    const bounds = new window.google.maps.LatLngBounds();
    const markers: any[] = [];

    filteredSortedProjects.forEach(project => {
      // Validate coordinates are valid numbers
      const lat = parseFloat(project.latitude!);
      const lng = parseFloat(project.longitude!);
      
      if (!isFinite(lat) || !isFinite(lng)) {
        console.warn('Invalid coordinates for project:', project.name);
        return;
      }

      const position = {
        lat,
        lng,
      };

      // Check if this project is favorited
      const isFavorited = favoriteIds.includes(project.id);
      
      // Create custom marker with different color for favorites
      // Note: Don't set map here - will be managed by MarkerClusterer
      const marker = new window.google.maps.Marker({
        position,
        title: project.name,
        icon: isFavorited ? {
          path: window.google.maps.SymbolPath.CIRCLE,
          fillColor: '#f59e0b', // Orange for favorites
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
          scale: 10,
        } : undefined, // Default red marker for non-favorites
      });

      // Create info window content using DOM to prevent XSS
      const infoContent = document.createElement('div');
      infoContent.style.padding = '8px';
      infoContent.style.minWidth = '200px';

      const title = document.createElement('h3');
      title.style.margin = '0 0 8px 0';
      title.style.fontWeight = '600';
      title.style.fontSize = '14px';
      title.textContent = project.name;
      if (isFavorited) {
        const star = document.createElement('span');
        star.textContent = ' ⭐';
        title.appendChild(star);
      }
      infoContent.appendChild(title);

      if (project.address) {
        const address = document.createElement('p');
        address.style.margin = '0 0 8px 0';
        address.style.color = '#666';
        address.style.fontSize = '12px';
        address.textContent = project.address;
        infoContent.appendChild(address);
      }
      
      // Show distance if available
      if (project.distance !== undefined) {
        const distance = document.createElement('p');
        distance.style.margin = '0 0 12px 0';
        distance.style.color = '#0ea5e9';
        distance.style.fontSize = '12px';
        distance.style.fontWeight = '600';
        distance.textContent = project.distance < 1
          ? `${(project.distance * 1000).toFixed(0)}m away`
          : `${project.distance.toFixed(1)}km away`;
        infoContent.appendChild(distance);
      }

      const button = document.createElement('button');
      button.textContent = 'Open in Maps';
      button.style.background = '#007AFF';
      button.style.color = 'white';
      button.style.border = 'none';
      button.style.borderRadius = '8px';
      button.style.padding = '8px 16px';
      button.style.fontSize = '13px';
      button.style.fontWeight = '500';
      button.style.cursor = 'pointer';
      button.style.width = '100%';
      button.onclick = () => {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const url = isIOS
          ? `maps://maps.apple.com/?q=${lat},${lng}`
          : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
        window.open(url, '_blank');
      };
      infoContent.appendChild(button);

      const infoWindow = new window.google.maps.InfoWindow({
        content: infoContent,
      });

      marker.addListener('click', () => {
        infoWindow.open(googleMapRef.current, marker);
      });

      markers.push(marker);
      bounds.extend(position);
    });

    // Create MarkerClusterer to group nearby markers
    if (markers.length > 0) {
      markerClustererRef.current = new MarkerClusterer({
        map: googleMapRef.current,
        markers,
        // Use default algorithm with custom radius for clustering
      });
      
      markersRef.current = markers;
    }

    // Fit map to show all markers
    if (filteredSortedProjects.length > 0) {
      googleMapRef.current.fitBounds(bounds);
      
      // Prevent zooming in too much for single markers
      const listener = window.google.maps.event.addListenerOnce(
        googleMapRef.current,
        'bounds_changed',
        () => {
          if (googleMapRef.current.getZoom() > 15) {
            googleMapRef.current.setZoom(15);
          }
        }
      );
    }
  }, [filteredSortedProjects, isMapLoaded, favoriteIds]);


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="loading-map">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <MapPin className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Map Not Available</h2>
        <p className="text-muted-foreground">
          Google Maps API key is required to display the map view.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-black">
      {/* Header */}
      <div className="space-y-3 px-4 pt-safe-3 pb-3 border-b border-border">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold" data-testid="text-page-title">Locations</h1>
          {filteredSortedProjects.length > 0 && (
            <Badge variant="secondary" data-testid="badge-project-count">
              {filteredSortedProjects.length} {filteredSortedProjects.length === 1 ? 'project' : 'projects'}
            </Badge>
          )}
        </div>
        
        {/* Search and Sort Controls */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-projects"
            />
          </div>
          <Select value={sortBy} onValueChange={(value: 'name' | 'distance') => setSortBy(value)}>
            <SelectTrigger className="w-[140px]" data-testid="select-sort-by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">By Name</SelectItem>
              <SelectItem value="distance" disabled={!userLocation}>
                By Distance {!userLocation && '(GPS off)'}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* User location status */}
        {userLocation && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Navigation className="w-3 h-3" />
            <span>Your location detected • Showing distances</span>
          </div>
        )}
      </div>

      {/* Map Container */}
      <div className="flex-1 relative min-h-0">
        {!isMapLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
            <div className="text-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Loading map...</p>
            </div>
          </div>
        )}
        
        <div 
          ref={mapRef} 
          className="absolute inset-0 w-full h-full"
          data-testid="map-container"
        />

        {projectsWithCoords.length === 0 && isMapLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="text-center p-6">
              <MapPin className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">No Projects with Locations</h2>
              <p className="text-muted-foreground">
                Add locations to your projects to see them on the map.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
