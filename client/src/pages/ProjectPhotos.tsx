import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useOfflineFirstPhotos } from "@/hooks/useOfflineFirstPhotos";
import { ArrowLeft, Camera, Settings as SettingsIcon, Check, Trash2, Share2, FolderInput, Tag as TagIcon, Images, X, CheckSquare, ChevronDown, ListTodo, FileText, MoreVertical, Grid3x3, Upload, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useKeyboardManager } from "@/hooks/useKeyboardManager";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { indexedDB as idb } from "@/lib/indexeddb";
import { nativeClipboard } from "@/lib/nativeClipboard";
import { haptics } from "@/lib/nativeHaptics";
import { PhotoAnnotationEditor } from "@/components/PhotoAnnotationEditor";
import { PhotoGestureViewer } from "@/components/PhotoGestureViewer";
import TagPicker from "@/components/TagPicker";
import LazyImage from "@/components/LazyImage";
import type { Photo as BasePhoto, Project, Tag, ToDo } from "../../../shared/schema";

type TodoWithDetails = ToDo & {
  project?: { id: string; name: string };
  photo?: { id: string; url: string };
  assignee: { id: string; firstName: string | null; lastName: string | null };
  creator: { id: string; firstName: string | null; lastName: string | null };
};
import { format } from "date-fns";

// Extend Photo to include tags
type Photo = BasePhoto & { tags?: Tag[] };

