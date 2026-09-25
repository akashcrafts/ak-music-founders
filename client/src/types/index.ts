export type JobStatus = 
  | 'idle'
  | 'queued'
  | 'extracting'
  | 'separating'
  | 'analyzing'
  | 'identifying'
  | 'discovering'
  | 'completed'
  | 'failed';

export interface JobInfo {
  id: string;
  filename: string;
  size: number;
  duration: number;
  status: JobStatus;
  progress: number;
  currentStep: string | null;
  separationMethod: string | null;
  errorMessage: string | null;
  hasOriginal: boolean;
  hasVocals: boolean;
  hasInstrumental: boolean;
  createdAt: string;
  completedAt: string | null;
}

export interface TrackInfo {
  id: string;
  job_id: string;
  title: string;
  artist: string;
  album: string | null;
  release_year: string | null;
  genre: string | null;
  artwork_url: string | null;
  confidence: number;
  start_time: number;
  end_time: number;
  duration_detected: number;
  source_name: string | null;
  source_url: string | null;
  license_type: string | null;
  download_available: number; // 0 or 1
  download_format: string | null;
  download_quality: string | null;
  download_url: string | null;
  preview_audio_url: string | null;
}

export interface DebugLog {
  id: number;
  job_id: string;
  stage: string;
  level: string;
  message: string;
  data_json: string | null;
  timestamp: string;
}

export interface SampleItem {
  id: string;
  name: string;
  filename: string;
  description: string;
  type: 'video' | 'audio';
  duration: number;
}
