import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, Camera, Settings as SettingsIcon, Check, Trash2, Share2, FolderInput, Tag as TagIcon, Images, X, CheckSquare, ChevronDown, ListTodo, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { queryClient, apiRequest } from "@/lib/queryClient";
import { indexedDB as idb } from "@/lib/indexeddb";
import { PhotoAnnotationEditor } from "@/components/PhotoAnnotationEditor";
import { PhotoGestureViewer } from "@/components/PhotoGestureViewer";
import TagPicker from "@/components/TagPicker";
import LazyImage from "@/components/LazyImage";
import type { Photo as BasePhoto, Project, Tag } from "../../../shared/schema";
import { format } from "date-fns";

// Extend Photo to include tags
type Photo = BasePhoto & { tags?: Tag[] };

export default function ProjectPhotos() {
  const { id: projectId } = useParams();
  const [, setLocation] = useLocation();
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
  const [photoSize, setPhotoSize] = useState<'S' | 'M' | 'L'>('M');
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [taskName, setTaskName] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [activeTab, setActiveTab] = useState<'photos' | 'tasks'>('photos');
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportOptions, setExportOptions] = useState({
    includeName: true,
    includeDate: true,
    includeTimestamp: true,
    includeComments: true,
    includeTags: true,
    includeProjectHeader: true,
  });
  const { toast } = useToast();

  const { data: project } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
  });

  const { data: allProjects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: showMoveDialog,
  });

  const { data: photos = [], isLoading } = useQuery<Photo[]>({
    queryKey: ["/api/projects", projectId, "photos"],
  });

  // Fetch available tags for filtering
  const { data: availableTags = [] } = useQuery<Tag[]>({
    queryKey: ["/api/tags"],
  });

  // Fetch team members for task assignment
  const { data: teamMembers = [] } = useQuery<any[]>({
    queryKey: ["/api/companies/members"],
    enabled: showTaskDialog || activeTab === 'tasks',
  });

  // Fetch all tasks for this project
  const { data: projectTasks = [], isLoading: isLoadingTasks } = useQuery<any[]>({
    queryKey: ["/api/projects", projectId, "tasks"],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/tasks`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch tasks");
      }
      return response.json();
    },
  });

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
    mutationFn: async (file: File) => {
      // Upload photo using multipart/form-data
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('caption', file.name);
      
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

  const movePhotosMutation = useMutation({
    mutationFn: async ({ photoIds, targetProjectId }: { photoIds: string[]; targetProjectId: string }) => {
      // Move each photo to the target project
      await Promise.all(
        photoIds.map(photoId => 
          apiRequest("PATCH", `/api/photos/${photoId}`, { projectId: targetProjectId })
        )
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

  const createTaskMutation = useMutation({
    mutationFn: async (taskData: { taskName: string; assignedTo: string; projectId: string }) => {
      return await apiRequest("POST", "/api/tasks", taskData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "tasks"] });
      toast({ 
        title: "Task created successfully",
        duration: 1500,
      });
      setShowTaskDialog(false);
      setTaskName("");
      setTaskAssignee("");
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to create task", 
        description: error.message,
        variant: "destructive" 
      });
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Upload the file
    uploadMutation.mutate(file);
    
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
      // Create share via API
      const response = await fetch('/api/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          projectId,
          photoIds: Array.from(selectedPhotoIds),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create share link');
      }

      const share = await response.json();
      const shareUrl = `${window.location.origin}/share/${share.token}`;

      // Try to copy to clipboard (may fail in some browsers)
      let copiedToClipboard = false;
      try {
        await navigator.clipboard.writeText(shareUrl);
        copiedToClipboard = true;
        toast({
          title: 'Share link created!',
          description: `Link copied to clipboard. ${selectedPhotoIds.size} photo${selectedPhotoIds.size === 1 ? '' : 's'} shared.`,
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

      // Add project header if enabled
      if (exportOptions.includeProjectHeader && project) {
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text(project.name, margin, margin);
        
        let yPos = margin + 8;
        
        if (project.address) {
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          doc.text(project.address, margin, yPos);
          yPos += 6;
        }
        
        doc.setFontSize(10);
        doc.text(`Exported: ${format(new Date(), 'MMMM d, yyyy h:mm a')}`, margin, yPos);
        yPos += 10;
        
        doc.setLineWidth(0.5);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 10;
      }

      let currentY = exportOptions.includeProjectHeader && project ? margin + 40 : margin;
      let successCount = 0;
      let failureCount = 0;
      let needsNewPage = false;

      // Process each photo
      for (let i = 0; i < selectedPhotos.length; i++) {
        const photo = selectedPhotos[i];

        // Fetch photo as blob
        try {
          const response = await fetch(photo.url);
          const blob = await response.blob();
          
          // Skip non-image files (e.g., videos)
          if (!blob.type.startsWith('image/')) {
            console.log(`Skipping non-image file: ${photo.id}, type: ${blob.type}`);
            failureCount++;
            continue;
          }
          
          // Convert blob to data URL
          const reader = new FileReader();
          const dataUrl = await new Promise<string>((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          // Calculate image dimensions to fit within page
          const img = new Image();
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = dataUrl;
          });

          const imgAspectRatio = img.width / img.height;
          let imgWidth = contentWidth;
          let imgHeight = imgWidth / imgAspectRatio;
          
          // If image is too tall, scale it down
          const maxImgHeight = pageHeight - currentY - margin - 60; // Reserve space for details
          if (imgHeight > maxImgHeight) {
            imgHeight = maxImgHeight;
            imgWidth = imgHeight * imgAspectRatio;
          }

          // Determine image format from blob type
          let imageFormat: 'JPEG' | 'PNG' | 'WEBP' = 'JPEG';
          if (blob.type === 'image/png') {
            imageFormat = 'PNG';
          } else if (blob.type === 'image/webp') {
            imageFormat = 'WEBP';
          }
          
          // Test that addImage will work by trying it in a try block
          // If this succeeds, we know we can safely add a page
          try {
            // Add new page if we successfully added a photo previously
            if (needsNewPage) {
              doc.addPage();
              currentY = margin;
            }
            
            // Add image with correct format
            doc.addImage(dataUrl, imageFormat, margin, currentY, imgWidth, imgHeight);
            currentY += imgHeight + 10;
          } catch (addImageError) {
            // If addImage failed, we may have added a blank page
            // Since jsPDF doesn't support page removal, track this as a failure
            console.error(`Failed to add image to PDF for photo ${photo.id}:`, addImageError);
            throw addImageError; // Re-throw to be caught by outer catch
          }

          // Add photo details
          doc.setFontSize(10);
          
          // Generate photo name from createdAt if not available
          const photoName = `Photo_${format(new Date(photo.createdAt), 'yyyy-MM-dd_HHmmss')}`;
          
          if (exportOptions.includeName) {
            doc.setFont('helvetica', 'bold');
            doc.text(`Name: `, margin, currentY);
            doc.setFont('helvetica', 'normal');
            doc.text(photoName, margin + 15, currentY);
            currentY += 6;
          }

          if (exportOptions.includeDate) {
            doc.setFont('helvetica', 'bold');
            doc.text(`Date: `, margin, currentY);
            doc.setFont('helvetica', 'normal');
            doc.text(format(new Date(photo.createdAt), 'MMMM d, yyyy'), margin + 15, currentY);
            currentY += 6;
          }

          if (exportOptions.includeTimestamp) {
            doc.setFont('helvetica', 'bold');
            doc.text(`Time: `, margin, currentY);
            doc.setFont('helvetica', 'normal');
            doc.text(format(new Date(photo.createdAt), 'h:mm a'), margin + 15, currentY);
            currentY += 6;
          }

          if (exportOptions.includeTags && photo.tags && photo.tags.length > 0) {
            doc.setFont('helvetica', 'bold');
            doc.text(`Tags: `, margin, currentY);
            doc.setFont('helvetica', 'normal');
            const tagNames = photo.tags.map(t => t.name).join(', ');
            doc.text(tagNames, margin + 15, currentY);
            currentY += 6;
          }

          if (exportOptions.includeComments && photo.caption) {
            doc.setFont('helvetica', 'bold');
            doc.text(`Comment:`, margin, currentY);
            currentY += 6;
            doc.setFont('helvetica', 'normal');
            
            // Word wrap comment text
            const lines = doc.splitTextToSize(photo.caption, contentWidth);
            doc.text(lines, margin, currentY);
            currentY += lines.length * 5;
          }
          
          successCount++;
          needsNewPage = true; // Next successful photo will need a new page
        } catch (error) {
          console.error(`Failed to add photo ${photo.id} to PDF:`, error);
          failureCount++;
          // Continue with next photo
        }
      }

      // Only save PDF if at least one photo was successfully added
      if (successCount > 0) {
        const fileName = project 
          ? `${project.name.replace(/[^a-z0-9]/gi, '_')}_photos_${format(new Date(), 'yyyy-MM-dd')}.pdf`
          : `photos_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
        
        doc.save(fileName);

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

  // Get grid classes based on photo size
  const getGridClasses = () => {
    switch (photoSize) {
      case 'S':
        return 'grid-cols-3 md:grid-cols-4 lg:grid-cols-6';
      case 'M':
        return 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
      case 'L':
        return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
      default:
        return 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
    }
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTaskDialog(true)}
              className="flex-shrink-0"
              data-testid="button-add-task"
            >
              <ListTodo className="w-4 h-4" />
            </Button>
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
          </div>
          
          {/* Photo size selector - only show on Photos tab */}
          {activeTab === 'photos' && (
            <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted" data-testid="photo-size-selector">
              {(['S', 'M', 'L'] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => setPhotoSize(size)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    photoSize === size
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover-elevate'
                  }`}
                  data-testid={`button-size-${size}`}
                >
                  {size}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <main className="flex-1 p-4">
        {activeTab === 'tasks' ? (
          // Tasks View
          <div className="space-y-4">
            {isLoadingTasks ? (
              <div className="text-center py-12">Loading tasks...</div>
            ) : projectTasks.length === 0 ? (
              <div className="text-center py-12">
                <ListTodo className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h2 className="text-xl font-semibold mb-2">No tasks yet</h2>
                <p className="text-muted-foreground mb-4">Create tasks to organize work for this project</p>
                <Button
                  onClick={() => setShowTaskDialog(true)}
                  data-testid="button-create-first-task"
                >
                  Create Task
                </Button>
              </div>
            ) : (
              <>
                {/* Active Tasks */}
                {projectTasks.filter(t => !t.completed).length > 0 && (
                  <section>
                    <h2 className="text-lg font-semibold mb-3">
                      Active Tasks ({projectTasks.filter(t => !t.completed).length})
                    </h2>
                    <div className="space-y-2">
                      {projectTasks.filter(t => !t.completed).map((task: any) => {
                        const assignee = teamMembers.find(m => m.id === task.assignedTo);
                        return (
                          <div
                            key={task.id}
                            className="bg-card border rounded-lg p-4 hover-elevate"
                            data-testid={`project-task-${task.id}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <h3 className="font-medium" data-testid={`task-name-${task.id}`}>
                                  {task.taskName}
                                </h3>
                                <div className="mt-1 flex items-center gap-2">
                                  {assignee && (
                                    <Badge variant="outline" className="text-xs">
                                      {assignee.name}
                                    </Badge>
                                  )}
                                  <span className="text-xs text-muted-foreground">
                                    {format(new Date(task.createdAt), 'MMM d, yyyy')}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* Completed Tasks */}
                {projectTasks.filter(t => t.completed).length > 0 && (
                  <section>
                    <h2 className="text-lg font-semibold mb-3">
                      Completed ({projectTasks.filter(t => t.completed).length})
                    </h2>
                    <div className="space-y-2">
                      {projectTasks.filter(t => t.completed).map((task: any) => {
                        const assignee = teamMembers.find(m => m.id === task.assignedTo);
                        return (
                          <div
                            key={task.id}
                            className="bg-card border rounded-lg p-4 opacity-60"
                            data-testid={`project-task-completed-${task.id}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <h3 className="font-medium line-through" data-testid={`task-name-completed-${task.id}`}>
                                  {task.taskName}
                                </h3>
                                <div className="mt-1 flex items-center gap-2">
                                  {assignee && (
                                    <Badge variant="outline" className="text-xs">
                                      {assignee.name}
                                    </Badge>
                                  )}
                                  <span className="text-xs text-muted-foreground">
                                    Completed {format(new Date(task.completedAt!), 'MMM d, yyyy')}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}
              </>
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
            
            <div className="space-y-8">
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
                <div className={`grid ${getGridClasses()} gap-4`}>
                  {datePhotos.map((photo) => {
                    const photoIndex = filteredPhotos.findIndex(p => p.id === photo.id);
                    const isSelected = selectedPhotoIds.has(photo.id);
                    return (
                      <div
                        key={photo.id}
                        className={`relative aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer hover-elevate active-elevate-2 animate-scale-in touch-feedback ${
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
                        
                        <LazyImage
                          src={photo.url}
                          alt={photo.caption || "Photo"}
                          className="w-full h-full object-cover"
                        />
                        {photo.photographerName && !isSelectMode && (
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
          </div>
        )}
      </main>
      </div>

      {/* Photo size selector moved to header area to avoid overlap with buttons */}

      {/* Portal fixed buttons to body - evenly spaced bottom bar */}
      {createPortal(
        <div 
          className="z-40 flex items-center justify-between px-4 max-w-screen-sm mx-auto"
          style={{ position: 'fixed', bottom: '96px', left: '0', right: '0' }}
        >
          {/* Back Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/")}
            data-testid="button-back"
            className="w-14 h-14 rounded-full bg-background/80 backdrop-blur-md border border-border shadow-lg hover:bg-background"
          >
            <ArrowLeft className="w-6 h-6" />
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
            className="flex items-center justify-center w-14 h-14 bg-primary rounded-full shadow-lg hover-elevate active-elevate-2 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="button-upload-photo"
            aria-label="Upload from library"
          >
            <Images className="w-6 h-6 text-primary-foreground" />
          </button>
          
          {/* Select/Cancel Button */}
          <Button
            onClick={toggleSelectMode}
            disabled={photos.length === 0}
            data-testid={isSelectMode ? "button-cancel-select" : "button-select-mode"}
            variant="ghost"
            size="icon"
            className="w-14 h-14 rounded-full bg-background/80 backdrop-blur-md border border-border shadow-lg hover:bg-background disabled:opacity-50"
          >
            {isSelectMode ? <X className="w-6 h-6" /> : <CheckSquare className="w-6 h-6" />}
          </Button>
        </div>,
        document.body
      )}

      {/* Selection Toolbar */}
      {isSelectMode && (
        <div className="fixed bottom-32 left-0 right-0 z-30 bg-card/95 backdrop-blur-md border-t border-border p-4 safe-area-inset-bottom animate-in slide-in-from-bottom">
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
          onShare={(photo) => {
            if (navigator.clipboard && window.isSecureContext) {
              toast({ title: "Photo URL copied to clipboard" });
            } else if (!navigator.share) {
              toast({ 
                title: "Sharing not available",
                description: "Please use a secure connection (HTTPS) to share photos",
                variant: "destructive"
              });
            }
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
                    await navigator.clipboard.writeText(shareLink);
                    toast({
                      title: 'Copied!',
                      description: 'Share link copied to clipboard',
                    });
                  } catch (error) {
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

      {/* Task Creation Dialog */}
      <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Task</DialogTitle>
            <DialogDescription>
              Assign a task to a team member for this project.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="task-name">Task Name</Label>
              <Input
                id="task-name"
                placeholder="e.g., Document foundation work"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                data-testid="input-task-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-assignee">Assign To</Label>
              <Select value={taskAssignee} onValueChange={setTaskAssignee}>
                <SelectTrigger id="task-assignee" data-testid="select-task-assignee">
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers.map((member: any) => (
                    <SelectItem key={member.id} value={member.id} data-testid={`option-assignee-${member.id}`}>
                      {member.firstName && member.lastName 
                        ? `${member.firstName} ${member.lastName}` 
                        : member.email}
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
                setShowTaskDialog(false);
                setTaskName("");
                setTaskAssignee("");
              }}
              data-testid="button-cancel-task"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (taskName.trim() && taskAssignee && projectId) {
                  createTaskMutation.mutate({
                    taskName: taskName.trim(),
                    assignedTo: taskAssignee,
                    projectId,
                  });
                }
              }}
              disabled={!taskName.trim() || !taskAssignee || createTaskMutation.isPending}
              data-testid="button-create-task"
            >
              {createTaskMutation.isPending ? "Creating..." : "Create Task"}
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
                  blue: "bg-blue-500",
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
              Select the details to include in the PDF export of {selectedPhotoIds.size} photo{selectedPhotoIds.size === 1 ? '' : 's'}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
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
