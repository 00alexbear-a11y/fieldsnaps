import { useState, useRef, useEffect } from 'react';
import { Camera as CameraIcon, X, Check, Settings2, PenLine, FolderOpen, Video, SwitchCamera, Home, Search, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { photoCompressionWorker } from '@/lib/photoCompressionWorker';
import { type QualityPreset } from '@/lib/photoCompression';
import { indexedDB as idb } from '@/lib/indexeddb';
import { syncManager } from '@/lib/syncManager';
import logoPath from '@assets/Fieldsnap logo v1.2_1760310501545.png';
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
  address?: string;
}

interface CameraDevice {
  deviceId: string;
  label: string;
  zoomLevel: 0.5 | 1 | 2 | 3;
}

type CameraMode = 'photo' | 'video';
type CameraFacing = 'environment' | 'user';

export default function Camera() {
  const [hasPermission, setHasPermission] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState<QualityPreset>('standard');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [showProjectSelection, setShowProjectSelection] = useState(true);
  const [isCapturing, setIsCapturing] = useState(false);
  const [cameraMode, setCameraMode] = useState<CameraMode>('photo');
  const [cameraFacing, setCameraFacing] = useState<CameraFacing>('environment');
  const [isRecording, setIsRecording] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<0.5 | 1 | 2 | 3>(1);
  const [projectSearchQuery, setProjectSearchQuery] = useState('');
  const [availableCameras, setAvailableCameras] = useState<CameraDevice[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Load projects
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  useEffect(() => {
    // Check for projectId query parameter
    const urlParams = new URLSearchParams(window.location.search);
    const projectIdFromUrl = urlParams.get('projectId');
    
    if (projects.length > 0 && !selectedProject) {
      // If projectId in URL and it exists in projects, use it and skip selection screen
      if (projectIdFromUrl && projects.some(p => p.id === projectIdFromUrl)) {
        setSelectedProject(projectIdFromUrl);
        setShowProjectSelection(false);
      }
    }
  }, [projects, selectedProject]);

  // Detect available cameras after permission is granted
  // Don't run on mount because labels aren't available until permission granted

  // Auto-start camera when project is selected and camera is not yet active
  useEffect(() => {
    if (selectedProject && !showProjectSelection && !isActive && !permissionDenied) {
      startCamera();
    }
  }, [selectedProject, showProjectSelection, currentDeviceId, cameraFacing]);

  // Cleanup camera when component unmounts
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const detectAvailableCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      // Filter cameras by facing mode (front vs back)
      const relevantCameras: CameraDevice[] = [];
      
      for (const device of videoDevices) {
        // Skip devices with no label or deviceId (permission not granted yet)
        if (!device.label || !device.deviceId) continue;
        
        const label = device.label.toLowerCase();
        
        // Skip front camera if we're in environment mode, and vice versa
        const isFrontCamera = label.includes('front') || label.includes('user');
        const isBackCamera = label.includes('back') || label.includes('rear') || label.includes('environment');
        
        if (cameraFacing === 'user' && isBackCamera) continue;
        if (cameraFacing === 'environment' && isFrontCamera) continue;
        
        // Try to determine zoom level based on label
        let zoomLevel: 0.5 | 1 | 2 | 3 = 1;
        
        if (label.includes('ultra') || label.includes('wide') || label.includes('0.5')) {
          zoomLevel = 0.5;
        } else if (label.includes('telephoto') || label.includes('tele') || label.includes('2x') || label.includes('zoom')) {
          zoomLevel = 2;
        } else if (label.includes('3x') || label.includes('periscope')) {
          zoomLevel = 3;
        } else {
          zoomLevel = 1; // Main/wide camera
        }
        
        relevantCameras.push({
          deviceId: device.deviceId,
          label: device.label,
          zoomLevel
        });
      }
      
      // Sort by zoom level
      relevantCameras.sort((a, b) => a.zoomLevel - b.zoomLevel);
      
      // If we have multiple cameras with the same zoom level, keep only the first one
      const uniqueCameras: CameraDevice[] = [];
      const seenZoomLevels = new Set<number>();
      
      for (const camera of relevantCameras) {
        if (!seenZoomLevels.has(camera.zoomLevel)) {
          uniqueCameras.push(camera);
          seenZoomLevels.add(camera.zoomLevel);
        }
      }
      
      setAvailableCameras(uniqueCameras);
      
      // Only set deviceId if we found valid cameras
      if (uniqueCameras.length > 0) {
        const defaultCamera = uniqueCameras.find(c => c.zoomLevel === 1) || uniqueCameras[0];
        setCurrentDeviceId(defaultCamera.deviceId);
        setZoomLevel(defaultCamera.zoomLevel);
      }
    } catch (error) {
      console.error('Error detecting cameras:', error);
      // Fallback to basic camera if detection fails
      setAvailableCameras([]);
      setCurrentDeviceId(null);
    }
  };

  const startCamera = async () => {
    try {
      // Use deviceId only if it's a valid non-empty string, otherwise use facingMode
      const constraints: MediaStreamConstraints = {
        video: (currentDeviceId && currentDeviceId.trim()) ? {
          deviceId: { exact: currentDeviceId },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        } : {
          facingMode: cameraFacing,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      };
      
      let stream: MediaStream;
      
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (deviceError) {
        // If deviceId constraint fails, fall back to facingMode
        console.warn('Camera deviceId failed, falling back to facingMode:', deviceError);
        const fallbackConstraints: MediaStreamConstraints = {
          video: {
            facingMode: cameraFacing,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        };
        stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
        // Clear deviceId since it didn't work
        setCurrentDeviceId(null);
      }

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
        setPermissionDenied(false);

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
        
        // Detect available cameras after permission is granted (when labels are available)
        await detectAvailableCameras();
      }
    } catch (error) {
      console.error('Camera error:', error);
      setPermissionDenied(true);
      setHasPermission(false);
      setIsActive(false);
      toast({
        title: 'Camera Access Denied',
        description: 'Unable to access camera. Please check permissions.',
        variant: 'destructive',
      });
    }
  };

  const stopCamera = () => {
    if (isRecording) {
      stopRecording();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
  };

  const switchCamera = async () => {
    stopCamera();
    setCameraFacing(prev => prev === 'environment' ? 'user' : 'environment');
  };

  const switchZoomLevel = async (level: 0.5 | 1 | 2 | 3) => {
    // Find the camera with the requested zoom level
    const targetCamera = availableCameras.find(c => c.zoomLevel === level);
    
    if (targetCamera && targetCamera.deviceId !== currentDeviceId) {
      setZoomLevel(level);
      setCurrentDeviceId(targetCamera.deviceId);
      
      // Restart camera with new device
      stopCamera();
      // Camera will auto-restart via useEffect dependency on currentDeviceId
    } else {
      // If camera already selected or not found, just update zoom level state
      setZoomLevel(level);
    }
  };

  const startRecording = async () => {
    if (!streamRef.current || isRecording) return;
    
    try {
      recordedChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(streamRef.current, {
        mimeType: 'video/webm',
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        // For now, just show a toast - video storage can be added later
        toast({
          title: 'Video Recorded',
          description: `${(blob.size / 1024 / 1024).toFixed(1)}MB video ready`,
        });
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      
      toast({
        title: 'Recording Started',
        description: 'Tap again to stop recording',
      });
    } catch (error) {
      console.error('Recording error:', error);
      toast({
        title: 'Recording Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
      setIsRecording(false);
    }
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
          
          <Button onClick={() => setLocation('/')} data-testid="button-go-home">
            <Home className="w-4 h-4 mr-2" />
            Go to Projects
          </Button>
        </div>
      </div>
    );
  }

  // Project selection screen
  if (showProjectSelection) {
    const filteredProjects = projectSearchQuery.trim() 
      ? projects.filter(project => 
          project.name.toLowerCase().includes(projectSearchQuery.toLowerCase()) ||
          (project.address?.toLowerCase().includes(projectSearchQuery.toLowerCase())) ||
          (project.description?.toLowerCase().includes(projectSearchQuery.toLowerCase()))
        )
      : projects;

    return (
      <div className="flex flex-col h-full bg-background">
        {/* Header */}
        <div className="flex flex-col items-center p-4 pb-2 border-b">
          <div className="flex items-center justify-between w-full mb-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation('/')}
              data-testid="button-back-to-home"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <img 
              src={logoPath} 
              alt="FieldSnaps" 
              className="h-9 w-auto object-contain"
              data-testid="img-fieldsnaps-logo"
            />
            <div className="w-10" />
          </div>
          <h1 className="text-lg font-semibold text-muted-foreground" data-testid="text-select-project">
            Select Project
          </h1>
        </div>

        {/* Project List */}
        <div className="flex-1 overflow-y-auto p-4 pb-20">
          <div className="max-w-2xl mx-auto space-y-3">
            {filteredProjects.map((project) => (
              <button
                key={project.id}
                onClick={() => {
                  setSelectedProject(project.id);
                  setShowProjectSelection(false);
                }}
                className="w-full text-left p-6 rounded-xl border-2 border-border hover-elevate active-elevate-2 transition-all"
                data-testid={`button-select-project-${project.id}`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <FolderOpen className="w-7 h-7 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold truncate">
                      {project.name}
                    </h3>
                    {project.description && (
                      <p className="text-sm text-muted-foreground truncate">
                        {project.description}
                      </p>
                    )}
                  </div>
                  <CameraIcon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Search Bar - Fixed at bottom */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-xl border-t">
          <div className="max-w-2xl mx-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                value={projectSearchQuery}
                onChange={(e) => setProjectSearchQuery(e.target.value)}
                placeholder="Search projects..."
                className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-border bg-background focus:outline-none focus:border-primary transition-colors"
                data-testid="input-search-projects"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Permission denied state
  if (permissionDenied) {
    const handleRequestAgain = () => {
      setPermissionDenied(false);
      setHasPermission(false);
      setIsActive(false);
      // Trigger camera start
      if (selectedProject && !showProjectSelection) {
        startCamera();
      }
    };

    return (
      <div className="fixed inset-0 w-full bg-black overflow-hidden flex items-center justify-center" style={{ height: '100dvh', minHeight: '100vh' }}>
        <div className="text-center space-y-6 p-8">
          <div className="w-24 h-24 mx-auto bg-red-600/20 rounded-full flex items-center justify-center">
            <CameraIcon className="w-12 h-12 text-red-600" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-white">Camera Access Denied</h2>
            <p className="text-white/60 text-sm max-w-sm">
              Please enable camera permissions in your browser settings to take photos.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <Button 
              onClick={handleRequestAgain}
              variant="default"
              data-testid="button-request-again"
            >
              <CameraIcon className="w-4 h-4 mr-2" />
              Request Again
            </Button>
            <Button 
              onClick={() => setLocation('/')} 
              variant="outline"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              data-testid="button-go-home-denied"
            >
              <Home className="w-4 h-4 mr-2" />
              Go Home
            </Button>
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
        style={{ 
          zIndex: 5,
        }}
        data-testid="video-camera-stream"
      />

      {/* Top Controls - Centered camera flip with quality on right */}
      <div className="absolute top-0 left-0 right-0 p-3 z-10">
        <div className="flex items-center justify-between max-w-screen-sm mx-auto">
          <div className="w-28" />
          
          {/* Camera switch - centered */}
          <Button
            variant="ghost"
            size="icon"
            onClick={switchCamera}
            className="text-white hover:bg-white/20 bg-black/30 backdrop-blur-md"
            data-testid="button-switch-camera"
          >
            <SwitchCamera className="w-5 h-5" />
          </Button>

          {/* Quality selector */}
          <Select value={selectedQuality} onValueChange={(v) => setSelectedQuality(v as QualityPreset)}>
            <SelectTrigger
              className="w-28 bg-black/30 backdrop-blur-md border-white/20 text-white text-sm h-9"
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

      {/* Mode Selector - Right side, lower position */}
      <div className="absolute right-4 bottom-48 flex flex-col gap-3 z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCameraMode('photo')}
          className={`text-white backdrop-blur-md rounded-xl ${cameraMode === 'photo' ? 'bg-white/25' : 'bg-white/10'}`}
          data-testid="button-mode-photo"
        >
          <CameraIcon className="w-5 h-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCameraMode('video')}
          className={`text-white backdrop-blur-md rounded-xl ${cameraMode === 'video' ? 'bg-white/25' : 'bg-white/10'}`}
          data-testid="button-mode-video"
        >
          <Video className="w-5 h-5" />
        </Button>
      </div>

      {/* Zoom Selector - Center, lower position - Only show available cameras */}
      <div className="absolute bottom-36 left-0 right-0 flex justify-center gap-2 z-10">
        {availableCameras.length > 0 ? (
          availableCameras.map((camera) => (
            <Button
              key={camera.zoomLevel}
              variant="ghost"
              size="sm"
              onClick={() => switchZoomLevel(camera.zoomLevel)}
              className={`text-white backdrop-blur-md text-sm font-medium px-3 ${
                zoomLevel === camera.zoomLevel ? 'bg-white/25' : 'bg-white/10'
              }`}
              data-testid={`button-zoom-${camera.zoomLevel}x`}
            >
              {camera.zoomLevel}x
            </Button>
          ))
        ) : (
          // Fallback to basic zoom if camera detection failed
          [1].map((level) => (
            <Button
              key={level}
              variant="ghost"
              size="sm"
              onClick={() => setZoomLevel(level as 0.5 | 1 | 2 | 3)}
              className={`text-white backdrop-blur-md text-sm font-medium px-3 ${
                zoomLevel === level ? 'bg-white/25' : 'bg-white/10'
              }`}
              data-testid={`button-zoom-${level}x`}
            >
              {level}x
            </Button>
          ))
        )}
      </div>

      {/* Bottom Capture Controls - Minimal, no background box */}
      <div className="absolute bottom-6 left-0 right-0 pb-safe z-20">
        {cameraMode === 'photo' ? (
          <div className="flex items-center justify-center gap-8 px-8 max-w-md mx-auto">
            {/* Quick Capture Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={quickCapture}
              disabled={isCapturing}
              className="w-14 h-14 rounded-full bg-white/90 hover:bg-white active:bg-white/80 text-black disabled:opacity-50 transition-transform shadow-lg"
              data-testid="button-quick-capture"
            >
              <CameraIcon className="w-7 h-7" />
            </Button>

            {/* Capture & Edit Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={captureAndEdit}
              disabled={isCapturing}
              className="w-16 h-16 rounded-full bg-primary hover:bg-primary/90 active:bg-primary/80 text-primary-foreground disabled:opacity-50 shadow-lg"
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
              onClick={() => setLocation('/')}
              className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20 active:bg-white/30 text-white shadow-lg"
              data-testid="button-close-camera-bottom"
            >
              <X className="w-7 h-7" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-center px-8 max-w-md mx-auto">
            {/* Video Record/Stop Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={isRecording ? stopRecording : startRecording}
              className={`w-20 h-20 rounded-full ${isRecording ? 'bg-red-600' : 'bg-white/90'} hover:scale-105 active:scale-95 transition-all shadow-lg`}
              data-testid="button-record-video"
            >
              {isRecording ? (
                <div className="w-6 h-6 bg-white rounded-sm" />
              ) : (
                <div className="w-5 h-5 bg-red-600 rounded-full" />
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Recording indicator */}
      {isRecording && (
        <div className="absolute top-24 left-0 right-0 flex justify-center z-10">
          <div className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 animate-pulse">
            <div className="w-2 h-2 bg-white rounded-full" />
            Recording
          </div>
        </div>
      )}
    </div>
  );
}
