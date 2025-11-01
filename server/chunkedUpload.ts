import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';

/**
 * Chunked Upload Service
 * 
 * Enables resumable uploads for large files by:
 * 1. Accepting 5-10MB chunks from the client
 * 2. Storing chunks temporarily in /tmp
 * 3. Assembling chunks when all are received
 * 4. Tracking upload progress per session
 */

const CHUNK_DIR = '/tmp/chunked-uploads';
const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB max file size
const CLEANUP_INTERVAL = 1000 * 60 * 60; // Cleanup every hour
const CHUNK_EXPIRY = 1000 * 60 * 60 * 24; // 24 hours

interface UploadSession {
  uploadId: string;
  fileName: string;
  totalChunks: number;
  receivedChunks: Set<number>;
  fileSize: number;
  createdAt: number;
  userId: string;
}

// In-memory tracking of upload sessions
const uploadSessions = new Map<string, UploadSession>();

/**
 * Initialize chunked upload system
 */
export async function initChunkedUpload() {
  // Create chunk directory if it doesn't exist
  try {
    await fs.mkdir(CHUNK_DIR, { recursive: true });
  } catch (error) {
    console.error('[ChunkedUpload] Failed to create chunk directory:', error);
  }

  // Clean up orphaned chunk directories on startup (from crashed sessions or attacks)
  await cleanupOrphanedChunks();

  // Start cleanup interval
  setInterval(cleanupExpiredChunks, CLEANUP_INTERVAL);
  
  console.log('[ChunkedUpload] Initialized');
}

/**
 * Middleware to validate upload session BEFORE multer processes the file
 * Prevents disk space DoS by rejecting invalid uploadIds early
 * 
 * NOTE: Reads uploadId from query params because req.body isn't populated
 * until AFTER multer parses multipart/form-data
 */
export function validateUploadSession(req: Request, res: Response, next: any) {
  // Read from query params since req.body isn't available before multer
  const uploadId = req.query.uploadId as string;
  const userId = (req as any).user?.claims?.sub;

  if (!uploadId) {
    return res.status(400).json({ error: 'Missing uploadId query parameter' });
  }

  const session = uploadSessions.get(uploadId);
  if (!session) {
    return res.status(404).json({ error: 'Upload session not found' });
  }

  // Verify ownership
  if (session.userId !== userId) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  // Session is valid, proceed to multer
  next();
}

/**
 * Multer storage for individual chunks
 * Only called AFTER validateUploadSession middleware
 * uploadId comes from query params, chunkIndex from form field
 */
const chunkStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    // uploadId validated via query param in validateUploadSession middleware
    const uploadId = req.query.uploadId as string;
    const chunkDir = path.join(CHUNK_DIR, uploadId);
    
    try {
      await fs.mkdir(chunkDir, { recursive: true });
      cb(null, chunkDir);
    } catch (error) {
      cb(error as Error, chunkDir);
    }
  },
  filename: (req, file, cb) => {
    // chunkIndex comes from multipart form field (parsed by multer)
    const chunkIndex = req.body.chunkIndex;
    cb(null, `chunk-${chunkIndex}`);
  }
});

export const chunkUpload = multer({
  storage: chunkStorage,
  limits: {
    fileSize: CHUNK_SIZE * 1.1, // Allow 10% buffer for metadata
  }
});

/**
 * Initialize a new chunked upload session
 */
