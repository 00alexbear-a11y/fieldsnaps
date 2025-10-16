import { useQuery } from "@tanstack/react-query";
import { User } from "@shared/schema";

export function useSubscriptionAccess() {
  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  // Check if user can perform write operations (create/upload/edit)
  const canWrite = (() => {
    if (!user) return false;
    
    const status = user.subscriptionStatus;
    
    // Active subscription or admin
    if (status === 'active' || status === 'admin') return true;
    
    // Trial with valid end date
    if (status === 'trial') {
      if (!user.trialEndDate) return true; // Trial not started yet
      const now = new Date();
      const trialEnd = new Date(user.trialEndDate);
      return now < trialEnd; // Trial still active
    }
    
    // Past due has 2-week grace period from when payment failed
    if (status === 'past_due') {
      if (!user.pastDueSince) {
        // If pastDueSince not set yet, allow writes (backend will set it on payment failure)
        console.warn('[SubscriptionAccess] past_due status without pastDueSince, allowing writes');
        return true;
      }
      const now = new Date();
      const graceEnd = new Date(user.pastDueSince);
      graceEnd.setDate(graceEnd.getDate() + 14); // 2 weeks grace from payment failure
      return now < graceEnd;
    }
    
    // All other cases: read-only
    return false;
  })();

  const subscriptionStatus = user?.subscriptionStatus || 'trial';
  const isTrialExpired = user?.subscriptionStatus === 'trial' && user?.trialEndDate && new Date() >= new Date(user.trialEndDate);
  const isPastDue = user?.subscriptionStatus === 'past_due';
  const isCanceled = user?.subscriptionStatus === 'canceled';

  return {
    canWrite,
    subscriptionStatus,
    isTrialExpired,
    isPastDue,
    isCanceled,
    user,
  };
}
