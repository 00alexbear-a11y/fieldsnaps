import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Navigation, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Project } from '@shared/schema';

// Google Maps types
declare global {
  interface Window {
    google: any;
    initMap: () => void;
  }
}

export default function Map() {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  // Filter projects with valid coordinates
  const projectsWithCoords = projects.filter(
    p => p.latitude && p.longitude && !p.deletedAt
  );

  // Load Google Maps script
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
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=marker&loading=async`;
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

  // Add markers for projects
  useEffect(() => {
    if (!googleMapRef.current || !window.google?.maps) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    if (projectsWithCoords.length === 0) return;

    const bounds = new window.google.maps.LatLngBounds();

    projectsWithCoords.forEach(project => {
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

      const marker = new window.google.maps.Marker({
        position,
        map: googleMapRef.current,
        title: project.name,
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
      infoContent.appendChild(title);

      if (project.address) {
        const address = document.createElement('p');
        address.style.margin = '0 0 12px 0';
        address.style.color = '#666';
        address.style.fontSize = '12px';
        address.textContent = project.address;
        infoContent.appendChild(address);
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

      markersRef.current.push(marker);
      bounds.extend(position);
    });

    // Fit map to show all markers
    if (projectsWithCoords.length > 0) {
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
  }, [projectsWithCoords, isMapLoaded]);


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
    <div className="flex flex-col h-screen bg-white dark:bg-black">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-20 border-b border-border">
        <h1 className="text-xl font-semibold" data-testid="text-page-title">Project Map</h1>
        {projectsWithCoords.length > 0 && (
          <div className="text-sm text-muted-foreground" data-testid="text-project-count">
            {projectsWithCoords.length} {projectsWithCoords.length === 1 ? 'project' : 'projects'}
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
