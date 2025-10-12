import { useState, useRef, useEffect } from 'react';
import { Camera as CameraIcon, X, Check, Settings2, PenLine, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { photoCompressionWorker } from '@/lib/photoCompressionWorker';
import { type QualityPreset } from '@/lib/photoCompression';
import { indexedDB as idb } from '@/lib/indexeddb';
import { syncManager } from '@/lib/syncManager';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';

const QUALITY_PRESETS: { value: QualityPreset; label: string; description: string }[] = [
  { value: 'quick', label: 'Quick', description: '200KB - Fast upload' },
  { value: 'standard', label: 'Standard', description: '500KB - Balanced' },
  { value: 'detailed', label: 'Detailed', description: '1MB - High quality' },
];

interface Project {
  id: string;
  name: string;
  description?: string;
}

export default function Camera() {
  const [hasPermission, setHasPermission] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState<QualityPreset>('standard');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [isCapturing, setIsCapturing] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Load projects
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  useEffect(() => {
    // Set first project as default
    if (projects.length > 0 && !selectedProject) {
      setSelectedProject(projects[0].id);
    }
  }, [projects, selectedProject]);

  // Auto-start camera when projects are loaded and camera is not yet active
  useEffect(() => {
    if (projects.length > 0 && !isActive) {
      startCamera();
    }
  }, [projects]);

  // Cleanup camera when component unmounts
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        
        console.log('[Camera] Stream set, videoRef dimensions:', videoRef.current.videoWidth, 'x', videoRef.current.videoHeight);
        
        // Explicitly play the video (required for iOS Safari)
        try {
          await videoRef.current.play();
          console.log('[Camera] Video play() successful');
        } catch (playError) {
          console.error('[Camera] Video play error:', playError);
        }
        
        setHasPermission(true);

        // Wait for video metadata to load so dimensions are available
        await new Promise<void>((resolve) => {
          const video = videoRef.current;
          if (!video) {
            resolve();
            return;
          }

          // If metadata already loaded, resolve immediately
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            console.log('[Camera] Metadata already loaded, dimensions:', video.videoWidth, 'x', video.videoHeight);
            resolve();
            return;
          }

          // Otherwise wait for loadedmetadata event
          const handleLoadedMetadata = () => {
            console.log('[Camera] Metadata loaded, dimensions:', video.videoWidth, 'x', video.videoHeight);
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            resolve();
          };
          video.addEventListener('loadedmetadata', handleLoadedMetadata);

          // Timeout after 5 seconds
          setTimeout(() => {
            console.warn('[Camera] Metadata load timeout after 5 seconds');
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            resolve();
          }, 5000);
        });

        // NOW set isActive after metadata has loaded
        setIsActive(true);
        console.log('[Camera] isActive set to true, loading overlay should hide');
      }
    } catch (error) {
      console.error('Camera error:', error);
      toast({
        title: 'Camera Error',
        description: 'Unable to access camera. Please check permissions.',
        variant: 'destructive',
      });
      throw error; // Re-throw so caller knows it failed
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
  };

  // Quick capture mode: Capture photo and continue shooting
  const quickCapture = async () => {
    if (!selectedProject || isCapturing || !isActive) return;

    setIsCapturing(true);

    try {
      if (!videoRef.current) {
        throw new Error('Video element not available');
      }

      // Verify video has valid dimensions
      if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
        throw new Error('Camera not ready - please wait a moment and try again');
      }
      // Create canvas to capture frame
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context');

      ctx.drawImage(video, 0, 0);

      // Convert to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Failed to create blob'))),
          'image/jpeg',
          0.95
        );
      });

      // Compress photo using Web Worker (non-blocking)
      const compressionResult = await photoCompressionWorker.compressPhoto(blob, selectedQuality);

      // Save to IndexedDB (blob only - URL created on-demand when loading)
      const savedPhoto = await idb.savePhoto({
        projectId: selectedProject,
        blob: compressionResult.blob,
        quality: selectedQuality,
        caption: '',
        timestamp: Date.now(),
        syncStatus: 'pending',
        retryCount: 0,
      });

      // Revoke temporary URL from worker (not stored in IndexedDB)
      URL.revokeObjectURL(compressionResult.url);

      // Queue for sync
      await syncManager.queuePhotoSync(savedPhoto.id, selectedProject, 'create');

      // Show brief success toast
      toast({
        title: '✓ Captured',
        description: `${QUALITY_PRESETS.find(p => p.value === selectedQuality)?.label} quality`,
        duration: 1500, // Brief toast for quick mode
      });

      // Visual feedback - pulse quick capture button
      const quickButton = document.querySelector('[data-testid="button-quick-capture"]') as HTMLElement;
      if (quickButton) {
        quickButton.style.transform = 'scale(0.9)';
        setTimeout(() => {
          quickButton.style.transform = 'scale(1)';
        }, 150);
      }

    } catch (error) {
      console.error('Quick capture error:', error);
      toast({
        title: 'Capture Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsCapturing(false);
    }
  };

  // Capture and edit mode: Capture photo then open annotation editor
  const captureAndEdit = async () => {
    if (!selectedProject || isCapturing || !isActive) return;

    setIsCapturing(true);

    try {
      if (!videoRef.current) {
        throw new Error('Video element not available');
      }

      // Verify video has valid dimensions
      if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
        throw new Error('Camera not ready - please wait a moment and try again');
      }
      // Create canvas to capture frame
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context');

      ctx.drawImage(video, 0, 0);

      // Convert to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Failed to create blob'))),
          'image/jpeg',
          0.95
        );
      });

      // Compress photo using Web Worker
      const compressionResult = await photoCompressionWorker.compressPhoto(blob, selectedQuality);

      // Save to IndexedDB
      const savedPhoto = await idb.savePhoto({
        projectId: selectedProject,
        blob: compressionResult.blob,
        quality: selectedQuality,
        caption: '',
        timestamp: Date.now(),
        syncStatus: 'pending',
        retryCount: 0,
      });

      // Revoke temporary URL from worker
      URL.revokeObjectURL(compressionResult.url);

      // Queue for sync
      await syncManager.queuePhotoSync(savedPhoto.id, selectedProject, 'create');

      // Stop camera before navigating
      stopCamera();

      // Navigate to photo edit page
      setLocation(`/photo/${savedPhoto.id}/edit`);

    } catch (error) {
      console.error('Capture and edit error:', error);
      toast({
        title: 'Capture Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
      setIsCapturing(false);
    }
  };

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 bg-background">
        <div className="max-w-md text-center space-y-6">
          <div className="w-24 h-24 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
            <CameraIcon className="w-12 h-12 text-primary" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold" data-testid="text-camera-title">
              Camera
            </h1>
            <p className="text-muted-foreground" data-testid="text-camera-description">
              Create a project first to start taking photos.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-full bg-black overflow-hidden" style={{ height: '100dvh', minHeight: '100vh' }}>
      {/* Loading state while camera starts */}
      {!isActive && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-8 z-30 bg-black">
          <div className="text-center space-y-4">
            <div className="w-24 h-24 mx-auto bg-primary/20 rounded-full flex items-center justify-center animate-pulse">
              <CameraIcon className="w-12 h-12 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-white">Starting Camera...</h2>
              <p className="text-white/60 text-sm">
                Getting ready to capture
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Video Stream */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ zIndex: 5 }}
        data-testid="video-camera-stream"
      />

      {/* Top Controls */}
      <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/60 to-transparent z-10">
        <div className="flex items-center justify-between max-w-screen-sm mx-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation('/projects')}
            className="text-white hover:bg-white/20"
            data-testid="button-close-camera"
          >
            <X className="w-6 h-6" />
          </Button>

          <div className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-white" />
            <Select value={selectedQuality} onValueChange={(v) => setSelectedQuality(v as QualityPreset)}>
              <SelectTrigger
                className="w-32 bg-white/10 border-white/20 text-white"
                data-testid="select-quality"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUALITY_PRESETS.map((preset) => (
                  <SelectItem key={preset.value} value={preset.value}>
                    <div className="flex flex-col">
                      <span className="font-medium">{preset.label}</span>
                      <span className="text-xs text-muted-foreground">{preset.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Bottom Fixed Controls */}
      <div className="fixed bottom-0 left-0 right-0 pb-safe bg-black/80 backdrop-blur-sm z-20">
        {/* Project Selector */}
        <div className="px-4 pt-3 pb-2 max-w-md mx-auto">
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger
              className="w-full bg-white/10 border-white/20 text-white"
              data-testid="select-project-camera"
            >
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4" />
                <SelectValue placeholder="Select project folder" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {projects.map((project: any) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center justify-around px-8 py-4 max-w-md mx-auto">
          {/* Quick Capture Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={quickCapture}
            disabled={isCapturing}
            className="w-16 h-16 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 text-white disabled:opacity-50 transition-transform"
            data-testid="button-quick-capture"
          >
            <CameraIcon className="w-8 h-8" />
          </Button>

          {/* Capture & Edit Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={captureAndEdit}
            disabled={isCapturing}
            className="w-16 h-16 rounded-full bg-primary hover:bg-primary/90 active:bg-primary/80 text-primary-foreground disabled:opacity-50"
            data-testid="button-capture-edit"
          >
            <div className="relative">
              <CameraIcon className="w-8 h-8" />
              <PenLine className="w-4 h-4 absolute -bottom-1 -right-1" />
            </div>
          </Button>

          {/* Close Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation('/projects')}
            className="w-16 h-16 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 text-white"
            data-testid="button-close-camera-bottom"
          >
            <X className="w-8 h-8" />
          </Button>
        </div>

        {/* Quality indicator */}
        <div className="text-center text-white/60 text-xs pb-2">
          {QUALITY_PRESETS.find(p => p.value === selectedQuality)?.description}
        </div>
      </div>
    </div>
  );
}
