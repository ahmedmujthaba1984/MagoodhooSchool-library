import React, { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';

interface BookCoverFallbackProps {
  src?: string;
  title: string;
  author?: string;
  className?: string;
}

export const BookCoverFallback: React.FC<BookCoverFallbackProps> = ({
  src,
  title,
  author,
  className = 'w-full h-full object-cover'
}) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (!src || hasError) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-slate-800 via-slate-900 to-emerald-950 text-white p-3 flex flex-col justify-between select-none">
        <div className="flex items-center justify-between opacity-70">
          <BookOpen className="w-4 h-4 text-emerald-300" />
          <span className="text-[9px] font-mono tracking-wider uppercase text-slate-300">MAGOODHOO</span>
        </div>
        <div className="space-y-1 my-auto">
          <div className="text-xs font-bold leading-snug line-clamp-3 text-slate-100">
            {title}
          </div>
          {author && (
            <div className="text-[10px] text-slate-400 truncate">
              {author}
            </div>
          )}
        </div>
        <div className="h-0.5 w-8 bg-emerald-500/60 rounded-full" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`${title}${author ? ` by ${author}` : ''}`}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setHasError(true)}
      className={className}
    />
  );
};
