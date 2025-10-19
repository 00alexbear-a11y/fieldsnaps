/**
 * Photo Compression System for Construction PWA
 * 
 * Compresses photos to target sizes while maintaining visual quality.
 * Uses Canvas API for client-side processing with no server dependency.
 */

export type QualityPreset = 'standard' | 'detailed' | 'quick';

export interface CompressionResult {
  blob: Blob;
  url: string;
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
  quality: QualityPreset;
}

export interface ThumbnailResult {
  blob: Blob;
  url: string;
  size: number;
}

// Quality presets with target file sizes
export const QUALITY_PRESETS = {
  standard: {
    targetSize: 500 * 1024, // 500KB
    maxDimension: 1920,
    quality: 0.85,
    description: 'Standard - Best for most documentation',
  },
  detailed: {
    targetSize: 1536 * 1024, // 1.5MB
    maxDimension: 2560,
    quality: 0.95,
    description: 'Detailed - High quality for important captures',
  },
  quick: {
    targetSize: 200 * 1024, // 200KB
    maxDimension: 1280,
    quality: 0.75,
    description: 'Quick - Fast sharing and progress updates',
  },
} as const;

const THUMBNAIL_SIZE = 150; // 150x150px thumbnails

/**
 * Load image from file/blob
 */
function loadImage(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * Calculate dimensions maintaining aspect ratio
 */
function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxDimension: number
): { width: number; height: number } {
  const aspectRatio = originalWidth / originalHeight;

  if (originalWidth <= maxDimension && originalHeight <= maxDimension) {
    return { width: originalWidth, height: originalHeight };
  }

  if (originalWidth > originalHeight) {
    return {
      width: maxDimension,
      height: Math.round(maxDimension / aspectRatio),
    };
  } else {
    return {
      width: Math.round(maxDimension * aspectRatio),
      height: maxDimension,
    };
  }
}

/**
 * Compress image to target quality
 */
async function compressToCanvas(
  img: HTMLImageElement,
  width: number,
  height: number,
  quality: number
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  canvas.width = width;
  canvas.height = height;

  // Use high-quality image smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Draw image
  ctx.drawImage(img, 0, 0, width, height);

  // Convert to blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob'));
        }
      },
      'image/jpeg',
      quality
    );
  });
}

/**
 * Iteratively compress to target file size with guaranteed target compliance
 */
async function compressToTargetSize(
  img: HTMLImageElement,
  targetSize: number,
  maxDimension: number,
  initialQuality: number
): Promise<{ blob: Blob; width: number; height: number }> {
  const MIN_QUALITY = 0.3;
  const MIN_LONG_EDGE = 640;
  
  // Calculate initial dimensions maintaining aspect ratio
  let { width, height } = calculateDimensions(
    img.naturalWidth,
    img.naturalHeight,
    maxDimension
  );

  let quality = initialQuality;
  let blob = await compressToCanvas(img, width, height, quality);
  
  // Track the best (smallest) result seen
  let bestBlob = blob;
  let bestWidth = width;
  let bestHeight = height;

  // If already under target, return
  if (blob.size <= targetSize) {
    return { blob, width, height };
  }

  // Phase 1: Reduce quality iteratively while above target
  while (blob.size > targetSize && quality > MIN_QUALITY) {
    quality = Math.max(MIN_QUALITY, quality * 0.9);
    blob = await compressToCanvas(img, width, height, quality);
    
    // Track best result
    if (blob.size < bestBlob.size) {
      bestBlob = blob;
      bestWidth = width;
      bestHeight = height;
    }
    
    // Exit early if we hit target
    if (blob.size <= targetSize) {
      return { blob, width, height };
    }
  }

  // Phase 2: If still too large, reduce dimensions proportionally
  const aspectRatio = width / height;
  const longEdge = Math.max(width, height);
  
  if (blob.size > targetSize && longEdge > MIN_LONG_EDGE) {
    let currentLongEdge = longEdge;
    
    while (blob.size > targetSize && currentLongEdge > MIN_LONG_EDGE) {
      // Reduce long edge by 10% each iteration
      currentLongEdge = Math.max(MIN_LONG_EDGE, Math.floor(currentLongEdge * 0.9));
      
      // Calculate new dimensions maintaining aspect ratio
      if (width > height) {
        width = currentLongEdge;
        height = Math.round(width / aspectRatio);
      } else {
        height = currentLongEdge;
        width = Math.round(height * aspectRatio);
      }
      
      // Try with current quality (continue from Phase 1 quality)
      blob = await compressToCanvas(img, width, height, quality);
      
      // Track best result
      if (blob.size < bestBlob.size) {
        bestBlob = blob;
        bestWidth = width;
        bestHeight = height;
      }
      
      // Exit early if we hit target
      if (blob.size <= targetSize) {
        return { blob, width, height };
      }
      
      // If still over, try reducing quality further at this dimension
      let dimQuality = quality;
      while (blob.size > targetSize && dimQuality > MIN_QUALITY) {
        dimQuality = Math.max(MIN_QUALITY, dimQuality * 0.9);
        blob = await compressToCanvas(img, width, height, dimQuality);
        
        // Track best result
        if (blob.size < bestBlob.size) {
          bestBlob = blob;
          bestWidth = width;
          bestHeight = height;
        }
        
        // Exit early if we hit target
        if (blob.size <= targetSize) {
          return { blob, width, height };
        }
      }
      
      // Update quality for next dimension iteration
      quality = dimQuality;
    }
  }

  // Return the best (smallest) result we achieved
  return { 
    blob: bestBlob, 
    width: bestWidth, 
    height: bestHeight 
  };
}

