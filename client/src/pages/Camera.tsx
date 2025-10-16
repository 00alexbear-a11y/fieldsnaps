import { useState, useRef, useEffect, useMemo } from 'react';
import { Camera as CameraIcon, X, Check, Settings2, PenLine, FolderOpen, Video, SwitchCamera, Home, Search, ArrowLeft, Trash2, ChevronUp, ChevronDown, Play, Info, Zap, Grid3X3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { useSubscriptionAccess } from '@/hooks/useSubscriptionAccess';
import { UpgradeModal } from '@/components/UpgradeModal';
import { photoCompressionWorker } from '@/lib/photoCompressionWorker';
import { type QualityPreset } from '@/lib/photoCompression';
import { indexedDB as idb, type LocalPhoto, createPhotoUrl } from '@/lib/indexeddb';
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
import { type Tag } from '@shared/schema';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Badge } from '@/components/ui/badge';

const QUALITY_PRESETS: { value: QualityPreset; label: string; description: string }[] = [
  { value: 'quick', label: 'S', description: '200KB - Fast upload' },
  { value: 'standard', label: 'M', description: '500KB - Balanced' },
  { value: 'detailed', label: 'L', description: '1MB - High quality' },
];

interface Project {
  id: string;
  name: string;
  description?: string;
  address?: string;
  completed?: boolean;
}

interface CameraDevice {
  deviceId: string;
  label: string;
  zoomLevel: 0.5 | 1 | 2 | 3;
}

type CameraMode = 'photo' | 'video';
type CameraFacing = 'environment' | 'user';

