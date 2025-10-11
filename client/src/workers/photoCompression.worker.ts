/**
 * Photo Compression Web Worker
 * 
 * Runs image compression in a separate thread to keep UI responsive.
 * Handles CPU-intensive canvas operations without blocking main thread.
 */

export type QualityPreset = 'standard' | 'detailed' | 'quick';

export interface CompressionRequest {
  type: 'compress';
  file: Blob;
  preset: QualityPreset;
}

export interface ThumbnailRequest {
  type: 'thumbnail';
  file: Blob;
}

export interface ProcessRequest {
  type: 'process';
  file: Blob;
  preset: QualityPreset;
}

export type WorkerRequest = CompressionRequest | ThumbnailRequest | ProcessRequest;

export interface CompressionResult {
  blob: Blob;
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
  quality: QualityPreset;
}

export interface ThumbnailResult {
  blob: Blob;
  size: number;
}

export interface ProcessResult {
  compressed: CompressionResult;
  thumbnail: ThumbnailResult;
}

export interface WorkerResponse {
  success: boolean;
  data?: CompressionResult | ThumbnailResult | ProcessResult;
  error?: string;
}

// Quality presets with target file sizes
const QUALITY_PRESETS = {
  standard: {
    targetSize: 500 * 1024, // 500KB
    maxDimension: 1920,
    quality: 0.85,
  },
  detailed: {
    targetSize: 1024 * 1024, // 1MB
    maxDimension: 2560,
    quality: 0.92,
  },
  quick: {
    targetSize: 200 * 1024, // 200KB
    maxDimension: 1280,
    quality: 0.75,
  },
} as const;

const THUMBNAIL_SIZE = 150;

/**
 * Load image from blob using worker-safe API
 */
async function loadImage(blob: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(blob);
  } catch (error) {
    throw new Error('Failed to load image');
  }
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
  img: ImageBitmap,
  width: number,
  height: number,
  quality: number
): Promise<Blob> {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Use high-quality image smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Draw image
  ctx.drawImage(img, 0, 0, width, height);

  // Convert to blob
  return await canvas.convertToBlob({
    type: 'image/jpeg',
    quality,
  });
}

/**
 * Iteratively compress to target file size
 */
async function compressToTargetSize(
  img: ImageBitmap,
  targetSize: number,
  maxDimension: number,
  initialQuality: number
): Promise<{ blob: Blob; width: number; height: number }> {
  const MIN_QUALITY = 0.3;
  const MIN_LONG_EDGE = 640;
  
  let { width, height } = calculateDimensions(
    img.width,
    img.height,
    maxDimension
  );

  let quality = initialQuality;
  let blob = await compressToCanvas(img, width, height, quality);
  
  let bestBlob = blob;
  let bestWidth = width;
  let bestHeight = height;

  if (blob.size <= targetSize) {
    return { blob, width, height };
  }

  // Phase 1: Reduce quality
  while (blob.size > targetSize && quality > MIN_QUALITY) {
    quality = Math.max(MIN_QUALITY, quality * 0.9);
    blob = await compressToCanvas(img, width, height, quality);
    
    if (blob.size < bestBlob.size) {
      bestBlob = blob;
      bestWidth = width;
      bestHeight = height;
    }
    
    if (blob.size <= targetSize) {
      return { blob, width, height };
    }
  }

  // Phase 2: Reduce dimensions
  const aspectRatio = width / height;
  const longEdge = Math.max(width, height);
  
  if (blob.size > targetSize && longEdge > MIN_LONG_EDGE) {
    let currentLongEdge = longEdge;
    
    while (blob.size > targetSize && currentLongEdge > MIN_LONG_EDGE) {
      currentLongEdge = Math.max(MIN_LONG_EDGE, Math.floor(currentLongEdge * 0.9));
      
      if (width > height) {
        width = currentLongEdge;
        height = Math.round(width / aspectRatio);
      } else {
        height = currentLongEdge;
        width = Math.round(height * aspectRatio);
      }
      
      blob = await compressToCanvas(img, width, height, quality);
      
      if (blob.size < bestBlob.size) {
        bestBlob = blob;
        bestWidth = width;
        bestHeight = height;
      }
      
      if (blob.size <= targetSize) {
        return { blob, width, height };
      }
      
      let dimQuality = quality;
      while (blob.size > targetSize && dimQuality > MIN_QUALITY) {
        dimQuality = Math.max(MIN_QUALITY, dimQuality * 0.9);
        blob = await compressToCanvas(img, width, height, dimQuality);
        
        if (blob.size < bestBlob.size) {
          bestBlob = blob;
          bestWidth = width;
          bestHeight = height;
        }
        
        if (blob.size <= targetSize) {
          return { blob, width, height };
        }
      }
      
      quality = dimQuality;
    }
  }

  return { 
    blob: bestBlob, 
    width: bestWidth, 
    height: bestHeight 
  };
}

/**
 * Compress photo with quality preset
 */
async function compressPhoto(
  file: Blob,
  preset: QualityPreset
): Promise<CompressionResult> {
  const config = QUALITY_PRESETS[preset];
  const originalSize = file.size;

  const img = await loadImage(file);

  const { blob, width, height } = await compressToTargetSize(
    img,
    config.targetSize,
    config.maxDimension,
    config.quality
  );

  return {
    blob,
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
async function generateThumbnail(file: Blob): Promise<ThumbnailResult> {
  const img = await loadImage(file);

  const size = THUMBNAIL_SIZE;
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Calculate crop for center square
  const sourceSize = Math.min(img.width, img.height);
  const sourceX = (img.width - sourceSize) / 2;
  const sourceY = (img.height - sourceSize) / 2;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

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

  const blob = await canvas.convertToBlob({
    type: 'image/jpeg',
    quality: 0.85,
  });

  return {
    blob,
    size: blob.size,
  };
}

/**
 * Process photo: compress and generate thumbnail
 */
async function processPhoto(
  file: Blob,
  preset: QualityPreset
): Promise<ProcessResult> {
  const [compressed, thumbnail] = await Promise.all([
    compressPhoto(file, preset),
    generateThumbnail(file),
  ]);

  return { compressed, thumbnail };
}

// Worker message handler
self.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;

  try {
    let result;

    switch (request.type) {
      case 'compress':
        result = await compressPhoto(request.file, request.preset);
        break;
      case 'thumbnail':
        result = await generateThumbnail(request.file);
        break;
      case 'process':
        result = await processPhoto(request.file, request.preset);
        break;
      default:
        throw new Error('Unknown request type');
    }

    self.postMessage({ success: true, data: result } as WorkerResponse);
  } catch (error: any) {
    self.postMessage({ 
      success: false, 
      error: error.message || 'Compression failed' 
    } as WorkerResponse);
  }
});
