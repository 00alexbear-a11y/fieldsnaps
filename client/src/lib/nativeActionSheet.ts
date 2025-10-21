import { ActionSheet, ActionSheetButtonStyle } from '@capacitor/action-sheet';
import { Capacitor } from '@capacitor/core';

export interface ActionSheetButton {
  title: string;
  style?: 'default' | 'cancel' | 'destructive';
  handler?: () => void | Promise<void>;
}

export interface ActionSheetOptions {
  title?: string;
  message?: string;
  buttons: ActionSheetButton[];
}

/**
 * Native iOS action sheet with fallback for web
 * On iOS: Shows native bottom sheet
 * On web: Returns options for manual handling (use DropdownMenu)
 */
class NativeActionSheet {
  /**
   * Show native action sheet on iOS, return options for web fallback
   */
  async show(options: ActionSheetOptions): Promise<{ index: number } | null> {
    if (!Capacitor.isNativePlatform()) {
      // On web, we can't show native action sheet
      // Return null to indicate web should use DropdownMenu
      return null;
    }

    try {
      const result = await ActionSheet.showActions({
        title: options.title,
        message: options.message,
        options: options.buttons.map(button => ({
          title: button.title,
          style: button.style === 'destructive' 
            ? ActionSheetButtonStyle.Destructive 
            : button.style === 'cancel'
            ? ActionSheetButtonStyle.Cancel
            : ActionSheetButtonStyle.Default,
        })),
      });

      // Execute the handler for the selected button
      const selectedButton = options.buttons[result.index];
      if (selectedButton?.handler) {
        await selectedButton.handler();
      }

      return { index: result.index };
    } catch (error) {
      console.error('Failed to show action sheet:', error);
      return null;
    }
  }

  /**
   * Check if platform supports native action sheets
   */
  isSupported(): boolean {
    return Capacitor.isNativePlatform();
  }
}

export const actionSheet = new NativeActionSheet();
