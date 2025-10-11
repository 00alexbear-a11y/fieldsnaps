import { useState, useRef, useEffect } from 'react';
import { Camera as CameraIcon, X, Check, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { compressPhoto, type QualityPreset } from '@/lib/photoCompression';
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
        setHasPermission(true);
        setIsActive(true);
      }
    } catch (error) {
      console.error('Camera error:', error);
      toast({
        title: 'Camera Error',
        description: 'Unable to access camera. Please check permissions.',
        variant: 'destructive',
      });
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

  const capturePhoto = async () => {
    if (!videoRef.current || !selectedProject || isCapturing) return;

    setIsCapturing(true);

    try {
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

      // Compress photo
      const compressionResult = await compressPhoto(blob, selectedQuality);

      // Save to IndexedDB (returns saved photo with generated ID)
      const savedPhoto = await idb.savePhoto({
        projectId: selectedProject,
        blob: compressionResult.blob,
        url: compressionResult.url,
        quality: selectedQuality,
        caption: '',
        timestamp: Date.now(),
        syncStatus: 'pending',
        retryCount: 0,
      });

      // Queue for sync
      await syncManager.queuePhotoSync(savedPhoto.id, selectedProject, 'create');

      // Show success
      toast({
        title: 'Photo Captured',
        description: `Saved with ${QUALITY_PRESETS.find(p => p.value === selectedQuality)?.label} quality`,
      });

      // Simulate haptic feedback with a brief visual pulse
      const captureButton = document.getElementById('capture-button');
      if (captureButton) {
        captureButton.style.transform = 'scale(0.95)';
        setTimeout(() => {
          captureButton.style.transform = 'scale(1)';
        }, 100);
      }

    } catch (error) {
      console.error('Capture error:', error);
      toast({
        title: 'Capture Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsCapturing(false);
    }
  };

  if (!hasPermission || !isActive) {
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
              Capture construction photos offline with automatic compression and sync.
            </p>
          </div>

          {projects.length === 0 ? (
            <div className="p-4 bg-muted rounded-md">
              <p className="text-sm text-muted-foreground">
                Create a project first to start taking photos.
              </p>
            </div>
          ) : (
            <div className="w-full space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Project</label>
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger data-testid="select-project">
                    <SelectValue placeholder="Select a project" />
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

              <Button
                variant="default"
                size="lg"
                className="w-full"
                onClick={startCamera}
                disabled={!selectedProject}
                data-testid="button-start-camera"
              >
                Start Camera
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-black overflow-hidden">
      {/* Video Stream */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        data-testid="video-camera-stream"
      />

      {/* Top Controls */}
      <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/60 to-transparent z-10">
        <div className="flex items-center justify-between max-w-screen-sm mx-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={stopCamera}
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

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 pb-24 pt-8 bg-gradient-to-t from-black/60 to-transparent z-10">
        <div className="flex flex-col items-center gap-4">
          {/* Project Info */}
          <div className="text-white text-sm font-medium">
            {projects.find((p: any) => p.id === selectedProject)?.name}
          </div>

          {/* Capture Button */}
          <button
            id="capture-button"
            onClick={capturePhoto}
            disabled={isCapturing}
            className="w-20 h-20 rounded-full border-4 border-white bg-white/20 hover:bg-white/30 active:bg-white/40 transition-all disabled:opacity-50"
            style={{ transition: 'transform 0.1s ease' }}
            data-testid="button-capture"
          >
            {isCapturing ? (
              <div className="w-full h-full rounded-full bg-white animate-pulse" />
            ) : (
              <div className="w-full h-full rounded-full bg-white" />
            )}
          </button>

          {/* Quality Info */}
          <div className="text-white/80 text-xs">
            {QUALITY_PRESETS.find(p => p.value === selectedQuality)?.description}
          </div>
        </div>
      </div>
    </div>
  );
}
