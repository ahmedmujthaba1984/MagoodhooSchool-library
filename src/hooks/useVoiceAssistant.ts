import { useState, useRef, useCallback } from 'react';
import { transcribeVoiceAudio } from '../services/ai/voiceService';

interface UseVoiceAssistantOptions {
  language?: 'en' | 'dv';
  onTranscript: (text: string) => void;
  onError?: (msg: string) => void;
}

export function useVoiceAssistant({ language = 'en', onTranscript, onError }: UseVoiceAssistantOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  const tryWebSpeechFallback = useCallback(() => {
    if (typeof window === 'undefined') return false;
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) return false;

    try {
      const rec = new SpeechRec();
      rec.lang = language === 'dv' ? 'dv-MV' : 'en-US';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      setIsRecording(true);

      rec.onresult = (event: any) => {
        const transcript = event?.results?.[0]?.[0]?.transcript || '';
        setIsRecording(false);
        if (transcript.trim()) onTranscript(transcript.trim());
      };
      rec.onerror = () => {
        setIsRecording(false);
        onError?.(
          language === 'dv'
            ? 'މައިކްރޯފޯން ބޭނުންކުރުމުގައި މައްސަލައެއް ޖެހިއްޖެ.'
            : 'Voice capture unavailable. Please check microphone permissions.'
        );
      };
      rec.onend = () => setIsRecording(false);
      rec.start();
      return true;
    } catch {
      return false;
    }
  }, [language, onTranscript, onError]);

  const startRecording = useCallback(async () => {
    if (isRecording) {
      stopRecording();
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      const started = tryWebSpeechFallback();
      if (!started) {
        onError?.(
          language === 'dv'
            ? 'މި ބްރައުޒާގައި އަޑު ރެކޯޑް ކުރުމުގެ ޚިދުމަތް ސަޕޯޓެއް ނުކުރޭ.'
            : 'Microphone recording is not supported in this browser.'
        );
      }
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const preferredMime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const recorder = preferredMime ? new MediaRecorder(stream, { mimeType: preferredMime }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        stopStream();
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size < 200) {
          return;
        }
        setIsTranscribing(true);
        try {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error('Failed to encode audio'));
            reader.readAsDataURL(blob);
          });
          const res = await transcribeVoiceAudio({
            audioBase64: base64,
            mimeType: recorder.mimeType || 'audio/webm',
            language,
          });
          if (res?.transcript) {
            onTranscript(res.transcript.trim());
          } else {
            onError?.(
              language === 'dv'
                ? 'އަޑު ލިޔުމަށް ބަދަލުނުކުރެވުނު. އަލުން ވާހަކަދައްކާލައްވާ.'
                : 'Could not transcribe audio. Please speak clearly and try again.'
            );
          }
        } catch {
          onError?.(
            language === 'dv'
              ? 'ވޮއިސް ސާވަރާ ގުޅުމުގައި މައްސަލައެއް ޖެހިއްޖެ.'
              : 'Voice transcription service unavailable.'
          );
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.start();
      setIsRecording(true);
    } catch {
      stopStream();
      const started = tryWebSpeechFallback();
      if (!started) {
        onError?.(
          language === 'dv'
            ? 'މައިކްރޯފޯން ހުއްދަ ދެއްވާ!'
            : 'Microphone access denied. Enable mic permissions to use voice search.'
        );
      }
    }
  }, [isRecording, language, onError, onTranscript, stopRecording, stopStream, tryWebSpeechFallback]);

  return {
    isRecording,
    isTranscribing,
    startRecording,
    stopRecording,
    toggleRecording: startRecording,
  };
}
