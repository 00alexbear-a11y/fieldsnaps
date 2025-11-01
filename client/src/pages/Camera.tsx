import { useState, useRef, useEffect, useMemo } from 'react';
import { Camera as CameraIcon, X, Check, Clock, Settings2, PenLine, Video, SwitchCamera, Home, Search, ArrowLeft, Trash2, ChevronUp, ChevronDown, Play, Info, Zap, ListTodo, CheckSquare, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { useSubscriptionAccess } from '@/hooks/useSubscriptionAccess';
import { UpgradeModal } from '@/components/UpgradeModal';
import { photoCompressionWorker } from '@/lib/photoCompressionWorker';
import { type QualityPreset } from '@/lib/photoCompression';
import { indexedDB as idb, type LocalPhoto, createPhotoUrl } from '@/lib/indexeddb';
import { syncManager } from '@/lib/syncManager';
import { haptics } from '@/lib/nativeHaptics';
import { nativeStatusBar } from '@/lib/nativeStatusBar';
import logoPath from '@assets/Fieldsnap logo v1.2_1760310501545.png';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { type Tag } from '@shared/schema';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useMutation } from '@tanstack/react-query';

const QUALITY_PRESETS: { value: QualityPreset; label: string; description: string }[] = [
  { value: 'quick', label: 'S', description: '200KB - Fast upload' },
  { value: 'standard', label: 'M', description: '500KB - Balanced' },
  { value: 'detailed', label: 'L', description: '1.5MB - High quality' },
];

interface Project {
  id: string;
  name: string;
  description?: string;
  address?: string;
  completed?: boolean;
  unitCount?: number;
  unitLabels?: string[];
}

interface Photo {
  id: string;
  url: string;
}

interface ProjectWithCounts extends Project {
  photoCount: number;
  coverPhoto?: Photo;
}

interface CameraDevice {
  deviceId: string;
  label: string;
  zoomLevel: 0.5 | 1 | 2 | 3;
}

type CameraMode = 'photo' | 'video' | 'edit';
type CameraFacing = 'environment' | 'user';

