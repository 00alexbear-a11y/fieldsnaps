/**
 * Upload Performance Monitoring System
 * 
 * Tracks metrics for all upload methods:
 * - Multipart uploads (<5MB)
 * - Presigned URL uploads (5-20MB)
 * - Chunked uploads (>20MB)
 * 
 * Metrics tracked:
 * - Success/failure rates
 * - Upload duration by file size
 * - Retry frequency
 * - Network errors
 * - Upload method distribution
 */

export type UploadMethod = 'multipart' | 'presigned' | 'chunked';
export type UploadStatus = 'started' | 'success' | 'failed' | 'retry';

export interface UploadMetric {
  userId: string;
  projectId: string;
  method: UploadMethod;
  status: UploadStatus;
  fileSize: number;
  fileSizeMB: number;
  duration?: number; // milliseconds
  error?: string;
  retryCount?: number;
  chunksFailed?: number;
  timestamp: Date;
}

class UploadMetricsService {
  private metrics: UploadMetric[] = [];
  private readonly MAX_METRICS = 10000; // Keep last 10k metrics in memory
  private readonly CLEANUP_THRESHOLD = 12000; // Cleanup when reaching 12k

  /**
   * Log an upload event
   */
  log(metric: Omit<UploadMetric, 'timestamp' | 'fileSizeMB'>): void {
    const fullMetric: UploadMetric = {
      ...metric,
      fileSizeMB: Math.round((metric.fileSize / (1024 * 1024)) * 100) / 100,
      timestamp: new Date(),
    };

    this.metrics.push(fullMetric);

    // Console log for real-time monitoring
    const logPrefix = `[Upload ${metric.status.toUpperCase()}]`;
    const methodLabel = metric.method.toUpperCase();
    const sizeLabel = `${fullMetric.fileSizeMB}MB`;
    
    if (metric.status === 'success') {
      console.log(
        `${logPrefix} ${methodLabel} | ${sizeLabel} | ${metric.duration}ms | User: ${metric.userId.slice(0, 8)}`
      );
    } else if (metric.status === 'failed') {
      console.error(
        `${logPrefix} ${methodLabel} | ${sizeLabel} | Error: ${metric.error} | User: ${metric.userId.slice(0, 8)}`
      );
    } else if (metric.status === 'retry') {
      console.warn(
        `${logPrefix} ${methodLabel} | Chunk retry #${metric.retryCount} | User: ${metric.userId.slice(0, 8)}`
      );
    }

    // Cleanup old metrics if threshold exceeded
    if (this.metrics.length > this.CLEANUP_THRESHOLD) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }
  }

  /**
   * Get upload statistics for a time period
   */
  getStats(options?: {
    userId?: string;
    method?: UploadMethod;
    hoursAgo?: number;
  }): {
    total: number;
    success: number;
    failed: number;
    successRate: number;
    avgDuration: number;
    avgFileSize: number;
    methodBreakdown: Record<UploadMethod, number>;
    sizeBreakdown: {
      small: number;    // <5MB
      medium: number;   // 5-20MB
      large: number;    // >20MB
    };
    errorBreakdown: Record<string, number>;
  } {
    const hoursAgo = options?.hoursAgo || 24;
    const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

    // Filter metrics
    let filtered = this.metrics.filter(m => m.timestamp >= cutoffTime);
    
    if (options?.userId) {
      filtered = filtered.filter(m => m.userId === options.userId);
    }
    
    if (options?.method) {
      filtered = filtered.filter(m => m.method === options.method);
    }

    // Only count final states (success/failed)
    const finalStates = filtered.filter(m => m.status === 'success' || m.status === 'failed');

    const total = finalStates.length;
    const success = finalStates.filter(m => m.status === 'success').length;
    const failed = finalStates.filter(m => m.status === 'failed').length;
    const successRate = total > 0 ? Math.round((success / total) * 100) : 0;

    // Calculate averages (only for successful uploads)
    const successfulUploads = finalStates.filter(m => m.status === 'success');
    
    // Calculate average duration (handle case where no duration is tracked)
    const uploadsWithDuration = successfulUploads.filter(m => m.duration !== undefined);
    const avgDuration = uploadsWithDuration.length > 0
      ? Math.round(
          uploadsWithDuration.reduce((sum, m) => sum + (m.duration || 0), 0) / 
          uploadsWithDuration.length
        )
      : 0;

    const avgFileSize = successfulUploads.length > 0
      ? Math.round(
          successfulUploads.reduce((sum, m) => sum + m.fileSizeMB, 0) / 
          successfulUploads.length * 100
        ) / 100
      : 0;

    // Method breakdown
    const methodBreakdown: Record<UploadMethod, number> = {
      multipart: finalStates.filter(m => m.method === 'multipart').length,
      presigned: finalStates.filter(m => m.method === 'presigned').length,
      chunked: finalStates.filter(m => m.method === 'chunked').length,
    };

    // Size breakdown
    const sizeBreakdown = {
      small: finalStates.filter(m => m.fileSizeMB < 5).length,
      medium: finalStates.filter(m => m.fileSizeMB >= 5 && m.fileSizeMB < 20).length,
      large: finalStates.filter(m => m.fileSizeMB >= 20).length,
    };

    // Error breakdown
    const errorBreakdown: Record<string, number> = {};
    finalStates
      .filter(m => m.status === 'failed' && m.error)
      .forEach(m => {
        const errorKey = m.error || 'Unknown';
        errorBreakdown[errorKey] = (errorBreakdown[errorKey] || 0) + 1;
      });

    return {
      total,
      success,
      failed,
      successRate,
      avgDuration,
      avgFileSize,
      methodBreakdown,
      sizeBreakdown,
      errorBreakdown,
    };
  }

  /**
   * Get recent failed uploads for debugging
   */
  getRecentFailures(limit: number = 10): UploadMetric[] {
    return this.metrics
      .filter(m => m.status === 'failed')
      .slice(-limit)
      .reverse();
  }

  /**
   * Clear all metrics (for testing)
   */
  clear(): void {
    this.metrics = [];
  }

  /**
   * Get total metrics count
   */
  getCount(): number {
    return this.metrics.length;
  }
}

// Singleton instance
export const uploadMetrics = new UploadMetricsService();
