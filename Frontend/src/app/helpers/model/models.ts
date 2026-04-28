// models/camera.model.ts
export interface Camera {
  id: number;
  name: string;
  rtsp_url: string;
  location: string;
  status: 'active' | 'inactive' | 'maintenance';
  created_at: string;
}

export interface CameraListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Camera[];
}
export interface CameraDetailResponse {
  total_cameras: number;
  active_cameras: number;
  inactive_cameras: number;
  maintenance_cameras: number;
}
export interface CameraCreatePayload {
  name: string;
  rtsp_url: string;
  location: string;
  status?: 'active' | 'inactive' | 'maintenance';
}

export interface CameraStatusCounts {
  active: number;
  inactive: number;
  maintenance: number;
}

export interface MLModelAnalytics {
  id: number;
  name: string;
  total_violations: number;
}

export interface ViolationAnalytics {
  total_violations: number;
  ml_models: MLModelAnalytics[];
}

export interface MLModel {
  id: number;
  name: string;
  threshold_parameter: number;
}

export interface VideoUpload {
  id: number;
  file: string;
  file_url?: string | null;
  original_name: string;
  camera: number;
  camera_name: string;
  ml_model: number;
  model_name: string;
  use_case: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress_percent: string | number;
  processed_frames: number;
  total_frames: number | null;
  sample_fps: number;
  fps: number | null;
  duration_seconds: number | null;
  frame_width: number | null;
  frame_height: number | null;
  violations_count: number;
  error_message: string;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
  violation_results_url: string;
}

export interface VideoUploadListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: VideoUpload[];
}
