import { useAuthContext } from "@/contexts/AuthContext";

export function useSubscriptionAccess() {
  const { user } = useAuthContext();

  const canWrite = (() => {
    if (!user) return false;
    
    const status = user.subscriptionStatus;
    
    if (status === 'active' || status === 'admin') return true;
    
    if (status === 'trial') {
      if (!user.trialEndDate) return true;
      const now = new Date();
      const trialEnd = new Date(user.trialEndDate);
      return now < trialEnd;
    }
    
    if (status === 'past_due') {
      if (!user.pastDueSince) {
        console.warn('[SubscriptionAccess] past_due status without pastDueSince, allowing writes');
        return true;
      }
      const now = new Date();
      const graceEnd = new Date(user.pastDueSince);
      graceEnd.setDate(graceEnd.getDate() + 14);
      return now < graceEnd;
    }
    
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