export default function Camera() {
  const { canWrite, isTrialExpired, isPastDue, isCanceled } = useSubscriptionAccess();
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
  const [continuousZoom, setContinuousZoom] = useState<number>(1);
  const [projectSearchQuery, setProjectSearchQuery] = useState('');
  const [availableCameras, setAvailableCameras] = useState<CameraDevice[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagPickerExpanded, setTagPickerExpanded] = useState(false);
  
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
  
  const annotationCanvasRef = useRef<HTMLCanvasElement>(null);
  const compositeCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const drawingPathRef = useRef<{x: number, y: number}[]>([]);
  const isRecordingRef = useRef<boolean>(false);
  const clearTimeoutRef = useRef<number | null>(null);
  
  const { toast } = useToast();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('projectId');
    if (projectId && projectId !== selectedProject) {
      console.log('[Camera] Setting project from URL:', projectId);
      setSelectedProject(projectId);
      setShowProjectSelection(false);
    }
  }, [location]);

  const { data: allProjects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  const projects = useMemo(() => 
    allProjects.filter(project => !project.completed),
    [allProjects]
  );

  const { data: tags = [] } = useQuery<Tag[]>({
    queryKey: ['/api/tags', selectedProject],
    queryFn: () => fetch(`/api/tags?projectId=${selectedProject}`, {
      headers: { 'x-skip-auth': 'true' }
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
  }, [selectedProject]);

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

  const previousProjectRef = useRef<string>('');
  const currentProjectRef = useRef<string>('');
  useEffect(() => {
    const sessionKey = selectedProject ? `camera-session-${selectedProject}` : null;
    currentProjectRef.current = selectedProject;
    
    if (sessionKey) {
      const saved = localStorage.getItem(sessionKey);
      if (saved) {
        try {
          const photoIds = JSON.parse(saved) as string[];
          const restoreForProject = selectedProject;
          
          Promise.all(photoIds.map(id => idb.getPhoto(id).catch(() => undefined)))
            .then(photos => {
              if (currentProjectRef.current === restoreForProject) {
                const validPhotos = photos.filter(p => p !== undefined) as LocalPhoto[];
                sessionPhotosRef.current = validPhotos;
                setSessionPhotos(validPhotos);
              }
            })
            .catch(e => {
              console.error('[Camera] Failed to restore session:', e);
            });
        } catch (e) {
          console.error('[Camera] Failed to restore session:', e);
        }
      }
    }
    
    if (previousProjectRef.current && previousProjectRef.current !== selectedProject) {
      const oldKey = `camera-session-${previousProjectRef.current}`;
      localStorage.removeItem(oldKey);
      sessionPhotosRef.current = [];
      setSessionPhotos([]);
    }
    previousProjectRef.current = selectedProject;
    
    return () => {
      if (!window.location.pathname.includes('/photo/') && !window.location.pathname.includes('/photo-edit')) {
        if (sessionKey) {
          localStorage.removeItem(sessionKey);
        }
        sessionPhotosRef.current = [];
      }
    };
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
    if (selectedProject && !showProjectSelection && !isActive && !permissionDenied) {
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
      stopCamera();
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
    
    try {
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
        if (permissionStatus.state === 'denied') {
          setPermissionDenied(true);
          setHasPermission(false);
          setIsActive(false);
          toast({
            title: 'Camera Access Denied',
            description: 'Please enable camera access in your browser settings.',
            variant: 'destructive',
          });
          return;
        }
      } catch (permError) {
        console.log('Permission API not supported, continuing with getUserMedia');
      }
      
      if (sessionId !== cameraSessionIdRef.current) {
        console.log(`[Camera] Session ${sessionId} aborted - newer session started`);
        return;
      }

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
        if (sessionId !== cameraSessionIdRef.current) {
          console.log(`[Camera] Session ${sessionId} aborted during fallback`);
          return;
        }
        
        console.warn('Camera deviceId failed, falling back to facingMode:', deviceError);
        const fallbackConstraints: MediaStreamConstraints = {
          video: {
            facingMode: cameraFacing,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
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
        console.log('[Camera] isActive set to true, loading overlay should hide');
        
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
          width: { ideal: 1920 },
          height: { ideal: 1080 },
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
            width: { ideal: 1920 },
            height: { ideal: 1080 },
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
      const lastPoint = path[path.length - 2];
      const currentPoint = path[path.length - 1];
      
      ctx.strokeStyle = '#FF0000';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      ctx.beginPath();
      ctx.moveTo(lastPoint.x, lastPoint.y);
      ctx.lineTo(currentPoint.x, currentPoint.y);
      ctx.stroke();
    }
  };

  const handleAnnotationTouchEnd = () => {
    setIsDrawing(false);
    drawingPathRef.current = [];
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
        videoBitsPerSecond: 2500000
      });
      
      recordedChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        
        const project = projects.find(p => p.id === selectedProject);
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).replace(/\//g, '-');
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }).replace(/:/g, '-');
        const autoCaption = project ? `${project.name}_${dateStr}_${timeStr}_VIDEO` : '';
        
        const savedPhoto = await idb.savePhoto({
          projectId: selectedProject,
          blob: blob,
          mediaType: 'video',
          quality: selectedQuality,
          caption: autoCaption,
          timestamp: Date.now(),
          syncStatus: 'pending',
          retryCount: 0,
          pendingTagIds: selectedTags.length > 0 ? selectedTags : undefined,
        });
        
        toast({
          title: '✓ Video Saved',
          description: 'Video recorded successfully',
          duration: 2000,
        });
        
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
        
        if (selectedProject) {
          const photoIds = sessionPhotosRef.current.map(p => p.id);
          localStorage.setItem(`camera-session-${selectedProject}`, JSON.stringify(photoIds));
        }
      };
      
      mediaRecorder.start(1000);
      mediaRecorderRef.current = mediaRecorder;
      isRecordingRef.current = true;
      setIsRecording(true);
      
      renderFrame();
      
      toast({
        title: '● Recording',
        description: 'Tap annotations to draw',
        duration: 2000,
      });
      
    } catch (error) {
      console.error('Recording start error:', error);
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

  const applyCrop = (sourceCanvas: HTMLCanvasElement): HTMLCanvasElement => {
    const selectedRatio = ASPECT_RATIOS.find(ar => ar.value === selectedAspectRatio);
    
    if (!selectedRatio || !selectedRatio.ratio) {
      return sourceCanvas;
    }

    const srcWidth = sourceCanvas.width;
    const srcHeight = sourceCanvas.height;
    const srcRatio = srcWidth / srcHeight;
    const targetRatio = selectedRatio.ratio;

    let cropWidth = srcWidth;
    let cropHeight = srcHeight;
    let cropX = 0;
    let cropY = 0;

    if (srcRatio > targetRatio) {
      cropWidth = srcHeight * targetRatio;
      cropX = (srcWidth - cropWidth) / 2;
    } else {
      cropHeight = srcWidth / targetRatio;
      cropY = (srcHeight - cropHeight) / 2;
    }

    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = cropWidth;
    croppedCanvas.height = cropHeight;
    const ctx = croppedCanvas.getContext('2d');
    if (!ctx) return sourceCanvas;

    ctx.drawImage(
      sourceCanvas,
      cropX, cropY, cropWidth, cropHeight,
      0, 0, cropWidth, cropHeight
    );

    return croppedCanvas;
  };

  const quickCapture = async () => {
    if (!selectedProject || isCapturing || !isActive) return;

    if (!canWrite) {
      setUpgradeModalOpen(true);
      return;
    }

    setIsCapturing(true);

    try {
      if (!videoRef.current) {
        throw new Error('Video element not available');
      }

      if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
        throw new Error('Camera not ready - please wait a moment and try again');
      }
      const video = videoRef.current;
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = video.videoWidth;
      tempCanvas.height = video.videoHeight;

      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) throw new Error('Failed to get canvas context');

      tempCtx.drawImage(video, 0, 0);

      const croppedCanvas = applyCrop(tempCanvas);

      const blob = await new Promise<Blob>((resolve, reject) => {
        croppedCanvas.toBlob(
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
        quality: selectedQuality,
        caption: autoCaption,
        timestamp: Date.now(),
        syncStatus: 'pending',
        retryCount: 0,
        pendingTagIds: selectedTags.length > 0 ? selectedTags : undefined,
      });

      URL.revokeObjectURL(compressionResult.url);

      toast({
        title: '✓ Captured',
        description: `${QUALITY_PRESETS.find(p => p.value === selectedQuality)?.label} quality`,
        duration: 1500,
      });

      syncManager.queuePhotoSync(savedPhoto.id, selectedProject, 'create').catch(err => {
        console.error('[Camera] Sync queue error:', err);
        toast({
          title: 'Sync queue failed',
          description: 'Photo saved locally but not queued for upload. Try manual sync.',
          variant: 'destructive',
          duration: 3000,
        });
      });

      sessionPhotosRef.current = [savedPhoto, ...sessionPhotosRef.current].slice(0, 10);
      setSessionPhotos([...sessionPhotosRef.current]);
      
      if (selectedProject) {
        const photoIds = sessionPhotosRef.current.map(p => p.id);
        localStorage.setItem(`camera-session-${selectedProject}`, JSON.stringify(photoIds));
      }

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

  const captureAndEdit = async () => {
    if (!selectedProject || isCapturing || !isActive) return;

    if (!canWrite) {
      setUpgradeModalOpen(true);
      return;
    }

    setIsCapturing(true);

    try {
      if (!videoRef.current) {
        throw new Error('Video element not available');
      }

      if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
        throw new Error('Camera not ready - please wait a moment and try again');
      }
      const video = videoRef.current;
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = video.videoWidth;
      tempCanvas.height = video.videoHeight;

      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) throw new Error('Failed to get canvas context');

      tempCtx.drawImage(video, 0, 0);

      const croppedCanvas = applyCrop(tempCanvas);

      const blob = await new Promise<Blob>((resolve, reject) => {
        croppedCanvas.toBlob(
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
        quality: selectedQuality,
        caption: autoCaption,
        timestamp: Date.now(),
        syncStatus: 'pending',
        retryCount: 0,
        pendingTagIds: selectedTags.length > 0 ? selectedTags : undefined,
      });

      console.log('[Camera] Photo saved for edit:', savedPhoto.id);

      syncManager.queuePhotoSync(savedPhoto.id, selectedProject, 'create').catch(err => {
        console.error('[Camera] Sync queue error:', err);
        toast({
          title: 'Sync queue failed',
          description: 'Photo saved locally but not queued for upload. Try manual sync.',
          variant: 'destructive',
          duration: 3000,
        });
      });

      sessionPhotosRef.current = [savedPhoto, ...sessionPhotosRef.current].slice(0, 10);
      setSessionPhotos([...sessionPhotosRef.current]);
      
      if (selectedProject) {
        const photoIds = sessionPhotosRef.current.map(p => p.id);
        localStorage.setItem(`camera-session-${selectedProject}`, JSON.stringify(photoIds));
      }

      URL.revokeObjectURL(compressionResult.url);

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


  const handleDeletePhoto = async (photoId: string) => {
    try {
      await idb.deletePhoto(photoId);
      
      sessionPhotosRef.current = sessionPhotosRef.current.filter(p => p.id !== photoId);
      setSessionPhotos([...sessionPhotosRef.current]);
      
      if (selectedProject) {
        const photoIds = sessionPhotosRef.current.map(p => p.id);
        localStorage.setItem(`camera-session-${selectedProject}`, JSON.stringify(photoIds));
      }

      toast({
        title: 'Photo deleted',
        description: 'Photo removed from local storage',
        duration: 2000,
      });
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
      <div className="flex flex-col h-screen bg-background">
        <div className="flex items-center justify-between px-4 py-6 border-b border-border">
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
          <div className="max-w-2xl mx-auto grid grid-cols-1 gap-3">
            {filteredProjects.map((project) => (
              <button
                key={project.id}
                onClick={() => {
                  setSelectedProject(project.id);
                  setShowProjectSelection(false);
                }}
                className="group w-full p-5 rounded-2xl bg-card border border-border hover-elevate active-elevate-2 transition-all"
                data-testid={`button-select-project-${project.id}`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <CameraIcon className="w-8 h-8 text-primary" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-lg font-medium text-foreground">
                      {project.name}
                    </h3>
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

  const selectedProjectData = projects.find(p => p.id === selectedProject);

  return (
    <div className="fixed inset-0 w-full bg-black overflow-hidden flex flex-col" style={{ height: '100dvh', minHeight: '100vh' }}>
      {/* Compact Header - Project selector and flip camera only */}
      <div className="flex-shrink-0 z-30 bg-black/50 backdrop-blur-md border-b border-white/10 px-2 py-2">
        <div className="flex items-center gap-2">
          {/* Project Dropdown */}
          <Select value={selectedProject} onValueChange={(v) => setSelectedProject(v)}>
            <SelectTrigger
              className="flex-1 bg-transparent border-none text-white font-medium h-8 text-sm"
              data-testid="select-project"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Flip Camera */}
          <Button
            variant="ghost"
            size="icon"
            onClick={switchCamera}
            className="h-8 w-8 bg-white/10 text-white hover:bg-white/20"
            data-testid="button-switch-camera"
          >
            <SwitchCamera className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Dominant Viewfinder (≥75% height) */}
      <div className="relative flex-1 min-h-0">
          {/* Loading state */}
          {!isActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10 bg-black">
              <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center animate-pulse">
                <CameraIcon className="w-10 h-10 text-primary" />
              </div>
              <p className="text-white text-sm">Starting Camera...</p>
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
          
          {/* Crop Guides Overlay - show when non-original ratio selected */}
          {selectedAspectRatio !== 'original' && isActive && (
            <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 3 }}>
              <div className="relative w-full h-full flex items-center justify-center">
                {(() => {
                  const selectedRatio = ASPECT_RATIOS.find(ar => ar.value === selectedAspectRatio);
                  if (!selectedRatio || !selectedRatio.ratio) return null;
                  
                  const targetRatio = selectedRatio.ratio;
                  const viewportRatio = window.innerWidth / window.innerHeight;
                  
                  let cropAreaStyle: React.CSSProperties = {};
                  
                  if (viewportRatio > targetRatio) {
                    const cropWidth = window.innerHeight * targetRatio;
                    const cropWidthPercent = (cropWidth / window.innerWidth) * 100;
                    cropAreaStyle = {
                      width: `${cropWidthPercent}%`,
                      height: '100%',
                    };
                  } else {
                    const cropHeight = window.innerWidth / targetRatio;
                    const cropHeightPercent = (cropHeight / window.innerHeight) * 100;
                    cropAreaStyle = {
                      width: '100%',
                      height: `${cropHeightPercent}%`,
                    };
                  }
                  
                  return (
                    <>
                      {/* Darken outer areas */}
                      <div className="absolute inset-0 bg-black/40" />
                      {/* Clear crop area */}
                      <div 
                        className="relative bg-transparent border-2 border-white/50"
                        style={cropAreaStyle}
                        data-testid="crop-guide-overlay"
                      />
                    </>
                  );
                })()}
              </div>
            </div>
          )}
          
          {/* Recording Indicator */}
          {isRecording && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-red-600 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2 animate-pulse">
              <div className="w-2 h-2 bg-white rounded-full" />
              Recording
            </div>
          )}
          
          {/* Zoom Indicator */}
          {pinchStartDistanceRef.current !== null && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 bg-black/60 backdrop-blur-md text-white px-6 py-3 rounded-full text-2xl font-semibold">
              {continuousZoom.toFixed(1)}x
            </div>
          )}
          
          {/* Horizontal Photo Preview Strip - Overlaid at bottom */}
          {sessionPhotos.length > 0 && !isRecording && (
            <div className="absolute bottom-0 left-0 right-0 z-20 overflow-x-auto scrollbar-hide bg-black/30 backdrop-blur-sm">
              <div className="flex gap-2 p-2">
              {sessionPhotos.slice(0, 5).map((photo) => {
                const url = thumbnailUrlsRef.current.get(photo.id);
                if (!url) return null;
                
                const photoTags = photo.pendingTagIds
                  ?.map(tagId => tags.find(t => t.id === tagId))
                  .filter(Boolean) as Tag[] | undefined;
                
                const tagColorMap: Record<string, string> = {
                  red: '#ef4444',
                  orange: '#f97316',
                  yellow: '#eab308',
                  blue: '#3b82f6',
                  gray: '#6b7280',
                };
                
                const isVideo = photo.mediaType === 'video';
                
                return (
                  <div
                    key={photo.id}
                    className="relative flex-shrink-0 group"
                    data-testid={`thumbnail-${photo.id}`}
                  >
                    <button
                      onClick={() => {
                        if (isVideo) {
                          setLocation(`/photo/${photo.id}/view`);
                        } else {
                          setLocation(`/photo/${photo.id}/edit`);
                        }
                      }}
                      className="block w-20 h-20 rounded-2xl overflow-hidden border-2 border-white/30 hover-elevate active-elevate-2"
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
                          alt="Thumbnail"
                          className="w-full h-full object-cover"
                        />
                      )}
                      
                      {isVideo && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
                          <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center">
                            <Play className="w-4 h-4 text-black fill-black ml-0.5" />
                          </div>
                        </div>
                      )}
                    </button>
                    
                    {photoTags && photoTags.length > 0 && (
                      <div 
                        className="absolute top-0 left-0 bottom-0 flex flex-col gap-0.5 p-1 pointer-events-none"
                        data-testid={`tag-indicators-${photo.id}`}
                      >
                        {photoTags.slice(0, 2).map((tag) => (
                          <div
                            key={tag.id}
                            className="w-1 flex-1 rounded-full"
                            style={{ backgroundColor: tagColorMap[tag.color] || '#6b7280' }}
                          />
                        ))}
                      </div>
                    )}
                    
                    {photoTags && photoTags.length > 2 && (
                      <div 
                        className="absolute top-1 left-1 bg-black/70 backdrop-blur-sm text-white text-[10px] font-medium px-1 py-0.5 rounded-full pointer-events-none"
                        data-testid={`tag-overflow-badge-${photo.id}`}
                      >
                        +{photoTags.length - 2}
                      </div>
                    )}
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePhoto(photo.id);
                      }}
                      className="absolute -top-1 -right-1 w-6 h-6 bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                      data-testid={`button-delete-thumbnail-${photo.id}`}
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                );
              })}
              </div>
            </div>
          )}
      </div>

      {/* Controls Row - Quality, Zoom, Tags */}
      <div className="flex-shrink-0 z-20 bg-black/50 backdrop-blur-md px-4 py-2 border-t border-white/10">
        <div className="flex items-center justify-center gap-4">
          {/* Quality toggles S/M/L */}
          <div className="flex gap-1">
            {QUALITY_PRESETS.map((preset) => (
              <Button
                key={preset.value}
                variant="ghost"
                size="sm"
                onClick={() => setSelectedQuality(preset.value)}
                className={`h-8 w-8 p-0 text-xs ${
                  selectedQuality === preset.value
                    ? 'bg-white text-black'
                    : 'bg-white/10 text-white'
                }`}
                data-testid={`button-quality-${preset.value}`}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          
          {/* Zoom controls */}
          <div className="flex gap-1">
            {availableCameras.map((camera) => (
              <Button
                key={camera.deviceId}
                variant="ghost"
                size="sm"
                onClick={() => switchZoomLevel(camera.zoomLevel)}
                className={`h-8 px-2 text-xs ${
                  zoomLevel === camera.zoomLevel
                    ? 'bg-white text-black'
                    : 'bg-white/10 text-white'
                }`}
                data-testid={`button-zoom-${camera.zoomLevel}x`}
              >
                {camera.zoomLevel}x
              </Button>
            ))}
          </div>
          
          {/* Auto-tag Dropdown */}
          {tags.length > 0 && !isRecording && (() => {
            const tagColorMap: Record<string, string> = {
              red: '#ef4444',
              orange: '#f97316',
              yellow: '#eab308',
              blue: '#3b82f6',
              gray: '#6b7280',
            };
            const selectedTag = selectedTags.length > 0 ? tags.find(t => t.id === selectedTags[0]) : null;
            const borderColor = selectedTag ? tagColorMap[selectedTag.color] || '#6b7280' : 'rgba(255, 255, 255, 0.2)';
            
            return (
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
                  className="w-24 bg-white/10 text-white h-8 text-xs"
                  style={{ borderColor, borderWidth: '2px' }}
                  data-testid="select-auto-tag"
                >
                  <SelectValue placeholder="No tag" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No tag</SelectItem>
                  {tags.map((tag) => {
                    return (
                      <SelectItem 
                        key={tag.id} 
                        value={tag.id}
                        style={{ color: tagColorMap[tag.color] || '#6b7280' }}
                      >
                        {tag.name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            );
          })()}
        </div>
      </div>

      {/* Bottom Action Rail - 4 Buttons: Back, Video, Camera, Edit */}
      <div className="flex-shrink-0 flex items-center justify-around px-8 py-4 bg-black/50 backdrop-blur-md border-t border-white/10">
        {/* Back */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => window.history.back()}
          className="flex flex-col gap-1 w-16 h-16 rounded-full bg-white/10 hover:bg-white/20 text-white"
          data-testid="button-back"
        >
          <ArrowLeft className="w-6 h-6" />
          <span className="text-[10px]">Back</span>
        </Button>
        
        {/* Video Record/Stop */}
        <Button
          variant="ghost"
          size="icon"
          onClick={isRecording ? stopRecording : startRecording}
          disabled={!selectedProject}
          className={`flex flex-col gap-1 w-16 h-16 rounded-full ${
            isRecording 
              ? 'bg-red-600 hover:bg-red-700 text-white' 
              : 'bg-white/10 hover:bg-white/20 text-white'
          } disabled:opacity-50`}
          data-testid="button-video-record"
        >
          {isRecording ? (
            <>
              <div className="w-6 h-6 rounded-sm bg-white" />
              <span className="text-[10px]">Stop</span>
            </>
          ) : (
            <>
              <Video className="w-6 h-6" />
              <span className="text-[10px]">Video</span>
            </>
          )}
        </Button>
        
        {/* Camera - Quick Capture */}
        <Button
          variant="ghost"
          size="icon"
          onClick={quickCapture}
          disabled={isCapturing || isRecording || !selectedProject}
          className="flex flex-col gap-1 w-16 h-16 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-50"
          data-testid="button-quick-capture"
        >
          <CameraIcon className="w-6 h-6" />
          <span className="text-[10px]">Camera</span>
        </Button>
        
        {/* Edit Mode - Capture & Edit */}
        <Button
          variant="ghost"
          size="icon"
          onClick={captureAndEdit}
          disabled={isCapturing || isRecording || !selectedProject}
          className="flex flex-col gap-1 w-16 h-16 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-50"
          data-testid="button-capture-edit"
        >
          <PenLine className="w-6 h-6" />
          <span className="text-[10px]">Edit</span>
        </Button>
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
