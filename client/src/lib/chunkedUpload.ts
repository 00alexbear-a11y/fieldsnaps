/**
 * Chunked Upload Client
 * Handles large file uploads by splitting into chunks with retry logic
 */

const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks (matches backend)
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 30000; // 30 seconds

export interface ChunkedUploadOptions {
  file: Blob;
  fileName: string;
  onProgress?: (progress: number) => void;
  onChunkComplete?: (chunkIndex: number, totalChunks: number) => void;
  signal?: AbortSignal;
}

export interface ChunkedUploadResult {
  uploadId: string;
}

interface UploadSession {
  uploadId: string;
  totalChunks: number;
}

/**
 * Calculate exponential backoff delay with jitter
 */
function calculateRetryDelay(attempt: number): number {
  const delay = Math.min(
    INITIAL_RETRY_DELAY * Math.pow(2, attempt),
    MAX_RETRY_DELAY
  );
  // Add jitter (±25%)
  const jitter = delay * 0.25 * (Math.random() - 0.5);
  return delay + jitter;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Initialize chunked upload session
 */
async function initUploadSession(
  fileName: string,
  fileSize: number,
  totalChunks: number,
  signal?: AbortSignal
): Promise<UploadSession> {
  const response = await fetch('/api/uploads/chunked/init', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    signal,
    body: JSON.stringify({ 
      fileName,
      fileSize,
      totalChunks 
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to initialize upload: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return {
    uploadId: data.uploadId,
    totalChunks,
  };
}

/**
 * Upload a single chunk with retry logic
 */
async function uploadChunkWithRetry(
  uploadId: string,
  chunk: Blob,
  chunkIndex: number,
  signal?: AbortSignal
): Promise<void> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      // Create FormData with chunk
      const formData = new FormData();
      formData.append('chunk', chunk, `chunk-${chunkIndex}`);
      formData.append('chunkIndex', chunkIndex.toString());

      // uploadId goes in query params (not body) for pre-multer validation
      const response = await fetch(
        `/api/uploads/chunked/chunk?uploadId=${encodeURIComponent(uploadId)}`,
        {
          method: 'POST',
          credentials: 'include',
          signal,
          body: formData,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Chunk upload failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log(`[ChunkedUpload] Chunk ${chunkIndex} uploaded:`, result);
      
      // Success!
      return;
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry if aborted
      if (signal?.aborted) {
        throw new Error('Upload aborted');
      }

      // Don't retry on final attempt
      if (attempt === MAX_RETRIES - 1) {
        break;
      }

      // Calculate retry delay with exponential backoff
      const delay = calculateRetryDelay(attempt);
      console.warn(
        `[ChunkedUpload] Chunk ${chunkIndex} failed (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${delay}ms:`,
        error
      );
      
      await sleep(delay);
    }
  }

  // All retries failed
  throw new Error(
    `Failed to upload chunk ${chunkIndex} after ${MAX_RETRIES} attempts: ${lastError?.message}`
  );
}


/**
 * Upload file using chunked upload with retry logic
 * Returns uploadId for calling the complete endpoint with metadata
 */
export async function uploadFileChunked(
  options: ChunkedUploadOptions
): Promise<ChunkedUploadResult> {
  const { file, fileName, onProgress, onChunkComplete, signal } = options;
  
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  
  console.log(`[ChunkedUpload] Starting upload: ${fileName} (${file.size} bytes in ${totalChunks} chunks)`);

  // Initialize upload session
  const session = await initUploadSession(fileName, file.size, totalChunks, signal);
  console.log(`[ChunkedUpload] Session initialized:`, session.uploadId);

  try {
    // Upload each chunk
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      await uploadChunkWithRetry(session.uploadId, chunk, i, signal);

      // Notify progress
      onChunkComplete?.(i, totalChunks);
      const progress = ((i + 1) / totalChunks) * 100;
      onProgress?.(progress);
    }

    console.log(`[ChunkedUpload] All chunks uploaded successfully`);

    // Return uploadId for calling complete endpoint with metadata
    return { uploadId: session.uploadId };
  } catch (error) {
    console.error('[ChunkedUpload] Upload failed:', error);
    throw error;
  }
}

/**
 * Determine if file should use chunked upload
 * Use chunked upload for files > 20MB
 */
export function shouldUseChunkedUpload(fileSize: number): boolean {
  const THRESHOLD = 20 * 1024 * 1024; // 20MB
  return fileSize > THRESHOLD;
}
