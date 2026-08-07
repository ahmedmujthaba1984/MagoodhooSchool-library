import React, { useState } from 'react';
import { BookMarked, MapPin, ShieldAlert, Search, Info, CheckCircle, ExternalLink } from 'lucide-react';
import { Book } from '../types';

interface ReferenceSectionProps {
  books: Book[];
}

export const ReferenceSection: React.FC<ReferenceSectionProps> = ({ books }) => {
  const [search, setSearch] = useState('');
  const referenceBooks = books.filter(b => b.isReferenceOnly);

  const filtered = referenceBooks.filter(b =>
    b.title.toLowerCase().includes(search.toLowerCase()) ||
    b.author.toLowerCase().includes(search.toLowerCase()) ||
    b.category.toLowerCase().includes(search.toLowerCase()) ||
    b.isbn.includes(search)
  );

  return (
    <div className="space-y-6">
      
      {/* Banner */}
      <div className="bg-gradient-to-r from-amber-900 via-amber-950 to-orange-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-amber-600/40 relative overflow-hidden">
        <div className="max-w-3xl space-y-3 relative z-10">
          <div className="inline-flex items-center gap-2 bg-amber-400/20 text-amber-200 border border-amber-400/30 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider">
            <BookMarked className="w-3.5 h-3.5 text-amber-300" /> Non-Circulating Collection
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-xs">
            Library Reference Desk & Rare Collections
          </h2>
          <p className="text-xs sm:text-sm text-amber-100 font-medium leading-relaxed">
            Reference items including encyclopedias, language dictionaries, map atlases, and scientific reference works remain inside the library for in-house study and research.
          </p>
        </div>
      </div>

      {/* Rules & Reading Room Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-amber-100/90 border-2 border-amber-300 rounded-2xl p-4 flex items-start gap-3 text-xs text-amber-950 shadow-md">
          <ShieldAlert className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-extrabold text-amber-950 text-sm">In-Library Use Only</h4>
            <p className="mt-1 text-amber-900 font-bold leading-relaxed">
              Reference items cannot be checked out or taken home. You may consult them freely in the main reading hall.
            </p>
          </div>
        </div>

        <div className="bg-slate-900 text-white border-2 border-slate-700 rounded-2xl p-4 flex items-start gap-3 text-xs shadow-md">
          <MapPin className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-extrabold text-amber-300 text-sm">Reference Desk Location</h4>
            <p className="mt-1 text-slate-200 font-bold leading-relaxed">
              Located at North Reading Hall, Sections A-D. Ask librarian Ms. Davis for catalog retrieval assistance.
            </p>
          </div>
        </div>

        <div className="bg-indigo-100/90 border-2 border-indigo-300 rounded-2xl p-4 flex items-start gap-3 text-xs text-indigo-950 shadow-md">
          <Info className="w-5 h-5 text-indigo-700 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-extrabold text-indigo-950 text-sm">Photocopying & Scanning</h4>
            <p className="mt-1 text-indigo-900 font-bold leading-relaxed">
              Digital book scanners are available next to Section B for copying excerpts or chapter citations for school projects.
            </p>
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="bg-white p-4 rounded-2xl border-2 border-slate-300 shadow-md flex items-center gap-3">
        <Search className="w-5 h-5 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search reference volumes, encyclopedias, atlases..."
          className="w-full text-sm focus:outline-none text-slate-900 placeholder-slate-500 font-extrabold bg-transparent"
          id="reference-search-input"
        />
      </div>

      {/* Reference Book Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filtered.map(book => (
          <div
            key={book.id}
            className="bg-white rounded-3xl border-2 border-amber-200 p-5 shadow-lg hover:border-amber-400 transition-all duration-300 flex flex-col sm:flex-row gap-4 relative overflow-hidden group"
          >
            <div className="w-full sm:w-32 h-44 bg-slate-900 rounded-2xl overflow-hidden flex-shrink-0 relative border border-slate-300 shadow-md">
              <img
                src={book.coverUrl}
                alt={book.title}
                className="w-full h-full object-cover group-hover:scale-105 transition"
              />
              <span className="absolute top-2 left-2 bg-amber-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow">
                REF ONLY
              </span>
            </div>

            <div className="flex-1 flex flex-col justify-between space-y-2">
              <div>
                <span className="text-[10px] font-black text-amber-900 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  {book.category}
                </span>
                <h3 className="text-base font-black text-slate-900 mt-1 group-hover:text-amber-700 transition">{book.title}</h3>
                <p className="text-xs text-slate-600 font-extrabold">by {book.author}</p>
                <p className="text-xs text-slate-700 font-bold mt-2 line-clamp-2 leading-relaxed">{book.description}</p>
              </div>

              <div className="pt-3 border-t border-slate-200 space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 text-slate-800 font-extrabold">
                  <MapPin className="w-3.5 h-3.5 text-amber-600" /> Shelf Location: <span className="font-mono text-amber-950 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-lg">{book.shelfLocation}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-600 font-mono font-bold">
                  <span>ISBN: {book.isbn}</span>
                  <span className="text-slate-900 font-extrabold">{book.totalCopies} Copies at Desk</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};
