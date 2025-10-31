/**
 * Video utility functions for thumbnail extraction
 */

/**
 * Extracts the first frame from a video blob as a thumbnail image
 * @param videoBlob - The video blob to extract thumbnail from
 * @param maxWidth - Maximum width of thumbnail (default: 400)
 * @param maxHeight - Maximum height of thumbnail (default: 400)
 * @returns Promise<Blob> - The thumbnail image as a JPEG blob
 */
export async function extractVideoThumbnail(
  videoBlob: Blob,
  maxWidth: number = 400,
  maxHeight: number = 400
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    // Create object URL for video
    const videoUrl = URL.createObjectURL(videoBlob);
    video.src = videoUrl;
    video.muted = true;
    video.playsInline = true;

    // Handle video load error
    video.onerror = () => {
      URL.revokeObjectURL(videoUrl);
      reject(new Error('Failed to load video for thumbnail extraction'));
    };

    // When metadata is loaded, we can get video dimensions
    video.onloadedmetadata = () => {
      // Seek to 0.1 seconds to get a frame after the very first (often black)
      video.currentTime = 0.1;
    };

    // When seeked to the frame, capture it
    video.onseeked = () => {
      try {
        // Calculate thumbnail dimensions maintaining aspect ratio
        let width = video.videoWidth;
        let height = video.videoHeight;
        
        if (width > maxWidth || height > maxHeight) {
          const aspectRatio = width / height;
          if (width > height) {
            width = maxWidth;
            height = width / aspectRatio;
          } else {
            height = maxHeight;
            width = height * aspectRatio;
          }
        }

        // Set canvas size
        canvas.width = width;
        canvas.height = height;

        // Draw video frame to canvas
        ctx.drawImage(video, 0, 0, width, height);

        // Convert canvas to blob
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(videoUrl);
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to create thumbnail blob'));
            }
          },
          'image/jpeg',
          0.85 // JPEG quality (85%)
        );
      } catch (error) {
        URL.revokeObjectURL(videoUrl);
        reject(error);
      }
    };

    // Start loading video
    video.load();
  });
}
