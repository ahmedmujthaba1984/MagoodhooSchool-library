import React, { useState } from 'react';
import { Search, Filter, BookOpen, BookMarked, CheckCircle, Clock, AlertTriangle, Bookmark, Shield, MapPin, Eye, Info, Plus, FileSpreadsheet, User, Edit, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Book, UserProfile, Reservation } from '../types';
import { AddBookModal } from './AddBookModal';

interface BookCatalogProps {
  books: Book[];
  currentUser: UserProfile;
  reservations: Reservation[];
  onReserveBook: (book: Book) => void;
  onOpenCheckoutForBook: (book: Book) => void;
  onViewReferenceOnly: () => void;
  onAddBook?: (bookData: Omit<Book, 'id'>) => Promise<void>;
  onEditBook?: (book: Book) => void;
  onDeleteBook?: (bookId: string) => void;
  onOpenImportModal?: (type?: 'books' | 'parents') => void;
}

export const BookCatalog: React.FC<BookCatalogProps> = ({
  books,
  currentUser,
  reservations,
  onReserveBook,
  onOpenCheckoutForBook,
  onViewReferenceOnly,
  onAddBook,
  onEditBook,
  onDeleteBook,
  onOpenImportModal
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<'all' | 'circulating' | 'reference'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [entriesPerPage, setEntriesPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [isAddBookModalOpen, setIsAddBookModalOpen] = useState(false);

  // Filter Categories
  const categories = Array.from(new Set(books.map(b => b.category)));

  // Filtered books
  const filteredBooks = books.filter(book => {
    const matchesSearch = 
      book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.isbn.includes(searchQuery) ||
      book.barcode.includes(searchQuery) ||
      book.category.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === 'all' || book.category === selectedCategory;

    const matchesType = 
      selectedType === 'all' ||
      (selectedType === 'reference' && book.isReferenceOnly) ||
      (selectedType === 'circulating' && !book.isReferenceOnly);

    return matchesSearch && matchesCategory && matchesType;
  });

  const isAlreadyReservedByUser = (bookId: string) => {
    return reservations.some(
      r => r.bookId === bookId && r.userId === currentUser.id && r.status === 'pending'
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner / Search bar */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 text-slate-900 border border-slate-200 shadow-xl relative overflow-hidden">
        <div className="relative z-10 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-900 border border-indigo-200 px-3 py-1 rounded-full text-xs font-bold">
                <BookOpen className="w-3.5 h-3.5 text-indigo-600" /> School Online Library Search
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                Explore Books, Literature & Reference Works
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 font-medium">
                Search our full catalog of circulating books, textbooks, and non-circulating reference materials. Reserve books online for pickup at the library desk.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
              {currentUser.role === 'admin' && onOpenImportModal && (
                <button
                  onClick={() => onOpenImportModal('books')}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs px-3.5 py-3 rounded-2xl transition flex items-center gap-2 border border-slate-300"
                  id="catalog-import-csv-btn"
                >
                  <FileSpreadsheet className="w-4 h-4 text-indigo-600" /> Import CSV / Template
                </button>
              )}
              {currentUser.role === 'admin' && onAddBook && (
                <button
                  onClick={() => setIsAddBookModalOpen(true)}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-extrabold text-xs px-4 py-3 rounded-2xl shadow-md transition flex items-center gap-2 active:scale-95"
                  id="catalog-add-book-btn"
                >
                  <Plus className="w-4 h-4" /> Add New Book
                </button>
              )}
            </div>
          </div>

          {/* Search Bar Input */}
          <div className="relative mt-2 max-w-3xl">
            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, author name, category, or ISBN barcode..."
              className="w-full pl-12 pr-4 py-3 bg-slate-50 text-slate-900 placeholder-slate-400 rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold transition-all shadow-inner"
              id="catalog-search-input"
            />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-md">
        
        {/* Category Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <span className="text-xs font-extrabold text-slate-500 flex items-center gap-1 uppercase tracking-wider pr-2">
            <Filter className="w-3.5 h-3.5" /> Category:
          </span>
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedCategory === 'all'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
            }`}
          >
            All Categories ({books.length})
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Circulating vs Reference Type Toggle & Grid/List View Toggle */}
        <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setSelectedType('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                selectedType === 'all' ? 'bg-white font-extrabold text-slate-900 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setSelectedType('circulating')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                selectedType === 'circulating' ? 'bg-white font-extrabold text-slate-900 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Borrowable
            </button>
            <button
              onClick={() => {
                setSelectedType('reference');
              }}
              className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1 ${
                selectedType === 'reference' ? 'bg-amber-500 font-bold text-white shadow-sm' : 'text-amber-800 hover:text-amber-950'
              }`}
            >
              <BookMarked className="w-3 h-3" /> Reference Only
            </button>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'grid' ? 'bg-white text-indigo-600 font-extrabold shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Grid Cards
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'list' ? 'bg-white text-indigo-600 font-extrabold shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              List of Books
            </button>
          </div>
        </div>

      </div>

      {/* GRID VIEW */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredBooks.map((book) => {
            const isReserved = isAlreadyReservedByUser(book.id);

            return (
              <div
                key={book.id}
                className="bg-white border border-slate-200 rounded-3xl hover:border-indigo-300 hover:shadow-2xl transition-all duration-300 shadow-md flex flex-col justify-between overflow-hidden group"
              >
                {/* Cover & Badges */}
                <div>
                  <div className="relative h-56 bg-slate-100 overflow-hidden">
                    <img
                      src={book.coverUrl}
                      alt={book.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent"></div>

                    {/* Top Badges */}
                    <div className="absolute top-3 left-3 right-3 flex justify-between items-start gap-1">
                      <span className="bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow">
                        {book.category}
                      </span>

                      {book.isReferenceOnly ? (
                        <span className="bg-amber-500 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full shadow flex items-center gap-1">
                          <BookMarked className="w-3 h-3" /> REFERENCE ONLY
                        </span>
                      ) : book.availableCopies > 0 ? (
                        <span className="bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> {book.availableCopies} Available
                        </span>
                      ) : (
                        <span className="bg-rose-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Checked Out
                        </span>
                      )}
                    </div>

                    {/* Title & Author on Cover gradient */}
                    <div className="absolute bottom-3 left-3 right-3 text-white">
                      <h3 className="font-extrabold text-base line-clamp-1 group-hover:text-amber-300 transition">
                        {book.title}
                      </h3>
                      <p className="text-xs text-slate-200 line-clamp-1 font-medium">by {book.author}</p>
                    </div>
                  </div>

                  {/* Details Section */}
                  <div className="p-4 space-y-3">
                    <div className="flex items-center text-xs text-slate-600 gap-1 font-semibold">
                      <MapPin className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                      <span className="truncate">{book.shelfLocation}</span>
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed font-normal">
                      {book.description}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100 font-mono font-semibold">
                      <span>ISBN: {book.isbn}</span>
                      <span>Copies: {book.availableCopies}/{book.totalCopies}</span>
                    </div>

                    {book.barcodeImageUrl && (
                      <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                        <img src={book.barcodeImageUrl} alt="Barcode" className="h-6 object-contain border rounded p-0.5" />
                        <span className="text-[10px] font-bold text-emerald-700">Custom Barcode Image Attached</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
                  <button
                    onClick={() => setSelectedBook(book)}
                    className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 rounded-xl border border-slate-200 bg-white transition-all shadow-sm"
                    title="View full details"
                  >
                    <Eye className="w-4 h-4 text-indigo-600" />
                  </button>

                  {book.isReferenceOnly ? (
                    <button
                      onClick={onViewReferenceOnly}
                      className="flex-1 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-bold text-xs py-2 px-3 rounded-xl text-center transition flex items-center justify-center gap-1"
                    >
                      <BookMarked className="w-3.5 h-3.5 text-amber-600" /> Reference Desk Info
                    </button>
                  ) : (
                    <>
                      {/* Reserve Online Button */}
                      <button
                        onClick={() => onReserveBook(book)}
                        disabled={isReserved}
                        className={`flex-1 font-bold text-xs py-2 px-3 rounded-xl text-center transition flex items-center justify-center gap-1 ${
                          isReserved
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-not-allowed'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow'
                        }`}
                      >
                        <Bookmark className="w-3.5 h-3.5" />
                        {isReserved ? 'Reserved Online' : 'Reserve Online'}
                      </button>

                      {/* Librarian Quick Checkout */}
                      {currentUser.role === 'admin' && (
                        <button
                          onClick={() => onOpenCheckoutForBook(book)}
                          className="bg-slate-200 hover:bg-slate-300 text-slate-800 border border-slate-300 font-bold text-xs py-2 px-3 rounded-xl transition"
                          title="Instant Librarian Checkout"
                        >
                          Checkout
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* COMPACT LIST / TABLE OF BOOKS VIEW (MATCHING REFERENCE IMAGE) */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-lg space-y-4 p-6">
          
          {/* Header Title with underline */}
          <div className="border-b border-slate-200 pb-3">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <span className="p-1.5 bg-slate-100 rounded-lg border border-slate-300">
                <BookOpen className="w-5 h-5 text-slate-700" />
              </span>
              Book Catalog
            </h2>
            <div className="h-1 w-20 bg-slate-800 rounded-full mt-1"></div>
          </div>

          {/* Table Controls Top Row: Entries Dropdown & Search Input */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <span>Show</span>
              <select
                value={entriesPerPage}
                onChange={(e) => {
                  setEntriesPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-300 rounded-md px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <span>entries</span>
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 w-full sm:w-auto">
              <span>Search:</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder=""
                className="bg-white border border-slate-300 rounded-md px-3 py-1 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm w-full sm:w-48"
              />
            </div>
          </div>

          {/* Main Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs text-slate-800 border-collapse">
              <thead className="bg-slate-100/80 text-slate-700 font-extrabold border-b border-slate-200">
                <tr>
                  <th className="p-3.5 border-r border-slate-200">Title</th>
                  <th className="p-3.5 border-r border-slate-200">Author</th>
                  <th className="p-3.5 border-r border-slate-200">ISBN</th>
                  <th className="p-3.5 border-r border-slate-200">Genre</th>
                  <th className="p-3.5 border-r border-slate-200 text-center">Total</th>
                  <th className="p-3.5 border-r border-slate-200 text-center">Available</th>
                  <th className="p-3.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(() => {
                  const startIndex = (currentPage - 1) * entriesPerPage;
                  const paginatedBooks = filteredBooks.slice(startIndex, startIndex + entriesPerPage);

                  return paginatedBooks.map((book) => {
                    const isReserved = isAlreadyReservedByUser(book.id);

                    return (
                      <tr key={book.id} className="hover:bg-slate-50 transition">
                        {/* Title Column */}
                        <td className="p-3.5 border-r border-slate-200">
                          <div className="flex items-center gap-3">
                            <img
                              src={book.coverUrl}
                              alt=""
                              className="w-8 h-10 object-cover rounded shadow-sm flex-shrink-0 border border-slate-200"
                            />
                            <span className="font-bold text-slate-900 text-xs sm:text-sm">{book.title}</span>
                          </div>
                        </td>

                        {/* Author Column */}
                        <td className="p-3.5 border-r border-slate-200 font-medium text-slate-800">
                          {book.author}
                        </td>

                        {/* ISBN Column */}
                        <td className="p-3.5 border-r border-slate-200 font-mono text-slate-700 font-semibold">
                          {book.isbn}
                        </td>

                        {/* Genre / Category Column */}
                        <td className="p-3.5 border-r border-slate-200 font-medium text-slate-800">
                          {book.category}
                        </td>

                        {/* Total Column */}
                        <td className="p-3.5 border-r border-slate-200 text-center font-bold text-slate-800">
                          {book.totalCopies}
                        </td>

                        {/* Available Column */}
                        <td className="p-3.5 border-r border-slate-200 text-center">
                          {book.availableCopies > 0 ? (
                            <span className="bg-[#16A34A] text-white text-[11px] font-black px-2.5 py-1 rounded-md shadow-sm inline-block min-w-[85px]">
                              {book.availableCopies} Available
                            </span>
                          ) : (
                            <span className="bg-rose-600 text-white text-[11px] font-black px-2.5 py-1 rounded-md shadow-sm inline-block min-w-[85px]">
                              Checked Out
                            </span>
                          )}
                        </td>

                        {/* Actions Column (Matching Screenshot Button Colors) */}
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Cyan View Details button */}
                            <button
                              onClick={() => setSelectedBook(book)}
                              className="p-1.5 bg-[#0EA5E9] hover:bg-sky-600 text-white rounded-md transition shadow-sm flex items-center gap-1 px-2.5 text-xs font-bold"
                              title="View Book Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Details</span>
                            </button>

                            {/* Reserve Online button for non-reference circulating books */}
                            {!book.isReferenceOnly && (
                              <button
                                onClick={() => onReserveBook(book)}
                                disabled={isReserved}
                                className={`p-1.5 rounded-md transition shadow-sm flex items-center gap-1 px-2.5 text-xs font-bold ${
                                  isReserved
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-not-allowed'
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                }`}
                                title={isReserved ? 'Reserved' : 'Reserve Online'}
                              >
                                <Bookmark className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">{isReserved ? 'Reserved' : 'Reserve'}</span>
                              </button>
                            )}

                            {/* Admin-Only Desk Checkout, Edit, Delete Controls */}
                            {currentUser.role === 'admin' && (
                              <>
                                <button
                                  onClick={() => onOpenCheckoutForBook(book)}
                                  className="p-1.5 bg-[#1D4ED8] hover:bg-blue-800 text-white rounded-md transition shadow-sm"
                                  title="Borrow / Desk Issue Book"
                                >
                                  <User className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => {
                                    if (onEditBook) onEditBook(book);
                                    else setSelectedBook(book);
                                  }}
                                  className="p-1.5 bg-[#EAB308] hover:bg-amber-600 text-white rounded-md transition shadow-sm"
                                  title="Edit Book Information"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => {
                                    if (onDeleteBook && confirm(`Are you sure you want to delete "${book.title}"?`)) {
                                      onDeleteBook(book.id);
                                    }
                                  }}
                                  className="p-1.5 bg-[#EF4444] hover:bg-rose-700 text-white rounded-md transition shadow-sm"
                                  title="Delete Book Record"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>

          {/* Table Footer: Entries info & Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <div className="text-xs text-slate-500 font-medium">
              Showing {filteredBooks.length === 0 ? 0 : (currentPage - 1) * entriesPerPage + 1} to{' '}
              {Math.min(currentPage * entriesPerPage, filteredBooks.length)} of {filteredBooks.length} entries
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Previous
              </button>

              {Array.from({ length: Math.ceil(filteredBooks.length / entriesPerPage) || 1 }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`px-3 py-1 text-xs font-bold rounded border transition ${
                    currentPage === i + 1
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {i + 1}
                </button>
              ))}

              <button
                onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredBooks.length / entriesPerPage), p + 1))}
                disabled={currentPage >= Math.ceil(filteredBooks.length / entriesPerPage)}
                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Next
              </button>
            </div>
          </div>

        </div>
      )}

      {filteredBooks.length === 0 && (
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
          <BookOpen className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-800">No books found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto font-medium">
            Try adjusting your search terms or selecting a different category filter.
          </p>
        </div>
      )}

      {/* Book Detail Modal */}
      {selectedBook && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 text-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="relative h-48 bg-slate-900">
              <img
                src={selectedBook.coverUrl}
                alt={selectedBook.title}
                className="w-full h-full object-cover opacity-70"
              />
              <button
                onClick={() => setSelectedBook(null)}
                className="absolute top-3 right-3 bg-white/80 text-slate-800 p-1.5 rounded-full hover:bg-white transition shadow border border-slate-200 font-bold"
              >
                ✕
              </button>
              <div className="absolute bottom-4 left-4 right-4 text-white">
                <span className="text-[10px] font-extrabold bg-indigo-600 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  {selectedBook.category}
                </span>
                <h3 className="text-lg font-black mt-1 text-white">{selectedBook.title}</h3>
                <p className="text-xs text-slate-200 font-medium">by {selectedBook.author}</p>
              </div>
            </div>

            <div className="p-5 space-y-4 text-xs text-slate-700 font-medium">
              {selectedBook.isReferenceOnly && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-amber-900">
                  <BookMarked className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-extrabold">Reference Material (Non-Circulating):</span>
                    <p className="text-[11px] mt-0.5 text-amber-800 font-medium">
                      This title is preserved for library desk reference only. Students may consult this volume inside the library reading hall.
                    </p>
                  </div>
                </div>
              )}

              <p className="leading-relaxed text-slate-700">{selectedBook.description}</p>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 font-mono text-[11px]">
                <div>
                  <span className="text-slate-500 block text-[10px] font-sans font-bold">ISBN Code</span>
                  <span className="font-bold text-slate-900">{selectedBook.isbn}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-sans font-bold">Barcode ID</span>
                  <span className="font-bold text-slate-900">{selectedBook.barcode}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-sans font-bold">Shelf Location</span>
                  <span className="font-bold text-slate-900">{selectedBook.shelfLocation}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-sans font-bold">Availability</span>
                  <span className="font-bold text-slate-900">{selectedBook.availableCopies} of {selectedBook.totalCopies} copies</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500 block text-[10px] font-sans font-bold">Publisher</span>
                  <span className="font-bold text-slate-900">{selectedBook.publisher} ({selectedBook.publicationYear})</span>
                </div>
              </div>

              {selectedBook.barcodeImageUrl && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Uploaded Book Barcode</span>
                  <img src={selectedBook.barcodeImageUrl} alt="Barcode" className="max-h-20 mx-auto object-contain border bg-white p-1 rounded shadow-sm" />
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setSelectedBook(null)}
                className="px-4 py-2 bg-slate-200 text-slate-800 rounded-xl text-xs font-bold hover:bg-slate-300 transition border border-slate-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Book Modal */}
      {onAddBook && (
        <AddBookModal
          isOpen={isAddBookModalOpen}
          onClose={() => setIsAddBookModalOpen(false)}
          onAddBook={onAddBook}
        />
      )}

    </div>
  );
};
