import { AlertCircle, CreditCard, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export function PaymentNotification() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dismissed, setDismissed] = useState(false);

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/billing/create-portal-session');
      return await res.json();
    },
    onSuccess: (data: { url: string }) => {
      window.location.href = data.url;
    },
    onError: (error: any) => {
      toast({
        title: 'Unable to open billing portal',
        description: error.message || 'Please try again later',
        variant: 'destructive',
      });
    },
  });

  // Don't show if user is not past_due or if dismissed
  if (!user || user.subscriptionStatus !== 'past_due' || dismissed) {
    return null;
  }

  // Calculate days remaining in grace period
  const gracePeriodDays = 14;
  let daysRemaining = gracePeriodDays;
  
  if (user.pastDueSince) {
    const pastDueDate = new Date(user.pastDueSince);
    const now = new Date();
    const daysPassed = Math.floor((now.getTime() - pastDueDate.getTime()) / (1000 * 60 * 60 * 24));
    daysRemaining = Math.max(0, gracePeriodDays - daysPassed);
  }

  const handleUpdatePayment = () => {
    portalMutation.mutate();
  };

  return (
    <div 
      className="bg-orange-50 dark:bg-orange-950/30 border-b border-orange-200 dark:border-orange-800"
      style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      data-testid="notification-payment-issue"
    >
      <div className="max-w-screen-xl mx-auto px-4 pb-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400 shrink-0" data-testid="icon-alert" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-orange-900 dark:text-orange-100">
                Payment Update Needed
              </p>
              <p className="text-xs text-orange-700 dark:text-orange-300 mt-0.5">
                We couldn't process your payment. Please update your payment method to continue using FieldSnaps.
                {daysRemaining > 0 && (
                  <span className="ml-1">
                    You have {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} of access remaining.
                  </span>
                )}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="default"
              onClick={handleUpdatePayment}
              disabled={portalMutation.isPending}
              className="bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600"
              data-testid="button-update-payment"
            >
              <CreditCard className="w-4 h-4 mr-1.5" />
              {portalMutation.isPending ? 'Loading...' : 'Update Payment'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDismissed(true)}
              className="text-orange-700 dark:text-orange-300 hover:text-orange-900 dark:hover:text-orange-100"
              data-testid="button-dismiss-notification"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
