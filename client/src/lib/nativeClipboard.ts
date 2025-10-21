import { Capacitor } from '@capacitor/core';
import { Clipboard } from '@capacitor/clipboard';

export const nativeClipboard = {
  async write(text: string): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        return;
      }
      
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return;
    }

    await Clipboard.write({ string: text });
  },

  async read(): Promise<string> {
    if (!Capacitor.isNativePlatform()) {
      if (navigator.clipboard) {
        return await navigator.clipboard.readText();
      }
      return '';
    }

    const result = await Clipboard.read();
    return result.value;
  },
};
