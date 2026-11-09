import React from 'react';

export const BookCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white border border-slate-200/90 rounded-3xl p-4 shadow-xs space-y-4 overflow-hidden flex flex-col justify-between">
      <div>
        <div className="h-52 w-full rounded-2xl shimmer-skeleton"></div>
        <div className="space-y-2 mt-4">
          <div className="h-4 w-3/4 rounded-lg shimmer-skeleton"></div>
          <div className="h-3 w-1/2 rounded-lg shimmer-skeleton"></div>
          <div className="h-3 w-2/3 rounded-lg shimmer-skeleton"></div>
        </div>
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div className="h-3 w-1/3 rounded-lg shimmer-skeleton"></div>
        <div className="h-8 w-24 rounded-xl shimmer-skeleton"></div>
      </div>
    </div>
  );
};

export const CatalogGridSkeleton: React.FC<{ count?: number }> = ({ count = 8 }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in duration-200">
      {Array.from({ length: count }).map((_, i) => (
        <BookCardSkeleton key={i} />
      ))}
    </div>
  );
};

export const SearchResultListSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => {
  return (
    <div className="space-y-3 p-2 animate-in fade-in duration-200">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="p-3.5 bg-white border border-slate-200/90 rounded-2xl flex items-center justify-between gap-4 shadow-xs"
        >
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-14 rounded-xl shimmer-skeleton shrink-0"></div>
            <div className="space-y-1.5 flex-1">
              <div className="h-4 w-2/5 rounded-lg shimmer-skeleton"></div>
              <div className="h-3 w-1/4 rounded-lg shimmer-skeleton"></div>
              <div className="h-2.5 w-1/3 rounded-lg shimmer-skeleton"></div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-6 w-16 rounded-full shimmer-skeleton"></div>
            <div className="h-8 w-20 rounded-xl shimmer-skeleton"></div>
          </div>
        </div>
      ))}
    </div>
  );
};

export const TableRowSkeleton: React.FC = () => {
  return (
    <tr className="border-b border-slate-100">
      <td className="p-3.5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-10 rounded-lg shimmer-skeleton shrink-0"></div>
          <div className="space-y-1.5 flex-1">
            <div className="h-3.5 w-3/4 rounded-md shimmer-skeleton"></div>
            <div className="h-2.5 w-1/3 rounded-md shimmer-skeleton"></div>
          </div>
        </div>
      </td>
      <td className="p-3.5">
        <div className="h-3 w-28 rounded shimmer-skeleton"></div>
      </td>
      <td className="p-3.5">
        <div className="h-3 w-24 rounded shimmer-skeleton font-mono"></div>
      </td>
      <td className="p-3.5">
        <div className="h-3 w-20 rounded shimmer-skeleton"></div>
      </td>
      <td className="p-3.5 text-center">
        <div className="h-3 w-8 mx-auto rounded shimmer-skeleton"></div>
      </td>
      <td className="p-3.5 text-center">
        <div className="h-3 w-16 mx-auto rounded-full shimmer-skeleton"></div>
      </td>
      <td className="p-3.5 text-center">
        <div className="h-7 w-20 mx-auto rounded-xl shimmer-skeleton"></div>
      </td>
    </tr>
  );
};

export const BorrowingHistoryTableSkeleton: React.FC<{ rows?: number }> = ({ rows = 4 }) => {
  return (
    <div className="overflow-x-auto border border-slate-200/90 rounded-2xl bg-white shadow-xs animate-in fade-in duration-200">
      <table className="w-full text-left text-xs text-slate-700">
        <thead className="bg-slate-100/90 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200">
          <tr>
            <th className="p-3.5">Book Title</th>
            <th className="p-3.5">Borrowed On</th>
            <th className="p-3.5">Returned On</th>
            <th className="p-3.5">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i}>
              <td className="p-3.5">
                <div className="space-y-1">
                  <div className="h-3.5 w-48 rounded shimmer-skeleton"></div>
                  <div className="h-2.5 w-24 rounded shimmer-skeleton"></div>
                </div>
              </td>
              <td className="p-3.5">
                <div className="h-3 w-24 rounded shimmer-skeleton font-mono"></div>
              </td>
              <td className="p-3.5">
                <div className="h-3 w-24 rounded shimmer-skeleton font-mono"></div>
              </td>
              <td className="p-3.5">
                <div className="h-5 w-24 rounded-full shimmer-skeleton"></div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const CirculationSummaryCardSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-200">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-5 bg-white border border-slate-200/90 rounded-3xl shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-4 w-24 rounded-lg shimmer-skeleton"></div>
            <div className="w-10 h-10 rounded-2xl shimmer-skeleton"></div>
          </div>
          <div className="h-8 w-16 rounded-xl shimmer-skeleton"></div>
          <div className="h-3 w-32 rounded-lg shimmer-skeleton"></div>
        </div>
      ))}
    </div>
  );
};
