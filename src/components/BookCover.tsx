import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen } from 'lucide-react';

export interface BookCoverProps {
  src?: string;
  alt?: string;
  title?: string | null;
  author?: string | null;
  ddcCallNumber?: string | null;
  category?: string | null;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  aspectRatio?: '2/3' | 'none';
}

interface ClothTheme {
  bg: string;
  spine: string;
  accent: string;
  goldText: string;
  creamText: string;
}

const CLOTH_THEMES: ClothTheme[] = [
  {
    // Heritage Emerald Cloth
    bg: 'bg-gradient-to-br from-[#0F4C45] via-[#0B3B35] to-[#072924]',
    spine: 'bg-[#072924]/70',
    accent: 'text-[#E7C67A]',
    goldText: 'text-[#F3DFB1]',
    creamText: 'text-[#F7F5F0]',
  },
  {
    // Archival Navy Cloth
    bg: 'bg-gradient-to-br from-[#192D4A] via-[#132238] to-[#0C1726]',
    spine: 'bg-[#0A1320]/70',
    accent: 'text-[#E7C67A]',
    goldText: 'text-[#F3DFB1]',
    creamText: 'text-[#F7F5F0]',
  },
  {
    // Classic Burgundy Cloth
    bg: 'bg-gradient-to-br from-[#5B212E] via-[#471823] to-[#300F17]',
    spine: 'bg-[#280B12]/70',
    accent: 'text-[#F3D79A]',
    goldText: 'text-[#F7E5BE]',
    creamText: 'text-[#FAF6F0]',
  },
  {
    // Warm Ochre / Terracotta Cloth
    bg: 'bg-gradient-to-br from-[#7B4626] via-[#62361C] to-[#472512]',
    spine: 'bg-[#3A1D0D]/70',
    accent: 'text-[#F7DDA4]',
    goldText: 'text-[#FAE9C5]',
    creamText: 'text-[#FDF9F2]',
  },
  {
    // Deep Charcoal Olive Cloth
    bg: 'bg-gradient-to-br from-[#2B3330] via-[#1F2623] to-[#151A18]',
    spine: 'bg-[#101412]/70',
    accent: 'text-[#D6B46C]',
    goldText: 'text-[#EFE0B9]',
    creamText: 'text-[#F5F3EE]',
  },
];

function pickClothTheme(seed: string): ClothTheme {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return CLOTH_THEMES[Math.abs(hash) % CLOTH_THEMES.length];
}