export default function ProjectPhotos() {
  const { id: projectId } = useParams();
  const [, setLocation] = useLocation();
  
  // Enable keyboard management for form inputs
  useKeyboardManager();
  
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [viewerPhotoIndex, setViewerPhotoIndex] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showBatchTagDialog, setShowBatchTagDialog] = useState(false);
  const [targetProjectId, setTargetProjectId] = useState<string>("");
  const [tagPickerPhotoId, setTagPickerPhotoId] = useState<string | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [columnCount, setColumnCount] = useState(5); // 1-10 columns, default 5
  const [activeTab, setActiveTab] = useState<'photos' | 'tasks' | 'pdfs'>('photos');
  const [taskView, setTaskView] = useState<'my-tasks' | 'team-tasks' | 'i-created'>('my-tasks');
  const [taskFilterCompleted, setTaskFilterCompleted] = useState<'active' | 'completed' | 'all'>('active');
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportOptions, setExportOptions] = useState({
    includeName: true,
    includeDate: true,
    includeTimestamp: true,
    includeComments: true,
    includeTags: true,
    includeProjectHeader: true,
    photosPerPage: 1 as 1 | 2 | 3 | 4,
  });
  const { toast } = useToast();

  const { data: project } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
  });

  const { data: company } = useQuery<any>({
    queryKey: ["/api/companies/me"],
  });

  const { data: allProjects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: showMoveDialog,
  });

  // Offline-first: load from IndexedDB immediately, fetch from server in background
  const { photos = [], isLoading, isOnline, hasLocalData } = useOfflineFirstPhotos(projectId || '');

  // Fetch available tags for filtering
  const { data: availableTags = [] } = useQuery<Tag[]>({
    queryKey: ["/api/tags"],
  });

  // Fetch team members for task assignment
  const { data: teamMembers = [] } = useQuery<any[]>({
    queryKey: ["/api/companies/members"],
    enabled: activeTab === 'tasks',
  });

  // Fetch all tasks for this project using the same endpoint as main To-Do page
  const { data: projectTasks = [], isLoading: isLoadingTasks } = useQuery<TodoWithDetails[]>({
    queryKey: ["/api/todos", taskView, projectId, taskFilterCompleted],
    queryFn: async () => {
      const params = new URLSearchParams({ view: taskView });
      if (projectId) params.append('projectId', projectId);
      if (taskFilterCompleted !== 'all') params.append('completed', taskFilterCompleted === 'completed' ? 'true' : 'false');
      const response = await fetch(`/api/todos?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch tasks");
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: activeTab === 'tasks',
  });

  // Fetch PDFs for this project
  const { data: pdfs = [] } = useQuery<any[]>({
    queryKey: ["/api/projects", projectId, "pdfs"],
    enabled: activeTab === 'pdfs',
  });

  // Initialize export options from company PDF settings
  useEffect(() => {
    if (company) {
      setExportOptions(prev => ({
        ...prev,
        photosPerPage: (company.pdfDefaultGridLayout || 2) as 1 | 2 | 3 | 4,
        includeTimestamp: company.pdfIncludeTimestamp ?? prev.includeTimestamp,
        includeTags: company.pdfIncludeTags ?? prev.includeTags,
        includeComments: prev.includeComments, // Keep existing for comments
        includeName: prev.includeName,
        includeDate: prev.includeDate,
        includeProjectHeader: prev.includeProjectHeader,
      }));
    }
  }, [company]);

  // Filter photos by selected tags (for use in viewer and display)
  const filteredPhotos = useMemo(() => {
    if (selectedTagIds.size === 0) return photos;
    return photos.filter(photo => 
      photo.tags?.some(tag => selectedTagIds.has(tag.id))
    );
  }, [photos, selectedTagIds]);

  // Group photos by date (newest first) using filtered photos
  const photosByDate = useMemo(() => {
    if (!filteredPhotos.length) return [];

    // Sort photos by createdAt (newest first)
    const sortedPhotos = [...filteredPhotos].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Group by date
    const groups = new Map<string, Photo[]>();
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
  }, [filteredPhotos]);

  const { data: annotations = [] } = useQuery<any[]>({
    queryKey: ["/api/photos", selectedPhoto?.id, "annotations"],
    enabled: !!selectedPhoto,
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ file, width, height }: { file: File; width: number; height: number }) => {
      // Upload photo using multipart/form-data
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('caption', file.name);
      formData.append('width', width.toString());
      formData.append('height', height.toString());
      
      const res = await fetch(`/api/projects/${projectId}/photos`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(errorData.message || `Upload failed: ${res.statusText}`);
      }
      
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "photos"] });
      toast({ title: "Photo uploaded successfully" });
    },
    onError: (error: any) => {
      console.error('Upload error:', error);
      toast({ 
        title: "Upload failed", 
        description: error.message || 'Failed to upload photo',
        variant: "destructive" 
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (photoId: string) => {
      await apiRequest("DELETE", `/api/photos/${photoId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "photos"] });
      toast({ title: "Photo deleted successfully" });
    },
    onError: () => {
      toast({ 
        title: "Failed to delete photo", 
        variant: "destructive" 
      });
    },
  });

  const setCoverPhotoMutation = useMutation({
    mutationFn: async (photoId: string) => {
      return await apiRequest("PATCH", `/api/projects/${projectId}`, { coverPhotoId: photoId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Project icon updated" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update project icon", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const deletePdfMutation = useMutation({
    mutationFn: async (pdfId: string) => {
      await apiRequest("DELETE", `/api/pdfs/${pdfId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "pdfs"] });
      toast({ title: "PDF deleted successfully" });
    },
    onError: () => {
      toast({ 
        title: "Failed to delete PDF", 
        variant: "destructive" 
      });
    },
  });

  const movePhotosMutation = useMutation({
    mutationFn: async ({ photoIds, targetProjectId }: { photoIds: string[]; targetProjectId: string }) => {
      // Move each photo to the target project, preserving annotations and edited blobs
      await Promise.all(
        photoIds.map(async photoId => {
          // Check if photo has annotations/edited blob in IndexedDB
          const localPhoto = await idb.getPhoto(photoId);
          
          if (localPhoto && (localPhoto.blob || localPhoto.annotations)) {
            // Photo has annotations or edited blob - send as FormData
            const formData = new FormData();
            formData.append('projectId', targetProjectId);
            
            if (localPhoto.blob) {
              formData.append('photo', localPhoto.blob, `photo-${photoId}.jpg`);
            }
            
            if (localPhoto.annotations) {
              formData.append('annotations', localPhoto.annotations);
            }
            
            // Send PATCH request with FormData
            const response = await fetch(`/api/photos/${photoId}`, {
              method: 'PATCH',
              credentials: 'include',
              body: formData,
            });
            
            if (!response.ok) {
              throw new Error(`Failed to move photo ${photoId}`);
            }
          } else {
            // No annotations/blob - just update projectId
            await apiRequest("PATCH", `/api/photos/${photoId}`, { projectId: targetProjectId });
          }
        })
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "photos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", variables.targetProjectId, "photos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: `${variables.photoIds.length} photo${variables.photoIds.length === 1 ? '' : 's'} moved successfully` });
      setShowMoveDialog(false);
      setSelectedPhotoIds(new Set());
      setIsSelectMode(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to move photos", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const batchTagMutation = useMutation({
    mutationFn: async ({ photoIds, tagId }: { photoIds: string[]; tagId: string }) => {
      // Apply tag to each selected photo
      await Promise.all(
        photoIds.map(photoId => 
          apiRequest("POST", `/api/photos/${photoId}/tags`, { tagId })
        )
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "photos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ 
        title: `Tag applied to ${variables.photoIds.length} photo${variables.photoIds.length === 1 ? '' : 's'}`,
        duration: 1500,
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to apply tags", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const completeTaskMutation = useMutation({
    mutationFn: async (todoId: string) => {
      return apiRequest('POST', `/api/todos/${todoId}/complete`, {});
    },
    onSuccess: () => {
      toast({ title: "Task completed!" });
      // Small delay to show completion animation before task disappears from active view
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/todos'] });
      }, 800);
    },
    onError: () => {
      toast({ title: "Failed to complete task", variant: "destructive" });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (todoId: string) => {
      return apiRequest('DELETE', `/api/todos/${todoId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/todos'] });
      toast({ title: "Task deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete task", variant: "destructive" });
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/projects/${projectId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Project deleted successfully" });
      setLocation("/");
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to delete project", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  // Helper function to get image dimensions and convert to JPEG
  const getImageDimensions = async (file: File): Promise<{ width: number; height: number; blob: Blob }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      
      img.onload = () => {
        URL.revokeObjectURL(url);
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        // Use full original dimensions without cropping
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Draw the full image
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({
                width: img.width,
                height: img.height,
                blob
              });
            } else {
              reject(new Error('Failed to create blob from canvas'));
            }
          },
          'image/jpeg',
          0.95
        );
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };
      
      img.src = url;
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check if it's an image
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please select an image file',
        variant: 'destructive',
      });
      e.target.value = '';
      return;
    }
    
    try {
      // Get image dimensions and convert to JPEG without cropping
      const { width, height, blob } = await getImageDimensions(file);
      
      // Update filename extension to .jpg since we're converting to JPEG
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
      const newFilename = `${nameWithoutExt}.jpg`;
      
      // Convert blob to File with JPEG extension
      const processedFile = new File([blob], newFilename, {
        type: 'image/jpeg',
        lastModified: Date.now(),
      });
      
      // Upload the file with dimensions
      uploadMutation.mutate({ file: processedFile, width, height });
    } catch (error) {
      console.error('Error processing image:', error);
      toast({
        title: 'Failed to process image',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
    
    // Reset the input so the same file can be uploaded again if needed
    e.target.value = '';
  };

  const toggleSelectMode = () => {
    setIsSelectMode(!isSelectMode);
    if (isSelectMode) {
      // Clear selection when exiting select mode
      setSelectedPhotoIds(new Set());
    }
  };

  const togglePhotoSelection = (photoId: string) => {
    const newSelected = new Set(selectedPhotoIds);
    if (newSelected.has(photoId)) {
      newSelected.delete(photoId);
    } else {
      newSelected.add(photoId);
    }
    setSelectedPhotoIds(newSelected);
  };

  const toggleDateSelection = (datePhotos: Photo[]) => {
    const newSelected = new Set(selectedPhotoIds);
    const datePhotoIds = datePhotos.map(p => p.id);
    const allSelected = datePhotoIds.every(id => newSelected.has(id));
    
    if (allSelected) {
      // Deselect all photos from this date
      datePhotoIds.forEach(id => newSelected.delete(id));
    } else {
      // Select all photos from this date
      datePhotoIds.forEach(id => newSelected.add(id));
    }
    setSelectedPhotoIds(newSelected);
  };

  const isDateFullySelected = (datePhotos: Photo[]) => {
    return datePhotos.every(photo => selectedPhotoIds.has(photo.id));
  };

  const isDatePartiallySelected = (datePhotos: Photo[]) => {
    const selectedCount = datePhotos.filter(photo => selectedPhotoIds.has(photo.id)).length;
    return selectedCount > 0 && selectedCount < datePhotos.length;
  };

  const handleShareSelected = async () => {
    if (selectedPhotoIds.size === 0) {
      toast({
        title: 'No photos selected',
        description: 'Please select at least one photo to share',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      // Create share via API (currently shares entire project, not just selected photos)
      const response = await fetch(`/api/projects/${projectId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to create share link');
      }

      const share = await response.json();
      const shareUrl = `${window.location.origin}/share/${share.token}`;

      // Try to copy to clipboard
      try {
        await nativeClipboard.write(shareUrl);
        toast({
          title: 'Share link created!',
          description: 'Link copied to clipboard. All project photos are now shared.',
        });
      } catch (clipboardError) {
        console.log('Clipboard write failed, will show dialog instead');
        toast({
          title: 'Share link created',
          description: 'Use the Copy button to copy the link',
        });
      }

      // Show the link in a dialog
      setShareLink(shareUrl);

      // Exit select mode
      setIsSelectMode(false);
      setSelectedPhotoIds(new Set());
    } catch (error) {
      console.error('Share error:', error);
      toast({
        title: 'Failed to create share link',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedPhotoIds.size === 0) {
      toast({
        title: 'No photos selected',
        description: 'Please select at least one photo to delete',
        variant: 'destructive',
      });
      return;
    }

    // Confirm deletion
    if (!window.confirm(`Are you sure you want to delete ${selectedPhotoIds.size} photo${selectedPhotoIds.size === 1 ? '' : 's'}?`)) {
      return;
    }

    try {
      // Delete each selected photo
      for (const photoId of Array.from(selectedPhotoIds)) {
        await deleteMutation.mutateAsync(photoId);
      }

      toast({
        title: 'Photos deleted',
        description: `${selectedPhotoIds.size} photo${selectedPhotoIds.size === 1 ? '' : 's'} deleted successfully`,
      });

      // Exit select mode
      setIsSelectMode(false);
      setSelectedPhotoIds(new Set());
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: 'Failed to delete photos',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleExportToPDF = async () => {
    try {
      // Dynamically import jsPDF
      const { jsPDF } = await import('jspdf');
      
      // Get selected photos
      const selectedPhotos = photos.filter(photo => selectedPhotoIds.has(photo.id));
      
      if (selectedPhotos.length === 0) {
        toast({
          title: 'No photos selected',
          description: 'Please select at least one photo to export',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Generating PDF...',
        description: 'This may take a moment',
      });

      // Create new PDF document
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - 2 * margin;

      // Map font family from settings to jsPDF font names
      const fontFamilyMap: Record<string, string> = {
        'Arial': 'helvetica',
        'Helvetica': 'helvetica',
        'Times': 'times',
        'Courier': 'courier',
      };
      const fontFamily = company?.pdfFontFamily ? fontFamilyMap[company.pdfFontFamily] || 'helvetica' : 'helvetica';

      // Function to add header to each page
      const addHeader = async (isFirstPage: boolean) => {
        let yPos = margin;

        // Add company logo if available
        if (company?.pdfLogoUrl && isFirstPage) {
          try {
            const logoResponse = await fetch(company.pdfLogoUrl);
            const logoBlob = await logoResponse.blob();
            const logoDataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(logoBlob);
            });
            
            // Add logo (max 40mm wide, proportional height)
            const logoImg = new Image();
            await new Promise<void>((resolve, reject) => {
              logoImg.onload = () => resolve();
              logoImg.onerror = reject;
              logoImg.src = logoDataUrl;
            });
            const logoMaxWidth = 40;
            const logoAspect = logoImg.width / logoImg.height;
            const logoWidth = Math.min(logoMaxWidth, logoImg.width / 5); // Rough mm conversion
            const logoHeight = logoWidth / logoAspect;
            doc.addImage(logoDataUrl, 'PNG', margin, yPos, logoWidth, logoHeight);
            yPos += logoHeight + 5;
          } catch (error) {
            console.error('Failed to load logo:', error);
          }
        }

        // Add company name and contact info
        if (company?.pdfCompanyName) {
          doc.setFontSize(company.pdfFontSizeHeader || 16);
          doc.setFont(fontFamily, 'bold');
          doc.text(company.pdfCompanyName, margin, yPos);
          yPos += 6;
        }

        if (company?.pdfCompanyAddress) {
          doc.setFontSize(company.pdfFontSizeBody || 12);
          doc.setFont(fontFamily, 'normal');
          doc.text(company.pdfCompanyAddress, margin, yPos);
          yPos += 5;
        }

        if (company?.pdfCompanyPhone) {
          doc.setFontSize(company.pdfFontSizeBody || 12);
          doc.text(company.pdfCompanyPhone, margin, yPos);
          yPos += 5;
        }

        // Add custom header text if provided
        if (company?.pdfHeaderText) {
          doc.setFontSize(company.pdfFontSizeBody || 12);
          doc.setFont(fontFamily, 'italic');
          const headerLines = doc.splitTextToSize(company.pdfHeaderText, contentWidth);
          doc.text(headerLines, margin, yPos);
          yPos += headerLines.length * 5;
        }

        // Add project info if enabled
        if (exportOptions.includeProjectHeader && project) {
          yPos += 5;
          doc.setFontSize(company?.pdfFontSizeTitle || 24);
          doc.setFont(fontFamily, 'bold');
          doc.text(project.name, margin, yPos);
          yPos += 8;
          
          if (project.address) {
            doc.setFontSize(company?.pdfFontSizeBody || 12);
            doc.setFont(fontFamily, 'normal');
            doc.text(project.address, margin, yPos);
            yPos += 6;
          }
          
          doc.setFontSize(company?.pdfFontSizeBody || 12);
          doc.text(`Exported: ${format(new Date(), 'MMMM d, yyyy h:mm a')}`, margin, yPos);
          yPos += 10;
        }
        
        doc.setLineWidth(0.5);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 10;

        return yPos;
      };

      // Function to add footer to each page
      const addFooter = () => {
        const footerY = pageHeight - margin + 5;
        
        if (company?.pdfFooterText) {
          doc.setFontSize(company.pdfFontSizeCaption || 10);
          doc.setFont(fontFamily, 'italic');
          const footerLines = doc.splitTextToSize(company.pdfFooterText, contentWidth);
          doc.text(footerLines, margin, footerY);
        }

        // Add signature line if enabled
        if (company?.pdfIncludeSignatureLine) {
          const signatureY = pageHeight - margin - 10;
          doc.setLineWidth(0.3);
          doc.line(margin, signatureY, margin + 80, signatureY);
          doc.setFontSize(company.pdfFontSizeCaption || 10);
          doc.setFont(fontFamily, 'normal');
          doc.text('Signature:', margin, signatureY - 2);
          doc.text('Date:', margin + 90, signatureY - 2);
          doc.line(margin + 105, signatureY, margin + 150, signatureY);
        }
      };

      let successCount = 0;
      let failureCount = 0;
      
      // Calculate grid layout based on photos per page
      const photosPerPage = exportOptions.photosPerPage;
      const gridLayouts: Record<1 | 2 | 3 | 4, { cols: number; rows: number }> = {
        1: { cols: 1, rows: 1 },
        2: { cols: 2, rows: 1 },
        3: { cols: 2, rows: 2 }, // 2 top, 1 bottom (will use 3 of 4 slots)
        4: { cols: 2, rows: 2 },
      };
      
      const layout = gridLayouts[photosPerPage];
      const cellWidth = (contentWidth - (layout.cols - 1) * 10) / layout.cols; // 10mm gap between columns
      const detailHeight = 30; // Space reserved for photo details
      
      // Process photos in batches based on photosPerPage
      for (let pageStart = 0; pageStart < selectedPhotos.length; pageStart += photosPerPage) {
        const pagePhotos = selectedPhotos.slice(pageStart, pageStart + photosPerPage);
        
        // Add new page if not the first
        if (pageStart > 0) {
          doc.addPage();
        }
        
        // Add header to this page
        const isFirstPage = pageStart === 0;
        const startY = await addHeader(isFirstPage);
        
        let currentY = startY;
        
        // Track heights for each row to handle variable aspect ratios
        const rowHeights: number[] = [];
        
        // Process each photo in the grid
        for (let i = 0; i < pagePhotos.length; i++) {
          const photo = pagePhotos[i];
          const row = Math.floor(i / layout.cols);
          const col = i % layout.cols;
          
          try {
            const response = await fetch(photo.url);
            const blob = await response.blob();
            
            // Skip non-image files
            if (!blob.type.startsWith('image/')) {
              console.log(`Skipping non-image file: ${photo.id}`);
              failureCount++;
              continue;
            }
            
            // Load image to get its native aspect ratio
            const img = new Image();
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                const url = reader.result as string;
                img.onload = () => resolve(url);
                img.onerror = reject;
                img.src = url;
              };
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
            
            // Calculate cell height based on photo's native aspect ratio
            const aspectRatio = img.width / img.height;
            const cellHeight = cellWidth / aspectRatio;
            
            // Track the maximum height in this row for proper spacing
            if (!rowHeights[row]) {
              rowHeights[row] = 0;
            }
            rowHeights[row] = Math.max(rowHeights[row], cellHeight);
            
            // Calculate Y position based on accumulated row heights
            let y = currentY;
            for (let r = 0; r < row; r++) {
              y += rowHeights[r] + detailHeight + 15; // 15mm gap between rows
            }
            
            // Calculate position in grid
            const x = margin + col * (cellWidth + 10);
            
            // Determine format
            let imageFormat: 'JPEG' | 'PNG' | 'WEBP' = 'JPEG';
            if (blob.type === 'image/png') imageFormat = 'PNG';
            else if (blob.type === 'image/webp') imageFormat = 'WEBP';
            
            // Add image at its native aspect ratio
            doc.addImage(dataUrl, imageFormat, x, y, cellWidth, cellHeight);
            
            // Add details below photo
            let detailY = y + cellHeight + 5;
            const captionFontSize = company?.pdfFontSizeCaption || 10;
            doc.setFontSize(captionFontSize);
            
            const photoName = photo.caption || `Photo_${format(new Date(photo.createdAt), 'yyyy-MM-dd_HHmmss')}`;
            
            if (exportOptions.includeName) {
              doc.setFont(fontFamily, 'bold');
              const nameText = doc.splitTextToSize(photoName, cellWidth);
              doc.text(nameText, x, detailY);
              detailY += nameText.length * (captionFontSize * 0.4);
            }
            
            if (exportOptions.includeDate || exportOptions.includeTimestamp) {
              doc.setFont(fontFamily, 'normal');
              const dateTimeText = `${format(new Date(photo.createdAt), 'MMM d, yyyy')}${exportOptions.includeTimestamp ? ` ${format(new Date(photo.createdAt), 'h:mm a')}` : ''}`;
              doc.text(dateTimeText, x, detailY);
              detailY += (captionFontSize * 0.4);
            }
            
            if (project && exportOptions.includeProjectHeader) {
              doc.setFont(fontFamily, 'italic');
              doc.text(`Project: ${project.name}`, x, detailY);
              detailY += (captionFontSize * 0.4);
            }
            
            if (exportOptions.includeTags && photo.tags && photo.tags.length > 0) {
              doc.setFont(fontFamily, 'italic');
              const tagText = photo.tags.map(t => t.name).join(', ');
              const tagLines = doc.splitTextToSize(tagText, cellWidth);
              doc.text(tagLines, x, detailY);
            }
            
            successCount++;
          } catch (error) {
            console.error(`Failed to add photo ${photo.id}:`, error);
            failureCount++;
          }
        }
        
        // Add footer after all photos on this page are rendered
        addFooter();
      }

      // Only save PDF if at least one photo was successfully added
      if (successCount > 0) {
        const fileName = project 
          ? `${project.name.replace(/[^a-z0-9]/gi, '_')}_photos_${format(new Date(), 'yyyy-MM-dd')}.pdf`
          : `photos_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
        
        // Get PDF as blob for uploading to Object Storage
        const pdfBlob = doc.output('blob');
        
        // Download to user's device
        doc.save(fileName);

        // Upload to Object Storage and create DB record
        try {
          const formData = new FormData();
          formData.append('pdf', pdfBlob, fileName);
          formData.append('photoCount', successCount.toString());
          formData.append('gridLayout', exportOptions.photosPerPage.toString());
          formData.append('settings', JSON.stringify({
            includeProjectHeader: exportOptions.includeProjectHeader,
            includeName: exportOptions.includeName,
            includeDate: exportOptions.includeDate,
            includeTimestamp: exportOptions.includeTimestamp,
            includeTags: exportOptions.includeTags,
            includeComments: exportOptions.includeComments,
          }));
          
          const uploadRes = await fetch(`/api/projects/${projectId}/pdfs`, {
            method: 'POST',
            credentials: 'include',
            body: formData,
          });
          
          if (uploadRes.ok) {
            // Invalidate PDFs query to show the new PDF in the PDFs tab
            queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "pdfs"] });
          }
        } catch (uploadError) {
          console.error('Failed to upload PDF to storage:', uploadError);
          // Don't show error to user since local download still worked
        }

        if (failureCount > 0) {
          toast({
            title: 'PDF exported with warnings',
            description: `${successCount} photo${successCount === 1 ? '' : 's'} exported successfully, ${failureCount} failed`,
            variant: 'default',
          });
        } else {
          toast({
            title: 'PDF exported successfully',
            description: `${successCount} photo${successCount === 1 ? '' : 's'} exported`,
          });
        }
      } else {
        toast({
          title: 'PDF export failed',
          description: 'No photos could be added to the PDF',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('PDF export error:', error);
      toast({
        title: 'Failed to export PDF',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      // Always exit select mode and clear selection, even if export fails
      setIsSelectMode(false);
      setSelectedPhotoIds(new Set());
    }
  };

  // Helper function to change grid size with smooth transitions
  const changeGridSize = (newColumnCount: number) => {
    if ('startViewTransition' in document) {
      (document as any).startViewTransition(() => {
        setColumnCount(newColumnCount);
      });
    } else {
      setColumnCount(newColumnCount);
    }
  };

  // Get grid style based on column count
  const getGridStyle = (): React.CSSProperties => {
    return {
      display: 'grid',
      gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
      gap: '2px', // Minimal gap like Apple Photos
    };
  };

  const handleSaveAnnotations = async (annotations: any[], annotatedBlob: Blob) => {
    if (!selectedPhoto || !projectId) return;

    try {
      // Check if photo exists in IndexedDB
      let existingPhoto = await idb.getPhoto(selectedPhoto.id);
      
      // If photo not in IndexedDB (e.g., it's a server-synced photo), create it first
      if (!existingPhoto) {
        // Fetch the original photo blob from server
        const response = await fetch(selectedPhoto.url);
        if (!response.ok) {
          throw new Error('Failed to fetch photo from server');
        }
        const originalBlob = await response.blob();
        
        // Create photo entry in IndexedDB with correct ID using helper method
        existingPhoto = await idb.savePhotoWithId(selectedPhoto.id, {
          projectId: projectId,
          blob: originalBlob,
          caption: selectedPhoto.caption ?? undefined,
          quality: 'standard',
          timestamp: Date.now(),
          syncStatus: 'synced',
          retryCount: 0,
          annotations: null,
          serverId: selectedPhoto.id,
          mediaType: (selectedPhoto.mediaType === 'video' ? 'video' : 'photo') as 'photo' | 'video',
        });
      }

      // Update the photo with annotated version
      await idb.updatePhoto(selectedPhoto.id, {
        blob: annotatedBlob,
        annotations: annotations.length > 0 ? JSON.stringify(annotations) : null,
      });

      // Add to sync queue to upload the annotated photo to server
      await idb.addToSyncQueue({
        type: 'photo',
        localId: selectedPhoto.id,
        projectId: projectId,
        action: 'update',
        data: { 
          blob: annotatedBlob,
          annotations: annotations.length > 0 ? JSON.stringify(annotations) : null,
        },
        retryCount: 0,
      });

      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'photos'] });
      
      toast({ 
        title: '✓ Saved',
        description: annotations.length > 0 
          ? `Annotations saved and will sync when online`
          : 'Photo saved',
        duration: 1500,
      });
      
      setSelectedPhoto(null);
    } catch (error: any) {
      console.error('[ProjectPhotos] Error saving annotations:', error);
      toast({ 
        title: "Failed to save annotations", 
        variant: "destructive", 
        description: error.message || 'Unknown error'
      });
    }
  };

  return (
    <>
      <div className="h-screen flex flex-col overflow-auto pb-20">
        <header className="border-b p-4 bg-background sticky top-0 z-10">
        <div className="flex items-center justify-between gap-2">
          {/* Tag Filter Dropdown on left */}
          {availableTags.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant={selectedTagIds.size > 0 ? "default" : "outline"} 
                  size="sm" 
                  data-testid="button-tag-filter"
                >
                  <TagIcon className="w-4 h-4 mr-1.5" />
                  {selectedTagIds.size > 0 
                    ? availableTags.find(t => selectedTagIds.has(t.id))?.name || "Tags"
                    : "Tags"
                  }
                  <ChevronDown className="w-3 h-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuLabel>Filter by Tag</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => setSelectedTagIds(new Set())}
                  data-testid="filter-all-photos"
                >
                  <div className={`w-2 h-2 rounded-full mr-2 ${selectedTagIds.size === 0 ? 'bg-primary' : 'bg-transparent border border-border'}`} />
                  All Photos
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {availableTags.map((tag) => (
                  <DropdownMenuItem 
                    key={tag.id}
                    onClick={() => {
                      const newSelected = new Set<string>();
                      newSelected.add(tag.id);
                      setSelectedTagIds(newSelected);
                    }}
                    data-testid={`filter-tag-${tag.id}`}
                  >
                    <div 
                      className={`w-2 h-2 rounded-full mr-2`}
                      style={{ backgroundColor: selectedTagIds.has(tag.id) ? 'hsl(var(--primary))' : tag.color }}
                    />
                    {tag.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          
          <div className="flex-1 text-center">
            <h1 className="text-lg sm:text-xl font-bold">{project?.name || "Project Photos"}</h1>
            {project?.description && (
              <p className="text-xs sm:text-sm text-muted-foreground">{project.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {project && (
              <Button
                variant={project.completed ? "outline" : "default"}
                size="sm"
                onClick={() => {
                  apiRequest("PATCH", `/api/projects/${projectId}`, { completed: !project.completed })
                    .then(() => {
                      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
                      queryClient.invalidateQueries({ queryKey: ["/api/projects/with-counts"] });
                      toast({
                        title: project.completed ? "Job Reopened" : "Job Completed",
                        description: project.completed ? "This job is now active again" : "This job is marked as complete",
                      });
                    })
                    .catch((error) => {
                      toast({
                        title: "Error",
                        description: "Failed to update job status",
                        variant: "destructive",
                      });
                    });
                }}
                className="flex-shrink-0"
                data-testid="button-toggle-complete"
              >
                {project.completed ? "Reopen" : "Complete"}
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="border-b px-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('photos')}
              className={`py-3 px-1 border-b-2 transition-colors ${
                activeTab === 'photos'
                  ? 'border-primary text-primary font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              data-testid="tab-photos"
            >
              Photos ({photos.length})
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              className={`py-3 px-1 border-b-2 transition-colors ${
                activeTab === 'tasks'
                  ? 'border-primary text-primary font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              data-testid="tab-tasks"
            >
              Tasks ({projectTasks.length})
            </button>
            <button
              onClick={() => setActiveTab('pdfs')}
              className={`py-3 px-1 border-b-2 transition-colors ${
                activeTab === 'pdfs'
                  ? 'border-primary text-primary font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              data-testid="tab-pdfs"
            >
              PDFs ({pdfs.length})
            </button>
          </div>
          {activeTab === 'photos' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" data-testid="button-grid-size">
                  <Grid3x3 className="w-4 h-4 mr-2" />
                  Grid Size
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => changeGridSize(10)}
                  data-testid="menu-grid-small"
                >
                  Small (10 columns)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => changeGridSize(5)}
                  data-testid="menu-grid-medium"
                >
                  Medium (5 columns)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => changeGridSize(3)}
                  data-testid="menu-grid-large"
                >
                  Large (3 columns)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <main className="flex-1 p-4 overflow-y-auto">
        {activeTab === 'tasks' ? (
          // Tasks View with filters matching main To-Do page
          <div className="max-w-screen-sm mx-auto space-y-4">
            {/* View Switcher */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {[
                { value: 'my-tasks' as const, label: 'My Tasks' },
                { value: 'team-tasks' as const, label: 'Team Tasks' },
                { value: 'i-created' as const, label: 'I Created' },
              ].map((view) => (
                <button
                  key={view.value}
                  onClick={() => setTaskView(view.value)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                    taskView === view.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover-elevate'
                  }`}
                  data-testid={`button-task-view-${view.value}`}
                >
                  {view.label}
                </button>
              ))}
            </div>

            {/* Completed Filter */}
            <div className="flex gap-2">
              {[
                { value: 'active' as const, label: 'Active' },
                { value: 'completed' as const, label: 'Completed' },
                { value: 'all' as const, label: 'All' },
              ].map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setTaskFilterCompleted(filter.value)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    taskFilterCompleted === filter.value
                      ? 'bg-primary/10 text-primary border border-primary'
                      : 'bg-muted text-muted-foreground hover-elevate'
                  }`}
                  data-testid={`button-filter-${filter.value}`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {/* Task List */}
            {isLoadingTasks ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : projectTasks.length === 0 ? (
              <div className="text-center py-12">
                <CheckSquare className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h2 className="text-xl font-semibold mb-2">No tasks</h2>
                <p className="text-muted-foreground">
                  {taskView === 'my-tasks' ? 'You have no assigned tasks for this project' :
                   taskView === 'team-tasks' ? 'No team tasks for this project' :
                   'You haven\'t created any tasks for this project'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {projectTasks.map((todo) => {
                  const getDisplayName = (person: { firstName: string | null; lastName: string | null }) => {
                    if (person.firstName && person.lastName) {
                      return `${person.firstName} ${person.lastName}`;
                    } else if (person.firstName) {
                      return person.firstName;
                    } else if (person.lastName) {
                      return person.lastName;
                    }
                    return 'Unknown';
                  };

                  return (
                    <Card
                      key={todo.id}
                      className={`hover-elevate cursor-pointer ${todo.completed ? 'opacity-60' : ''} ${todo.photo ? 'px-2 py-2' : 'px-3 py-1'}`}
                      data-testid={`card-todo-${todo.id}`}
                    >
                      <div className="flex items-center gap-2">
                        {/* Completion checkbox */}
                        <Checkbox
                          checked={todo.completed}
                          onCheckedChange={(checked) => {
                            if (!checked && todo.completed) {
                              // Uncompleting - would need an API endpoint for this
                              toast({ title: "Cannot uncomplete tasks", variant: "destructive" });
                            } else if (checked && !todo.completed) {
                              completeTaskMutation.mutate(todo.id);
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-shrink-0"
                          data-testid={`checkbox-todo-complete-${todo.id}`}
                        />

                        {/* Photo thumbnail if available */}
                        {todo.photo && (
                          <div
                            className="flex-shrink-0 w-[60px] h-[60px] rounded-md overflow-hidden bg-muted"
                            data-testid={`img-todo-photo-${todo.id}`}
                          >
                            <img
                              src={todo.photo.url}
                              alt="Task photo"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <h3
                            className={`font-medium text-sm leading-snug ${todo.completed ? 'line-through' : ''}`}
                            data-testid={`text-todo-title-${todo.id}`}
                          >
                            {todo.title}
                          </h3>
                        </div>

                        {/* Three-dot menu */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-12 w-12 flex-shrink-0"
                              onClick={(e) => e.stopPropagation()}
                              data-testid={`button-menu-todo-${todo.id}`}
                            >
                              <MoreVertical className="w-5 h-5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {!todo.completed && (
                              <DropdownMenuItem
                                onClick={() => completeTaskMutation.mutate(todo.id)}
                                disabled={completeTaskMutation.isPending}
                                data-testid={`menu-complete-todo-${todo.id}`}
                              >
                                Mark Complete
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => deleteTaskMutation.mutate(todo.id)}
                              disabled={deleteTaskMutation.isPending}
                              className="text-destructive"
                              data-testid={`menu-delete-todo-${todo.id}`}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        ) : activeTab === 'pdfs' ? (
          // PDFs View
          <div className="max-w-screen-lg mx-auto space-y-4">
            {pdfs.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h2 className="text-xl font-semibold mb-2">No PDFs generated yet</h2>
                <p className="text-muted-foreground">Export photos to PDF using the Photos tab</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pdfs.map((pdf: any) => (
                  <Card key={pdf.id} className="p-4 hover-elevate" data-testid={`pdf-item-${pdf.id}`}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center">
                        <FileText className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate" data-testid={`pdf-filename-${pdf.id}`}>{pdf.filename}</h3>
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                          <span>{pdf.photoCount} photos</span>
                          <span>•</span>
                          <span>{format(new Date(pdf.createdAt), 'MMM d, yyyy')}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(pdf.storageUrl, '_blank')}
                          data-testid={`button-download-pdf-${pdf.id}`}
                        >
                          Download
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deletePdfMutation.mutate(pdf.id)}
                          disabled={deletePdfMutation.isPending}
                          data-testid={`button-delete-pdf-${pdf.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : isLoading ? (
          <div className="text-center py-12">Loading photos...</div>
        ) : photos.length === 0 ? (
          <div className="text-center py-12">
            <Camera className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">No photos yet</h2>
            <p className="text-muted-foreground">Tap the camera or upload button below to get started</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Empty state when filter yields no results */}
            {selectedTagIds.size > 0 && photosByDate.length === 0 && (
              <div className="text-center py-12">
                <TagIcon className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h2 className="text-xl font-semibold mb-2">No photos match this filter</h2>
                <p className="text-muted-foreground mb-4">Try selecting different tags or clear the filter</p>
                <Button
                  onClick={() => setSelectedTagIds(new Set())}
                  variant="outline"
                  size="sm"
                  data-testid="button-clear-empty-filter"
                >
                  Clear Filter
                </Button>
              </div>
            )}
            
            <div id="photo-grid" className="space-y-8">
            {photosByDate.map(({ date, photos: datePhotos }) => (
              <div key={date} data-testid={`date-group-${date}`}>
                {/* Date Header with Checkbox */}
                <div className="flex items-center gap-3 mb-4">
                  {isSelectMode && (
                    <Checkbox
                      checked={isDateFullySelected(datePhotos)}
                      onCheckedChange={() => toggleDateSelection(datePhotos)}
                      data-testid={`checkbox-date-${date}`}
                      className="w-5 h-5"
                    />
                  )}
                  <h2 className="text-lg font-semibold text-foreground">
                    {date}
                  </h2>
                </div>
                
                {/* Photos Grid */}
                <div className="photo-grid-container" style={getGridStyle()}>
                  {datePhotos.map((photo) => {
                    const photoIndex = filteredPhotos.findIndex(p => p.id === photo.id);
                    const isSelected = selectedPhotoIds.has(photo.id);
                    return (
                      <div
                        key={photo.id}
                        ref={(el) => {
                          if (el) {
                            el.style.setProperty('view-transition-name', `photo-${photo.id}`);
                          }
                        }}
                        className={`photo-grid-item relative aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer hover-elevate active-elevate-2 animate-scale-in touch-feedback ${
                          isSelectMode && isSelected ? 'ring-4 ring-primary' : ''
                        }`}
                        onClick={() => {
                          if (isSelectMode) {
                            togglePhotoSelection(photo.id);
                          } else {
                            setViewerPhotoIndex(photoIndex);
                          }
                        }}
                        data-testid={`photo-${photo.id}`}
                      >
                        {isSelectMode && (
                          <div className="absolute top-2 left-2 z-10">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => togglePhotoSelection(photo.id)}
                              data-testid={`checkbox-photo-${photo.id}`}
                              className="w-6 h-6 bg-white/90 backdrop-blur-sm border-2"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        )}
                        
                        {/* Tag indicators on left side */}
                        {photo.tags && photo.tags.length > 0 && (
                          <div 
                            className="absolute top-0 left-0 bottom-0 flex flex-col gap-0.5 p-1 z-10"
                            data-testid={`tag-indicators-${photo.id}`}
                          >
                            {photo.tags.slice(0, 2).map((tag, idx) => (
                              <div
                                key={tag.id}
                                className="w-1 flex-1 rounded-full"
                                style={{ backgroundColor: tag.color }}
                                title={tag.name}
                                data-testid={`tag-bar-${photo.id}-${idx}`}
                              />
                            ))}
                          </div>
                        )}
                        
                        {/* +N badge if more than 2 tags */}
                        {photo.tags && photo.tags.length > 2 && (
                          <div 
                            className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm text-white text-[10px] font-medium px-1.5 py-0.5 rounded-full z-10"
                            data-testid={`tag-overflow-badge-${photo.id}`}
                          >
                            +{photo.tags.length - 2}
                          </div>
                        )}
                        
                        {/* Sync status badge - bottom right corner */}
                        {(photo as any).syncStatus && (photo as any).syncStatus !== 'synced' && (
                          <div 
                            className={`absolute bottom-2 right-2 flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full backdrop-blur-sm z-10 ${
                              (photo as any).syncStatus === 'pending' 
                                ? 'bg-orange-500/80 text-white' 
                                : (photo as any).syncStatus === 'syncing'
                                ? 'bg-blue-500/80 text-white'
                                : 'bg-red-500/80 text-white' // error
                            }`}
                            data-testid={`sync-status-${photo.id}`}
                          >
                            {(photo as any).syncStatus === 'pending' && (
                              <>
                                <Upload className="w-3 h-3" />
                                <span>Pending</span>
                              </>
                            )}
                            {(photo as any).syncStatus === 'syncing' && (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>Uploading</span>
                              </>
                            )}
                            {(photo as any).syncStatus === 'error' && (
                              <>
                                <AlertCircle className="w-3 h-3" />
                                <span>Failed</span>
                              </>
                            )}
                          </div>
                        )}
                        
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
          </div>
        )}
      </main>
      </div>

      {/* Photo size selector moved to header area to avoid overlap with buttons */}

      {/* Portal fixed buttons to body - evenly spaced bottom bar */}
      {createPortal(
        <div 
          className="z-40 flex items-center justify-between px-4 max-w-screen-sm mx-auto"
          style={{ position: 'fixed', bottom: '16px', left: '0', right: '0' }}
        >
          {/* Back Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/")}
            data-testid="button-back"
            className="w-16 h-16 rounded-full bg-background/80 backdrop-blur-md border border-border shadow-lg hover:bg-background"
          >
            <ArrowLeft className="w-7 h-7" />
          </Button>

          {/* Camera Button */}
          <Button
            onClick={() => setLocation(`/camera?projectId=${projectId}`)}
            data-testid="button-add-photo-fab"
            className="w-16 h-16 rounded-full bg-primary text-primary-foreground shadow-2xl hover:bg-primary/90"
          >
            <Camera className="w-7 h-7" />
          </Button>

          {/* Upload Button */}
          <button
            onClick={() => document.getElementById('photo-upload-input')?.click()}
            disabled={uploadMutation.isPending}
            className="flex items-center justify-center w-16 h-16 bg-primary rounded-full shadow-lg hover-elevate active-elevate-2 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="button-upload-photo"
            aria-label="Upload from library"
          >
            <Images className="w-7 h-7 text-primary-foreground" />
          </button>
          
          {/* Select/Cancel Button */}
          <Button
            onClick={toggleSelectMode}
            disabled={photos.length === 0}
            data-testid={isSelectMode ? "button-cancel-select" : "button-select-mode"}
            variant="ghost"
            size="icon"
            className="w-16 h-16 rounded-full bg-background/80 backdrop-blur-md border border-border shadow-lg hover:bg-background disabled:opacity-50"
          >
            {isSelectMode ? <X className="w-7 h-7" /> : <CheckSquare className="w-7 h-7" />}
          </Button>
        </div>,
        document.body
      )}

      {/* Selection Toolbar */}
      {isSelectMode && (
        <div className="fixed bottom-20 left-0 right-0 z-30 bg-card/95 backdrop-blur-md border-t border-border p-4 safe-area-inset-bottom animate-in slide-in-from-bottom">
          <div className="max-w-screen-sm mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-sm font-medium flex-shrink-0">
              {selectedPhotoIds.size} photo{selectedPhotoIds.size === 1 ? '' : 's'} selected
            </span>
            <div className="flex flex-wrap gap-2 justify-center sm:justify-end">
              <Button
                variant="outline"
                onClick={() => setShowBatchTagDialog(true)}
                disabled={selectedPhotoIds.size === 0}
                data-testid="button-tag-selected"
              >
                <TagIcon className="w-4 h-4 mr-2" />
                Tag
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowMoveDialog(true)}
                disabled={selectedPhotoIds.size === 0}
                data-testid="button-move-selected"
              >
                <FolderInput className="w-4 h-4 mr-2" />
                Move
              </Button>
              <Button
                variant="outline"
                onClick={handleDeleteSelected}
                disabled={selectedPhotoIds.size === 0}
                data-testid="button-delete-selected"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
              <Button
                onClick={handleShareSelected}
                disabled={selectedPhotoIds.size === 0}
                data-testid="button-share-selected"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
              <Button
                variant="default"
                onClick={() => setShowExportDialog(true)}
                disabled={selectedPhotoIds.size === 0}
                data-testid="button-export-pdf"
              >
                <FileText className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Gesture-enabled Photo Viewer */}
      {viewerPhotoIndex !== null && (
        <PhotoGestureViewer
          photos={filteredPhotos}
          initialIndex={viewerPhotoIndex}
          onClose={() => setViewerPhotoIndex(null)}
          onDelete={(photoId) => deleteMutation.mutate(photoId)}
          onAnnotate={(photo) => {
            const fullPhoto = filteredPhotos.find(p => p.id === photo.id);
            if (fullPhoto) {
              setViewerPhotoIndex(null);
              setSelectedPhoto(fullPhoto);
            }
          }}
          onTag={(photo) => {
            setViewerPhotoIndex(null);
            setTagPickerPhotoId(photo.id);
          }}
          onShare={() => {
            // Share is handled by PhotoGestureViewer's native share
          }}
          onSetCoverPhoto={(photoId) => setCoverPhotoMutation.mutate(photoId)}
        />
      )}

      {/* Annotation Editor Dialog (can be accessed via long-press in future) */}
      {selectedPhoto && (
        <Dialog open={true} onOpenChange={() => setSelectedPhoto(null)}>
          <DialogContent className="max-w-full md:max-w-5xl h-screen max-h-screen md:h-auto md:max-h-[90vh] p-0 sm:rounded-none md:sm:rounded-lg gap-0">
            <DialogHeader className="sr-only">
              <DialogTitle>Photo Annotation Editor</DialogTitle>
              <DialogDescription>
                Draw, annotate, and markup this photo with arrows, text, lines, and freehand drawing
              </DialogDescription>
            </DialogHeader>
            <PhotoAnnotationEditor
              photoUrl={selectedPhoto.url}
              photoId={selectedPhoto.id}
              existingAnnotations={annotations}
              onSave={handleSaveAnnotations}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project?</AlertDialogTitle>
            <AlertDialogDescription>
              "{project?.name}" and all its photos will be moved to trash for 30 days before permanent deletion.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                deleteProjectMutation.mutate();
                setShowDeleteConfirm(false);
              }}
              data-testid="button-confirm-delete"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Share Link Dialog */}
      <Dialog open={!!shareLink} onOpenChange={() => setShareLink(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share Link Created</DialogTitle>
            <DialogDescription>
              Copy this link to share your photos with others. The link will expire in 30 days.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-x-2">
            <div className="grid flex-1 gap-2">
              <Input
                id="share-link"
                value={shareLink || ''}
                readOnly
                className="font-mono text-sm"
                data-testid="input-share-link"
              />
            </div>
            <Button
              type="button"
              size="sm"
              className="px-3"
              onClick={async () => {
                if (shareLink) {
                  try {
                    await nativeClipboard.write(shareLink);
                    haptics.light();
                    toast({
                      title: 'Copied!',
                      description: 'Share link copied to clipboard',
                    });
                  } catch (error) {
                    haptics.error();
                    toast({
                      title: 'Copy failed',
                      description: 'Please copy the link manually',
                      variant: 'destructive',
                    });
                  }
                }
              }}
              data-testid="button-copy-link"
            >
              Copy
            </Button>
          </div>
          <DialogFooter className="sm:justify-start">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShareLink(null)}
              data-testid="button-close-share-dialog"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move to Project Dialog */}
      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Move Photos to Project</DialogTitle>
            <DialogDescription>
              Select a project to move {selectedPhotoIds.size} photo{selectedPhotoIds.size === 1 ? '' : 's'} to.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="target-project">Target Project</Label>
              <Select
                value={targetProjectId}
                onValueChange={setTargetProjectId}
              >
                <SelectTrigger id="target-project" data-testid="select-target-project">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {allProjects
                    .filter(p => p.id !== projectId)
                    .map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowMoveDialog(false);
                setTargetProjectId("");
              }}
              data-testid="button-cancel-move"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (targetProjectId) {
                  movePhotosMutation.mutate({
                    photoIds: Array.from(selectedPhotoIds),
                    targetProjectId,
                  });
                }
              }}
              disabled={!targetProjectId || movePhotosMutation.isPending}
              data-testid="button-confirm-move"
            >
              {movePhotosMutation.isPending ? "Moving..." : "Move Photos"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Tag Dialog */}
      <Dialog open={showBatchTagDialog} onOpenChange={setShowBatchTagDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Apply Tags to Photos</DialogTitle>
            <DialogDescription>
              Select tags to apply to {selectedPhotoIds.size} photo{selectedPhotoIds.size === 1 ? '' : 's'}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4 max-h-[400px] overflow-y-auto">
            {availableTags.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No tags available
              </p>
            ) : (
              availableTags.map((tag) => {
                const tagColorMap: Record<string, string> = {
                  red: "bg-red-500",
                  yellow: "bg-yellow-500",
                  blue: "bg-primary",
                  orange: "bg-orange-500",
                  gray: "bg-gray-500",
                };
                const colorClass = tagColorMap[tag.color] || "bg-gray-500";

                return (
                  <button
                    key={tag.id}
                    onClick={() => {
                      batchTagMutation.mutate({
                        photoIds: Array.from(selectedPhotoIds),
                        tagId: tag.id,
                      });
                    }}
                    disabled={batchTagMutation.isPending}
                    className="w-full flex items-center justify-between p-3 rounded-lg border transition-colors hover-elevate active-elevate-2 bg-card border-border"
                    data-testid={`button-batch-tag-${tag.name.toLowerCase()}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full ${colorClass}`} />
                      <span className="font-medium">{tag.name}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => {
                setShowBatchTagDialog(false);
              }}
              data-testid="button-close-batch-tag"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export to PDF Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Export to PDF</DialogTitle>
            <DialogDescription>
              Export {selectedPhotoIds.size} photo{selectedPhotoIds.size === 1 ? '' : 's'} to PDF with customizable layout and details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Photos per page selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Photos per page</label>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((count) => (
                  <button
                    key={count}
                    onClick={() => setExportOptions(prev => ({ ...prev, photosPerPage: count as 1 | 2 | 3 | 4 }))}
                    className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-colors ${
                      exportOptions.photosPerPage === count
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                    data-testid={`button-photos-per-page-${count}`}
                  >
                    <span className="text-2xl font-bold">{count}</span>
                    <span className="text-xs text-muted-foreground mt-1">
                      {count === 1 ? 'Large' : count === 2 ? 'Medium' : count === 3 ? 'Compact' : 'Grid'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="border-t pt-4">
              <label className="text-sm font-medium mb-3 block">Include details</label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="export-project-header"
                checked={exportOptions.includeProjectHeader}
                onCheckedChange={(checked) => 
                  setExportOptions(prev => ({ ...prev, includeProjectHeader: !!checked }))
                }
                data-testid="checkbox-export-project-header"
              />
              <label
                htmlFor="export-project-header"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Project header
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="export-name"
                checked={exportOptions.includeName}
                onCheckedChange={(checked) => 
                  setExportOptions(prev => ({ ...prev, includeName: !!checked }))
                }
                data-testid="checkbox-export-name"
              />
              <label
                htmlFor="export-name"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Photo name
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="export-date"
                checked={exportOptions.includeDate}
                onCheckedChange={(checked) => 
                  setExportOptions(prev => ({ ...prev, includeDate: !!checked }))
                }
                data-testid="checkbox-export-date"
              />
              <label
                htmlFor="export-date"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Date
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="export-timestamp"
                checked={exportOptions.includeTimestamp}
                onCheckedChange={(checked) => 
                  setExportOptions(prev => ({ ...prev, includeTimestamp: !!checked }))
                }
                data-testid="checkbox-export-timestamp"
              />
              <label
                htmlFor="export-timestamp"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Timestamp
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="export-comments"
                checked={exportOptions.includeComments}
                onCheckedChange={(checked) => 
                  setExportOptions(prev => ({ ...prev, includeComments: !!checked }))
                }
                data-testid="checkbox-export-comments"
              />
              <label
                htmlFor="export-comments"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Comments
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="export-tags"
                checked={exportOptions.includeTags}
                onCheckedChange={(checked) => 
                  setExportOptions(prev => ({ ...prev, includeTags: !!checked }))
                }
                data-testid="checkbox-export-tags"
              />
              <label
                htmlFor="export-tags"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Tags
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setShowExportDialog(false)}
              data-testid="button-cancel-export"
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                await handleExportToPDF();
                setShowExportDialog(false);
              }}
              data-testid="button-confirm-export"
            >
              Generate PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tag Picker */}
      {tagPickerPhotoId && projectId && (
        <TagPicker
          photoId={tagPickerPhotoId}
          projectId={projectId}
          onClose={() => setTagPickerPhotoId(null)}
        />
      )}

      {/* Hidden file input for photo upload from camera roll */}
      <input
        type="file"
        id="photo-upload-input"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
        data-testid="input-photo-upload"
      />
    </>
  );
}
