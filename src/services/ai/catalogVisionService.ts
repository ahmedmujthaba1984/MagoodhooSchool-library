import { safeAiJsonFetch } from './client';
import { CoverOcrResult, validateCoverOcrResult } from './schemas';
import { fetchExternalMetadata } from '../metadataFetcher';

export type { CoverOcrResult };

export interface BookInfo {
  description?: string;
  category?: string;
  publicationYear?: number;
  publisher?: string;
  shelfLocation?: string;
}

export interface IsbnLookupResult {
  source: string;
  found: boolean;
  isbn: string;
  upc?: string;
  title: string;
  author: string;
  publisher: string;
  publicationYear: number;
  pageCount?: number;
  coverUrl: string;
  category: string;
  subjects?: string[];
  language?: 'English' | 'Dhivehi' | 'Arabic' | 'Other';
  ddcCallNumber: string;
  description: string;
}

export async function generateAiBookInfo(params: {
  title: string;
  author: string;
  language?: 'en' | 'dv';
}): Promise<BookInfo> {
  const { title, author, language = 'en' } = params;
  const isDhivehi = language === 'dv';

  const serverData = await safeAiJsonFetch<BookInfo & { error?: string }>(
    '/api/ai/generate-book-info',
    { title, author, language },
    { method: 'POST', retries: 2 }
  );
  if (serverData && !serverData.error && serverData.description) {
    return serverData;
  }

  return {
    description: isDhivehi
      ? `މިއީ "${author}" ލިޔުއްވާފައިވާ "${title}" އާ ބެހޭ ތަޢުލީމީ މުހިންމު މަޢުލޫމާތުތަކާއި ޢިބުރަތްތެރި ވާހަކަތައް އެކުލެވޭ ފޮތެކެވެ.`
      : `An engaging educational book titled "${title}" written by ${author}.`,
    category: 'General Reading',
    publicationYear: new Date().getFullYear(),
    publisher: 'School Press',
    shelfLocation: 'Section A - General',
  };
}

export async function analyzeBookImagesWithSchema(params: {
  imageBase64: string;
  titlePageBase64?: string;
  mimeType?: string;
  titlePageMimeType?: string;
  language?: 'en' | 'dv';
}): Promise<CoverOcrResult> {
  const lang = params.language === 'dv' ? 'dv' : 'en';
  const serverData = await safeAiJsonFetch<CoverOcrResult>('/api/ai/cover-ocr', params, {
    method: 'POST',
    retries: 2,
    validator: (raw) => validateCoverOcrResult(raw, lang),
  });

  if (serverData) return serverData;

  const year = new Date().getFullYear();
  const isDv = lang === 'dv';
  const titleDv = isDv ? 'ދިވެހި އަދަބީ ފޮތް (އޮފްލައިން ސްކޭން)' : '';
  const titleEn = isDv ? 'Dhivehi Literature Volume (Offline Draft)' : 'Scanned Book (Verify Metadata)';

  return {
    title_en: titleEn,
    title_dv: titleDv,
    title: isDv ? titleDv : titleEn,
    authors: [isDv ? 'މަގޫދޫ ލިޔުންތެރިޔާ' : 'Verify Author Name'],
    author: isDv ? 'މަގޫދޫ ލިޔުންތެރިޔާ' : 'Verify Author Name',
    publisher: 'Local / NIE Press',
    publication_year: year,
    publicationYear: year,
    language: lang,
    bookLanguage: isDv ? 'Dhivehi' : 'English',
    ddc_code: isDv ? 'DDC 891.49' : 'DDC 823',
    ddcCallNumber: isDv ? 'DDC 891.49' : 'DDC 823',
    category: isDv ? 'Dhivehi Literature' : 'Fiction & Literature',
    grade_level: 'Grade 6',
    subjects: isDv
      ? ['Dhivehi Language', 'Maldivian Literature', 'School Reading']
      : ['School Reading', 'Literature', 'General Catalog'],
    tags: isDv
      ? ['Dhivehi Language', 'Maldivian Literature', 'School Reading']
      : ['School Reading', 'Literature', 'General Catalog'],
    synopsis: isDv
      ? 'އޮފްލައިން މޯޑުގައި އުފެދުނު ޑްރާފްޓް މަޢުލޫމާތެވެ. ބާކޯޑު ޕްރިންޓްކުރުމުގެ ކުރިން މަޢުލޫމާތު ޗެކްކޮށްލައްވާ.'
      : 'Offline metadata draft created from captured cover images. Verify title, DDC call number, and grade level before printing barcode.',
    description: isDv
      ? 'އޮފްލައިން މޯޑުގައި އުފެދުނު ޑްރާފްޓް މަޢުލޫމާތެވެ. ބާކޯޑު ޕްރިންޓްކުރުމުގެ ކުރިން މަޢުލޫމާތު ޗެކްކޮށްލައްވާ.'
      : 'Offline metadata draft created from captured cover images. Verify title, DDC call number, and grade level before printing barcode.',
    source: 'offline_fallback',
  };
}

export async function analyzeBookCoverOcr(params: {
  imageBase64: string;
  mimeType?: string;
  language?: 'en' | 'dv';
}): Promise<CoverOcrResult | null> {
  return analyzeBookImagesWithSchema(params);
}

export async function lookupIsbnMetadata(isbn: string): Promise<IsbnLookupResult | null> {
  const result = await fetchExternalMetadata(isbn);
  if (result) return result;
  return safeAiJsonFetch<IsbnLookupResult>(
    `/api/catalog/lookup?isbn=${encodeURIComponent(isbn)}`,
    undefined,
    { method: 'GET', retries: 1 }
  );
}
