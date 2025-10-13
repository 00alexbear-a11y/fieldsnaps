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

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=marker`;
    script.async = true;
    script.defer = true;
    
    window.initMap = () => {
      setIsMapLoaded(true);
    };

    script.onload = () => {
      setIsMapLoaded(true);
    };

    document.head.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
      if ('initMap' in window) {
        delete (window as any).initMap;
      }
    };
  }, []);

  // Initialize map
  useEffect(() => {
    if (!isMapLoaded || !mapRef.current || googleMapRef.current) return;

    const defaultCenter = { lat: 37.7749, lng: -122.4194 }; // San Francisco
    
    googleMapRef.current = new window.google.maps.Map(mapRef.current, {
      center: defaultCenter,
      zoom: 12,
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
      const position = {
        lat: parseFloat(project.latitude!),
        lng: parseFloat(project.longitude!),
      };

      const marker = new window.google.maps.Marker({
        position,
        map: googleMapRef.current,
        title: project.name,
      });

      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="padding: 8px; min-width: 200px;">
            <h3 style="margin: 0 0 8px 0; font-weight: 600; font-size: 14px;">${project.name}</h3>
            ${project.address ? `<p style="margin: 0 0 12px 0; color: #666; font-size: 12px;">${project.address}</p>` : ''}
            <button
              onclick="window.openInMaps('${project.latitude}', '${project.longitude}')"
              style="
                background: #007AFF;
                color: white;
                border: none;
                border-radius: 8px;
                padding: 8px 16px;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                width: 100%;
              "
            >
              Open in Maps
            </button>
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

  // Global function to open maps app
  useEffect(() => {
    (window as any).openInMaps = (lat: string, lng: string) => {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const url = isIOS
        ? `maps://maps.apple.com/?q=${lat},${lng}`
        : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
      window.open(url, '_blank');
    };

    return () => {
      delete (window as any).openInMaps;
    };
  }, []);

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
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h1 className="text-xl font-semibold" data-testid="text-page-title">Project Map</h1>
        {projectsWithCoords.length > 0 && (
          <div className="text-sm text-muted-foreground" data-testid="text-project-count">
            {projectsWithCoords.length} {projectsWithCoords.length === 1 ? 'project' : 'projects'}
          </div>
        )}
      </div>

      {/* Map Container */}
      <div className="flex-1 relative">
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
          className="w-full h-full"
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
