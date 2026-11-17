import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen } from 'lucide-react';

export interface BookCoverProps {
  src?: string;
  title?: string | null;
  author?: string | null;
  ddcCallNumber?: string | null;
  category?: string | null;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

const COVER_PALETTES = [
  'from-emerald-950 via-emerald-900 to-slate-900 border-emerald-700/40',
  'from-slate-900 via-indigo-950 to-slate-950 border-indigo-700/40',
  'from-teal-950 via-slate-900 to-cyan-950 border-teal-700/40',
  'from-slate-900 via-slate-800 to-emerald-950 border-slate-700/40',
  'from-amber-950 via-slate-900 to-stone-950 border-amber-700/40',
  'from-sky-950 via-slate-900 to-indigo-950 border-sky-700/40',
];

function pickPalette(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return COVER_PALETTES[Math.abs(hash) % COVER_PALETTES.length];
}

export const BookCover: React.FC<BookCoverProps> = ({
  src,
  title,
  author,
  ddcCallNumber,
  category,
  className = 'w-full h-full object-cover',
  size = 'md',
}) => {
  const safeTitle = (title ?? '').trim() || 'Untitled Catalog Volume';
  const safeAuthor = (author ?? '').trim();
  const safeDdc = (ddcCallNumber ?? '').trim();
  const cleanSrc = (src ?? '').trim();

  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setHasError(false);
    setIsLoaded(false);
  }, [cleanSrc]);

  const palette = useMemo(
    () => pickPalette(`${category ?? ''}:${safeTitle}`),
    [category, safeTitle]
  );

  const renderFallback = () => {
    if (size === 'xs') {
      return (
        <div
          className={`w-full h-full bg-gradient-to-br ${palette} text-white p-1 flex flex-col items-center justify-center select-none text-center`}
          aria-label={safeTitle}
        >
          <BookOpen className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
          {safeDdc && (
            <span className="text-[7px] font-mono tabular-nums text-slate-200 leading-none mt-0.5 truncate max-w-full">
              <bdi dir="ltr">{safeDdc.replace(/^DDC\s*/i, '')}</bdi>
            </span>
          )}
        </div>
      );
    }

    return (
      <div
        className={`w-full h-full bg-gradient-to-br ${palette} text-white p-3 flex flex-col justify-between select-none relative overflow-hidden`}
        aria-label={safeTitle}
      >
        {/* Subtle decorative spine stripe */}
        <div className="absolute inset-y-0 start-0 w-1 bg-emerald-400/50" aria-hidden="true" />

        <div className="flex items-center justify-between gap-1.5 ps-1.5">
          <BookOpen className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
          {safeDdc ? (
            <span className="text-[9px] font-mono tabular-nums tracking-wide text-emerald-200/90 truncate">
              <bdi dir="ltr">{safeDdc}</bdi>
            </span>
          ) : (
            <span className="text-[9px] font-mono tracking-wider uppercase text-slate-300/80">
              MAGOODHOO
            </span>
          )}
        </div>

        <div className="space-y-1 my-auto ps-1.5">
          <div
            className={`${
              size === 'sm' ? 'text-[10px]' : 'text-xs'
            } font-bold leading-relaxed line-clamp-3 text-slate-50`}
          >
            <bdi>{safeTitle}</bdi>
          </div>
          {safeAuthor && size !== 'sm' && (
            <div className="text-[10px] text-slate-300/85 truncate leading-relaxed">
              <bdi>{safeAuthor}</bdi>
            </div>
          )}
        </div>

        <div className="ps-1.5 flex items-center justify-between gap-2">
          <div className="h-0.5 w-8 bg-emerald-400/60 rounded-full" />
          {category && size === 'lg' && (
            <span className="text-[9px] text-slate-300/80 truncate max-w-[65%]">
              {category}
            </span>
          )}
        </div>
      </div>
    );
  };

  if (!cleanSrc || hasError) {
    return renderFallback();
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-200 dark:bg-slate-800">
      {!isLoaded && (
        <div
          className="absolute inset-0 shimmer-skeleton"
          aria-hidden="true"
        />
      )}
      <img
        src={cleanSrc}
        alt={`${safeTitle}${safeAuthor ? ` — ${safeAuthor}` : ''}`}
        referrerPolicy="no-referrer"
        loading="lazy"
        decoding="async"
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
        className={`${className} transition-opacity duration-200 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
};
