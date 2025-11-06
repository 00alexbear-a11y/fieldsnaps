import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Download, ArrowLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import LazyImage from "@/components/LazyImage";
import type { Photo, Project, Share } from "../../../shared/schema";
import { format } from "date-fns";

interface ShareData {
  companyName: string | null;
  project: {
    name: string;
    description?: string;
    address?: string;
  };
  photos: Array<{
    id: string;
    url: string;
    caption?: string;
    createdAt: Date;
  }>;
}

export default function ShareView() {
  const { token } = useParams();
  const [viewerPhotoIndex, setViewerPhotoIndex] = useState<number | null>(null);
  const viewLoggedRef = useRef(false);

  const { data, isLoading, error } = useQuery<ShareData>({
    queryKey: [`/api/shared/${token}`],
  });

  // Log view once when data is first loaded
  useEffect(() => {
    if (data && token && !viewLoggedRef.current) {
      viewLoggedRef.current = true;
      fetch(`/api/shared/${token}/view-log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }).catch(err => console.error('Failed to log view:', err));
    }
  }, [data, token]);

  // Transform all photo URLs to use unauthenticated share proxy routes
  const transformedPhotos = useMemo(() => {
    if (!data?.photos || !token) return [];
    return data.photos.map(photo => ({
      ...photo,
      url: `/api/shared/${token}/photos/${photo.id}/image`,
    }));
  }, [data?.photos, token]);

  // Group transformed photos by date (newest first)
  const photosByDate = useMemo(() => {
    if (transformedPhotos.length === 0) return [];

    type SharedPhoto = typeof transformedPhotos[0];

    // Sort photos by createdAt (newest first)
    const sortedPhotos = [...transformedPhotos].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Group by date
    const groups = new Map<string, SharedPhoto[]>();
    sortedPhotos.forEach(photo => {
      const date = format(new Date(photo.createdAt), 'MMMM d, yyyy');
      if (!groups.has(date)) {
        groups.set(date, []);
      }
      groups.get(date)!.push(photo);
    });

    // Convert to array of { date, photos }
    return Array.from(groups.entries()).map(([date, photos]) => ({
      date,
      photos,
    }));
  }, [transformedPhotos]);

  const handleDownload = async (photo: ShareData['photos'][0]) => {
    try {
      const response = await fetch(photo.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `photo-${photo.id}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading shared photos...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold mb-2">Share Not Found</h1>
          <p className="text-muted-foreground mb-6">
            This share link is invalid or has expired.
          </p>
        </div>
      </div>
    );
  }

  const { project } = data;

  const handleDownloadAll = async () => {
    if (transformedPhotos.length === 0) return;

    for (let i = 0; i < transformedPhotos.length; i++) {
      const photo = transformedPhotos[i];
      try {
        const response = await fetch(photo.url);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${project.name.replace(/[^a-z0-9]/gi, '_')}_photo_${i + 1}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        // Add small delay between downloads to avoid overwhelming browser
        if (i < transformedPhotos.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error('Download error for photo', i, error);
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-background">
        <div className="p-4 space-y-4">
          {/* Logo and Company Name */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">FS</span>
              </div>
              <span className="font-semibold text-foreground">FieldSnaps</span>
            </div>
            {data.companyName && (
              <>
                <span className="text-muted-foreground">•</span>
                <span className="text-sm font-medium text-foreground">{data.companyName}</span>
              </>
            )}
          </div>

          {/* Project Details */}
          <div>
            <h1 className="text-xl font-bold text-foreground">{project.name}</h1>
            {project.description && (
              <p className="text-sm text-muted-foreground mt-1">{project.description}</p>
            )}
            {project.address && (
              <p className="text-sm text-muted-foreground mt-1">{project.address}</p>
            )}
          </div>

          {/* Download All Button */}
          {transformedPhotos.length > 0 && (
            <Button
              onClick={handleDownloadAll}
              variant="outline"
              className="w-full sm:w-auto"
              data-testid="button-download-all"
            >
              <Download className="w-4 h-4 mr-2" />
              Download All ({transformedPhotos.length})
            </Button>
          )}
        </div>
      </header>

      <main className="flex-1 p-4">
        {transformedPhotos.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No photos shared</p>
          </div>
        ) : (
          <div className="space-y-8 max-w-6xl mx-auto">
            {photosByDate.map(({ date, photos: datePhotos }) => (
              <div key={date} data-testid={`date-group-${date}`}>
                {/* Date Header */}
                <h2 className="text-lg font-semibold mb-4 text-foreground">
                  {date}
                </h2>
                
                {/* Photos Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {datePhotos.map((photo, index) => {
                    const photoIndex = transformedPhotos.findIndex(p => p.id === photo.id);
                    return (
                      <div
                        key={photo.id}
                        className="relative aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer hover-elevate active-elevate-2"
                        onClick={() => setViewerPhotoIndex(photoIndex)}
                        data-testid={`photo-${photo.id}`}
                      >
                        <LazyImage
                          src={photo.url}
                          alt={photo.caption || "Photo"}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Simple Photo Viewer */}
      {viewerPhotoIndex !== null && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-black/50 backdrop-blur-sm">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewerPhotoIndex(null)}
              className="text-white hover:bg-white/20"
              data-testid="button-close-viewer"
            >
              <X className="w-6 h-6" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDownload(transformedPhotos[viewerPhotoIndex])}
              className="text-white hover:bg-white/20"
              data-testid="button-download"
            >
              <Download className="w-5 h-5" />
            </Button>
          </div>

          {/* Photo */}
          <div className="flex-1 flex items-center justify-center p-4">
            <img
              src={transformedPhotos[viewerPhotoIndex].url}
              alt={transformedPhotos[viewerPhotoIndex].caption || "Photo"}
              className="max-w-full max-h-full object-contain"
            />
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between p-4 bg-black/50 backdrop-blur-sm">
            <Button
              variant="ghost"
              onClick={() => setViewerPhotoIndex(Math.max(0, viewerPhotoIndex - 1))}
              disabled={viewerPhotoIndex === 0}
              className="text-white hover:bg-white/20"
              data-testid="button-prev"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Previous
            </Button>
            <span className="text-white text-sm">
              {viewerPhotoIndex + 1} / {transformedPhotos.length}
            </span>
            <Button
              variant="ghost"
              onClick={() => setViewerPhotoIndex(Math.min(transformedPhotos.length - 1, viewerPhotoIndex + 1))}
              disabled={viewerPhotoIndex === transformedPhotos.length - 1}
              className="text-white hover:bg-white/20"
              data-testid="button-next"
            >
              Next
              <ArrowLeft className="w-5 h-5 ml-2 rotate-180" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
