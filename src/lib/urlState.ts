import { Language } from './i18n';

export type CatalogViewMode = 'grid' | 'table' | 'shelf';

export interface CatalogUrlFilters {
  q?: string;
  cat?: string;
  media?: string;
  type?: 'all' | 'circulating' | 'reference';
  status?: string;
  grade?: string;
  blang?: string;
  sort?: string;
  page?: number;
  view?: CatalogViewMode;
}

export interface ParsedUrlState {
  tab: string;
  bookId: string | null;
  patronId: string | null;
  lang: Language | null;
  catalogFilters: CatalogUrlFilters;
}

const TAB_TO_PATH: Record<string, string> = {
  catalog: '/catalog',
  dashboard: '/dashboard',
  'checkout-hub': '/circulation',
  students: '/patrons',
  'personal-library': '/personal',
  reports: '/analytics',
  acquisitions: '/acquisitions',
  stocktaking: '/stocktaking',
  'reading-challenges': '/challenges',
  'admin-panel': '/admin',
  'security-suite': '/security',
  'ai-assistant': '/ai',
  reference: '/reference',
  'my-borrowings': '/my-loans',
  'parent-portal': '/parent',
  faq: '/faq',
  login: '/login',
};

const PATH_TO_TAB: Record<string, string> = Object.entries(TAB_TO_PATH).reduce(
  (acc, [tab, route]) => {
    acc[route] = tab;
    return acc;
  },
  {} as Record<string, string>
);

export function normalizeCatalogView(raw: string | null): CatalogViewMode | undefined {
  if (!raw) return undefined;
  const v = raw.toLowerCase().trim();
  if (v === 'table' || v === 'list') return 'table';
  if (v === 'shelf' || v === 'shelves') return 'shelf';
  if (v === 'grid') return 'grid';
  return undefined;
}

export function parseUrlState(pathname: string, search: string): ParsedUrlState {
  const cleanPath = (pathname || '/').replace(/\/+$/, '') || '/';
  const params = new URLSearchParams(search || '');

  let tab = 'catalog';
  let bookId: string | null = params.get('book');
  let patronId: string | null = params.get('patron');

  if (cleanPath.startsWith('/catalog/book/')) {
    tab = 'catalog';
    const segment = decodeURIComponent(cleanPath.slice('/catalog/book/'.length));
    if (segment) bookId = segment;
  } else if (cleanPath.startsWith('/patrons/')) {
    tab = 'students';
    const segment = decodeURIComponent(cleanPath.slice('/patrons/'.length));
    if (segment) patronId = segment;
  } else if (PATH_TO_TAB[cleanPath]) {
    tab = PATH_TO_TAB[cleanPath];
  } else if (params.get('tab')) {
    tab = params.get('tab') || 'catalog';
  }

  const rawLang = params.get('lang');
  const lang: Language | null = rawLang === 'dv' || rawLang === 'en' ? rawLang : null;

  const rawType = params.get('type');
  const type =
    rawType === 'circulating' || rawType === 'reference' || rawType === 'all'
      ? rawType
      : undefined;

  const rawPage = Number(params.get('page'));
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : undefined;

  return {
    tab,
    bookId: bookId || null,
    patronId: patronId || null,
    lang,
    catalogFilters: {
      q: params.get('q') || undefined,
      cat: params.get('cat') || undefined,
      media: params.get('media') || undefined,
      type,
      status: params.get('status') || undefined,
      grade: params.get('grade') || undefined,
      blang: params.get('blang') || undefined,
      sort: params.get('sort') || undefined,
      page,
      view: normalizeCatalogView(params.get('view')),
    },
  };
}

export function buildUrlFromState(input: {
  tab: string;
  bookId?: string | null;
  patronId?: string | null;
  lang?: Language;
  catalogFilters?: CatalogUrlFilters;
}): string {
  let pathname = TAB_TO_PATH[input.tab] || '/catalog';

  if (input.tab === 'students' && input.patronId) {
    pathname = `/patrons/${encodeURIComponent(input.patronId)}`;
  }

  const params = new URLSearchParams();
  if (input.lang) {
    params.set('lang', input.lang);
  }

  if ((input.tab === 'catalog' || input.tab === 'add-book') && input.catalogFilters) {
    const f = input.catalogFilters;
    if (f.view) params.set('view', f.view);
    if (f.q && f.q.trim()) params.set('q', f.q.trim());
    if (f.cat && f.cat !== 'all') params.set('cat', f.cat);
    if (f.media && f.media !== 'all') params.set('media', f.media);
    if (f.type && f.type !== 'all') params.set('type', f.type);
    if (f.status && f.status !== 'all') params.set('status', f.status);
    if (f.grade && f.grade !== 'all') params.set('grade', f.grade);
    if (f.blang && f.blang !== 'all') params.set('blang', f.blang);
    if (f.sort && f.sort !== 'title-asc') params.set('sort', f.sort);
    if (f.page && f.page > 1) params.set('page', String(f.page));
  }

  if ((input.tab === 'catalog' || input.tab === 'add-book') && input.bookId) {
    params.set('book', input.bookId);
  }

  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function syncBrowserHistory(
  nextUrl: string,
  options: { replace?: boolean } = {}
): void {
  if (typeof window === 'undefined' || !window.history) return;
  const current = `${window.location.pathname}${window.location.search}`;
  if (current === nextUrl) return;
  try {
    if (options.replace) {
      window.history.replaceState(null, '', nextUrl);
    } else {
      window.history.pushState(null, '', nextUrl);
    }
  } catch {
    // Ignore restricted history frames
  }
}
