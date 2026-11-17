export interface ExternalMetadataResult {
  source: 'Open Library' | 'Google Books' | 'Crossref' | 'Manual Fallback';
  found: boolean;
  isbn: string;
  upc?: string;
  title: string;
  subtitle?: string;
  author: string;
  publisher: string;
  publicationYear: number;
  pageCount?: number;
  coverUrl: string;
  category: string;
  subjects: string[];
  language: 'English' | 'Dhivehi' | 'Arabic' | 'Other';
  ddcCallNumber: string;
  description: string;
}

function normalizeCoverUrl(url?: string): string {
  if (!url) return '';
  return url.replace(/^http:\/\//i, 'https://').replace('&edge=curl', '');
}

function mapLanguageCode(code?: string): 'English' | 'Dhivehi' | 'Arabic' | 'Other' {
  const norm = (code || '').toLowerCase().trim();
  if (norm === 'dv' || norm === 'div' || norm === 'dhivehi') return 'Dhivehi';
  if (norm === 'ar' || norm === 'ara' || norm === 'arabic') return 'Arabic';
  if (!norm || norm === 'en' || norm === 'eng' || norm === 'english') return 'English';
  return 'Other';
}

function cleanIdentifier(raw: string): string {
  return raw.replace(/[^0-9Xx]/g, '').trim();
}

async function fetchWithTimeout(url: string, timeoutMs = 6000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Queries Open Library Books API + Editions cover fallback directly.
 */
async function queryOpenLibraryDirect(code: string): Promise<ExternalMetadataResult | null> {
  try {
    const res = await fetchWithTimeout(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(code)}&format=json&jscmd=data`
    );
    if (!res.ok) return null;
    const json = await res.json();
    const entry = json?.[`ISBN:${code}`];
    if (!entry) return null;

    const subjects: string[] = Array.isArray(entry.subjects)
      ? entry.subjects.map((s: any) => (typeof s === 'string' ? s : s?.name)).filter(Boolean).slice(0, 5)
      : [];

    const coverUrl =
      normalizeCoverUrl(entry.cover?.large || entry.cover?.medium || entry.cover?.small) ||
      `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(code)}-L.jpg?default=false`;

    const ddcRaw = entry.classifications?.dewey_decimal_class?.[0];
    const yearMatch = String(entry.publish_date || '').match(/\d{4}/);

    return {
      source: 'Open Library',
      found: true,
      isbn: code,
      title: entry.title || 'Untitled Book',
      subtitle: entry.subtitle || undefined,
      author: Array.isArray(entry.authors) && entry.authors.length > 0
        ? entry.authors.map((a: any) => a.name).filter(Boolean).join(', ')
        : 'Unknown Author',
      publisher: Array.isArray(entry.publishers) && entry.publishers.length > 0
        ? entry.publishers.map((p: any) => p.name).filter(Boolean).join(', ')
        : 'Open Library Publisher',
      publicationYear: yearMatch ? parseInt(yearMatch[0], 10) : new Date().getFullYear(),
      pageCount: typeof entry.number_of_pages === 'number' ? entry.number_of_pages : undefined,
      coverUrl,
      category: subjects[0] || 'General Literature',
      subjects,
      language: 'English',
      ddcCallNumber: ddcRaw ? `DDC ${ddcRaw}` : 'DDC 800',
      description:
        (typeof entry.notes === 'string' ? entry.notes : entry.notes?.value) ||
        entry.subtitle ||
        `Cataloged via Open Library (ISBN ${code}).`
    };
  } catch {
    return null;
  }
}

/**
 * Queries Google Books Volumes API by ISBN or UPC/EAN identifier.
 */
async function queryGoogleBooksDirect(code: string): Promise<ExternalMetadataResult | null> {
  const queries = [`isbn:${code}`, code];
  for (const q of queries) {
    try {
      const res = await fetchWithTimeout(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=1`
      );
      if (!res.ok) continue;
      const data = await res.json();
      const info = data?.items?.[0]?.volumeInfo;
      if (!info) continue;

      const highRes =
        info.imageLinks?.extraLarge ||
        info.imageLinks?.large ||
        info.imageLinks?.medium ||
        info.imageLinks?.thumbnail ||
        info.imageLinks?.smallThumbnail ||
        '';

      const categories: string[] = Array.isArray(info.categories) ? info.categories.slice(0, 5) : [];

      return {
        source: 'Google Books',
        found: true,
        isbn: code,
        upc: code.length === 12 ? code : undefined,
        title: info.title || 'Untitled Book',
        subtitle: info.subtitle || undefined,
        author: Array.isArray(info.authors) && info.authors.length > 0
          ? info.authors.join(', ')
          : 'Unknown Creator',
        publisher: info.publisher || 'Publisher',
        publicationYear: parseInt(String(info.publishedDate || '').slice(0, 4), 10) || new Date().getFullYear(),
        pageCount: typeof info.pageCount === 'number' ? info.pageCount : undefined,
        coverUrl: normalizeCoverUrl(highRes) || '/covers/classic_literature.jpg',
        category: categories[0] || 'General Literature',
        subjects: categories,
        language: mapLanguageCode(info.language),
        ddcCallNumber: 'DDC 800',
        description: info.description || info.subtitle || `Retrieved via Google Books (${code}).`
      };
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Fetches rich bibliographic metadata from server proxy (/api/catalog/lookup)
 * and client-side Open Library & Google Books APIs with clean fallback.
 */
export async function fetchExternalMetadata(rawCode: string): Promise<ExternalMetadataResult | null> {
  const cleanCode = cleanIdentifier(rawCode);
  if (!cleanCode) return null;

  // 1. Try local backend lookup proxy first (avoids browser CORS issues on restricted networks)
  if (typeof window !== 'undefined' && navigator.onLine) {
    try {
      const serverRes = await fetchWithTimeout(`/api/catalog/lookup?isbn=${encodeURIComponent(cleanCode)}`, 5000);
      if (serverRes.ok) {
        const data = await serverRes.json();
        if (data && data.found) {
          return {
            source: data.source || 'Open Library',
            found: true,
            isbn: data.isbn || cleanCode,
            upc: cleanCode.length === 12 ? cleanCode : undefined,
            title: data.title || 'Untitled Book',
            author: data.author || 'Unknown Author',
            publisher: data.publisher || 'Publisher',
            publicationYear: Number(data.publicationYear) || new Date().getFullYear(),
            pageCount: data.pageCount ? Number(data.pageCount) : undefined,
            coverUrl: normalizeCoverUrl(data.coverUrl) || '/covers/classic_literature.jpg',
            category: data.category || 'General Literature',
            subjects: Array.isArray(data.subjects) ? data.subjects : data.category ? [data.category] : [],
            language: mapLanguageCode(data.language),
            ddcCallNumber: data.ddcCallNumber || 'DDC 800',
            description: data.description || ''
          };
        }
      }
    } catch {
      // Fall through to direct browser requests
    }
  }

  // 2. Direct Open Library API
  const olResult = await queryOpenLibraryDirect(cleanCode);
  if (olResult) return olResult;

  // 3. Direct Google Books API (supports ISBN and UPC fallback)
  const gbResult = await queryGoogleBooksDirect(cleanCode);
  if (gbResult) return gbResult;

  return null;
}
