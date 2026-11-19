import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, LayoutGrid, Columns3 } from 'lucide-react';

export interface HorizontalBookShelfProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  headerActions?: React.ReactNode;
  itemCount?: number;
  language?: 'en' | 'dv';
  defaultExpanded?: boolean;
  allowGridToggle?: boolean;
  scrollStep?: number;
  gridClassName?: string;
  trackClassName?: string;
  containerClassName?: string;
  children: React.ReactNode;
}

/**
 * Reusable Horizontal Book Shelf with:
 * - Floating RTL/LTR-aware start/end chevron navigation buttons (auto-disabled at boundaries)
 * - Smart desktop mouse-wheel vertical-to-horizontal scroll (releases back to vertical at edges)
 * - Click-and-drag mouse scrolling (suppressing accidental card clicks during drag)
 * - Touch swipe momentum + subtle thin scrollbar indicator
 * - "View All / Grid View" toggle expanding the shelf into a multi-row responsive grid
 */
export const HorizontalBookShelf: React.FC<HorizontalBookShelfProps> = ({
  title,
  subtitle,
  icon,
  headerActions,
  itemCount,
  language = 'en',
  defaultExpanded = false,
  allowGridToggle = true,
  scrollStep = 480,
  gridClassName = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4',
  trackClassName = 'gap-4',
  containerClassName = 'bg-[#EFECE6]/90 dark:bg-[#232724]/85 border border-[#E2DDD5] dark:border-[#2E3330] rounded-3xl p-4 sm:p-5 space-y-3.5 shelf-ledge',
  children,
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [canScrollStart, setCanScrollStart] = useState(false);
  const [canScrollEnd, setCanScrollEnd] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Drag state refs (kept in refs to avoid re-renders on pointermove)
  const pointerDownRef = useRef(false);
  const dragMovedRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartScrollLeftRef = useRef(0);

  const isElementRtl = useCallback((el: HTMLElement): boolean => {
    if (typeof window === 'undefined') return language === 'dv';
    return window.getComputedStyle(el).direction === 'rtl';
  }, [language]);

  const updateScrollBounds = useCallback(() => {
    const el = trackRef.current;
    if (!el || isExpanded) {
      setCanScrollStart(false);
      setCanScrollEnd(false);
      return;
    }

    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    if (maxScroll <= 4) {
      setCanScrollStart(false);
      setCanScrollEnd(false);
      return;
    }

    const rtl = isElementRtl(el);
    // Modern browsers (Chrome, Firefox, Safari) use negative scrollLeft in RTL (0 -> -maxScroll).
    // Taking Math.abs normalizes offset from logical start (0) to logical end (maxScroll).
    const rawOffset = rtl ? Math.abs(el.scrollLeft) : el.scrollLeft;
    const clampedOffset = Math.min(maxScroll, Math.max(0, rawOffset));

    setCanScrollStart(clampedOffset > 4);
    setCanScrollEnd(clampedOffset < maxScroll - 4);
  }, [isElementRtl, isExpanded]);

  useEffect(() => {
    updateScrollBounds();
    const el = trackRef.current;
    if (!el || isExpanded) return;

    const handleScroll = () => updateScrollBounds();
    el.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => updateScrollBounds());
      resizeObserver.observe(el);
    }

    // Re-check after fonts/images settle
    const settleTimer = window.setTimeout(updateScrollBounds, 250);

    return () => {
      el.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      resizeObserver?.disconnect();
      window.clearTimeout(settleTimer);
    };
  }, [updateScrollBounds, isExpanded, children, language]);

  // Non-passive wheel listener: translates vertical wheel into horizontal scroll when overflowing
  useEffect(() => {
    const el = trackRef.current;
    if (!el || isExpanded) return;

    const handleWheel = (e: WheelEvent) => {
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (maxScroll <= 4) return;

      // Only intercept predominantly vertical mouse-wheel gestures
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;

      const rtl = isElementRtl(el);
      const currentOffset = rtl ? Math.abs(el.scrollLeft) : el.scrollLeft;
      const scrollingTowardEnd = e.deltaY > 0;
      const scrollingTowardStart = e.deltaY < 0;

      const atEnd = currentOffset >= maxScroll - 2;
      const atStart = currentOffset <= 2;

      // Release back to natural vertical page scrolling at boundaries
      if ((scrollingTowardEnd && atEnd) || (scrollingTowardStart && atStart)) {
        return;
      }

      e.preventDefault();
      const delta = rtl ? -e.deltaY : e.deltaY;
      el.scrollLeft += delta;
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [isExpanded, isElementRtl]);

  const scrollByDirection = useCallback(
    (logicalDirection: 'start' | 'end') => {
      const el = trackRef.current;
      if (!el) return;
      const rtl = isElementRtl(el);
      // In LTR: end = +step, start = -step. In RTL: end (left) = -step, start (right) = +step.
      const sign =
        logicalDirection === 'end' ? (rtl ? -1 : 1) : rtl ? 1 : -1;
      el.scrollBy({
        left: sign * scrollStep,
        behavior: 'smooth',
      });
    },
    [isElementRtl, scrollStep]
  );

  // Mouse Click-and-Drag Handlers (Touch uses native browser momentum swipe)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const el = trackRef.current;
    if (!el || el.scrollWidth <= el.clientWidth + 4) return;

    pointerDownRef.current = true;
    dragMovedRef.current = false;
    dragStartXRef.current = e.clientX;
    dragStartScrollLeftRef.current = el.scrollLeft;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerDownRef.current) return;
    const el = trackRef.current;
    if (!el) return;

    const dx = e.clientX - dragStartXRef.current;
    if (!dragMovedRef.current && Math.abs(dx) > 6) {
      dragMovedRef.current = true;
      setIsDragging(true);
    }

    if (dragMovedRef.current) {
      e.preventDefault();
      el.scrollLeft = dragStartScrollLeftRef.current - dx;
    }
  };

  const finishDrag = () => {
    if (!pointerDownRef.current) return;
    pointerDownRef.current = false;
    if (isDragging) {
      setIsDragging(false);
    }
    // Keep dragMovedRef truthy through the immediate click event, then clear
    if (dragMovedRef.current) {
      window.setTimeout(() => {
        dragMovedRef.current = false;
      }, 40);
    }
  };

  const handleClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragMovedRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const isDv = language === 'dv';
  const showArrows = !isExpanded && (canScrollStart || canScrollEnd);

  return (
    <section className={`min-w-0 ${containerClassName}`}>
      {/* Shelf Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap px-1">
        <div className="min-w-0">
          <h3 className="text-base font-extrabold text-[#1C1917] dark:text-[#F5F3EE] flex items-center gap-2 leading-relaxed archival-heading">
            {icon}
            <span>{title}</span>
            {typeof itemCount === 'number' && (
              <span className="text-[11px] font-mono tabular-nums font-bold text-[#6B655D] dark:text-[#A19B91]">
                (<bdi dir="ltr">{itemCount}</bdi>)
              </span>
            )}
          </h3>
          {subtitle && (
            <p className="text-xs text-[#6B655D] dark:text-[#A19B91] leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {headerActions}

          {allowGridToggle && (
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#FFFFFF] dark:bg-[#1A1D1B] hover:bg-[#ECFDF5] dark:hover:bg-[#0F4C45]/40 text-[#0F4C45] dark:text-[#6EE7B7] border border-[#E2DDD5] dark:border-[#2E3330] transition cursor-pointer whitespace-nowrap shrink-0"
              aria-pressed={isExpanded}
            >
              {isExpanded ? (
                <>
                  <Columns3 className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
                  <span>{isDv ? 'ރެކު ވިއު' : 'Shelf Row'}</span>
                </>
              ) : (
                <>
                  <LayoutGrid className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
                  <span>{isDv ? 'ހުރިހާ ފޮތް / ގްރިޑް' : 'View All / Grid'}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Expanded Multi-Row Responsive Grid OR Horizontal Scrollable Shelf */}
      {isExpanded ? (
        <div className={`horizontal-shelf-grid ${gridClassName}`}>
          {children}
        </div>
      ) : (
        <div className="relative group/shelf min-w-0">
          {/* Floating Start Navigation Button (Left in LTR, Right in RTL) */}
          {showArrows && canScrollStart && (
            <button
              type="button"
              onClick={() => scrollByDirection('start')}
              aria-label={isDv ? 'ކުރީގެ ފޮތްތައް' : 'Scroll shelf backward'}
              className="hidden sm:flex items-center justify-center absolute top-1/2 -translate-y-1/2 start-1.5 z-20 w-10 h-10 rounded-full bg-[#FFFFFF]/95 dark:bg-[#1A1D1B]/95 hover:bg-[#0F4C45] hover:text-white text-[#1C1917] dark:text-[#F5F3EE] border border-[#E2DDD5] dark:border-[#2E3330] shadow-lg backdrop-blur-xs transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F4C45]"
            >
              <ChevronLeft className="w-5 h-5 rtl-mirror" strokeWidth={2.25} />
            </button>
          )}

          {/* Floating End Navigation Button (Right in LTR, Left in RTL) */}
          {showArrows && canScrollEnd && (
            <button
              type="button"
              onClick={() => scrollByDirection('end')}
              aria-label={isDv ? 'ދެން ހުރި ފޮތްތައް' : 'Scroll shelf forward'}
              className="hidden sm:flex items-center justify-center absolute top-1/2 -translate-y-1/2 end-1.5 z-20 w-10 h-10 rounded-full bg-[#FFFFFF]/95 dark:bg-[#1A1D1B]/95 hover:bg-[#0F4C45] hover:text-white text-[#1C1917] dark:text-[#F5F3EE] border border-[#E2DDD5] dark:border-[#2E3330] shadow-lg backdrop-blur-xs transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F4C45]"
            >
              <ChevronRight className="w-5 h-5 rtl-mirror" strokeWidth={2.25} />
            </button>
          )}

          {/* Scrollable Track */}
          <div
            ref={trackRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishDrag}
            onPointerCancel={finishDrag}
            onPointerLeave={finishDrag}
            onClickCapture={handleClickCapture}
            className={`flex ${trackClassName} overflow-x-auto pb-3 pt-0.5 px-0.5 scrollbar-thin ${
              isDragging
                ? 'cursor-grabbing select-none snap-none'
                : 'cursor-grab scroll-smooth snap-x snap-mandatory'
            }`}
          >
            {children}
          </div>
        </div>
      )}
    </section>
  );
};
