import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';

export interface ShareOptions {
  title?: string;
  text?: string;
  url?: string;
  files?: string[];
  dialogTitle?: string;
}

export interface ShareResult {
  shared: boolean;
  method: 'native' | 'web-share' | 'clipboard' | 'failed';
}

export const nativeShare = {
  async share(options: ShareOptions): Promise<ShareResult> {
    if (!Capacitor.isNativePlatform()) {
      if (navigator.share) {
        try {
          await navigator.share({
            title: options.title,
            text: options.text,
            url: options.url,
          });
          return { shared: true, method: 'web-share' };
        } catch (error) {
          if ((error as Error).name === 'AbortError') {
            return { shared: false, method: 'failed' };
          }
          throw error;
        }
      }
      
      if (options.url && navigator.clipboard) {
        await navigator.clipboard.writeText(options.url);
        return { shared: true, method: 'clipboard' };
      }
      
      return { shared: false, method: 'failed' };
    }

    try {
      let filePaths: string[] = [];
      
      if (options.files && options.files.length > 0) {
        for (const fileUrl of options.files) {
          try {
            const response = await fetch(fileUrl);
            const blob = await response.blob();
            const base64Data = await blobToBase64(blob);
            
            const fileName = `share_${Date.now()}.jpg`;
            const writeResult = await Filesystem.writeFile({
              path: fileName,
              data: base64Data,
              directory: Directory.Cache,
            });
            
            filePaths.push(writeResult.uri);
          } catch (fileError) {
            console.warn('Failed to prepare file for sharing:', fileError);
          }
        }
      }

      const shareResult = await Share.share({
        title: options.title,
        text: options.text,
        url: filePaths.length === 0 ? options.url : undefined,
        files: filePaths.length > 0 ? filePaths : undefined,
        dialogTitle: options.dialogTitle || 'Share',
      });
      
      if (filePaths.length > 0) {
        setTimeout(async () => {
          for (const filePath of filePaths) {
            try {
              const fileName = filePath.split('/').pop();
              if (fileName) {
                await Filesystem.deleteFile({
                  path: fileName,
                  directory: Directory.Cache,
                });
              }
            } catch {
              // Cleanup failed, not critical
            }
          }
        }, 5000);
      }
      
      // Check if user completed the share or cancelled
      const completed = (shareResult as any)?.completed !== false;
      return { 
        shared: completed, 
        method: 'native' 
      };
    } catch (error) {
      console.warn('Native share failed:', error);
      return { shared: false, method: 'failed' };
    }
  },

  async canShare(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      return !!navigator.share || !!navigator.clipboard;
    }
    
    try {
      const result = await Share.canShare();
      return result.value;
    } catch {
      return false;
    }
  },
};

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
