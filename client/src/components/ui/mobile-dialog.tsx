import { useId } from "react";
import { useKeyboardManager, useAutoScrollInput } from "@/hooks/useKeyboardManager";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MobileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  showCancel?: boolean;
  onCancel?: () => void;
  className?: string;
  contentClassName?: string;
}

/**
 * Mobile-optimized dialog component with iOS keyboard handling
 * 
 * Features:
 * - Top-aligned positioning (Apple-style) instead of centered
 * - Scrollable body that adjusts for keyboard
 * - Sticky footer section for action buttons
 * - Auto-scrolls focused inputs into view
 * - Handles iOS safe areas
 * - Dynamic max-height based on visualViewport
 */
export function MobileDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  showCancel = false,
  onCancel,
  className,
  contentClassName,
}: MobileDialogProps) {
  // Only track keyboard when dialog is actually open to avoid multiple listeners
  const { keyboardHeight, visualViewportHeight } = useKeyboardManager(open);
  // Only auto-scroll inputs when dialog is actually open
  useAutoScrollInput(open);

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      onOpenChange(false);
    }
  };

  // Calculate max height with safe area consideration:
  // - Use visual viewport height (accounts for keyboard)
  // - Account for safe area insets (iOS notch, etc)
  // - Ensure dialog fits with padding
  const maxHeight = visualViewportHeight > 0 
    ? `min(${visualViewportHeight - 40}px, calc(100vh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 40px))` 
    : 'calc(100vh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 40px)';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          // Top-aligned with safe area consideration
          "top-[max(20px,env(safe-area-inset-top))] translate-y-0",
          "sm:top-[max(20px,env(safe-area-inset-top))] sm:translate-y-0",
          // Mobile-first: full width with padding, desktop: max-w-lg
          "w-[calc(100vw-32px)] sm:max-w-lg",
          // Enable vertical layout with flex
          "flex flex-col",
          // Remove default gap, we'll control spacing internally
          "gap-0 p-0",
          className
        )}
        style={{
          maxHeight,
        }}
      >
        {/* Header - not scrollable */}
        <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {/* Scrollable content area */}
        <div 
          className={cn(
            "flex-1 overflow-y-auto px-6",
            // iOS smooth scrolling
            "[-webkit-overflow-scrolling:touch]",
            // Add bottom padding when keyboard is open to ensure content is accessible
            keyboardHeight > 150 ? "pb-6" : "pb-4",
            contentClassName
          )}
        >
          {children}
        </div>

        {/* Footer - sticky at bottom */}
        {(footer || showCancel) && (
          <div className="flex-shrink-0 px-6 pb-6 pt-4 border-t bg-background">
            {footer || (
              showCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  className="w-full"
                  data-testid="button-cancel-dialog"
                >
                  Cancel
                </Button>
              )
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface MobileDialogFormProps extends Omit<MobileDialogProps, 'children' | 'footer'> {
  onSubmit: (e: React.FormEvent) => void;
  children: React.ReactNode;
  submitLabel?: string;
  submitDisabled?: boolean;
  submitTestId?: string;
  showCancel?: boolean;
}

/**
 * Convenience wrapper for form dialogs
 * Handles form submission and provides standard submit/cancel buttons
 */
export function MobileDialogForm({
  onSubmit,
  children,
  submitLabel = "Submit",
  submitDisabled = false,
  submitTestId = "button-submit",
  showCancel = true,
  onCancel,
  ...dialogProps
}: MobileDialogFormProps) {
  // Generate unique form ID to avoid collisions when multiple dialogs exist
  const formId = useId();
  
  return (
    <MobileDialog
      {...dialogProps}
      footer={
        <div className="flex gap-3">
          {showCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel || (() => dialogProps.onOpenChange(false))}
              className="flex-1"
              data-testid="button-cancel"
            >
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            disabled={submitDisabled}
            className="flex-1"
            data-testid={submitTestId}
            form={formId}
          >
            {submitLabel}
          </Button>
        </div>
      }
    >
      <form id={formId} onSubmit={onSubmit} className="space-y-4">
        {children}
      </form>
    </MobileDialog>
  );
}
