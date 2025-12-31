import { useInfiniteQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Image as ImageIcon, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { getApiUrl } from "@/lib/apiUrl";

interface Photo {
  id: string;
  projectId: string;
  url: string;
  thumbnailUrl?: string;
  caption?: string;
  createdAt: string;
  tags?: { id: string; name: string; color: string }[];
}

interface PhotosResponse {
  photos: Photo[];
  nextCursor?: string;
  total?: number;
}

export default function AllPhotos() {
  const parentRef = useRef<HTMLDivElement>(null);

  // Fetch all photos with infinite scroll
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useInfiniteQuery({
    queryKey: ['/api/photos'],
    queryFn: async ({ pageParam }) => {
      const url = pageParam 
        ? `/api/photos?cursor=${encodeURIComponent(pageParam)}&limit=50`
        : '/api/photos?limit=50';
      const res = await fetch(getApiUrl(url));
      if (!res.ok) throw new Error('Failed to fetch photos');
      return res.json() as Promise<PhotosResponse>;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  // Flatten all photos from pages
  const allPhotos = useMemo(() => {
    return data?.pages.flatMap(page => page.photos) ?? [];
  }, [data]);

  // Get the most recent total from any page (they should all be the same)
  const totalPhotos = useMemo(() => {
    if (!data?.pages || data.pages.length === 0) return 0;
    // Get total from the most recently fetched page
    const latestPage = data.pages[data.pages.length - 1];
    return latestPage?.total ?? 0;
  }, [data]);

  // Group photos by date
  const photosByDate = useMemo(() => {
    const groups = new Map<string, Photo[]>();
    
    allPhotos.forEach(photo => {
      const date = format(new Date(photo.createdAt), 'MMMM d, yyyy');
      if (!groups.has(date)) {
        groups.set(date, []);
      }
      groups.get(date)!.push(photo);
    });

    return Array.from(groups.entries()).map(([date, photos]) => ({
      date,
      photos,
    }));
  }, [allPhotos]);

  // Auto-load more when scrolling near bottom
  useEffect(() => {
    const element = parentRef.current;
    if (!element) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = element;
      const threshold = 500; // Load more when 500px from bottom

      if (scrollHeight - scrollTop - clientHeight < threshold && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    };

    element.addEventListener('scroll', handleScroll);
    return () => element.removeEventListener('scroll', handleScroll);
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 h-14 border-b">
        <div className="flex items-center gap-3">
          <Link href="/projects">
            <Button
              variant="ghost"
              size="icon"
              data-testid="button-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-semibold">All Photos</h1>
        </div>
        {totalPhotos > 0 && (
          <span className="text-sm text-muted-foreground" data-testid="text-photo-count">
            {totalPhotos} {totalPhotos === 1 ? 'photo' : 'photos'}
          </span>
        )}
      </header>

      {/* Main content */}
      <main
        ref={parentRef}
        className="flex-1 overflow-y-auto px-4 pb-20"
        data-testid="main-all-photos"
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <p className="text-destructive">Failed to load photos</p>
            <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/photos'] })}>
              Retry
            </Button>
          </div>
        ) : allPhotos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-muted-foreground">
            <ImageIcon className="w-16 h-16" />
            <p className="text-center">No photos yet</p>
            <Link href="/camera">
              <Button>Take a Photo</Button>
            </Link>
          </div>
        ) : (
          <div className="py-4 space-y-6">
            {photosByDate.map(({ date, photos }) => (
              <div key={date} data-testid={`date-group-${date}`}>
                <h2 className="text-lg font-semibold mb-4">{date}</h2>
                <div
                  className="grid gap-0.5"
                  style={{
                    gridTemplateColumns: 'repeat(3, 1fr)',
                  }}
                >
                  {photos.map((photo) => (
                    <Link
                      key={photo.id}
                      href={`/photo/${photo.id}/view`}
                      data-testid={`photo-${photo.id}`}
                    >
                      <div
                        className="relative aspect-square bg-muted overflow-hidden cursor-pointer hover-elevate"
                      >
                        <img
                          src={getApiUrl(`/api/photos/${photo.id}/thumbnail`)}
                          alt={photo.caption || 'Photo'}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        {photo.tags && photo.tags.length > 0 && (
                          <div className="absolute bottom-1 left-1 flex gap-1">
                            {photo.tags.slice(0, 2).map(tag => (
                              <div
                                key={tag.id}
                                className="px-1.5 py-0.5 rounded text-xs font-medium text-white"
                                style={{ backgroundColor: tag.color }}
                              >
                                {tag.name}
                              </div>
                            ))}
                            {photo.tags.length > 2 && (
                              <div className="px-1.5 py-0.5 rounded text-xs font-medium bg-black/70 text-white">
                                +{photo.tags.length - 2}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}

            {/* Loading more indicator */}
            {isFetchingNextPage && (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Load more button (fallback) */}
            {hasNextPage && !isFetchingNextPage && (
              <div className="flex justify-center py-4">
                <Button
                  onClick={() => fetchNextPage()}
                  variant="outline"
                  data-testid="button-load-more"
                >
                  Load More Photos
                </Button>
              </div>
            )}

            {/* End indicator */}
            {!hasNextPage && allPhotos.length > 0 && (
              <div className="flex justify-center py-8">
                <p className="text-sm text-muted-foreground">
                  That's all your photos!
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
