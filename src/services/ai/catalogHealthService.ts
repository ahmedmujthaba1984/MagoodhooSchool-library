import { Book } from '../../types';
import { safeAiJsonFetch } from './client';
import {
  CatalogHealthAiPatch,
  CatalogHealthAiResponse,
  validateCatalogHealthAiResponse,
} from './schemas';
import {
  generateDraftSynopsis,
  inferBookLanguage,
  inferDdcAndShelf,
  inferTargetGrade,
  normalizeAuthorName,
} from '../../lib/catalogHealth';

export async function enrichCatalogHealthProposals(params: {
  books: Book[];
  flaggedBookIds: string[];
}): Promise<CatalogHealthAiResponse> {
  const { books, flaggedBookIds } = params;
  const targetBooks = books
    .filter((b) => flaggedBookIds.includes(b.id))
    .slice(0, 25);

  if (targetBooks.length === 0) {
    return {
      summary: 'All checked catalog titles already meet metadata completeness standards.',
      source: 'deterministic_fallback',
      patches: [],
    };
  }

  const payload = {
    books: targetBooks.map((b) => ({
      id: b.id,
      title: b.title,
      author: b.author,
      category: b.category,
      bookLanguage: b.bookLanguage || '',
      ddcCallNumber: b.ddcCallNumber || '',
      targetGrade: b.targetGrade || '',
      description: b.description || '',
      shelfLocation: b.shelfLocation || '',
    })),
  };

  const serverRes = await safeAiJsonFetch<CatalogHealthAiResponse>(
    '/api/ai/catalog-health',
    payload,
    {
      method: 'POST',
      retries: 1,
      validator: validateCatalogHealthAiResponse,
    }
  );

  if (serverRes && serverRes.patches.length > 0) {
    return serverRes;
  }

  const fallbackPatches: CatalogHealthAiPatch[] = targetBooks.map((b) => {
    const ddc = inferDdcAndShelf(b);
    return {
      bookId: b.id,
      ddcCallNumber: b.ddcCallNumber || ddc.ddcCallNumber,
      shelfLocation: b.shelfLocation || ddc.shelfLocation,
      bookLanguage: b.bookLanguage || inferBookLanguage(b),
      targetGrade: b.targetGrade || inferTargetGrade(b),
      author: normalizeAuthorName(b.author),
      description: (b.description || '').trim().length >= 25 ? b.description : generateDraftSynopsis(b),
    };
  });

  return {
    summary: `Prepared structured metadata enrichment proposals for ${fallbackPatches.length} catalog title(s).`,
    source: 'deterministic_fallback',
    patches: fallbackPatches,
  };
}
