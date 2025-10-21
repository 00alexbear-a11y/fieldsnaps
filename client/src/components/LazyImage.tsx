import { useState, useEffect, useRef } from 'react';
import { WifiOff } from 'lucide-react';

interface LazyImageProps {
  src: string;
  thumbnailSrc?: string;
  alt: string;
  className?: string;
}

export default function LazyImage({ src, thumbnailSrc, alt, className = '' }: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string | undefined>(undefined);
  const [isLoadingFullRes, setIsLoadingFullRes] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '50px',
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  // Load thumbnail first, then full-res when in view
  useEffect(() => {
    if (!isInView) return;

    if (thumbnailSrc) {
      setCurrentSrc(thumbnailSrc);
      setIsLoaded(true);
      
      setIsLoadingFullRes(true);
      const fullImg = new Image();
      fullImg.src = src;
      fullImg.crossOrigin = 'use-credentials';
      fullImg.onload = () => {
        setCurrentSrc(src);
        setIsLoadingFullRes(false);
      };
      fullImg.onerror = () => {
        setIsLoadingFullRes(false);
      };
    } else {
      setCurrentSrc(src);
    }
  }, [isInView, src, thumbnailSrc]);

  // Reset error state when src changes
  useEffect(() => {
    setHasError(false);
    setIsLoaded(false);
    setCurrentSrc(undefined);
  }, [src]);

  return (
    <div className="relative w-full h-full">
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}
      
      {/* Error fallback for offline photos */}
      {hasError && (
        <div className="absolute inset-0 bg-muted flex flex-col items-center justify-center p-4 text-center">
          <WifiOff className="w-8 h-8 text-muted-foreground mb-2" />
          <p className="text-xs text-muted-foreground">
            Connect to internet to view
          </p>
        </div>
      )}
      
      <img
        ref={imgRef}
        src={currentSrc}
        alt={alt}
        crossOrigin="use-credentials"
        className={`${className} ${!isLoaded || hasError ? 'opacity-0' : 'opacity-100'} ${isLoadingFullRes && thumbnailSrc ? 'blur-sm' : ''} transition-all duration-300`}
        onLoad={() => {
          if (!thumbnailSrc) {
            setIsLoaded(true);
          }
          setHasError(false);
        }}
        onError={() => setHasError(true)}
      />
    </div>
  );
}