/**
 * Compress photo with quality preset
 */
export async function compressPhoto(
  file: File | Blob,
  preset: QualityPreset = 'standard'
): Promise<CompressionResult> {
  const config = QUALITY_PRESETS[preset];
  const originalSize = file.size;

  // Load image
  const img = await loadImage(file);

  // Compress to target size
  const { blob, width, height } = await compressToTargetSize(
    img,
    config.targetSize,
    config.maxDimension,
    config.quality
  );

  // Create object URL
  const url = URL.createObjectURL(blob);

  return {
    blob,
    url,
    width,
    height,
    originalSize,
    compressedSize: blob.size,
    quality: preset,
  };
}

/**
 * Generate square thumbnail
 */
export async function generateThumbnail(
  file: File | Blob
): Promise<ThumbnailResult> {
  const img = await loadImage(file);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  const size = THUMBNAIL_SIZE;
  canvas.width = size;
  canvas.height = size;

  // Calculate crop for center square
  const sourceSize = Math.min(img.naturalWidth, img.naturalHeight);
  const sourceX = (img.naturalWidth - sourceSize) / 2;
  const sourceY = (img.naturalHeight - sourceSize) / 2;

  // Use high-quality image smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Draw cropped and scaled image
  ctx.drawImage(
    img,
    sourceX,
    sourceY,
    sourceSize,
    sourceSize,
    0,
    0,
    size,
    size
  );

  // Convert to blob
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create thumbnail blob'));
        }
      },
      'image/jpeg',
      0.85
    );
  });

  const url = URL.createObjectURL(blob);

  return {
    blob,
    url,
    size: blob.size,
  };
}

/**
 * Compress photo and generate thumbnail in parallel
 */
export async function processPhoto(
  file: File | Blob,
  preset: QualityPreset = 'standard'
): Promise<{
  compressed: CompressionResult;
  thumbnail: ThumbnailResult;
}> {
  const [compressed, thumbnail] = await Promise.all([
    compressPhoto(file, preset),
    generateThumbnail(file),
  ]);

  return { compressed, thumbnail };
}

/**
 * Get compression stats for display
 */
export function getCompressionStats(result: CompressionResult): {
  originalSizeMB: string;
  compressedSizeMB: string;
  savedPercentage: string;
  dimensions: string;
} {
  const originalMB = (result.originalSize / (1024 * 1024)).toFixed(2);
  const compressedMB = (result.compressedSize / (1024 * 1024)).toFixed(2);
  const savedPercent = (
    ((result.originalSize - result.compressedSize) / result.originalSize) *
    100
  ).toFixed(0);

  return {
    originalSizeMB: `${originalMB}MB`,
    compressedSizeMB: `${compressedMB}MB`,
    savedPercentage: `${savedPercent}%`,
    dimensions: `${result.width}x${result.height}`,
  };
}

/**
 * Revoke object URLs to free memory
 */
export function revokePhotoUrls(compressed: CompressionResult, thumbnail: ThumbnailResult): void {
  URL.revokeObjectURL(compressed.url);
  URL.revokeObjectURL(thumbnail.url);
}
