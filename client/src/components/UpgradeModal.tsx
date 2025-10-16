import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  reason?: 'trial_expired' | 'past_due' | 'canceled';
}

export function UpgradeModal({ open, onClose, reason = 'trial_expired' }: UpgradeModalProps) {
  const { toast } = useToast();

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/billing/create-checkout-session');
      return await res.json();
    },
    onSuccess: (data: { url: string }) => {
      window.location.href = data.url;
    },
    onError: (error: any) => {
      toast({
        title: 'Checkout failed',
        description: error.message || 'Unable to start checkout process',
        variant: 'destructive',
      });
    },
  });

  const handleUpgrade = () => {
    checkoutMutation.mutate();
  };

  const messages = {
    trial_expired: {
      title: "Your trial has ended",
      description: "Thanks for trying FieldSnaps! To continue capturing and organizing your project photos, please upgrade to a paid plan. Remember, 20% of your subscription supports missionaries worldwide.",
    },
    past_due: {
      title: "Payment update needed",
      description: "We couldn't process your payment. Please update your payment method to continue using FieldSnaps. Your work is important to us!",
    },
    canceled: {
      title: "Subscription canceled",
      description: "Your subscription has been canceled. You can still view your existing projects and photos. To create new content, please reactivate your subscription.",
    },
  };

  const message = messages[reason];

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Heart className="h-6 w-6 text-primary" />
          </div>
          <AlertDialogTitle className="text-center">{message.title}</AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            {message.description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-col gap-2">
          <Button 
            onClick={handleUpgrade} 
            className="w-full"
            disabled={checkoutMutation.isPending}
            data-testid="button-upgrade"
          >
            {checkoutMutation.isPending ? 'Loading...' : 'View Subscription Options'}
          </Button>
          <Button 
            onClick={onClose} 
            variant="ghost" 
            className="w-full"
            data-testid="button-close-upgrade-modal"
          >
            Not Now
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
