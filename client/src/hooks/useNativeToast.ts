import { useToast } from "@/hooks/use-toast";
import { nativeToast, type ShadcnToastOptions } from "@/lib/nativeToast";

/**
 * Unified toast hook that shows native iOS toasts on mobile
 * and shadcn toasts on web
 */
export function useNativeToast() {
  const { toast: shadcnToast } = useToast();

  const toast = (options: ShadcnToastOptions) => {
    // Show native toast on iOS
    if (nativeToast.isSupported()) {
      nativeToast.show(options);
    } else {
      // Fall back to shadcn toast on web
      shadcnToast(options);
    }
  };

  return { toast };
}
