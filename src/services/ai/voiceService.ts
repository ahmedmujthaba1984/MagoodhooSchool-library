import { safeAiJsonFetch } from './client';

export interface VoiceTranscribeResponse {
  transcript: string;
  language?: 'en' | 'dv';
  confidence?: string;
}

export async function transcribeVoiceAudio(params: {
  audioBase64: string;
  mimeType?: string;
  language?: 'en' | 'dv';
}): Promise<VoiceTranscribeResponse | null> {
  return safeAiJsonFetch<VoiceTranscribeResponse>('/api/ai/transcribe', params);
}
