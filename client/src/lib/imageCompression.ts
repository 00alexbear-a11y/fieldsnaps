import imageCompression from 'browser-image-compression';

export interface CompressionOptions {
  maxWidthOrHeight?: number;
  maxSizeMB?: number;
  quality?: number;
  useWebWorker?: boolean;
}

export interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

const defaultOptions: CompressionOptions = {
  maxWidthOrHeight: 1920,
  maxSizeMB: 1,
  quality: 0.85,
  useWebWorker: true,
};

export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const originalSize = file.size;
  
  const mergedOptions = {
    ...defaultOptions,
    ...options,
  };

  try {
    const compressedFile = await imageCompression(file, {
      maxSizeMB: mergedOptions.maxSizeMB!,
      maxWidthOrHeight: mergedOptions.maxWidthOrHeight!,
      useWebWorker: mergedOptions.useWebWorker!,
      initialQuality: mergedOptions.quality!,
    });

    const compressedSize = compressedFile.size;
    const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;

    return {
      file: compressedFile,
      originalSize,
      compressedSize,
      compressionRatio,
    };
  } catch (error) {
    console.error('Image compression failed:', error);
    return {
      file,
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 0,
    };
  }
}

export async function generateThumbnail(
  file: File,
  size: number = 200
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > size) {
            height = (height * size) / width;
            width = size;
          }
        } else {
          if (height > size) {
            width = (width * size) / height;
            height = size;
          }
        }

        canvas.width = size;
        canvas.height = size;
        
        const offsetX = (size - width) / 2;
        const offsetY = (size - height) / 2;
        
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, size, size);
        
        ctx.drawImage(img, offsetX, offsetY, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Could not create thumbnail blob'));
            }
          },
          'image/jpeg',
          0.8
        );
      };
      
      img.onerror = () => {
        reject(new Error('Could not load image'));
      };
      
      img.src = e.target?.result as string;
    };
    
    reader.onerror = () => {
      reject(new Error('Could not read file'));
    };
    
    reader.readAsDataURL(file);
  });
}

export async function compressAndGenerateThumbnail(
  file: File
): Promise<{ compressed: CompressionResult; thumbnail: Blob }> {
  const [compressed, thumbnail] = await Promise.all([
    compressImage(file),
    generateThumbnail(file),
  ]);

  return {
    compressed,
    thumbnail,
  };
}