export async function initUploadSession(req: Request, res: Response) {
  try {
    const { fileName, fileSize, totalChunks } = req.body;
    const userId = (req as any).user.claims.sub;

    // Validate inputs
    if (!fileName || !fileSize || !totalChunks) {
      return res.status(400).json({ 
        error: 'Missing required fields: fileName, fileSize, totalChunks' 
      });
    }

    if (fileSize > MAX_FILE_SIZE) {
      return res.status(400).json({ 
        error: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB` 
      });
    }

    // Generate unique upload ID
    const uploadId = crypto.randomUUID();

    // Create upload session
    const session: UploadSession = {
      uploadId,
      fileName,
      totalChunks: parseInt(totalChunks),
      receivedChunks: new Set(),
      fileSize: parseInt(fileSize),
      createdAt: Date.now(),
      userId
    };

    uploadSessions.set(uploadId, session);

    // Create directory for chunks
    const chunkDir = path.join(CHUNK_DIR, uploadId);
    await fs.mkdir(chunkDir, { recursive: true });

    console.log(`[ChunkedUpload] Session created: ${uploadId} for ${fileName} (${fileSize} bytes, ${totalChunks} chunks)`);

    res.json({
      uploadId,
      chunkSize: CHUNK_SIZE
    });
  } catch (error) {
    console.error('[ChunkedUpload] Failed to init session:', error);
    res.status(500).json({ error: 'Failed to initialize upload session' });
  }
}

/**
 * Handle individual chunk upload
 * uploadId comes from query params (validated by middleware)
 * chunkIndex comes from multipart form field
 */
export async function uploadChunk(req: Request, res: Response) {
  try {
    const uploadId = req.query.uploadId as string;
    const chunkIndex = req.body.chunkIndex;
    const userId = (req as any).user.claims.sub;

    if (!uploadId || chunkIndex === undefined) {
      return res.status(400).json({ 
        error: 'Missing uploadId or chunkIndex' 
      });
    }

    // Get upload session (already validated by middleware, but double-check)
    const session = uploadSessions.get(uploadId);
    if (!session) {
      return res.status(404).json({ error: 'Upload session not found' });
    }

    // Verify ownership (already validated by middleware, but double-check)
    if (session.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const index = parseInt(chunkIndex);
    
    // Validate chunk index
    if (index < 0 || index >= session.totalChunks) {
      return res.status(400).json({ 
        error: `Invalid chunk index: ${index}` 
      });
    }

    // Mark chunk as received
    session.receivedChunks.add(index);

    console.log(`[ChunkedUpload] Received chunk ${index}/${session.totalChunks - 1} for ${uploadId}`);

    res.json({
      received: session.receivedChunks.size,
      total: session.totalChunks,
      isComplete: session.receivedChunks.size === session.totalChunks
    });
  } catch (error) {
    console.error('[ChunkedUpload] Failed to upload chunk:', error);
    res.status(500).json({ error: 'Failed to upload chunk' });
  }
}

/**
 * Assemble all chunks into final file
 * Returns the assembled file buffer
 */
export async function assembleChunks(uploadId: string): Promise<Buffer> {
  const session = uploadSessions.get(uploadId);
  if (!session) {
    throw new Error('Upload session not found');
  }

  // Verify all chunks received
  if (session.receivedChunks.size !== session.totalChunks) {
    throw new Error(`Missing chunks: received ${session.receivedChunks.size}/${session.totalChunks}`);
  }

  const chunkDir = path.join(CHUNK_DIR, uploadId);
  const chunks: Buffer[] = [];

  // Read all chunks in order
  for (let i = 0; i < session.totalChunks; i++) {
    const chunkPath = path.join(chunkDir, `chunk-${i}`);
    try {
      const chunkData = await fs.readFile(chunkPath);
      chunks.push(chunkData);
    } catch (error) {
      throw new Error(`Failed to read chunk ${i}: ${error}`);
    }
  }

  // Combine all chunks
  const assembledFile = Buffer.concat(chunks);

  console.log(`[ChunkedUpload] Assembled ${session.totalChunks} chunks into ${assembledFile.length} bytes for ${uploadId}`);

  return assembledFile;
}

/**
 * Get upload session status
 */
export async function getUploadStatus(req: Request, res: Response) {
  try {
    const { uploadId } = req.params;
    const userId = (req as any).user.claims.sub;

    const session = uploadSessions.get(uploadId);
    if (!session) {
      return res.status(404).json({ error: 'Upload session not found' });
    }

    // Verify ownership
    if (session.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json({
      uploadId: session.uploadId,
      fileName: session.fileName,
      fileSize: session.fileSize,
      totalChunks: session.totalChunks,
      receivedChunks: Array.from(session.receivedChunks).sort((a, b) => a - b),
      isComplete: session.receivedChunks.size === session.totalChunks,
      progress: (session.receivedChunks.size / session.totalChunks) * 100
    });
  } catch (error) {
    console.error('[ChunkedUpload] Failed to get status:', error);
    res.status(500).json({ error: 'Failed to get upload status' });
  }
}

/**
 * Clean up upload session and chunks
 */
export async function cleanupUploadSession(uploadId: string) {
  try {
    // Remove session from memory
    uploadSessions.delete(uploadId);

    // Delete chunk directory
    const chunkDir = path.join(CHUNK_DIR, uploadId);
    await fs.rm(chunkDir, { recursive: true, force: true });

    console.log(`[ChunkedUpload] Cleaned up session: ${uploadId}`);
  } catch (error) {
    console.error(`[ChunkedUpload] Failed to cleanup ${uploadId}:`, error);
  }
}

/**
 * Cancel upload session
 */
export async function cancelUpload(req: Request, res: Response) {
  try {
    const { uploadId } = req.params;
    const userId = (req as any).user.claims.sub;

    const session = uploadSessions.get(uploadId);
    if (!session) {
      return res.status(404).json({ error: 'Upload session not found' });
    }

    // Verify ownership
    if (session.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await cleanupUploadSession(uploadId);

    res.json({ message: 'Upload cancelled' });
  } catch (error) {
    console.error('[ChunkedUpload] Failed to cancel upload:', error);
    res.status(500).json({ error: 'Failed to cancel upload' });
  }
}

/**
 * Cleanup expired chunks (runs periodically)
 */
async function cleanupExpiredChunks() {
  const now = Date.now();
  let cleanedCount = 0;

  const entries = Array.from(uploadSessions.entries());
  for (const [uploadId, session] of entries) {
    // Remove sessions older than 24 hours
    if (now - session.createdAt > CHUNK_EXPIRY) {
      await cleanupUploadSession(uploadId);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    console.log(`[ChunkedUpload] Cleaned up ${cleanedCount} expired sessions`);
  }
  
  // Also clean up orphaned directories
  await cleanupOrphanedChunks();
}

/**
 * Cleanup orphaned chunk directories (from failed uploads or attacks)
 * Runs on startup and periodically to prevent disk space leaks
 */
async function cleanupOrphanedChunks() {
  try {
    const entries = await fs.readdir(CHUNK_DIR);
    let orphanedCount = 0;

    for (const entry of entries) {
      const uploadId = entry;
      
      // If no active session exists for this directory, it's orphaned
      if (!uploadSessions.has(uploadId)) {
        const orphanedDir = path.join(CHUNK_DIR, uploadId);
        await fs.rm(orphanedDir, { recursive: true, force: true });
        orphanedCount++;
      }
    }

    if (orphanedCount > 0) {
      console.log(`[ChunkedUpload] Cleaned up ${orphanedCount} orphaned chunk directories`);
    }
  } catch (error) {
    console.error('[ChunkedUpload] Failed to cleanup orphaned chunks:', error);
  }
}