export default function Camera() {
  const { canWrite, isTrialExpired, isPastDue, isCanceled } = useSubscriptionAccess();
  const [hasPermission, setHasPermission] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [selectedQuality, setSelectedQuality] = useState<QualityPreset>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('camera-quality');
      return (saved as QualityPreset) || 'standard';
    }
    return 'standard';
  });
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [showProjectSelection, setShowProjectSelection] = useState(true);
  const [isCapturing, setIsCapturing] = useState(false);
  const [cameraMode, setCameraMode] = useState<CameraMode>(() => {
    // Check if we should preserve session from URL
    const urlParams = new URLSearchParams(window.location.search);
    const preserveSession = urlParams.get('preserveSession') === 'true';
    
    if (preserveSession) {
      const savedMode = sessionStorage.getItem('camera-mode') as CameraMode | null;
      if (savedMode && ['photo', 'video', 'edit'].includes(savedMode)) {
        return savedMode;
      }
    }
    
    // Default to photo on fresh session
    return 'photo';
  });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isReturningFromEdit, setIsReturningFromEdit] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('preserveSession') === 'true';
  });
  const [cameraFacing, setCameraFacing] = useState<CameraFacing>('environment');
  const [isRecording, setIsRecording] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<0.5 | 1 | 2 | 3>(1);
  const [continuousZoom, setContinuousZoom] = useState<number>(1);
  const [projectSearchQuery, setProjectSearchQuery] = useState('');
  const [availableCameras, setAvailableCameras] = useState<CameraDevice[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [isAttachMode, setIsAttachMode] = useState(false);
  
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagPickerExpanded, setTagPickerExpanded] = useState(false);
  const [selectedUnitLabel, setSelectedUnitLabel] = useState<string | null>(null);
  const [showFlash, setShowFlash] = useState(false);
  
  // Swipe-down gesture refs (using refs to avoid re-renders during gesture)
  const swipeStartY = useRef<number | null>(null);
  const swipeStartTime = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const sessionPhotosRef = useRef<LocalPhoto[]>([]);
  const [sessionPhotos, setSessionPhotos] = useState<LocalPhoto[]>([]);
  const thumbnailUrlsRef = useRef<Map<string, string>>(new Map());
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const pinchStartDistanceRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef<number>(1);
  const cameraSessionIdRef = useRef<number>(0);
  const userSelectedZoomRef = useRef<0.5 | 1 | 2 | 3 | null>(null);
  const startCameraTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const modeTransitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Session ID for tracking photos in current camera session
  const currentSessionId = useRef<string>(crypto.randomUUID());
  
  // Capture session preservation state at mount to avoid re-reading URL at cleanup
  const urlParams = new URLSearchParams(window.location.search);
  const shouldPreserveSessionRef = useRef<boolean>(urlParams.get('preserveSession') === 'true');
  
  const annotationCanvasRef = useRef<HTMLCanvasElement>(null);
  const compositeCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const drawingPathRef = useRef<{x: number, y: number}[]>([]);
  const isRecordingRef = useRef<boolean>(false);
  const clearTimeoutRef = useRef<number | null>(null);
  
  const { toast } = useToast();
  const [location, setLocation] = useLocation();

  // Fetch todos to show which photos have tasks attached
  const { data: todos = [] } = useQuery<Array<{ id: string; photoId: string | null }>>({
    queryKey: ['/api/todos', 'my-tasks'],
    queryFn: async () => {
      const params = new URLSearchParams({ view: 'my-tasks' });
      const response = await fetch(`/api/todos?${params.toString()}`);
      if (!response.ok) return [];
      return await response.json();
    },
  });

  // Create a Set of photoIds that have tasks for quick lookup
  const photoIdsWithTasks = useMemo(() => {
    return new Set(todos.filter(t => t.photoId).map(t => t.photoId!));
  }, [todos]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('projectId');
    const mode = params.get('mode');
    
    if (projectId && projectId !== selectedProject) {
      console.log('[Camera] Setting project from URL:', projectId);
      setSelectedProject(projectId);
      setShowProjectSelection(false);
    }
    
    // Detect Photo Attachment Mode
    if (mode === 'attachToTodo') {
      console.log('[Camera] Photo Attachment Mode activated');
      setIsAttachMode(true);
    } else {
      // Reset attach mode when not in attachment flow
      if (isAttachMode) {
        console.log('[Camera] Photo Attachment Mode deactivated');
      }
      setIsAttachMode(false);
    }
  }, [location]);

  const { data: allProjectsWithCounts = [] } = useQuery<ProjectWithCounts[]>({
    queryKey: ['/api/projects/with-counts'],
  });

  const projects = useMemo(() => 
    allProjectsWithCounts.filter(project => !project.completed),
    [allProjectsWithCounts]
  );

  // Get current project and generate unit labels
  const selectedProjectData = useMemo(() => 
    projects.find(p => p.id === selectedProject),
    [projects, selectedProject]
  );

  const unitLabels = useMemo(() => {
    if (!selectedProjectData || !selectedProjectData.unitCount || selectedProjectData.unitCount <= 1) {
      return [];
    }
    
    // Use stored custom labels if available, otherwise auto-generate
    if (selectedProjectData.unitLabels && selectedProjectData.unitLabels.length > 0) {
      return selectedProjectData.unitLabels;
    }
    
    // Fallback: Generate unit labels: "Unit 1", "Unit 2", etc.
    return Array.from({ length: selectedProjectData.unitCount }, (_, i) => `Unit ${i + 1}`);
  }, [selectedProjectData]);

  const { data: tags = [] } = useQuery<Tag[]>({
    queryKey: ['/api/tags', selectedProject],
    queryFn: () => fetch(`/api/tags?projectId=${selectedProject}`, {
      credentials: 'include'
    }).then(r => r.json()),
    enabled: !!selectedProject,
  });

  useEffect(() => {
    console.log('[Camera Tags] Selected project:', selectedProject);
    console.log('[Camera Tags] Tags loaded:', tags);
    console.log('[Camera Tags] Should show selector:', tags.length > 0 && !isRecording);
  }, [selectedProject, tags, isRecording]);

  useEffect(() => {
    setSelectedTags([]);
    // Reset unit stamp when project changes or when project has no units
    setSelectedUnitLabel(null);
  }, [selectedProject]);

  // Clear stamp when unitCount becomes <= 1 OR when selected label is no longer valid
  useEffect(() => {
    if (unitLabels.length === 0) {
      setSelectedUnitLabel(null);
    } else if (selectedUnitLabel && !unitLabels.includes(selectedUnitLabel)) {
      // Current selection is no longer valid (e.g., unit names changed)
      setSelectedUnitLabel(null);
    }
  }, [unitLabels, selectedUnitLabel]);

  useEffect(() => {
    if (selectedTags.length > 0) {
      if (tags.length === 0) {
        setSelectedTags([]);
      } else {
        const validTagIds = new Set(tags.map(t => t.id));
        setSelectedTags(prev => prev.filter(tagId => validTagIds.has(tagId)));
      }
    }
  }, [tags]);

  // Clear session photos on mount for fresh camera session (unless preserving session)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const preserveSession = urlParams.get('preserveSession') === 'true';
    
    if (!preserveSession) {
      // Generate new session ID for this camera session
      currentSessionId.current = crypto.randomUUID();
      
      sessionPhotosRef.current = [];
      setSessionPhotos([]);
      
      // Clean up all camera session data from localStorage
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('camera-session-')) {
          localStorage.removeItem(key);
        }
      });
    }
    
    // Cleanup function: runs when leaving camera (component unmount)
    return () => {
      // Only cleanup if we're not preserving the session
      // Use ref value captured at mount to avoid re-reading URL during route transition
      if (!shouldPreserveSessionRef.current && currentSessionId.current) {
        console.log('[Camera] Cleaning up session photos for session:', currentSessionId.current);
        
        // Clean up uploaded photos from this session asynchronously
        idb.cleanupSessionPhotos(currentSessionId.current).then(result => {
          console.log(`[Camera] Session cleanup complete:`, result);
        }).catch(error => {
          console.error('[Camera] Session cleanup failed:', error);
        });
      }
    };
  }, []);

  // Save camera mode to sessionStorage whenever it changes
  useEffect(() => {
    sessionStorage.setItem('camera-mode', cameraMode);
  }, [cameraMode]);

  // Smooth transition when returning from edit
  useEffect(() => {
    if (isReturningFromEdit) {
      // Brief delay to ensure camera is ready, then fade in
      const timer = setTimeout(() => {
        setIsReturningFromEdit(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isReturningFromEdit]);

  const previousProjectRef = useRef<string>('');
  const currentProjectRef = useRef<string>('');
  useEffect(() => {
    currentProjectRef.current = selectedProject;
    
    // Always start with fresh session - no restoration from localStorage
    if (previousProjectRef.current && previousProjectRef.current !== selectedProject) {
      sessionPhotosRef.current = [];
      setSessionPhotos([]);
    }
    previousProjectRef.current = selectedProject;
  }, [selectedProject]);

  useEffect(() => {
    thumbnailUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    thumbnailUrlsRef.current.clear();

    sessionPhotos.forEach(photo => {
      if (photo && photo.id) {
        const url = createPhotoUrl(photo);
        thumbnailUrlsRef.current.set(photo.id, url);
      }
    });

    return () => {
      thumbnailUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      thumbnailUrlsRef.current.clear();
    };
  }, [sessionPhotos]);


  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const projectIdFromUrl = urlParams.get('projectId');
    
    if (projects.length > 0 && !selectedProject) {
      if (projectIdFromUrl && projects.some(p => p.id === projectIdFromUrl)) {
        setSelectedProject(projectIdFromUrl);
        setShowProjectSelection(false);
      }
    }
  }, [projects, selectedProject]);

  useEffect(() => {
    if (selectedProject && !showProjectSelection && !isActive && !permissionDenied && !isCameraLoading) {
      startCamera();
    }
  }, [selectedProject, showProjectSelection]);
  
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    
    if (selectedProject && !showProjectSelection && !permissionDenied) {
      stopCamera();
      setTimeout(() => startCamera(), 100);
    }
  }, [cameraFacing]);

  useEffect(() => {
    return () => {
      if (startCameraTimeoutRef.current) {
        clearTimeout(startCameraTimeoutRef.current);
      }
      if (modeTransitionTimeoutRef.current) {
        clearTimeout(modeTransitionTimeoutRef.current);
      }
      stopCamera();
      // Ensure status bar is shown when component unmounts
      nativeStatusBar.show();
    };
  }, []);

  const detectAvailableCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      const relevantCameras: CameraDevice[] = [];
      
      for (const device of videoDevices) {
        if (!device.label || !device.deviceId) continue;
        
        const label = device.label.toLowerCase();
        
        const isFrontCamera = label.includes('front') || label.includes('user');
        const isBackCamera = label.includes('back') || label.includes('rear') || label.includes('environment');
        
        if (cameraFacing === 'user' && isBackCamera) continue;
        if (cameraFacing === 'environment' && isFrontCamera) continue;
        
        let zoomLevel: 0.5 | 1 | 2 | 3 = 1;
        
        if (label.includes('ultra') || label.includes('wide') || label.includes('0.5')) {
          zoomLevel = 0.5;
        } else if (label.includes('telephoto') || label.includes('tele') || label.includes('2x') || label.includes('zoom')) {
          zoomLevel = 2;
        } else if (label.includes('3x') || label.includes('periscope')) {
          zoomLevel = 3;
        } else {
          zoomLevel = 1;
        }
        
        relevantCameras.push({
          deviceId: device.deviceId,
          label: device.label,
          zoomLevel
        });
      }
      
      relevantCameras.sort((a, b) => a.zoomLevel - b.zoomLevel);
      
      const uniqueCameras: CameraDevice[] = [];
      const seenZoomLevels = new Set<number>();
      
      for (const camera of relevantCameras) {
        if (!seenZoomLevels.has(camera.zoomLevel)) {
          uniqueCameras.push(camera);
          seenZoomLevels.add(camera.zoomLevel);
        }
      }
      
      setAvailableCameras(uniqueCameras);
      
      if (uniqueCameras.length > 0) {
        const targetZoom = userSelectedZoomRef.current || 1;
        const preferredCamera = uniqueCameras.find(c => c.zoomLevel === targetZoom) 
          || uniqueCameras.find(c => c.zoomLevel === 1) 
          || uniqueCameras[0];
        
        setCurrentDeviceId(preferredCamera.deviceId);
        
        if (!userSelectedZoomRef.current) {
          setZoomLevel(preferredCamera.zoomLevel);
        }
      }
    } catch (error) {
      console.error('Error detecting cameras:', error);
      setAvailableCameras([]);
      setCurrentDeviceId(null);
    }
  };

  const startCamera = (): Promise<void> => {
    if (startCameraTimeoutRef.current) {
      clearTimeout(startCameraTimeoutRef.current);
    }
    
    return new Promise<void>((resolve) => {
      startCameraTimeoutRef.current = setTimeout(async () => {
        await startCameraImmediate();
        resolve();
      }, 150);
    });
  };
  
  const startCameraImmediate = async () => {
    const sessionId = ++cameraSessionIdRef.current;
    console.log(`[Camera] Starting camera session ${sessionId}`);
    
    setIsCameraLoading(true);
    setCameraError(null);
    
    try {
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
        if (permissionStatus.state === 'denied') {
          setPermissionDenied(true);
          setHasPermission(false);
          setIsActive(false);
          setIsCameraLoading(false);
          setCameraError('Camera access denied. Please enable camera in your browser settings.');
          toast({
            title: 'Camera Access Denied',
            description: 'Please enable camera access in your browser settings.',
            variant: 'destructive',
            duration: 5000,
          });
          return;
        }
      } catch (permError) {
        console.log('Permission API not supported, continuing with getUserMedia');
      }
      
      if (sessionId !== cameraSessionIdRef.current) {
        console.log(`[Camera] Session ${sessionId} aborted - newer session started`);
        setIsCameraLoading(false);
        return;
      }

      const constraints: MediaStreamConstraints = {
        video: (currentDeviceId && currentDeviceId.trim()) ? {
          deviceId: { exact: currentDeviceId },
          width: { ideal: 3840, max: 3840 },
          height: { ideal: 2160, max: 2160 },
        } : {
          facingMode: cameraFacing,
          width: { ideal: 3840, max: 3840 },
          height: { ideal: 2160, max: 2160 },
        },
      };
      
      let stream: MediaStream;
      
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (deviceError) {
        if (sessionId !== cameraSessionIdRef.current) {
          console.log(`[Camera] Session ${sessionId} aborted during fallback`);
          return;
        }
        
        console.warn('Camera deviceId failed, falling back to facingMode:', deviceError);
        const fallbackConstraints: MediaStreamConstraints = {
          video: {
            facingMode: cameraFacing,
            width: { ideal: 3840, max: 3840 },
            height: { ideal: 2160, max: 2160 },
          },
        };
        stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
        setCurrentDeviceId(null);
      }
      
      if (sessionId !== cameraSessionIdRef.current) {
        console.log(`[Camera] Session ${sessionId} aborted - stopping stream`);
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        
        console.log('[Camera] Stream set, videoRef dimensions:', videoRef.current.videoWidth, 'x', videoRef.current.videoHeight);
        
        try {
          await videoRef.current.play();
          console.log('[Camera] Video play() successful');
        } catch (playError) {
          console.error('[Camera] Video play error:', playError);
        }
        
        setHasPermission(true);
        setPermissionDenied(false);

        await new Promise<void>((resolve) => {
          const video = videoRef.current;
          if (!video) {
            resolve();
            return;
          }

          if (video.videoWidth > 0 && video.videoHeight > 0) {
            console.log('[Camera] Metadata already loaded, dimensions:', video.videoWidth, 'x', video.videoHeight);
            resolve();
            return;
          }

          const handleLoadedMetadata = () => {
            console.log('[Camera] Metadata loaded, dimensions:', video.videoWidth, 'x', video.videoHeight);
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            resolve();
          };
          video.addEventListener('loadedmetadata', handleLoadedMetadata);

          setTimeout(() => {
            console.warn('[Camera] Metadata load timeout after 5 seconds');
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            resolve();
          }, 5000);
        });

        setIsActive(true);
        setIsCameraLoading(false);
        console.log('[Camera] isActive set to true, loading overlay should hide');
        
        // Hide status bar for immersive full-screen camera experience
        nativeStatusBar.hide();
        
        await detectAvailableCameras();
      }
    } catch (error) {
      console.error('Camera error:', error);
      setPermissionDenied(true);
      setHasPermission(false);
      setIsActive(false);
      setIsCameraLoading(false);
      
      const errorMessage = error instanceof Error ? error.message : 'Unable to access camera';
      setCameraError(errorMessage);
      
      toast({
        title: 'Camera Access Failed',
        description: `${errorMessage}. Please check your camera permissions and try again.`,
        variant: 'destructive',
        duration: 5000,
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
    
    // Show status bar when leaving camera
    nativeStatusBar.show();
  };

  const switchCamera = async () => {
    setZoomLevel(1);
    setContinuousZoom(1);
    setAvailableCameras([]);
    setCurrentDeviceId(null);
    
    userSelectedZoomRef.current = null;
    
    setCameraFacing(prev => prev === 'environment' ? 'user' : 'environment');
  };

  const applyContinuousZoom = async (zoom: number) => {
    if (!streamRef.current) return;
    
    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (!videoTrack) return;
    
    try {
      await videoTrack.applyConstraints({
        // @ts-ignore
        advanced: [{ zoom }]
      });
      setContinuousZoom(zoom);
    } catch (error) {
      console.warn('[Camera] Continuous zoom constraint failed:', error);
    }
  };

  const switchZoomLevel = async (level: 0.5 | 1 | 2 | 3) => {
    if (zoomLevel === level) return;
    
    userSelectedZoomRef.current = level;
    
    setZoomLevel(level);
    setContinuousZoom(level);
    
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        try {
          await videoTrack.applyConstraints({
            // @ts-ignore
            advanced: [{ zoom: level }]
          });
          console.log(`[Camera] Applied zoom ${level}x via applyConstraints`);
          return;
        } catch (constraintError) {
          console.warn('[Camera] applyConstraints failed, will restart stream:', constraintError);
        }
      }
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
    
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: cameraFacing,
          width: { ideal: 3840, max: 3840 },
          height: { ideal: 2160, max: 2160 },
          // @ts-ignore
          advanced: [{ zoom: level }]
        },
      };
      
      let stream: MediaStream;
      
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (zoomError) {
        console.warn('Zoom constraint not supported, falling back to basic constraints:', zoomError);
        const fallbackConstraints: MediaStreamConstraints = {
          video: {
            facingMode: cameraFacing,
            width: { ideal: 3840, max: 3840 },
            height: { ideal: 2160, max: 2160 },
          },
        };
        stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        
        await videoRef.current.play();
        
        await new Promise<void>((resolve) => {
          const video = videoRef.current;
          if (!video) {
            resolve();
            return;
          }
          
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            resolve();
            return;
          }
          
          const handleLoadedMetadata = () => {
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            resolve();
          };
          video.addEventListener('loadedmetadata', handleLoadedMetadata);
          
          setTimeout(() => {
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            resolve();
          }, 5000);
        });
        
        setIsActive(true);
      }
    } catch (error) {
      console.error('Camera switch error:', error instanceof Error ? error.message : String(error));
      console.error('Full error object:', error);
      toast({
        title: 'Camera Switch Failed',
        description: error instanceof Error ? error.message : 'Unable to switch camera lens',
        variant: 'destructive',
      });
      setZoomLevel(1);
      await startCamera();
    }
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLVideoElement>) => {
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      pinchStartDistanceRef.current = distance;
      pinchStartZoomRef.current = continuousZoom;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLVideoElement>) => {
    if (e.touches.length === 2 && pinchStartDistanceRef.current !== null) {
      e.preventDefault();
      
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      
      const scale = distance / pinchStartDistanceRef.current;
      let newZoom = pinchStartZoomRef.current * scale;
      
      const minZoom = zoomLevel;
      const maxZoom = Math.floor(zoomLevel) + 0.99;
      newZoom = Math.max(minZoom, Math.min(maxZoom, newZoom));
      
      applyContinuousZoom(newZoom);
    }
  };

  const handleTouchEnd = () => {
    pinchStartDistanceRef.current = null;
  };

  const handleAnnotationTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isRecording) return;
    
    e.preventDefault();
    const canvas = annotationCanvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = ((touch.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((touch.clientY - rect.top) / rect.height) * canvas.height;
    
    setIsDrawing(true);
    drawingPathRef.current = [{ x, y }];
  };

  const handleAnnotationTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isRecording || !isDrawing) return;
    
    e.preventDefault();
    const canvas = annotationCanvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = ((touch.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((touch.clientY - rect.top) / rect.height) * canvas.height;
    
    drawingPathRef.current.push({ x, y });
    
    const ctx = canvas.getContext('2d');
    if (ctx && drawingPathRef.current.length > 1) {
      const path = drawingPathRef.current;
      
      // Clear canvas and redraw entire path to avoid gaps at corners
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Match edit mode pen: Medium size (8) with 4.5x scale = 36px
      const scaledPenWidth = 36;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // Draw black outline for entire path
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = scaledPenWidth + 6; // 42px for outline
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x, path[i].y);
      }
      ctx.stroke();
      
      // Draw red stroke on top for entire path
      ctx.strokeStyle = '#FF0000';
      ctx.lineWidth = scaledPenWidth; // 36px
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x, path[i].y);
      }
      ctx.stroke();
    }
  };

  const handleAnnotationTouchEnd = () => {
    setIsDrawing(false);
    drawingPathRef.current = [];
    
    // Clear the annotation canvas after each stroke
    const canvas = annotationCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  // Swipe-down gesture handlers for dismissing camera (iOS-style)
  const handleContainerTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    // Disable swipe gestures during video recording to prevent interference with annotations
    if (isRecording) {
      e.preventDefault();
      return;
    }
    
    // Only handle single-touch swipes (not pinch) - Allow from anywhere on preview
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      swipeStartY.current = touch.clientY;
      swipeStartTime.current = Date.now();
    }
  };

  const handleContainerTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    // Disable swipe gestures during video recording to prevent interference with annotations
    if (isRecording) {
      e.preventDefault();
      return;
    }
    
    if (swipeStartY.current !== null && e.touches.length === 1 && containerRef.current) {
      const touch = e.touches[0];
      const deltaY = touch.clientY - swipeStartY.current;
      
      // Only allow downward swipes
      if (deltaY > 0) {
        const offset = Math.min(deltaY, 200); // Cap at 200px
        // Use direct DOM manipulation to avoid re-renders
        containerRef.current.style.transform = `translateY(${offset}px)`;
        containerRef.current.style.transition = 'none';
      }
    }
  };

  const handleContainerTouchEnd = () => {
    // Disable swipe gestures during video recording to prevent interference with annotations
    if (isRecording) {
      return;
    }
    
    if (swipeStartY.current !== null && containerRef.current) {
      const currentTransform = containerRef.current.style.transform;
      const offset = parseFloat(currentTransform.match(/translateY\((\d+)px\)/)?.[1] || '0');
      const swipeDuration = Date.now() - swipeStartTime.current;
      const velocity = offset / swipeDuration; // px/ms
      
      // Dismiss if swiped down more than 100px or fast swipe (>0.5 px/ms)
      if (offset > 100 || velocity > 0.5) {
        setLocation('/'); // Go back
      } else {
        // Animate back to normal position
        containerRef.current.style.transition = 'transform 0.3s ease-out';
        containerRef.current.style.transform = 'translateY(0px)';
      }
      
      swipeStartY.current = null;
    }
  };

  // Mode switching with subtle transition delay
  const switchCameraMode = async (newMode: CameraMode) => {
    if (cameraMode === newMode || isTransitioning || isRecording) return;
    
    // Clear any existing transition timeout
    if (modeTransitionTimeoutRef.current) {
      clearTimeout(modeTransitionTimeoutRef.current);
    }
    
    haptics.light();
    setIsTransitioning(true);
    
    // 250ms transition delay for intentional feel
    modeTransitionTimeoutRef.current = setTimeout(() => {
      setCameraMode(newMode);
      setIsTransitioning(false);
      modeTransitionTimeoutRef.current = null;
    }, 250);
  };

  const startRecording = async () => {
    if (!videoRef.current || !annotationCanvasRef.current || !compositeCanvasRef.current) return;
    
    if (!canWrite) {
      setUpgradeModalOpen(true);
      return;
    }

    try {
      const video = videoRef.current;
      const annotationCanvas = annotationCanvasRef.current;
      const compositeCanvas = compositeCanvasRef.current;
      
      annotationCanvas.width = video.videoWidth;
      annotationCanvas.height = video.videoHeight;
      
      compositeCanvas.width = video.videoWidth;
      compositeCanvas.height = video.videoHeight;
      
      const compositeCtx = compositeCanvas.getContext('2d');
      if (!compositeCtx) throw new Error('Failed to get composite canvas context');
      
      const compositeStream = compositeCanvas.captureStream(30);
      
      const renderFrame = () => {
        if (!isRecordingRef.current) return;
        
        compositeCtx.clearRect(0, 0, compositeCanvas.width, compositeCanvas.height);
        
        compositeCtx.drawImage(video, 0, 0, compositeCanvas.width, compositeCanvas.height);
        
        const annotationCtx = annotationCanvas.getContext('2d');
        if (annotationCtx) {
          compositeCtx.drawImage(annotationCanvas, 0, 0);
        }
        
        clearTimeoutRef.current = requestAnimationFrame(renderFrame);
      };
      
      const mediaRecorder = new MediaRecorder(compositeStream, {
        mimeType: 'video/webm;codecs=vp8,opus',
        videoBitsPerSecond: 10000000
      });
      
      recordedChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        
        // Extract thumbnail from video
        let thumbnailBlob: Blob | undefined;
        try {
          const { extractVideoThumbnail } = await import('@/lib/videoUtils');
          thumbnailBlob = await extractVideoThumbnail(blob, 400, 400);
        } catch (error) {
          console.error('[Camera] Failed to extract video thumbnail:', error);
          // Continue without thumbnail if extraction fails
        }
        
        const project = projects.find(p => p.id === selectedProject);
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).replace(/\//g, '-');
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }).replace(/:/g, '-');
        const autoCaption = project ? `${project.name}_${dateStr}_${timeStr}_VIDEO` : '';
        
        const savedPhoto = await idb.savePhoto({
          projectId: selectedProject,
          blob: blob,
          thumbnailBlob,
          mediaType: 'video',
          quality: selectedQuality,
          caption: autoCaption,
          timestamp: Date.now(),
          syncStatus: 'pending',
          retryCount: 0,
          pendingTagIds: selectedTags.length > 0 ? selectedTags : undefined,
          unitLabel: selectedUnitLabel || undefined,
          sessionActive: true,
          sessionId: currentSessionId.current,
        });
        
        haptics.success();
        
        syncManager.queuePhotoSync(savedPhoto.id, selectedProject, 'create').catch(err => {
          console.error('[Camera] Sync queue error:', err);
          toast({
            title: 'Sync queue failed',
            description: 'Video saved locally but not queued for upload.',
            variant: 'destructive',
            duration: 3000,
          });
        });
        
        sessionPhotosRef.current = [savedPhoto, ...sessionPhotosRef.current].slice(0, 10);
        setSessionPhotos([...sessionPhotosRef.current]);

        // Invalidate photos query to trigger refresh in ProjectPhotos page
        queryClient.invalidateQueries({ queryKey: ['/api/projects', selectedProject, 'photos'] });

        // Dispatch custom event to trigger immediate IndexedDB reload (works offline)
        window.dispatchEvent(new CustomEvent('photoAdded', { detail: { projectId: selectedProject } }));

        // Navigate back to todos if in Photo Attachment Mode
        if (isAttachMode) {
          console.log('[Camera] Video recorded in attach mode, navigating to todos with photoId:', savedPhoto.id);
          setLocation(`/todos?photoId=${savedPhoto.id}`);
        }
      };
      
      mediaRecorder.start(1000);
      mediaRecorderRef.current = mediaRecorder;
      isRecordingRef.current = true;
      setIsRecording(true);
      
      renderFrame();
      
      haptics.medium();
      
    } catch (error) {
      console.error('Recording start error:', error);
      haptics.error();
      toast({
        title: 'Recording Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      haptics.medium();
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
      isRecordingRef.current = false;
      setIsRecording(false);
      
      if (clearTimeoutRef.current !== null) {
        cancelAnimationFrame(clearTimeoutRef.current);
        clearTimeoutRef.current = null;
      }
      
      const canvas = annotationCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
    }
  };

  // Helper function to capture video frame at native aspect ratio
  const captureVideoFrame = (video: HTMLVideoElement): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');

    // Use native video dimensions - no cropping
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the full frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return canvas;
  };

  const quickCapture = async () => {
    if (!selectedProject || isCapturing || !isActive) return;

    if (!canWrite) {
      setUpgradeModalOpen(true);
      return;
    }

    haptics.light();
    
    // Trigger flash animation
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 200);
    
    setIsCapturing(true);

    try {
      if (!videoRef.current) {
        throw new Error('Video element not available');
      }

      if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
        throw new Error('Camera not ready - please wait a moment and try again');
      }
      const video = videoRef.current;
      const canvas = captureVideoFrame(video);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Failed to create blob'))),
          'image/jpeg',
          0.95
        );
      });

      const compressionResult = await photoCompressionWorker.compressPhoto(blob, selectedQuality);

      const project = projects.find(p => p.id === selectedProject);
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).replace(/\//g, '-');
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }).replace(/:/g, '-');
      const autoCaption = project ? `${project.name}_${dateStr}_${timeStr}` : '';

      const savedPhoto = await idb.savePhoto({
        projectId: selectedProject,
        blob: compressionResult.blob,
        mediaType: 'photo',
        width: canvas.width,
        height: canvas.height,
        quality: selectedQuality,
        caption: autoCaption,
        timestamp: Date.now(),
        syncStatus: 'pending',
        retryCount: 0,
        pendingTagIds: selectedTags.length > 0 ? selectedTags : undefined,
        unitLabel: selectedUnitLabel || undefined,
        sessionActive: true,
        sessionId: currentSessionId.current,
      });

      URL.revokeObjectURL(compressionResult.url);

      haptics.success();

      sessionPhotosRef.current = [savedPhoto, ...sessionPhotosRef.current].slice(0, 10);
      setSessionPhotos([...sessionPhotosRef.current]);

      // Navigate back to todos if in Photo Attachment Mode
      if (isAttachMode) {
        console.log('[Camera] Quick capture in attach mode, uploading and waiting for server ID');
        
        // Upload immediately and wait for server photo ID
        const serverPhotoId = await syncManager.uploadPhotoAndWait(savedPhoto.id, selectedProject);
        
        if (serverPhotoId) {
          console.log('[Camera] Photo uploaded, navigating to todos with server photoId:', serverPhotoId);
          setLocation(`/todos?photoId=${serverPhotoId}`);
        } else {
          // Upload failed or offline - navigate without photoId
          console.log('[Camera] Photo upload failed, navigating to todos without photoId');
          setLocation('/todos');
        }
        return; // Early return to prevent button animation
      }

      // For normal mode (not attach), queue for background sync
      try {
        await syncManager.queuePhotoSync(savedPhoto.id, selectedProject, 'create');
        console.log('[Camera] Photo queued for sync successfully');
      } catch (err) {
        console.error('[Camera] Sync queue error:', err);
        // Silent - user doesn't need notification if working correctly
      }

      // Invalidate photos query to trigger refresh in ProjectPhotos page
      queryClient.invalidateQueries({ queryKey: ['/api/projects', selectedProject, 'photos'] });

      // Dispatch custom event to trigger immediate IndexedDB reload (works offline)
      window.dispatchEvent(new CustomEvent('photoAdded', { detail: { projectId: selectedProject } }));

      const quickButton = document.querySelector('[data-testid="button-quick-capture"]') as HTMLElement;
      if (quickButton) {
        quickButton.style.transform = 'scale(0.9)';
        setTimeout(() => {
          quickButton.style.transform = 'scale(1)';
        }, 150);
      }

    } catch (error) {
      console.error('Quick capture error:', error);
      haptics.error();
      const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        title: 'Photo Capture Failed',
        description: errorMsg + '. Please try again.',
        variant: 'destructive',
        duration: 4000,
      });
    } finally {
      setIsCapturing(false);
    }
  };

  const captureAndEdit = async (mode?: 'todo' | 'edit') => {
    if (!selectedProject || isCapturing || !isActive) return;

    if (!canWrite) {
      setUpgradeModalOpen(true);
      return;
    }

    haptics.light();
    
    // Trigger flash animation
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 200);
    
    setIsCapturing(true);

    try {
      if (!videoRef.current) {
        throw new Error('Video element not available');
      }

      if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
        throw new Error('Camera not ready - please wait a moment and try again');
      }
      const video = videoRef.current;
      const canvas = captureVideoFrame(video);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Failed to create blob'))),
          'image/jpeg',
          0.95
        );
      });

      const compressionResult = await photoCompressionWorker.compressPhoto(blob, selectedQuality);

      const project = projects.find(p => p.id === selectedProject);
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).replace(/\//g, '-');
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }).replace(/:/g, '-');
      const autoCaption = project ? `${project.name}_${dateStr}_${timeStr}` : '';

      const savedPhoto = await idb.savePhoto({
        projectId: selectedProject,
        blob: compressionResult.blob,
        mediaType: 'photo',
        width: canvas.width,
        height: canvas.height,
        quality: selectedQuality,
        caption: autoCaption,
        timestamp: Date.now(),
        syncStatus: 'pending',
        retryCount: 0,
        pendingTagIds: selectedTags.length > 0 ? selectedTags : undefined,
        unitLabel: selectedUnitLabel || undefined,
        isForTodo: mode === 'todo',
        sessionActive: true,
        sessionId: currentSessionId.current,
      });

      console.log('[Camera] Photo saved for edit:', savedPhoto.id);

      try {
        await syncManager.queuePhotoSync(savedPhoto.id, selectedProject, 'create');
        console.log('[Camera] Photo queued for sync successfully');
      } catch (err) {
        console.error('[Camera] Sync queue error:', err);
        // Don't show error toast here since user is navigating to edit
        // The photo is still saved locally and can be synced later
      }

      sessionPhotosRef.current = [savedPhoto, ...sessionPhotosRef.current].slice(0, 10);
      setSessionPhotos([...sessionPhotosRef.current]);

      URL.revokeObjectURL(compressionResult.url);

      // Invalidate photos query to trigger refresh in ProjectPhotos page
      queryClient.invalidateQueries({ queryKey: ['/api/projects', selectedProject, 'photos'] });

      // Dispatch custom event to trigger immediate IndexedDB reload (works offline)
      window.dispatchEvent(new CustomEvent('photoAdded', { detail: { projectId: selectedProject } }));

      // Navigate based on mode
      if (isAttachMode) {
        // Photo Attachment Mode: return to todos with photoId
        setLocation(`/todos?photoId=${savedPhoto.id}`);
      } else if (mode === 'todo') {
        // Camera Tab To-Do mode: navigate to edit page with createTodo flag
        shouldPreserveSessionRef.current = true; // Preserve session when going to edit
        setLocation(`/photo/${savedPhoto.id}/edit?createTodo=true&projectId=${selectedProject}&preserveSession=true`);
      } else {
        // Normal capture: navigate to edit page with preserveSession flag
        shouldPreserveSessionRef.current = true; // Preserve session when going to edit
        setLocation(`/photo/${savedPhoto.id}/edit?preserveSession=true&projectId=${selectedProject}`);
      }

    } catch (error) {
      console.error('Capture and edit error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        title: 'Photo Capture Failed',
        description: errorMsg + '. Please try again.',
        variant: 'destructive',
        duration: 4000,
      });
      setIsCapturing(false);
    }
  };


  const handleDeletePhoto = async (photoId: string) => {
    try {
      await idb.deletePhoto(photoId);
      
      sessionPhotosRef.current = sessionPhotosRef.current.filter(p => p.id !== photoId);
      setSessionPhotos([...sessionPhotosRef.current]);

    } catch (error) {
      console.error('[Camera] Failed to delete photo:', error);
      toast({
        title: 'Delete failed',
        description: 'Failed to delete photo',
        variant: 'destructive',
      });
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

  if (showProjectSelection) {
    const filteredProjects = projectSearchQuery.trim() 
      ? projects.filter(project => 
          project.name.toLowerCase().includes(projectSearchQuery.toLowerCase()) ||
          (project.address?.toLowerCase().includes(projectSearchQuery.toLowerCase())) ||
          (project.description?.toLowerCase().includes(projectSearchQuery.toLowerCase()))
        )
      : projects;

    return (
      <div className="flex flex-col h-dvh bg-background">
        <div className="flex items-center justify-between px-4 pt-safe-3 pb-3 border-b border-border">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation('/')}
            data-testid="button-back-to-home"
          >
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <h1 className="text-lg font-medium text-muted-foreground" data-testid="text-select-project">
            Tap to Capture
          </h1>
          <div className="w-10" />
        </div>

        <div className="flex-1 overflow-y-auto px-4 pt-6 pb-24">
          <div className="max-w-2xl mx-auto space-y-2">
            {filteredProjects.map((project) => (
              <button
                key={project.id}
                onClick={() => {
                  setSelectedProject(project.id);
                  setShowProjectSelection(false);
                }}
                className="group w-full flex gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl bg-card border border-border hover-elevate active-elevate-2 transition-all"
                data-testid={`button-select-project-${project.id}`}
              >
                {/* Cover Photo - matches SwipeableProjectCard */}
                <div className="flex-shrink-0">
                  {project.coverPhoto ? (
                    <img
                      src={project.coverPhoto.url}
                      alt={project.name}
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover"
                      data-testid={`img-cover-${project.id}`}
                    />
                  ) : (
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-muted/50 backdrop-blur-sm flex items-center justify-center border border-border/30">
                      <Home className="w-7 h-7 sm:w-8 sm:h-8 text-muted-foreground/70" />
                    </div>
                  )}
                </div>

                {/* Project Info - matches SwipeableProjectCard layout */}
                <div className="flex-1 min-w-0 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold truncate text-left" data-testid={`text-project-name-${project.id}`}>
                      {project.name}
                    </h3>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground text-left">
                      <CameraIcon className="w-3.5 h-3.5" />
                      <span data-testid={`text-photo-count-${project.id}`}>
                        {project.photoCount || 0} {project.photoCount === 1 ? 'photo' : 'photos'}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-xl border-t border-border">
          <div className="max-w-2xl mx-auto">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                value={projectSearchQuery}
                onChange={(e) => setProjectSearchQuery(e.target.value)}
                placeholder="Search projects..."
                className="w-full pl-12 pr-4 py-4 rounded-2xl bg-card border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-all"
                data-testid="input-search-projects"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (permissionDenied) {
    const handleRequestAgain = () => {
      setPermissionDenied(false);
      setHasPermission(false);
      setIsActive(false);
      if (selectedProject && !showProjectSelection) {
        startCamera();
      }
    };

    return (
      <div className="fixed inset-0 w-full h-dvh bg-black overflow-hidden flex items-center justify-center">
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
    <div 
      ref={containerRef}
      className={`fixed inset-0 w-full h-dvh bg-black overflow-hidden flex flex-col transition-opacity duration-300 ${
        isReturningFromEdit ? 'opacity-0' : 'opacity-100'
      }`}
      onTouchStart={handleContainerTouchStart}
      onTouchMove={handleContainerTouchMove}
      onTouchEnd={handleContainerTouchEnd}
    >
      {/* Camera Viewfinder */}
      <div className="relative flex-1 min-h-0 w-full max-w-full mx-auto">
          {/* Top Bar - iOS Style with Black Background */}
          <div className="absolute top-0 left-0 right-0 z-30 pt-safe-2 px-4 pb-4 bg-black">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setLocation('/')}
                className="h-11 w-11 bg-black/30 text-white/80 hover:bg-black/40 backdrop-blur-sm border border-white/10 rounded-full"
                data-testid="button-back"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              
              {/* Session Status Indicator */}
              {sessionPhotos.length > 0 && (() => {
                const uploadedCount = sessionPhotos.filter(p => p.uploadedAt).length;
                const pendingCount = sessionPhotos.filter(p => !p.uploadedAt).length; // Count all non-uploaded (pending, syncing, error)
                
                return (
                  <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 bg-black/40 backdrop-blur-sm border border-white/10 rounded-full" data-testid="session-status">
                    <span className="text-white/90 text-xs font-medium">
                      {sessionPhotos.length} {sessionPhotos.length === 1 ? 'photo' : 'photos'}
                    </span>
                    {uploadedCount > 0 && (
                      <>
                        <span className="text-white/40">•</span>
                        <span className="text-green-400 text-xs font-medium flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          {uploadedCount}
                        </span>
                      </>
                    )}
                    {pendingCount > 0 && (
                      <>
                        <span className="text-white/40">•</span>
                        <span className="text-yellow-400 text-xs font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {pendingCount}
                        </span>
                      </>
                    )}
                  </div>
                );
              })()}
              
              <Button
                variant="ghost"
                size="icon"
                onClick={switchCamera}
                className="h-11 w-11 bg-black/30 text-white/80 hover:bg-black/40 backdrop-blur-sm border border-white/10 rounded-full"
                data-testid="button-switch-camera"
              >
                <SwitchCamera className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Loading and Error states */}
          {(!isActive || isCameraLoading) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10 bg-black">
              {cameraError ? (
                <>
                  <div className="w-20 h-20 bg-red-600/20 rounded-full flex items-center justify-center">
                    <X className="w-10 h-10 text-red-600" />
                  </div>
                  <div className="text-center space-y-2 px-6">
                    <p className="text-white text-sm font-medium">Camera Error</p>
                    <p className="text-white/60 text-xs max-w-xs">{cameraError}</p>
                  </div>
                  <Button
                    onClick={() => {
                      setCameraError(null);
                      setPermissionDenied(false);
                      startCamera();
                    }}
                    variant="outline"
                    size="sm"
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                    data-testid="button-retry-camera"
                  >
                    Try Again
                  </Button>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center animate-pulse">
                    <CameraIcon className="w-10 h-10 text-primary" />
                  </div>
                  <p className="text-white text-sm">Starting Camera...</p>
                </>
              )}
            </div>
          )}
          
          {/* Video Stream */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${!isActive ? 'opacity-0' : 'opacity-100'}`}
            style={{ zIndex: 1 }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            data-testid="video-camera-stream"
          />
          
          {/* Annotation Canvas */}
          <canvas
            ref={annotationCanvasRef}
            className={`absolute inset-0 w-full h-full object-cover ${isRecording ? 'touch-none' : 'pointer-events-none opacity-0'}`}
            style={{ zIndex: 2 }}
            onTouchStart={handleAnnotationTouchStart}
            onTouchMove={handleAnnotationTouchMove}
            onTouchEnd={handleAnnotationTouchEnd}
            data-testid="annotation-canvas"
          />
          
          {/* Photo Flash Overlay */}
          {showFlash && (
            <div 
              className="absolute inset-0 bg-white pointer-events-none animate-flash"
              style={{ zIndex: 50 }}
              data-testid="flash-overlay"
            />
          )}
          
          {/* Recording Indicator */}
          {isRecording && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-red-600 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2 animate-pulse">
              <div className="w-2 h-2 bg-white rounded-full" />
              Recording
            </div>
          )}
          
          {/* Unit Stamp Badge - Only show when unit is selected */}
          {selectedUnitLabel && !isRecording && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-primary text-white px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg backdrop-blur-sm border border-white/20">
              {selectedUnitLabel}
            </div>
          )}
          
          {/* Zoom Indicator */}
          {pinchStartDistanceRef.current !== null && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 bg-black/60 backdrop-blur-md text-white px-6 py-3 rounded-full text-2xl font-semibold">
              {continuousZoom.toFixed(1)}x
            </div>
          )}
          
      </div>

      {/* iOS 26-Style Bottom Controls with Liquid Glass Background - Apple Layout */}
      <div className="flex-shrink-0 flex flex-col items-center gap-4 pb-safe-6 pt-8 px-6 mb-0 bg-black">
        {/* Floating Zoom Controls - iOS 26 Liquid Glass Style (Just above controls) */}
        {!isRecording && availableCameras.length > 1 && (
          <div className="flex flex-row gap-1.5 bg-black/30 backdrop-blur-xl rounded-full px-2.5 py-2 shadow-2xl border border-white/10">
            {availableCameras.map((camera) => (
              <button
                key={camera.deviceId}
                onClick={() => switchZoomLevel(camera.zoomLevel)}
                className={`min-touch text-xs font-semibold px-2.5 py-1.5 rounded-full transition-all duration-200 ${
                  zoomLevel === camera.zoomLevel
                    ? 'bg-white text-black shadow-md'
                    : 'text-white/90 hover:bg-white/15 active:bg-white/25'
                }`}
                data-testid={`button-zoom-${camera.zoomLevel}x`}
              >
                {camera.zoomLevel}×
              </button>
            ))}
          </div>
        )}
        {/* Central Control Row - Bottom Position */}
        <div className="flex items-center justify-between w-full">
          {/* Thumbnail - Bottom Left (iOS Style) */}
          {sessionPhotos.length > 0 ? (() => {
            const photo = sessionPhotos[0]; // Most recent photo
            const url = thumbnailUrlsRef.current.get(photo.id);
            if (!url) return <div className="w-14 h-14" />; // Spacer if no URL
            
            const photoTags = photo.pendingTagIds
              ?.map(tagId => tags.find(t => t.id === tagId))
              .filter(Boolean) as Tag[] | undefined;
            
            const isVideo = photo.mediaType === 'video';
            const photoCount = sessionPhotos.length;
            
            return (
              <button
                onClick={() => {
                  // Navigate to project photos to view all session photos
                  setLocation(`/projects/${selectedProject}`);
                }}
                className="w-14 h-14 rounded-full overflow-hidden border-2 border-white/60 shadow-2xl hover-elevate active-elevate-2 backdrop-blur-sm ring-1 ring-black/10 flex-shrink-0"
                data-testid="thumbnail-last-photo"
              >
                {isVideo ? (
                  <video
                    src={url}
                    className="w-full h-full object-cover"
                    muted
                  />
                ) : (
                  <img
                    src={url}
                    alt="Last photo"
                    className="w-full h-full object-cover"
                  />
                )}
                
                {/* Video Play Icon */}
                {isVideo && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
                    <div className="w-6 h-6 rounded-full bg-white/90 flex items-center justify-center">
                      <Play className="w-3 h-3 text-black fill-black ml-0.5" />
                    </div>
                  </div>
                )}
                
                {/* Photo Count Badge */}
                {photoCount > 1 && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-md">
                    {photoCount}
                  </div>
                )}
                
                {/* Upload Status Badge */}
                {photo.uploadedAt ? (
                  <div className="absolute -top-1 -left-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center shadow-md border border-white" data-testid="badge-uploaded">
                    <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                  </div>
                ) : (
                  <div className="absolute -top-1 -left-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center shadow-md border border-white animate-pulse" data-testid="badge-pending">
                    <Clock className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
                
                {/* Tag Indicator */}
                {photoTags && photoTags.length > 0 && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border border-white shadow-sm"
                    style={{ backgroundColor: (() => {
                      const tagColorMap: Record<string, string> = {
                        red: '#ef4444',
                        orange: '#f97316',
                        yellow: '#eab308',
                        blue: '#3b82f6',
                        gray: '#6b7280',
                      };
                      return tagColorMap[photoTags[0].color] || '#6b7280';
                    })() }}
                  />
                )}
              </button>
            );
          })() : (
            <div className="w-14 h-14" />
          )}
          
          {/* Central Capture Button - Adapts to Mode */}
          {cameraMode === 'photo' && (
            <button
              onClick={quickCapture}
              disabled={isCapturing || !selectedProject}
              className="w-20 h-20 rounded-full bg-white border-4 border-white/30 hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 shadow-lg"
              data-testid="button-capture"
            >
              <div className="w-full h-full rounded-full bg-white" />
            </button>
          )}
          
          {cameraMode === 'edit' && (
            <button
              onClick={() => captureAndEdit()}
              disabled={isCapturing || !selectedProject}
              className="w-20 h-20 rounded-full bg-white border-4 border-white/30 hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 shadow-lg"
              data-testid="button-capture-edit"
            >
              <div className="w-full h-full rounded-full bg-white" />
            </button>
          )}
          
          {cameraMode === 'video' && (
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={!selectedProject}
              className={`w-20 h-20 rounded-full border-4 border-white/30 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 shadow-lg ${
                isRecording ? 'bg-red-600' : 'bg-red-600'
              }`}
              data-testid="button-capture"
            >
              {isRecording ? (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-8 h-8 rounded-sm bg-white" />
                </div>
              ) : (
                <div className="w-full h-full rounded-full bg-red-600" />
              )}
            </button>
          )}
          
          {/* Utility Button - Tags & To-Do (Liquid Glass) */}
          {!isAttachMode && (
            <Sheet>
              <SheetTrigger asChild>
                <button
                  className="w-12 h-12 rounded-full bg-white/15 backdrop-blur-xl hover:bg-white/25 active:bg-white/35 transition-all flex items-center justify-center text-white shadow-2xl border border-white/20"
                  data-testid="button-utility"
                >
                  <CheckSquare className="w-5 h-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="bg-black/95 backdrop-blur-md border-white/10">
                <SheetHeader>
                  <SheetTitle className="text-white">Quick Actions</SheetTitle>
                  <SheetDescription className="text-white/60">
                    Add tags or create a to-do
                  </SheetDescription>
                </SheetHeader>
                <div className="flex flex-col gap-3 mt-6">
                  {/* Tags */}
                  {tags.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <label className="text-white/80 text-sm">Auto-tag photos</label>
                      <Select
                        value={selectedTags.length > 0 ? selectedTags[0] : 'none'}
                        onValueChange={(v) => {
                          if (v && v !== 'none') {
                            setSelectedTags([v]);
                          } else {
                            setSelectedTags([]);
                          }
                        }}
                      >
                        <SelectTrigger
                          className="bg-white/10 text-white border-white/20"
                          data-testid="select-auto-tag"
                        >
                          <SelectValue placeholder="No tag" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No tag</SelectItem>
                          {tags.map((tag) => (
                            <SelectItem key={tag.id} value={tag.id}>
                              {tag.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  {/* Unit Stamp Selector - Only show when project has multiple units */}
                  {unitLabels.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <label className="text-white/80 text-sm">Unit Stamp</label>
                      <Select
                        value={selectedUnitLabel || 'none'}
                        onValueChange={(v) => {
                          if (v && v !== 'none') {
                            setSelectedUnitLabel(v);
                          } else {
                            setSelectedUnitLabel(null);
                          }
                        }}
                      >
                        <SelectTrigger
                          className="bg-white/10 text-white border-white/20"
                          data-testid="select-unit-stamp"
                        >
                          <SelectValue placeholder="No unit" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No unit</SelectItem>
                          {unitLabels.map((label) => (
                            <SelectItem key={label} value={label}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  {/* To-Do Button */}
                  {selectedProject && !isRecording && (
                    <Button
                      onClick={() => captureAndEdit('todo')}
                      disabled={isCapturing}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                      data-testid="button-todo"
                    >
                      <CheckSquare className="w-4 h-4 mr-2" />
                      Capture & Create To-Do
                    </Button>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          )}
          {isAttachMode && <div className="w-12 h-12" />}
        </div>

        {/* Mode Carousel - Apple Style Pill (Above Capture Button) */}
        <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-xl rounded-full px-3 py-2 border border-white/10">
          <button
            onClick={() => switchCameraMode('video')}
            disabled={isTransitioning || isRecording}
            aria-pressed={cameraMode === 'video'}
            className={`px-5 py-1.5 rounded-full text-[15px] font-medium tracking-tight transition-all duration-250 ${
              cameraMode === 'video'
                ? 'bg-white text-black'
                : 'text-white/70 hover:text-white/90 active:text-white/95'
            } disabled:opacity-50`}
            data-testid="button-mode-video"
          >
            VIDEO
          </button>
          <button
            onClick={() => switchCameraMode('photo')}
            disabled={isTransitioning || isRecording}
            aria-pressed={cameraMode === 'photo'}
            className={`px-5 py-1.5 rounded-full text-[15px] font-medium tracking-tight transition-all duration-250 ${
              cameraMode === 'photo'
                ? 'bg-white text-black'
                : 'text-white/70 hover:text-white/90 active:text-white/95'
            } disabled:opacity-50`}
            data-testid="button-mode-photo"
          >
            PHOTO
          </button>
          <button
            onClick={() => switchCameraMode('edit')}
            disabled={isTransitioning || isRecording}
            aria-pressed={cameraMode === 'edit'}
            className={`px-5 py-1.5 rounded-full text-[15px] font-medium tracking-tight transition-all duration-250 ${
              cameraMode === 'edit'
                ? 'bg-white text-black'
                : 'text-white/70 hover:text-white/90 active:text-white/95'
            } disabled:opacity-50`}
            data-testid="button-mode-edit"
          >
            EDIT
          </button>
        </div>
      </div>

      {/* Composite Canvas - Hidden */}
      <canvas
        ref={compositeCanvasRef}
        className="absolute"
        style={{ top: '-9999px', left: '-9999px' }}
      />

      {/* Upgrade Modal */}
      <UpgradeModal 
        open={upgradeModalOpen} 
        onClose={() => setUpgradeModalOpen(false)}
        reason={isTrialExpired ? 'trial_expired' : isPastDue ? 'past_due' : isCanceled ? 'canceled' : 'trial_expired'}
      />
    </div>
  );
}
