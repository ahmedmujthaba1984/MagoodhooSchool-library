import { AiServiceStatus } from './schemas';

export interface AiFetchOptions {
  method?: 'POST' | 'GET';
  retries?: number;
  baseDelayMs?: number;
  validator?: (raw: unknown) => any;
}

const TRANSIENT_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function safeAiJsonFetch<T = any>(
  url: string,
  bodyData?: unknown,
  methodOrOptions: 'POST' | 'GET' | AiFetchOptions = 'POST'
): Promise<T | null> {
  const opts: AiFetchOptions =
    typeof methodOrOptions === 'string' ? { method: methodOrOptions } : methodOrOptions;
  const method = opts.method || 'POST';
  const retries = opts.retries ?? 2;
  const baseDelayMs = opts.baseDelayMs ?? 450;

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return null;
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method,
        headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
        body: method === 'POST' ? JSON.stringify(bodyData) : undefined,
      });

      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const text = await res.text();
        try {
          const parsed = JSON.parse(text);
          if (opts.validator) {
            const validated = opts.validator(parsed);
            if (validated) return validated as T;
            console.warn(`Schema validation failed for ${url}`);
            return null;
          }
          return parsed as T;
        } catch (e) {
          console.warn(`JSON parse error from ${url}:`, e);
          return null;
        }
      }

      if (TRANSIENT_STATUS_CODES.has(res.status) && attempt < retries) {
        await wait(baseDelayMs * Math.pow(2, attempt));
        continue;
      }
      return null;
    } catch (err) {
      if (attempt < retries) {
        await wait(baseDelayMs * Math.pow(2, attempt));
        continue;
      }
      console.warn(`Network fetch note for ${url}:`, err);
    }
  }
  return null;
}

export async function fetchAiServiceStatus(): Promise<AiServiceStatus> {
  const status = await safeAiJsonFetch<AiServiceStatus>('/api/ai/status', undefined, {
    method: 'GET',
    retries: 1,
  });
  if (status) return status;
  return {
    configured: false,
    primaryModel: 'gemini-4-hydrogen',
    fallbackModel: 'gemini-3.1-flash-lite',
    voiceModel: 'gemini-3.5-transcribe',
    offlineFallbackReady: true,
    capabilities: ['opac-nlq', 'curriculum-match', 'overdue-insights', 'reminder-drafter'],
  };
}
