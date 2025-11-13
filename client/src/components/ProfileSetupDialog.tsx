import { useState, useEffect } from "react";
import { MobileDialog } from "@/components/ui/mobile-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProfilePhotoUpload } from "./ProfilePhotoUpload";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User } from "@shared/schema";

interface ProfileSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  isFirstTime?: boolean;
  onComplete?: () => void; // Called only on successful save or explicit skip
}

export function ProfileSetupDialog({ open, onOpenChange, user, isFirstTime = false, onComplete }: ProfileSetupDialogProps) {
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const { toast } = useToast();

  // Reset state to user prop when dialog opens or user changes
  useEffect(() => {
    if (open) {
      setFirstName(user?.firstName || "");
      setLastName(user?.lastName || "");
    }
  }, [open, user?.firstName, user?.lastName]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { firstName?: string; lastName?: string }) => {
      const res = await apiRequest('PATCH', '/api/user/profile', data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      toast({
        title: "Profile Updated",
        description: "Your profile has been saved successfully",
      });
      onOpenChange(false);
      // Mark as complete (sets localStorage flag in App.tsx)
      onComplete?.();
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter your first and last name",
        variant: "destructive",
      });
      return;
    }

    updateProfileMutation.mutate({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
    });
  };

  const handleSkip = () => {
    onOpenChange(false);
    // Mark as complete (sets localStorage flag in App.tsx)
    onComplete?.();
    if (isFirstTime) {
      toast({
        title: "Profile Setup Skipped",
        description: "You can complete your profile anytime in Settings",
        duration: 4000,
      });
    }
  };

  const userInitials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user?.email?.[0]?.toUpperCase() || "?";

  return (
    <MobileDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isFirstTime ? "Complete Your Profile" : "Edit Profile"}
      description={isFirstTime ? "Add a photo and your name to personalize your account" : undefined}
      dismissible={!isFirstTime} // Non-dismissible during first-time setup
      footer={
        <div className="flex gap-2 w-full">
          {isFirstTime ? (
            <Button
              variant="ghost"
              onClick={handleSkip}
              data-testid="button-skip-profile"
              className="flex-1"
            >
              Skip for Now
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel-profile"
              className="flex-1"
            >
              Cancel
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={updateProfileMutation.isPending}
            data-testid="button-save-profile"
            className="flex-1"
          >
            {updateProfileMutation.isPending ? "Saving..." : "Save Profile"}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <ProfilePhotoUpload
          currentPhotoUrl={user?.profileImageUrl}
          userInitials={userInitials}
          onUploadComplete={(url) => {
            console.log("Profile photo uploaded:", url);
          }}
        />

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">First Name</Label>
            <Input
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Enter your first name"
              data-testid="input-first-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lastName">Last Name</Label>
            <Input
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Enter your last name"
              data-testid="input-last-name"
            />
          </div>
        </div>
      </div>
    </MobileDialog>
  );
}
