import { useState, useRef } from "react";
import { Camera, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Capacitor } from "@capacitor/core";
import { Camera as CapacitorCamera } from "@capacitor/camera";

interface ProfilePhotoUploadProps {
  currentPhotoUrl?: string | null;
  userInitials?: string;
  onUploadComplete?: (newPhotoUrl: string) => void;
}

export function ProfilePhotoUpload({ 
  currentPhotoUrl, 
  userInitials = "?",
  onUploadComplete 
}: ProfilePhotoUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const isNative = Capacitor.isNativePlatform();

  const handleCameraClick = async () => {
    if (isNative) {
      try {
        const image = await CapacitorCamera.getPhoto({
          quality: 90,
          allowEditing: true,
          resultType: 'DataUrl',
          source: 'camera',
        });

        if (image.dataUrl) {
          setPreviewUrl(image.dataUrl);
          await uploadPhoto(image.dataUrl);
        }
      } catch (error) {
        console.error("Camera error:", error);
        toast({
          title: "Camera Error",
          description: "Failed to open camera",
          variant: "destructive",
        });
      }
    } else {
      // Web: use file input with camera
      if (fileInputRef.current) {
        fileInputRef.current.setAttribute('capture', 'environment');
        fileInputRef.current.click();
      }
    }
  };

  const handleFileClick = async () => {
    if (isNative) {
      try {
        const image = await CapacitorCamera.getPhoto({
          quality: 90,
          allowEditing: true,
          resultType: 'DataUrl',
          source: 'photos',
        });

        if (image.dataUrl) {
          setPreviewUrl(image.dataUrl);
          await uploadPhoto(image.dataUrl);
        }
      } catch (error) {
        console.error("Photo picker error:", error);
        toast({
          title: "Photo Picker Error",
          description: "Failed to select photo",
          variant: "destructive",
        });
      }
    } else {
      // Web: use file input
      if (fileInputRef.current) {
        fileInputRef.current.removeAttribute('capture');
        fileInputRef.current.click();
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please select an image smaller than 10MB",
        variant: "destructive",
      });
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      setPreviewUrl(dataUrl);
      uploadPhotoFile(file);
    };
    reader.readAsDataURL(file);
  };

  const uploadPhotoFile = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);

      const res = await apiRequest('POST', '/api/user/profile-photo', formData);
      const response = await res.json();

      toast({
        title: "Success",
        description: "Profile photo uploaded successfully",
      });

      // Invalidate all user-related caches to ensure avatar updates everywhere
      queryClient.invalidateQueries({ queryKey: ['auth', 'currentUser'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });

      if (onUploadComplete && response.profileImageUrl) {
        onUploadComplete(response.profileImageUrl);
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload profile photo",
        variant: "destructive",
      });
      setPreviewUrl(null);
    } finally {
      setIsUploading(false);
    }
  };

  const uploadPhoto = async (dataUrl: string) => {
    setIsUploading(true);
    try {
      // Convert data URL to Blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], 'profile-photo.jpg', { type: 'image/jpeg' });

      const formData = new FormData();
      formData.append('photo', file);

      const res = await apiRequest('POST', '/api/user/profile-photo', formData);
      const uploadResponse = await res.json();

      toast({
        title: "Success",
        description: "Profile photo uploaded successfully",
      });

      // Invalidate all user-related caches to ensure avatar updates everywhere
      queryClient.invalidateQueries({ queryKey: ['auth', 'currentUser'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });

      if (onUploadComplete && uploadResponse.profileImageUrl) {
        onUploadComplete(uploadResponse.profileImageUrl);
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload profile photo",
        variant: "destructive",
      });
      setPreviewUrl(null);
    } finally {
      setIsUploading(false);
    }
  };

  const clearPreview = () => {
    setPreviewUrl(null);
  };

  const displayUrl = previewUrl || currentPhotoUrl;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <Avatar className="h-24 w-24">
          {displayUrl ? (
            <AvatarImage src={displayUrl} alt="Profile" />
          ) : (
            <AvatarFallback className="text-2xl">{userInitials}</AvatarFallback>
          )}
        </Avatar>
        {previewUrl && !isUploading && (
          <button
            onClick={clearPreview}
            className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 hover-elevate active-elevate-2"
            data-testid="button-clear-preview"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
        data-testid="input-file-photo"
      />

      <div className="flex gap-2">
        <Button
          onClick={handleCameraClick}
          disabled={isUploading}
          size="sm"
          variant="outline"
          data-testid="button-camera"
        >
          <Camera className="h-4 w-4 mr-2" />
          {isNative ? "Take Photo" : "Camera"}
        </Button>
        <Button
          onClick={handleFileClick}
          disabled={isUploading}
          size="sm"
          variant="outline"
          data-testid="button-choose-file"
        >
          <Upload className="h-4 w-4 mr-2" />
          Choose File
        </Button>
      </div>

      {isUploading && (
        <p className="text-sm text-muted-foreground">Uploading...</p>
      )}
    </div>
  );
}
