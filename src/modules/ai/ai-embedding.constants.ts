/**
 * Bull Queue constants for AI Embedding
 */
export const AI_EMBEDDING_QUEUE = 'ai-embedding';

export enum EmbeddingJobName {
  /** Embed or re-embed a single job posting */
  SYNC_JOB = 'sync-job',
  /** Embed or re-embed a single worker service */
  SYNC_WORKER_SERVICE = 'sync-worker-service',
  /** Batch sync: scan all open jobs & active services for missing/stale embeddings */
  BATCH_SYNC_ALL = 'batch-sync-all',
  /** Remove embedding when a job is cancelled/completed */
  REMOVE_JOB = 'remove-job',
  /** Sync a single job into graph_knowledge (denormalized) */
  SYNC_GRAPH_JOB = 'sync-graph-job',
  /** Sync a single worker service into graph_knowledge */
  SYNC_GRAPH_WORKER = 'sync-graph-worker',
  /** Deactivate a graph_knowledge node */
  REMOVE_GRAPH_NODE = 'remove-graph-node',
}

/** Payload types */
export interface SyncJobPayload {
  jobId: string;
}

export interface SyncWorkerServicePayload {
  workerServiceId: string;
}

export interface RemoveJobPayload {
  jobId: string;
}

export interface SyncGraphJobPayload {
  jobId: string;
}

export interface SyncGraphWorkerPayload {
  workerServiceId: string;
}

export interface RemoveGraphNodePayload {
  sourceId: string;
}
