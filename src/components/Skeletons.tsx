import React from 'react';

export const BookCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-4 shadow-xs space-y-4 overflow-hidden flex flex-col justify-between">
      <div>
        <div className="h-52 w-full rounded-2xl shimmer-skeleton"></div>
        <div className="space-y-2 mt-4">
          <div className="h-4 w-3/4 rounded-lg shimmer-skeleton"></div>
          <div className="h-3 w-1/2 rounded-lg shimmer-skeleton"></div>
          <div className="h-3 w-2/3 rounded-lg shimmer-skeleton"></div>
        </div>
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
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
          className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl flex items-center justify-between gap-4 shadow-xs"
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
            <div className="h-6 w-16 rounded-md shimmer-skeleton"></div>
            <div className="h-8 w-20 rounded-xl shimmer-skeleton"></div>
          </div>
        </div>
      ))}
    </div>
  );
};

export const TableRowSkeleton: React.FC = () => {
  return (
    <tr className="border-b border-slate-100 dark:border-slate-800">
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
        <div className="h-3 w-16 mx-auto rounded-md shimmer-skeleton"></div>
      </td>
      <td className="p-3.5 text-center">
        <div className="h-7 w-20 mx-auto rounded-xl shimmer-skeleton"></div>
      </td>
    </tr>
  );
};

export const CatalogTableSkeleton: React.FC<{ rows?: number }> = ({ rows = 6 }) => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-6 w-48 rounded-lg shimmer-skeleton" />
        <div className="h-5 w-24 rounded-lg shimmer-skeleton" />
      </div>
      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
        <table className="w-full text-start text-xs">
          <thead className="bg-slate-900 text-white">
            <tr>
              <th className="p-3.5">Title</th>
              <th className="p-3.5">Author</th>
              <th className="p-3.5">ISBN / Call No.</th>
              <th className="p-3.5">Genre</th>
              <th className="p-3.5 text-center">Total</th>
              <th className="p-3.5 text-center">Available</th>
              <th className="p-3.5 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, idx) => (
              <TableRowSkeleton key={idx} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const BorrowingHistoryTableSkeleton: React.FC<{ rows?: number }> = ({ rows = 4 }) => {
  return (
    <div className="overflow-x-auto border border-slate-200/90 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-xs animate-in fade-in duration-200">
      <table className="w-full text-start text-xs text-slate-700 dark:text-slate-300">
        <thead className="bg-slate-100/90 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-700">
          <tr>
            <th className="p-3.5">Book Title</th>
            <th className="p-3.5">Borrowed On</th>
            <th className="p-3.5">Returned On</th>
            <th className="p-3.5">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
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
                <div className="h-5 w-24 rounded-md shimmer-skeleton"></div>
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
        <div key={i} className="p-5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-xs space-y-3">
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

export const AnalyticsDashboardSkeleton: React.FC<{ panels?: number }> = ({ panels = 3 }) => {
  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-2">
        <div className="h-3.5 w-3/4 rounded shimmer-skeleton" />
        <div className="h-3 w-1/2 rounded shimmer-skeleton" />
      </div>
      <div className="space-y-2.5">
        {Array.from({ length: panels }).map((_, i) => (
          <div
            key={i}
            className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-3"
          >
            <div className="space-y-1.5 flex-1">
              <div className="h-3.5 w-2/3 rounded shimmer-skeleton" />
              <div className="h-2.5 w-1/2 rounded shimmer-skeleton" />
            </div>
            <div className="h-6 w-16 rounded-lg shimmer-skeleton shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
};

export const CirculationDeskSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-200">
      <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="h-5 w-40 rounded shimmer-skeleton" />
        <div className="h-12 w-full rounded-xl shimmer-skeleton" />
        <div className="h-24 w-full rounded-xl shimmer-skeleton" />
        <div className="h-11 w-full rounded-xl shimmer-skeleton" />
      </div>
      <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="h-5 w-52 rounded shimmer-skeleton" />
        <div className="h-16 w-full rounded-xl shimmer-skeleton" />
        <div className="h-16 w-full rounded-xl shimmer-skeleton" />
        <div className="h-16 w-full rounded-xl shimmer-skeleton" />
      </div>
    </div>
  );
};

export const AiPanelSkeleton: React.FC<{ rows?: number }> = ({ rows = 3 }) => {
  return (
    <div className="space-y-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl animate-in fade-in duration-200">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg shimmer-skeleton shrink-0" />
        <div className="h-4 w-48 rounded-lg shimmer-skeleton" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2">
          <div className="h-3.5 w-3/4 rounded shimmer-skeleton" />
          <div className="h-3 w-full rounded shimmer-skeleton" />
          <div className="h-3 w-2/3 rounded shimmer-skeleton" />
        </div>
      ))}
    </div>
  );
};
