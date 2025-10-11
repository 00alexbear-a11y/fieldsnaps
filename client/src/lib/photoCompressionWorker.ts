/**
 * Photo Compression Worker Manager
 * 
 * Manages Web Worker lifecycle and communication for photo compression.
 * Provides simple async API for UI thread.
 */

import type { QualityPreset } from './photoCompression';
import type {
  WorkerRequest,
  WorkerResponse,
  CompressionResult,
  ThumbnailResult,
  ProcessResult,
} from '../workers/photoCompression.worker';

class PhotoCompressionWorkerManager {
  private worker: Worker | null = null;

  /**
   * Initialize worker (lazy)
   */
  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(
        new URL('../workers/photoCompression.worker.ts', import.meta.url),
        { type: 'module' }
      );
    }
    return this.worker;
  }

  /**
   * Send request to worker and wait for response
   */
  private async sendRequest<T>(request: WorkerRequest): Promise<T> {
    return new Promise((resolve, reject) => {
      const worker = this.getWorker();

      const handler = (event: MessageEvent<WorkerResponse>) => {
        worker.removeEventListener('message', handler);

        if (event.data.success) {
          resolve(event.data.data as T);
        } else {
          reject(new Error(event.data.error || 'Worker operation failed'));
        }
      };

      worker.addEventListener('message', handler);
      worker.postMessage(request);
    });
  }

  /**
   * Compress photo with quality preset
   * 
   * IMPORTANT: Caller must revoke the returned URL when done:
   * URL.revokeObjectURL(result.url)
   */
  async compressPhoto(
    file: File | Blob,
    preset: QualityPreset = 'standard'
  ): Promise<CompressionResult & { url: string }> {
    const blob = file instanceof File ? file : file;
    
    const result = await this.sendRequest<CompressionResult>({
      type: 'compress',
      file: blob,
      preset,
    });

    // Create URL on main thread (URLs can't be transferred from worker)
    const url = URL.createObjectURL(result.blob);

    return {
      ...result,
      url,
    };
  }

  /**
   * Generate thumbnail
   * 
   * IMPORTANT: Caller must revoke the returned URL when done:
   * URL.revokeObjectURL(result.url)
   */
  async generateThumbnail(file: File | Blob): Promise<ThumbnailResult & { url: string }> {
    const blob = file instanceof File ? file : file;
    
    const result = await this.sendRequest<ThumbnailResult>({
      type: 'thumbnail',
      file: blob,
    });

    const url = URL.createObjectURL(result.blob);

    return {
      ...result,
      url,
    };
  }

  /**
   * Process photo: compress and generate thumbnail in parallel
   * 
   * IMPORTANT: Caller must revoke both returned URLs when done:
   * URL.revokeObjectURL(result.compressed.url)
   * URL.revokeObjectURL(result.thumbnail.url)
   */
  async processPhoto(
    file: File | Blob,
    preset: QualityPreset = 'standard'
  ): Promise<{
    compressed: CompressionResult & { url: string };
    thumbnail: ThumbnailResult & { url: string };
  }> {
    const blob = file instanceof File ? file : file;
    
    const result = await this.sendRequest<ProcessResult>({
      type: 'process',
      file: blob,
      preset,
    });

    // Create URLs on main thread
    const compressedUrl = URL.createObjectURL(result.compressed.blob);
    const thumbnailUrl = URL.createObjectURL(result.thumbnail.blob);

    return {
      compressed: {
        ...result.compressed,
        url: compressedUrl,
      },
      thumbnail: {
        ...result.thumbnail,
        url: thumbnailUrl,
      },
    };
  }

  /**
   * Terminate worker and free resources
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}

// Export singleton instance
export const photoCompressionWorker = new PhotoCompressionWorkerManager();

// Export helper to get compression stats
export function getCompressionStats(result: CompressionResult & { url: string }): {
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

// Export helper to revoke URLs
export function revokePhotoUrls(
  compressed: { url: string },
  thumbnail: { url: string }
): void {
  URL.revokeObjectURL(compressed.url);
  URL.revokeObjectURL(thumbnail.url);
}
