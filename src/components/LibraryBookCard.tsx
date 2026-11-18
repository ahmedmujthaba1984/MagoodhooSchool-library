import React from 'react';
import { MapPin, Bookmark } from 'lucide-react';
import { BookCover } from './BookCover';
import { StatusPill, CirculationStatusType } from './StatusPill';

export interface LibraryBookCardProps {
  title: string;
  author: string;
  coverUrl?: string;
  category?: string;
  ddcCallNumber?: string;
  barcode?: string;
  isbn?: string;
  shelfLocation?: string;
  targetGrade?: string;
  description?: string;
  availableCopies?: number;
  totalCopies?: number;
  isReferenceOnly?: boolean;
  holdsCount?: number;
  language?: 'en' | 'dv';
  variant?: 'catalog' | 'shelf' | 'personal';
  progressPct?: number;
  progressLabel?: string;
  statusOverride?: CirculationStatusType;
  statusLabelOverride?: string;
  onSelect?: () => void;
  footer?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export const LibraryBookCard: React.FC<LibraryBookCardProps> = ({
  title,
  author,
  coverUrl,
  category,
  ddcCallNumber,
  barcode,
  isbn,
  shelfLocation,
  targetGrade,
  description,
  availableCopies = 0,
  totalCopies = 0,
  isReferenceOnly = false,
  holdsCount = 0,
  language = 'en',
  variant = 'catalog',
  progressPct,
  progressLabel,
  statusOverride,
  statusLabelOverride,
  onSelect,
  footer,
  children,
  className = '',
}) => {
  const status: CirculationStatusType = statusOverride
    ? statusOverride
    : isReferenceOnly
    ? 'reference'
    : availableCopies > 0
    ? 'available'
    : 'checked_out';

  const statusLabel =
    statusLabelOverride ||
    (status === 'reference'
      ? language === 'dv'
        ? 'ރެފަރެންސް'
        : 'Reference'
      : status === 'available'
      ? language === 'dv'
        ? 'ލިބެންހުރި'
        : 'Available'
      : status === 'reserved'
      ? language === 'dv'
        ? 'ރިޒާވް'
        : 'On Hold'
      : status === 'overdue'
      ? language === 'dv'
        ? 'މުއްދަތު ހަމަވި'
        : 'Overdue'
      : language === 'dv'
      ? 'ދޫކުރެވިފައި'
      : 'Checked Out');

  const spineLabel = useMemoSpineLabel(ddcCallNumber, barcode, isbn);

  if (variant === 'shelf') {
    return (
      <article
        onClick={onSelect}
        className={`w-40 sm:w-44 shrink-0 snap-start bg-[#FFFFFF] dark:bg-[#1A1D1B] border border-[#E2DDD5] dark:border-[#2E3330] rounded-2xl overflow-hidden hover:border-[#0F4C45]/60 dark:hover:border-[#16655B] transition-all duration-200 cursor-pointer group flex flex-col book-cover-card ${className}`}
      >
        <div className="aspect-[2/3] w-full relative overflow-hidden bg-[#EFECE6] dark:bg-[#232724]">
          <BookCover
            src={coverUrl}
            title={title}
            author={author}
            ddcCallNumber={ddcCallNumber}
            category={category}
            size="sm"
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
          />

          {/* Live Copy Counter Pill */}
          <div className="absolute top-2 end-2">
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono tabular-nums font-bold shadow-xs border ${
                isReferenceOnly
                  ? 'bg-[#ECFDF5]/95 text-[#0F4C45] border-[#A7F3D0]'
                  : availableCopies > 0
                  ? 'bg-[#F0FDF4]/95 text-[#15803D] border-[#BBF7D0]'
                  : 'bg-[#EFF6FF]/95 text-[#1D4ED8] border-[#BFDBFE]'
              }`}
            >
              <bdi dir="ltr">
                {isReferenceOnly ? 'REF' : `${availableCopies}/${totalCopies}`}
              </bdi>
            </span>
          </div>

          {/* Spine Call-Number Sticker */}
          {spineLabel && (
            <div className="absolute bottom-2 start-2 max-w-[85%] bg-[#FFFDF7]/95 dark:bg-[#121413]/90 text-[#1C1917] dark:text-[#F5F3EE] border border-[#D6CFC3] dark:border-[#2E3330] px-1.5 py-0.5 rounded text-[9px] font-mono tabular-nums font-semibold truncate shadow-2xs">
              <bdi dir="ltr">{spineLabel}</bdi>
            </div>
          )}
        </div>

        <div className="p-3 space-y-1 flex-1 flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-[#1C1917] dark:text-[#F5F3EE] line-clamp-2 leading-snug group-hover:text-[#0F4C45] dark:group-hover:text-[#6EE7B7] transition-colors">
              <bdi>{title}</bdi>
            </h4>
            <p className="text-[11px] text-[#6B655D] dark:text-[#A19B91] truncate mt-0.5">
              <bdi>{author}</bdi>
            </p>
          </div>
          {shelfLocation && (
            <div className="text-[10px] font-mono text-[#0F4C45] dark:text-[#6EE7B7] truncate pt-1 flex items-center gap-1">
              <MapPin className="w-3 h-3 shrink-0" strokeWidth={1.75} />
              <bdi dir="ltr">{shelfLocation}</bdi>
            </div>
          )}
        </div>
      </article>
    );
  }

  return (
    <article
      className={`bg-[#FFFFFF] dark:bg-[#1A1D1B] border border-[#E2DDD5] dark:border-[#2E3330] rounded-2xl hover:border-[#0F4C45]/50 dark:hover:border-[#16655B] transition-all duration-200 flex flex-col justify-between overflow-hidden group ${className}`}
    >
      <div>
        {/* Tactile 2:3 Cover Stage on Sunken Archival Shelf Surface */}
        <div
          onClick={onSelect}
          className={`relative bg-[#EFECE6] dark:bg-[#232724] px-6 pt-5 pb-4 flex justify-center border-b border-[#E2DDD5]/80 dark:border-[#2E3330] ${
            onSelect ? 'cursor-pointer' : ''
          }`}
        >
          {/* Live Copy Counter / Progress Top Corner */}
          <div className="absolute top-3 end-3 z-10">
            {variant === 'personal' && typeof progressPct === 'number' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FFFFFF]/95 dark:bg-[#121413]/90 text-[#0F4C45] dark:text-[#6EE7B7] border border-[#E2DDD5] dark:border-[#2E3330] text-[10px] font-mono tabular-nums font-bold shadow-xs">
                <Bookmark className="w-3 h-3 text-[#C26D3A]" strokeWidth={1.75} />
                <bdi dir="ltr">{progressPct}%</bdi>
              </span>
            ) : (
              <StatusPill
                status={status}
                label={statusLabel}
                countPrefix={
                  !isReferenceOnly && totalCopies > 0
                    ? `${availableCopies}/${totalCopies}`
                    : undefined
                }
                compact
              />
            )}
          </div>

          {/* 2:3 Physical Book Frame */}
          <div className="relative w-36 sm:w-40 aspect-[2/3] rounded-md overflow-hidden book-cover-card border border-black/10 dark:border-white/10 group-hover:-translate-y-0.5 transition-transform duration-200">
            <BookCover
              src={coverUrl}
              title={title}
              author={author}
              ddcCallNumber={ddcCallNumber}
              category={category}
              size="md"
              className="w-full h-full object-cover"
            />

            {/* Ribbon Bookmark Progress Bar for Personal Shelf */}
            {variant === 'personal' && typeof progressPct === 'number' && (
              <div className="absolute inset-x-0 bottom-0 bg-[#121413]/85 backdrop-blur-xs px-2.5 py-1.5 space-y-1">
                <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-[#F5F3EE]">
                  <span>{progressLabel || `${progressPct}% Read`}</span>
                </div>
                <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#C26D3A] transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
                  />
                </div>
              </div>
            )}

            {/* Spine Call-Number Sticker for Catalog Books */}
            {variant !== 'personal' && spineLabel && (
              <div className="absolute bottom-2 start-2 max-w-[90%] bg-[#FFFDF7]/95 dark:bg-[#1A1D1B]/95 text-[#1C1917] dark:text-[#F5F3EE] border border-[#D6CFC3] dark:border-[#2E3330] px-1.5 py-0.5 rounded text-[9px] font-mono tabular-nums font-bold shadow-xs truncate">
                <bdi dir="ltr">{spineLabel}</bdi>
              </div>
            )}
          </div>
        </div>

        {/* Clean Unboxed Metadata Block */}
        <div className="p-4 space-y-2 text-xs">
          <div
            onClick={onSelect}
            className={onSelect ? 'cursor-pointer' : undefined}
          >
            <h3 className="font-bold text-sm text-[#1C1917] dark:text-[#F5F3EE] line-clamp-2 group-hover:text-[#0F4C45] dark:group-hover:text-[#6EE7B7] transition-colors leading-snug archival-heading">
              <bdi>{title}</bdi>
            </h3>
            <p className="text-xs text-[#6B655D] dark:text-[#A19B91] truncate mt-0.5 font-medium">
              <bdi>{author}</bdi>
            </p>
          </div>

          {/* Unboxed Metadata Line */}
          {(category || ddcCallNumber || targetGrade) && (
            <div className="text-[11px] text-[#6B655D] dark:text-[#A19B91] truncate leading-relaxed">
              {category && <span>{category}</span>}
              {ddcCallNumber && (
                <>
                  {category ? ' · ' : ''}
                  <bdi dir="ltr" className="font-mono text-[#1C1917] dark:text-[#E2DDD5]">
                    {ddcCallNumber}
                  </bdi>
                </>
              )}
              {targetGrade && (
                <>
                  {' · '}
                  <span>{targetGrade}</span>
                </>
              )}
            </div>
          )}

          {/* Live Copy Count + Shelf Location (RTL Safe) */}
          {variant !== 'personal' && (
            <div className="flex items-center gap-1.5 text-[#1C1917] dark:text-[#E2DDD5] font-semibold">
              <MapPin className="w-3.5 h-3.5 text-[#0F4C45] dark:text-[#6EE7B7] shrink-0" strokeWidth={1.75} />
              <span className="truncate text-[11px] leading-relaxed">
                {isReferenceOnly ? (
                  language === 'dv' ? (
                    <>
                      ރެފަރެންސް —{' '}
                      <bdi dir="ltr" className="font-mono">
                        {shelfLocation}
                      </bdi>
                    </>
                  ) : (
                    <>
                      In-Library Use —{' '}
                      <bdi dir="ltr" className="font-mono">
                        {shelfLocation}
                      </bdi>
                    </>
                  )
                ) : language === 'dv' ? (
                  <>
                    <bdi dir="ltr" className="font-mono tabular-nums">
                      {totalCopies}
                    </bdi>{' '}
                    ގެ ތެރެއިން{' '}
                    <bdi dir="ltr" className="font-mono tabular-nums">
                      {availableCopies}
                    </bdi>{' '}
                    ކޮޕީ ލިބެންހުރި —{' '}
                    <bdi dir="ltr" className="font-mono">
                      {shelfLocation}
                    </bdi>
                  </>
                ) : (
                  <>
                    <span className="font-mono tabular-nums">{availableCopies}</span> of{' '}
                    <span className="font-mono tabular-nums">{totalCopies}</span> on shelf —{' '}
                    <bdi dir="ltr" className="font-mono">
                      {shelfLocation}
                    </bdi>
                  </>
                )}
              </span>
            </div>
          )}

          {description && (
            <p className="text-[#6B655D] dark:text-[#A19B91] line-clamp-2 leading-relaxed text-xs">
              <bdi>{description}</bdi>
            </p>
          )}

          {children}

          {isbn && variant !== 'personal' && (
            <div className="flex items-center justify-between text-[11px] text-[#6B655D] dark:text-[#A19B91] pt-2 border-t border-[#E2DDD5]/70 dark:border-[#2E3330]">
              <span>
                ISBN{' '}
                <bdi dir="ltr" className="font-mono tabular-nums text-[#1C1917] dark:text-[#F5F3EE]">
                  {isbn}
                </bdi>
              </span>
              {holdsCount > 0 && (
                <span className="text-[#C26D3A] font-semibold">
                  <bdi dir="ltr" className="font-mono tabular-nums">
                    {holdsCount} {holdsCount === 1 ? 'hold' : 'holds'}
                  </bdi>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {footer && (
        <div className="p-3.5 bg-[#F7F5F0]/70 dark:bg-[#232724]/50 border-t border-[#E2DDD5] dark:border-[#2E3330]">
          {footer}
        </div>
      )}
    </article>
  );
};

function useMemoSpineLabel(ddc?: string, barcode?: string, isbn?: string): string {
  const ddcPart = (ddc || '').trim().replace(/^DDC\s*/i, '');
  const codePart = (barcode || '').trim();
  if (ddcPart && codePart) return `${ddcPart} | ${codePart}`;
  if (ddcPart) return `DDC ${ddcPart}`;
  if (codePart) return codePart;
  if (isbn) return isbn;
  return '';
}
