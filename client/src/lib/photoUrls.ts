/**
 * Transform photo URLs to use backend proxy routes instead of direct Object Storage paths.
 * This ensures photos load correctly in iOS WebView with proper CORS headers.
 */

import { getApiUrl } from "@/lib/apiUrl";

/**
 * Get the image URL for a photo
 * @param photoId - The photo ID
 * @param originalUrl - The original storage URL (optional, for fallback)
 * @returns The proxied image URL (absolute URL for native app compatibility)
 */
export function getPhotoImageUrl(photoId: string, originalUrl?: string | null): string {
  // If it's already a blob URL (local photo), return as-is
  if (originalUrl?.startsWith('blob:')) {
    return originalUrl;
  }
  
  // Use the backend proxy route wrapped with getApiUrl for native app compatibility
  return getApiUrl(`/api/photos/${photoId}/image`);
}

/**
 * Get the thumbnail URL for a photo
 * @param photoId - The photo ID
 * @param originalThumbnailUrl - The original thumbnail storage URL (optional)
 * @returns The proxied thumbnail URL (absolute URL for native app compatibility)
 */
export function getPhotoThumbnailUrl(photoId: string, originalThumbnailUrl?: string | null): string {
  // If it's already a blob URL (local photo), return as-is
  if (originalThumbnailUrl?.startsWith('blob:')) {
    return originalThumbnailUrl;
  }
  
  // Use the backend proxy route wrapped with getApiUrl for native app compatibility
  return getApiUrl(`/api/photos/${photoId}/thumbnail`);
}