export const BookCover: React.FC<BookCoverProps> = ({
  src,
  alt,
  title,
  author,
  ddcCallNumber,
  category,
  className = 'w-full h-full object-cover',
  size = 'md',
  aspectRatio = '2/3',
}) => {
  const safeTitle = (title ?? alt ?? '').trim() || 'Untitled Catalog Volume';
  const safeAuthor = (author ?? '').trim();
  const safeDdc = (ddcCallNumber ?? '').trim();
  const rawSrc = (src ?? '').trim();
  const cleanSrc =
    !rawSrc ||
    /^(none|null|undefined|n\/a|about:blank)$/i.test(rawSrc)
      ? ''
      : rawSrc;

  const imgRef = React.useRef<HTMLImageElement | null>(null);
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setHasError(false);
    setIsLoaded(false);
  }, [cleanSrc]);

  // Catch cached blank 1x1 pixel images that finish loading before onLoad fires
  useEffect(() => {
    const img = imgRef.current;
    if (!img || !cleanSrc || hasError) return;
    if (img.complete) {
      if (img.naturalWidth < 10 || img.naturalHeight < 10) {
        setHasError(true);
      } else {
        setIsLoaded(true);
      }
    }
  }, [cleanSrc, hasError]);

  const cloth = useMemo(
    () => pickClothTheme(`${category ?? ''}:${safeTitle}`),
    [category, safeTitle]
  );

  // Detect callers like w-8 h-11 or w-9 h-12 where size classes live in className
  const hasExplicitDimensions = /\b(w-\d+|w-\[|h-\d+|h-\[)/.test(className) && !/\bw-full\b/.test(className);
  const wrapperSizing = hasExplicitDimensions
    ? className
    : aspectRatio === 'none'
    ? 'w-full h-full'
    : 'aspect-[2/3] w-full';

  const imgClasses = hasExplicitDimensions ? 'w-full h-full object-cover' : className;

  const renderFallback = () => {
    if (size === 'xs' || hasExplicitDimensions) {
      return (
        <div
          className={`relative overflow-hidden ${wrapperSizing} ${cloth.bg} cloth-cover-weave book-spine-highlight text-white p-1 flex flex-col items-center justify-center select-none text-center`}
          aria-label={safeTitle}
        >
          <BookOpen className={`w-3.5 h-3.5 ${cloth.accent} shrink-0`} />
          {safeDdc && (
            <span className={`text-[7px] font-mono tabular-nums ${cloth.goldText} leading-none mt-0.5 truncate max-w-full`}>
              <bdi dir="ltr">{safeDdc.replace(/^DDC\s*/i, '')}</bdi>
            </span>
          )}
        </div>
      );
    }

    return (
      <div
        className={`relative overflow-hidden ${wrapperSizing} ${cloth.bg} cloth-cover-weave book-spine-highlight p-3.5 flex flex-col justify-between select-none`}
        aria-label={safeTitle}
      >
        {/* Subtle debossed spine crease channel on logical start edge */}
        <div
          className={`absolute inset-y-0 start-0 w-2.5 ${cloth.spine} border-e border-white/15`}
          aria-hidden="true"
        />

        {/* Subtle inset gilt frame */}
        <div
          className="absolute inset-2 start-3.5 border border-[#E7C67A]/25 rounded-sm pointer-events-none"
          aria-hidden="true"
        />

        <div className="relative z-10 flex items-center justify-between gap-1.5 ps-2.5">
          <BookOpen className={`w-3.5 h-3.5 ${cloth.accent} shrink-0`} strokeWidth={1.75} />
          {safeDdc ? (
            <span className={`text-[9px] font-mono tabular-nums tracking-wide ${cloth.goldText} truncate`}>
              <bdi dir="ltr">{safeDdc}</bdi>
            </span>
          ) : (
            <span className={`text-[8px] font-mono tracking-widest uppercase ${cloth.goldText}/80`}>
              MAGOODHOO
            </span>
          )}
        </div>

        <div className="relative z-10 space-y-1.5 my-auto ps-2.5 pe-1">
          <div
            className={`${
              size === 'sm' ? 'text-[11px]' : 'text-[13px]'
            } font-bold leading-snug line-clamp-4 ${cloth.creamText} tracking-tight`}
          >
            <bdi>{safeTitle}</bdi>
          </div>
          {safeAuthor && size !== 'sm' && (
            <div className={`text-[10px] ${cloth.goldText} opacity-90 truncate leading-relaxed font-medium`}>
              <bdi>{safeAuthor}</bdi>
            </div>
          )}
        </div>

        <div className="relative z-10 ps-2.5 flex items-center justify-between gap-2">
          <div className="h-[1.5px] w-7 bg-[#C26D3A]" />
          {category && size === 'lg' && (
            <span className={`text-[9px] ${cloth.goldText} opacity-80 truncate max-w-[65%]`}>
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
    <div className={`relative overflow-hidden bg-[#EFECE6] dark:bg-[#232724] ${wrapperSizing}`}>
      {!isLoaded && (
        <div className="absolute inset-0 shimmer-skeleton" aria-hidden="true" />
      )}
      <img
        ref={imgRef}
        src={cleanSrc}
        alt={alt || `${safeTitle}${safeAuthor ? ` — ${safeAuthor}` : ''}`}
        referrerPolicy="no-referrer"
        loading="lazy"
        decoding="async"
        onLoad={(e) => {
          const el = e.currentTarget;
          if (el.naturalWidth < 10 || el.naturalHeight < 10) {
            setHasError(true);
            return;
          }
          setIsLoaded(true);
        }}
        onError={() => setHasError(true)}
        className={`${imgClasses} transition-opacity duration-200 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
      {/* Tactile Spine Highlight Overlay */}
      <div className="absolute inset-0 book-spine-highlight pointer-events-none" aria-hidden="true" />
    </div>
  );
};
