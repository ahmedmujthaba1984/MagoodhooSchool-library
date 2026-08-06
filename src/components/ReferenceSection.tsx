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
      <div className="bg-amber-500/10 backdrop-blur-xl rounded-3xl p-6 sm:p-8 text-white shadow-2xl border border-amber-500/20 relative overflow-hidden">
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
            <BookMarked className="w-3.5 h-3.5" /> Non-Circulating Collection
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Library Reference Desk & Rare Collections
          </h2>
          <p className="text-sm text-amber-200/90">
            Reference items including encyclopedias, language dictionaries, map atlases, and scientific reference works remain inside the library for in-house study and research.
          </p>
        </div>
      </div>

      {/* Rules & Reading Room Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-amber-500/10 backdrop-blur-md border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3 text-xs text-amber-100 shadow-lg">
          <ShieldAlert className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-amber-200">In-Library Use Only</h4>
            <p className="mt-0.5 text-amber-300/80">
              Reference items cannot be checked out or taken home. You may consult them freely in the main reading hall.
            </p>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-md border border-white/10 text-white rounded-2xl p-4 flex items-start gap-3 text-xs shadow-lg">
          <MapPin className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-amber-300">Reference Desk Location</h4>
            <p className="mt-0.5 text-slate-300">
              Located at North Reading Hall, Sections A-D. Ask librarian Ms. Davis for catalog retrieval assistance.
            </p>
          </div>
        </div>

        <div className="bg-indigo-500/10 backdrop-blur-md border border-indigo-500/20 rounded-2xl p-4 flex items-start gap-3 text-xs text-indigo-100 shadow-lg">
          <Info className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-indigo-200">Photocopying & Scanning</h4>
            <p className="mt-0.5 text-indigo-300/80">
              Digital book scanners are available next to Section B for copying excerpts or chapter citations for school projects.
            </p>
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-lg flex items-center gap-3">
        <Search className="w-5 h-5 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search reference volumes, encyclopedias, atlases..."
          className="w-full text-sm focus:outline-none text-white placeholder-slate-400 font-medium bg-transparent"
          id="reference-search-input"
        />
      </div>

      {/* Reference Book Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filtered.map(book => (
          <div
            key={book.id}
            className="bg-white/5 backdrop-blur-md rounded-3xl border border-amber-500/20 p-5 shadow-xl hover:bg-white/10 hover:border-amber-500/40 transition-all duration-300 flex flex-col sm:flex-row gap-4 relative overflow-hidden group"
          >
            <div className="w-full sm:w-32 h-44 bg-slate-900 rounded-2xl overflow-hidden flex-shrink-0 relative border border-white/10">
              <img
                src={book.coverUrl}
                alt={book.title}
                className="w-full h-full object-cover group-hover:scale-105 transition"
              />
              <span className="absolute top-2 left-2 bg-amber-500/90 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full shadow backdrop-blur-sm">
                REF ONLY
              </span>
            </div>

            <div className="flex-1 flex flex-col justify-between space-y-2">
              <div>
                <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 border border-amber-500/30 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  {book.category}
                </span>
                <h3 className="text-base font-bold text-slate-100 mt-1 group-hover:text-amber-300 transition">{book.title}</h3>
                <p className="text-xs text-slate-400 font-medium">by {book.author}</p>
                <p className="text-xs text-slate-300 mt-2 line-clamp-2 leading-relaxed">{book.description}</p>
              </div>

              <div className="pt-3 border-t border-white/10 space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                  <MapPin className="w-3.5 h-3.5 text-amber-400" /> Shelf Location: <span className="font-mono text-amber-300 bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded-lg">{book.shelfLocation}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span>ISBN: {book.isbn}</span>
                  <span className="text-slate-300 font-semibold">{book.totalCopies} Copies at Desk</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};
