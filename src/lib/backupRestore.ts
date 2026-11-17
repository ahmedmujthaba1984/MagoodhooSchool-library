import {
  AcquisitionRequest,
  AuditLogEntry,
  Book,
  LedgerTransaction,
  LibrarySettings,
  LibrarySnapshotArchive,
  LibrarySnapshotData,
  Loan,
  PersonalItem,
  Reservation,
  UserProfile
} from '../types';

export const BACKUP_SCHEMA_VERSION = '2.0.0';
export const BACKUP_APP_ID = 'magoodhoo-school-library';

function computePayloadChecksum(data: LibrarySnapshotData): string {
  const canonical = JSON.stringify(data);
  let hash = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `FNV1A-${(hash >>> 0).toString(16).padStart(8, '0').toUpperCase()}`;
}

export function countPhysicalCopies(books: Book[]): number {
  return books.reduce(
    (sum, b) => sum + (b.copies?.length || b.totalCopies || 1),
    0
  );
}

export function createSnapshotArchive(params: {
  books: Book[];
  users: UserProfile[];
  loans: Loan[];
  reservations: Reservation[];
  ledgerTransactions: LedgerTransaction[];
  acquisitions: AcquisitionRequest[];
  personalItems: PersonalItem[];
  auditLogs: AuditLogEntry[];
  settings: LibrarySettings;
  exportedBy: string;
}): LibrarySnapshotArchive {
  const data: LibrarySnapshotData = {
    books: params.books,
    users: params.users,
    loans: params.loans,
    reservations: params.reservations,
    ledgerTransactions: params.ledgerTransactions,
    acquisitions: params.acquisitions,
    personalItems: params.personalItems,
    auditLogs: params.auditLogs,
    settings: params.settings,
  };

  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appId: BACKUP_APP_ID,
    exportedAt: new Date().toISOString(),
    exportedBy: params.exportedBy,
    encrypted: false,
    checksum: computePayloadChecksum(data),
    counts: {
      titles: params.books.length,
      copies: countPhysicalCopies(params.books),
      patrons: params.users.length,
      loans: params.loans.length,
      reservations: params.reservations.length,
      ledgerTransactions: params.ledgerTransactions.length,
      acquisitions: params.acquisitions.length,
      auditLogs: params.auditLogs.length,
    },
    data,
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveAesKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function serializeSnapshotArchive(
  archive: LibrarySnapshotArchive,
  passphrase?: string
): Promise<string> {
  const trimmedPass = (passphrase || '').trim();
  if (!trimmedPass || typeof crypto === 'undefined' || !crypto.subtle) {
    return JSON.stringify(archive, null, 2);
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(trimmedPass, salt);
  const encoded = new TextEncoder().encode(JSON.stringify(archive.data));
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );

  const envelope = {
    schemaVersion: archive.schemaVersion,
    appId: archive.appId,
    exportedAt: archive.exportedAt,
    exportedBy: archive.exportedBy,
    encrypted: true,
    algorithm: 'PBKDF2-AES-256-GCM',
    saltB64: bytesToBase64(salt),
    ivB64: bytesToBase64(iv),
    checksum: archive.checksum,
    counts: archive.counts,
    ciphertextB64: bytesToBase64(new Uint8Array(cipherBuffer)),
  };

  return JSON.stringify(envelope, null, 2);
}

export interface SnapshotValidationResult {
  valid: boolean;
  error?: string;
  requiresPassphrase?: boolean;
  archive?: LibrarySnapshotArchive;
}

export async function parseAndValidateSnapshot(
  rawText: string,
  passphrase?: string
): Promise<SnapshotValidationResult> {
  let parsed: any;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { valid: false, error: 'Invalid JSON syntax. Select a valid Magoodhoo ILS backup file.' };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, error: 'Backup root must be a JSON object.' };
  }
  if (parsed.appId !== BACKUP_APP_ID) {
    return {
      valid: false,
      error: `Unrecognized archive appId "${parsed.appId || 'missing'}". Expected "${BACKUP_APP_ID}".`,
    };
  }
  if (parsed.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    return {
      valid: false,
      error: `Incompatible schemaVersion "${parsed.schemaVersion || 'missing'}". Expected "${BACKUP_SCHEMA_VERSION}".`,
    };
  }

  let dataPayload: any = parsed.data;

  if (parsed.encrypted) {
    const trimmed = (passphrase || '').trim();
    if (!trimmed) {
      return {
        valid: false,
        requiresPassphrase: true,
        error: 'This snapshot archive is AES-256 encrypted. Enter the backup passphrase to unlock and validate.',
      };
    }
    try {
      const salt = base64ToBytes(parsed.saltB64);
      const iv = base64ToBytes(parsed.ivB64);
      const cipher = base64ToBytes(parsed.ciphertextB64);
      const key = await deriveAesKey(trimmed, salt);
      const plainBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as unknown as BufferSource }, key, cipher as unknown as BufferSource);
      dataPayload = JSON.parse(new TextDecoder().decode(plainBuffer));
    } catch {
      return {
        valid: false,
        requiresPassphrase: true,
        error: 'Incorrect backup passphrase or corrupted encrypted payload.',
      };
    }
  }

  if (!dataPayload || typeof dataPayload !== 'object') {
    return { valid: false, error: 'Backup archive is missing its "data" payload object.' };
  }

  const requiredArrays: Array<keyof LibrarySnapshotData> = [
    'books',
    'users',
    'loans',
    'reservations',
    'ledgerTransactions',
  ];

  for (const key of requiredArrays) {
    if (!Array.isArray(dataPayload[key])) {
      return {
        valid: false,
        error: `Schema validation failed: "data.${key}" must be an array.`,
      };
    }
  }

  if (!dataPayload.settings || typeof dataPayload.settings !== 'object') {
    return { valid: false, error: 'Schema validation failed: "data.settings" object is required.' };
  }

  const normalizedData: LibrarySnapshotData = {
    books: dataPayload.books,
    users: dataPayload.users,
    loans: dataPayload.loans,
    reservations: dataPayload.reservations,
    ledgerTransactions: dataPayload.ledgerTransactions,
    acquisitions: Array.isArray(dataPayload.acquisitions) ? dataPayload.acquisitions : [],
    personalItems: Array.isArray(dataPayload.personalItems) ? dataPayload.personalItems : [],
    auditLogs: Array.isArray(dataPayload.auditLogs) ? dataPayload.auditLogs : [],
    settings: dataPayload.settings,
  };

  if (parsed.checksum) {
    const expectedChecksum = computePayloadChecksum(normalizedData);
    if (expectedChecksum !== parsed.checksum) {
      return {
        valid: false,
        error: `Integrity checksum mismatch (${parsed.checksum} != ${expectedChecksum}). File may have been tampered with.`,
      };
    }
  }

  const archive: LibrarySnapshotArchive = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appId: BACKUP_APP_ID,
    exportedAt: parsed.exportedAt || new Date().toISOString(),
    exportedBy: parsed.exportedBy || 'Administrator',
    encrypted: Boolean(parsed.encrypted),
    checksum: parsed.checksum || computePayloadChecksum(normalizedData),
    counts: {
      titles: normalizedData.books.length,
      copies: countPhysicalCopies(normalizedData.books),
      patrons: normalizedData.users.length,
      loans: normalizedData.loans.length,
      reservations: normalizedData.reservations.length,
      ledgerTransactions: normalizedData.ledgerTransactions.length,
      acquisitions: normalizedData.acquisitions.length,
      auditLogs: normalizedData.auditLogs.length,
    },
    data: normalizedData,
  };

  return { valid: true, archive };
}

export function triggerSnapshotFileDownload(jsonContent: string, encrypted: boolean) {
  if (typeof document === 'undefined') return;
  const datePart = new Date().toISOString().split('T')[0];
  const ext = encrypted ? 'enc.json' : 'json';
  const filename = `magoodhoo-ils-snapshot-${datePart}.${ext}`;
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
