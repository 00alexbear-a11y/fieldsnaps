import { Capacitor } from '@capacitor/core';
import { Dialog } from '@capacitor/dialog';
import { ActionSheet, ActionSheetButtonStyle } from '@capacitor/action-sheet';

export interface AlertOptions {
  title: string;
  message: string;
  buttonTitle?: string;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  okButtonTitle?: string;
  cancelButtonTitle?: string;
}

export interface ActionSheetButton {
  title: string;
  style?: 'default' | 'destructive' | 'cancel';
  icon?: string;
}

export interface ActionSheetOptions {
  title: string;
  message?: string;
  buttons: ActionSheetButton[];
}

export const nativeDialogs = {
  async alert(options: AlertOptions): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      window.alert(`${options.title}\n\n${options.message}`);
      return;
    }

    await Dialog.alert({
      title: options.title,
      message: options.message,
      buttonTitle: options.buttonTitle || 'OK',
    });
  },

  async confirm(options: ConfirmOptions): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      return window.confirm(`${options.title}\n\n${options.message}`);
    }

    const result = await Dialog.confirm({
      title: options.title,
      message: options.message,
      okButtonTitle: options.okButtonTitle || 'OK',
      cancelButtonTitle: options.cancelButtonTitle || 'Cancel',
    });

    return result.value;
  },

  async actionSheet(options: ActionSheetOptions): Promise<number> {
    if (!Capacitor.isNativePlatform()) {
      const message = `${options.title}${options.message ? '\n' + options.message : ''}\n\n${
        options.buttons.map((btn, i) => `${i + 1}. ${btn.title}`).join('\n')
      }`;
      
      const input = window.prompt(message, '1');
      if (input === null) {
        const cancelIndex = options.buttons.findIndex(btn => btn.style === 'cancel');
        return cancelIndex >= 0 ? cancelIndex : -1;
      }
      
      const index = parseInt(input) - 1;
      if (isNaN(index) || index < 0 || index >= options.buttons.length) {
        return -1;
      }
      
      return index;
    }

    const result = await ActionSheet.showActions({
      title: options.title,
      message: options.message,
      options: options.buttons.map(btn => ({
        title: btn.title,
        style: btn.style === 'destructive' 
          ? ActionSheetButtonStyle.Destructive 
          : btn.style === 'cancel'
          ? ActionSheetButtonStyle.Cancel
          : ActionSheetButtonStyle.Default,
      })),
    });

    return result.index;
  },
};
