import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Download, ArrowLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import LazyImage from "@/components/LazyImage";
import type { Photo, Project, Share } from "../../../shared/schema";
import { format } from "date-fns";

interface ShareData {
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
    photographerName?: string;
  }>;
}

export default function ShareView() {
  const { token } = useParams();
  const [viewerPhotoIndex, setViewerPhotoIndex] = useState<number | null>(null);

  const { data, isLoading, error } = useQuery<ShareData>({
    queryKey: [`/api/shared/${token}`],
  });

  // Group photos by date (newest first)
  const photosByDate = useMemo(() => {
    if (!data?.photos || data.photos.length === 0) return [];

    type SharedPhoto = ShareData['photos'][0];

    // Sort photos by createdAt (newest first)
    const sortedPhotos = [...data.photos].sort((a, b) => 
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
  }, [data?.photos]);

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

  const { photos, project } = data;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b p-4 bg-background">
        <div>
          <p className="text-sm text-muted-foreground mb-1">Shared with you</p>
          <h1 className="text-xl font-bold">{project.name}</h1>
          {project.description && (
            <p className="text-sm text-muted-foreground mt-1">{project.description}</p>
          )}
        </div>
      </header>

      <main className="flex-1 p-4">
        {photos.length === 0 ? (
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
                    const photoIndex = photos.findIndex(p => p.id === photo.id);
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
                        {photo.photographerName && (
                          <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-primary/80 flex items-center justify-center text-[10px] font-medium">
                              {photo.photographerName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                            </div>
                            <span className="font-medium">{photo.photographerName.split(' ')[0]}</span>
                          </div>
                        )}
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
              onClick={() => handleDownload(photos[viewerPhotoIndex])}
              className="text-white hover:bg-white/20"
              data-testid="button-download"
            >
              <Download className="w-5 h-5" />
            </Button>
          </div>

          {/* Photo */}
          <div className="flex-1 flex items-center justify-center p-4">
            <img
              src={photos[viewerPhotoIndex].url}
              alt={photos[viewerPhotoIndex].caption || "Photo"}
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
              {viewerPhotoIndex + 1} / {photos.length}
            </span>
            <Button
              variant="ghost"
              onClick={() => setViewerPhotoIndex(Math.min(photos.length - 1, viewerPhotoIndex + 1))}
              disabled={viewerPhotoIndex === photos.length - 1}
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
