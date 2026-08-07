import React, { useState } from 'react';
import { Shield, Plus, Edit2, Trash2, Printer, DollarSign, Settings, Users, BookOpen, CheckCircle, AlertTriangle, QrCode, FileSpreadsheet } from 'lucide-react';
import { Book, UserProfile, Loan, LibrarySettings } from '../types';
import { useLanguage } from '../lib/i18n';

interface AdminPanelProps {
  books: Book[];
  users: UserProfile[];
  loans: Loan[];
  settings: LibrarySettings;
  onAddBook: (book: Omit<Book, 'id'>) => void;
  onUpdateBook: (id: string, data: Partial<Book>) => void;
  onDeleteBook: (id: string) => void;
  onDeleteUser?: (userId: string) => void;
  onUpdateSettings: (newSettings: Partial<LibrarySettings>) => void;
  onMarkFeePaid: (loanId: string) => void;
  onOpenAddParentModal?: () => void;
  onOpenImportModal?: (type?: 'books' | 'parents') => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  books,
  users,
  loans,
  settings,
  onAddBook,
  onUpdateBook,
  onDeleteBook,
  onDeleteUser,
  onUpdateSettings,
  onMarkFeePaid,
  onOpenAddParentModal,
  onOpenImportModal
}) => {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'inventory' | 'late-fees' | 'barcode-labels' | 'users' | 'settings'>('inventory');

  // New Book Modal State
  const [showBookModal, setShowBookModal] = useState(false);
  const [editingBookId, setEditingBookId] = useState<string | null>(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [isbn, setIsbn] = useState('');
  const [barcode, setBarcode] = useState('');
  const [category, setCategory] = useState('Classic Literature');
  const [isReferenceOnly, setIsReferenceOnly] = useState(false);
  const [totalCopies, setTotalCopies] = useState(3);
  const [shelfLocation, setShelfLocation] = useState('Fiction - Aisle 1');
  const [coverUrl, setCoverUrl] = useState('https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80');
  const [description, setDescription] = useState('');
  const [publisher, setPublisher] = useState('Scholastic');
  const [publicationYear, setPublicationYear] = useState(2022);

  // Print Label Selection
  const [selectedLabelBook, setSelectedLabelBook] = useState<Book | null>(books[0] || null);

  // Settings State
  const [policyMaxBorrowDays, setPolicyMaxBorrowDays] = useState(settings.maxBorrowDays || 14);
  const [policyLateFeeRate, setPolicyLateFeeRate] = useState(settings.lateFeePerDay || 0.50);
  const [policyMaxRenewals, setPolicyMaxRenewals] = useState(settings.maxRenewals || 2);
  const [policyMaxBooksStudent, setPolicyMaxBooksStudent] = useState(settings.maxBooksPerStudent || 3);
  const [policyGracePeriodDays, setPolicyGracePeriodDays] = useState(settings.gracePeriodDays ?? 2);
  const [policyMaxBooksStaff, setPolicyMaxBooksStaff] = useState(settings.maxBooksPerStaff ?? 7);
  const [policyStaffBorrowDays, setPolicyStaffBorrowDays] = useState(settings.staffBorrowDays ?? 30);
  const [policyMaxActiveReservations, setPolicyMaxActiveReservations] = useState(settings.maxActiveReservations ?? 2);
  const [policyHoldExpiryDays, setPolicyHoldExpiryDays] = useState(settings.holdExpiryDays ?? 3);
  const [policyLostBookReplacementFee, setPolicyLostBookReplacementFee] = useState(settings.lostBookReplacementFee ?? 15.00);
  const [policyAllowRefCheckoutStaff, setPolicyAllowRefCheckoutStaff] = useState(settings.allowReferenceCheckoutForStaff ?? true);
  const [policyMaxOverdueFineCap, setPolicyMaxOverdueFineCap] = useState(settings.maxOverdueFineCap ?? 25.00);
  const [policyBlockBorrowingFineThreshold, setPolicyBlockBorrowingFineThreshold] = useState(settings.blockBorrowingFineThreshold ?? 10.00);
  const [policyAllowRecallRequests, setPolicyAllowRecallRequests] = useState(settings.allowRecallRequests ?? true);
  const [policyHolidayGraceDays, setPolicyHolidayGraceDays] = useState(settings.holidayGraceDays ?? true);
  const [policySummerVacationCheckout, setPolicySummerVacationCheckout] = useState(settings.summerVacationCheckout ?? false);
  const [policyAutoEmailRemindersDaysBefore, setPolicyAutoEmailRemindersDaysBefore] = useState(settings.autoEmailRemindersDaysBefore ?? 2);
  const [policyDamagedBookMinorFee, setPolicyDamagedBookMinorFee] = useState(settings.damagedBookMinorFee ?? 3.00);
  const [policyNoteText, setPolicyNoteText] = useState(settings.policyNote || 'Books must be returned in good condition. Fines apply daily after grace period.');
  const [settingsSavedMessage, setSettingsSavedMessage] = useState(false);

  const openNewBookModal = () => {
    setEditingBookId(null);
    setTitle('');
    setAuthor('');
    setIsbn('');
    setBarcode('');
    setCategory('Classic Literature');
    setIsReferenceOnly(false);
    setTotalCopies(3);
    setShelfLocation('Fiction - Aisle 1');
    setCoverUrl('https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80');
    setDescription('');
    setPublisher('Scholastic');
    setPublicationYear(2022);
    setShowBookModal(true);
  };

  const openEditBookModal = (book: Book) => {
    setEditingBookId(book.id);
    setTitle(book.title);
    setAuthor(book.author);
    setIsbn(book.isbn);
    setBarcode(book.barcode);
    setCategory(book.category);
    setIsReferenceOnly(book.isReferenceOnly);
    setTotalCopies(book.totalCopies);
    setShelfLocation(book.shelfLocation);
    setCoverUrl(book.coverUrl);
    setDescription(book.description);
    setPublisher(book.publisher);
    setPublicationYear(book.publicationYear);
    setShowBookModal(true);
  };

  const handleSaveBook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !author.trim()) return;

    const bookData = {
      title: title.trim(),
      author: author.trim(),
      isbn: isbn.trim() || `978${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      barcode: barcode.trim() || isbn.trim() || `978${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      category,
      isReferenceOnly,
      totalCopies: Number(totalCopies),
      availableCopies: Number(totalCopies),
      shelfLocation: shelfLocation.trim(),
      coverUrl: coverUrl.trim(),
      description: description.trim(),
      publisher: publisher.trim(),
      publicationYear: Number(publicationYear),
      addedAt: new Date().toISOString().split('T')[0],
    };

    if (editingBookId) {
      onUpdateBook(editingBookId, bookData);
    } else {
      onAddBook(bookData);
    }

    setShowBookModal(false);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({
      maxBorrowDays: policyMaxBorrowDays,
      lateFeePerDay: policyLateFeeRate,
      maxRenewals: policyMaxRenewals,
      maxBooksPerStudent: policyMaxBooksStudent,
      gracePeriodDays: policyGracePeriodDays,
      maxBooksPerStaff: policyMaxBooksStaff,
      staffBorrowDays: policyStaffBorrowDays,
      maxActiveReservations: policyMaxActiveReservations,
      holdExpiryDays: policyHoldExpiryDays,
      lostBookReplacementFee: policyLostBookReplacementFee,
      allowReferenceCheckoutForStaff: policyAllowRefCheckoutStaff,
      maxOverdueFineCap: policyMaxOverdueFineCap,
      blockBorrowingFineThreshold: policyBlockBorrowingFineThreshold,
      allowRecallRequests: policyAllowRecallRequests,
      holidayGraceDays: policyHolidayGraceDays,
      summerVacationCheckout: policySummerVacationCheckout,
      autoEmailRemindersDaysBefore: policyAutoEmailRemindersDaysBefore,
      damagedBookMinorFee: policyDamagedBookMinorFee,
      policyNote: policyNoteText,
    });
    setSettingsSavedMessage(true);
    setTimeout(() => setSettingsSavedMessage(false), 3000);
  };

  const overdueLoans = loans.filter(l => l.status === 'overdue' || (l.lateFee > 0 && !l.feePaid));

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 text-slate-900 border border-slate-200 shadow-xl relative overflow-hidden">
        <div className="max-w-3xl space-y-2">
          <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-900 border border-amber-200 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider">
            <Shield className="w-3.5 h-3.5 text-amber-600" /> {t.adminInventory}
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            {t.adminInventory}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 font-medium">
            {language === 'dv'
              ? 'ފޮތްތައް އިތުރުކުރުމާއި، ބާކޯޑް ޕްރިންޓްކުރުމާއި، ޖޫރިމަނާ އަދި ލައިބްރަރީގެ އުޞޫލުތައް ބެލެހެއްޓެވުން.'
              : 'Catalog new titles, edit reference flags, print barcode labels, oversee late fees, and manage school library circulation policies.'}
          </p>
        </div>
      </div>

      {/* Admin Tab Switcher */}
      <div className="flex bg-white rounded-2xl border border-slate-200 p-1.5 shadow-md overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex-1 min-w-[140px] py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'inventory' ? 'bg-amber-500 text-white shadow' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
          id="admin-inventory-tab"
        >
          <BookOpen className="w-4 h-4" /> {language === 'dv' ? 'ފޮތްތަކުގެ އިންވެންޓްރީ' : 'Book Inventory'} ({books.length})
        </button>

        <button
          onClick={() => setActiveTab('late-fees')}
          className={`flex-1 min-w-[140px] py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'late-fees' ? 'bg-amber-500 text-white shadow' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
          id="admin-late-fees-tab"
        >
          <DollarSign className="w-4 h-4" /> {language === 'dv' ? 'ޖޫރިމަނާ އަދި މުއްދަތު ހަމަވެފައި' : 'Overdue & Late Fees'} ({overdueLoans.length})
        </button>

        <button
          onClick={() => setActiveTab('barcode-labels')}
          className={`flex-1 min-w-[140px] py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'barcode-labels' ? 'bg-amber-500 text-white shadow' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
          id="admin-barcode-tab"
        >
          <QrCode className="w-4 h-4" /> {language === 'dv' ? 'ބާކޯޑް ލޭބަލް ޕްރިންޓް' : 'Print Barcode Labels'}
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex-1 min-w-[140px] py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'users' ? 'bg-amber-500 text-white shadow' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
          id="admin-users-tab"
        >
          <Users className="w-4 h-4" /> {language === 'dv' ? 'މެންބަރުން އަދި އެކައުންޓްތައް' : 'Users & Parent Accounts'} ({users.length})
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 min-w-[140px] py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'settings' ? 'bg-amber-500 text-white shadow' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
          id="admin-settings-tab"
        >
          <Settings className="w-4 h-4" /> {language === 'dv' ? 'ލައިބްރަރީ އުޞޫލުތައް' : 'Library Policies'}
        </button>
      </div>

      {/* TAB 1: INVENTORY MANAGEMENT */}
      {activeTab === 'inventory' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="text-base font-black text-slate-900">Manage Cataloged Books</h3>
              <p className="text-xs text-slate-500 font-medium">Add, edit, bulk import, or set books as Reference Only</p>
            </div>
            <div className="flex items-center gap-2">
              {onOpenImportModal && (
                <button
                  onClick={() => onOpenImportModal('books')}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs px-3.5 py-2.5 rounded-xl transition flex items-center gap-2 border border-slate-300"
                  id="admin-import-books-btn"
                >
                  <FileSpreadsheet className="w-4 h-4 text-indigo-600" /> Import Books CSV
                </button>
              )}
              <button
                onClick={openNewBookModal}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow transition flex items-center gap-2"
                id="add-new-book-btn"
              >
                <Plus className="w-4 h-4" /> Add New Book Record
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white shadow-sm">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 text-slate-600 font-extrabold uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="p-3">Book Title / Author</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">ISBN / Barcode</th>
                  <th className="p-3">Shelf Location</th>
                  <th className="p-3">Copies</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {books.map(book => (
                  <tr key={book.id} className="hover:bg-slate-50 transition">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <img src={book.coverUrl} alt="" className="w-8 h-12 object-cover rounded-xl shadow border border-slate-200" />
                        <div>
                          <div className="font-extrabold text-slate-900">{book.title}</div>
                          <div className="text-[11px] text-slate-500 font-medium">by {book.author}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 font-bold text-slate-700">{book.category}</td>
                    <td className="p-3">
                      {book.isReferenceOnly ? (
                        <span className="bg-amber-100 text-amber-900 font-extrabold text-[10px] px-2.5 py-0.5 rounded-full border border-amber-300">
                          Ref Only
                        </span>
                      ) : (
                        <span className="bg-emerald-100 text-emerald-900 font-extrabold text-[10px] px-2.5 py-0.5 rounded-full border border-emerald-300">
                          Circulating
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-mono text-[11px] text-slate-600 font-bold">{book.barcode}</td>
                    <td className="p-3 font-bold text-slate-700">{book.shelfLocation}</td>
                    <td className="p-3 font-extrabold text-slate-900">{book.availableCopies} / {book.totalCopies}</td>
                    <td className="p-3 text-right space-x-2">
                      <button
                        onClick={() => openEditBookModal(book)}
                        className="p-1.5 text-indigo-600 hover:bg-slate-100 rounded-xl transition font-bold"
                        title="Edit Book"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDeleteBook(book.id)}
                        className="p-1.5 text-rose-600 hover:bg-slate-100 rounded-xl transition font-bold"
                        title="Delete Book"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: OVERDUE & LATE FEES */}
      {activeTab === 'late-fees' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xl space-y-4">
          <div>
            <h3 className="text-base font-black text-slate-900">Overdue Loans & Fee Collection</h3>
            <p className="text-xs text-slate-500 font-medium">Monitor late items and mark fees as collected</p>
          </div>

          {overdueLoans.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500 font-medium">
              No overdue loans or unpaid fees currently recorded!
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white shadow-sm">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100 text-slate-600 font-extrabold uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="p-3">Borrower Student</th>
                    <th className="p-3">Book Title</th>
                    <th className="p-3">Due Date</th>
                    <th className="p-3">Calculated Fee</th>
                    <th className="p-3">Payment Status</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {overdueLoans.map(loan => (
                    <tr key={loan.id} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-extrabold text-slate-900">{loan.userName} ({loan.userGrade})</td>
                      <td className="p-3 font-bold text-slate-800">{loan.bookTitle}</td>
                      <td className="p-3 font-mono text-rose-700 font-extrabold">{loan.dueDate}</td>
                      <td className="p-3 font-mono text-base font-black text-rose-600">${loan.lateFee.toFixed(2)}</td>
                      <td className="p-3">
                        {loan.feePaid ? (
                          <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">
                            Paid
                          </span>
                        ) : (
                          <span className="bg-rose-100 text-rose-900 border border-rose-300 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">
                            Unpaid Fee
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {!loan.feePaid && (
                          <button
                            onClick={() => onMarkFeePaid(loan.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] px-3 py-1.5 rounded-xl transition shadow"
                          >
                            Collect Fee (${loan.lateFee.toFixed(2)})
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: BARCODE LABEL GENERATOR */}
      {activeTab === 'barcode-labels' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xl space-y-6">
          <div>
            <h3 className="text-base font-black text-slate-900">Physical Barcode Label Generator</h3>
            <p className="text-xs text-slate-500 font-medium">Select any book in the inventory to generate printable barcode labels for physical book spines.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700">Select Book To Print Label:</label>
              <select
                value={selectedLabelBook?.id || ''}
                onChange={(e) => {
                  const b = books.find(x => x.id === e.target.value);
                  if (b) setSelectedLabelBook(b);
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none"
              >
                {books.map(b => (
                  <option key={b.id} value={b.id}>{b.title} - Barcode: {b.barcode}</option>
                ))}
              </select>

              <button
                onClick={() => window.print()}
                className="w-full bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-xs py-2.5 rounded-xl transition flex items-center justify-center gap-2 shadow"
              >
                <Printer className="w-4 h-4" /> Print Barcode Label Sheet
              </button>
            </div>

            {/* Label Preview Card */}
            {selectedLabelBook && (
              <div className="border-2 border-dashed border-slate-300 p-6 rounded-2xl bg-slate-50 flex flex-col items-center justify-center text-center space-y-2">
                <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Oakridge Library Spine Label</div>
                <div className="text-sm font-black text-slate-900">{selectedLabelBook.title}</div>
                <div className="text-xs font-bold text-slate-600">Location: {selectedLabelBook.shelfLocation}</div>
                
                {/* Simulated Barcode */}
                <div className="bg-white px-6 py-3 border border-slate-300 rounded-xl shadow space-y-1 my-2">
                  <div className="font-mono text-2xl tracking-[0.2em] font-black text-slate-900">
                    |||||| | |||| | ||||||
                  </div>
                  <div className="font-mono text-xs font-bold text-slate-800">
                    {selectedLabelBook.barcode}
                  </div>
                </div>

                {selectedLabelBook.isReferenceOnly && (
                  <span className="bg-amber-500 text-white font-extrabold text-[10px] px-3 py-0.5 rounded-full uppercase shadow">
                    REFERENCE ONLY
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: USERS & PARENT ACCOUNTS */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4 border-b pb-4 border-slate-100">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600" /> Member & Parent Account Directory
              </h3>
              <p className="text-xs text-slate-500 font-medium">Manage registered parent accounts, student links, and member profiles</p>
            </div>

            <div className="flex items-center gap-2">
              {onOpenImportModal && (
                <button
                  onClick={() => onOpenImportModal('parents')}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs px-3.5 py-2.5 rounded-xl transition flex items-center gap-2 border border-slate-300"
                  id="admin-import-parents-btn"
                >
                  <FileSpreadsheet className="w-4 h-4 text-purple-600" /> Import Parents CSV
                </button>
              )}
              {onOpenAddParentModal && (
                <button
                  onClick={onOpenAddParentModal}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow transition flex items-center gap-2"
                  id="admin-add-parent-account-btn"
                >
                  <Plus className="w-4 h-4" /> Register New Parent Account
                </button>
              )}
            </div>
          </div>

          {/* Parent Accounts List */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-4 h-4 text-purple-600" /> Parent Accounts ({users.filter(u => u.role === 'parent').length})
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {users.filter(u => u.role === 'parent').map((parent) => {
                const children = users.filter(u => u.parentId === parent.id || parent.childrenIds?.includes(u.id));

                return (
                  <div key={parent.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 relative group">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                          {parent.name}
                          <span className="bg-purple-100 text-purple-900 text-[10px] px-2 py-0.5 rounded-full border border-purple-200 font-bold">
                            Parent
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 font-medium mt-0.5">{parent.email}</div>
                      </div>

                      {onDeleteUser && (
                        <button
                          onClick={() => onDeleteUser(parent.id)}
                          className="bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 font-bold text-[11px] px-2.5 py-1 rounded-xl transition flex items-center gap-1 shrink-0"
                          title="Remove Parent Account"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" /> Remove
                        </button>
                      )}
                    </div>

                    {/* Linked Children */}
                    <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5 shadow-sm">
                      <div className="text-[11px] font-bold text-purple-900">
                        Linked Student Children ({children.length}):
                      </div>
                      {children.length === 0 ? (
                        <div className="text-[11px] text-slate-400 italic">No student children linked to this parent.</div>
                      ) : (
                        <div className="space-y-1">
                          {children.map(c => (
                            <div key={c.id} className="text-xs text-slate-800 font-bold flex items-center justify-between bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                              <span>{c.name} ({c.grade})</span>
                              <span className="font-mono text-[10px] text-slate-500">ID: {c.studentIdCode}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Student Members List */}
          <div className="space-y-3 pt-4 border-t border-slate-200">
            <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
              Student Members ({users.filter(u => u.role === 'student').length})
            </h4>

            <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white shadow-sm">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100 text-slate-600 font-extrabold uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="p-3">Student Name</th>
                    <th className="p-3">Grade</th>
                    <th className="p-3">Student ID Barcode</th>
                    <th className="p-3">Linked Parent</th>
                    <th className="p-3 text-right">Admin Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.filter(u => u.role === 'student').map(student => {
                    const parent = users.find(u => u.id === student.parentId || u.childrenIds?.includes(student.id));
                    return (
                      <tr key={student.id} className="hover:bg-slate-50 transition">
                        <td className="p-3 font-extrabold text-slate-900">{student.name}</td>
                        <td className="p-3 font-bold text-slate-700">{student.grade}</td>
                        <td className="p-3 font-mono text-indigo-700 font-bold">{student.studentIdCode || 'N/A'}</td>
                        <td className="p-3 text-slate-700 font-medium">
                          {parent ? (
                            <span className="text-purple-900 font-bold">{parent.name}</span>
                          ) : (
                            <span className="text-slate-400 italic">Unlinked</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          {onDeleteUser && (
                            <button
                              onClick={() => onDeleteUser(student.id)}
                              className="bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 font-bold text-[11px] px-2.5 py-1 rounded-xl transition inline-flex items-center gap-1"
                              title="Remove Student Account"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-600" /> Remove
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* TAB 5: POLICY SETTINGS */}
      {activeTab === 'settings' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xl space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-lg font-black text-slate-900">
              {language === 'dv' ? 'ލައިބްރަރީ ސާކިއުލޭޝަން އުޞޫލުތަކާއި ގަވާއިދުތައް' : 'Library Circulation Rules & Policy Management'}
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {language === 'dv'
                ? 'ފޮތް ދޫކުރުމުގެ މުއްދަތުތަކާއި، ކޯޓާތައް، ޖޫރިމަނާ އަދި ނަންނޯޓުކުރުމުގެ ގަވާއިދުތައް ކަނޑައެޅުއްވުން'
                : 'Configure checkout loan limits, renewal terms, hold durations, grace periods, and late fee structures'}
            </p>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-6 text-xs">
            {/* Section 1: Loan Durations & Renewals */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
              <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-200 pb-2">
                <BookOpen className="w-4 h-4 text-blue-600" />
                {language === 'dv' ? 'ފޮތް ދޫކުރެވޭ މުއްދަތާއި އިތުރުކުރުން' : 'Loan Periods & Renewals'}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'dv' ? 'ދަރިވަރުންގެ މުއްދަތު (ދުވަސް)' : 'Student Loan Period (Days)'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={policyMaxBorrowDays}
                    onChange={(e) => setPolicyMaxBorrowDays(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">{language === 'dv' ? 'އާންމު ދަރިވަރުންނަށް ފޮތް ދޫކުރެވޭ މުއްދަތު' : 'Default loan period for students'}</p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'dv' ? 'މުވައްޒަފުންގެ މުއްދަތު (ދުވަސް)' : 'Staff/Faculty Loan Period (Days)'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={policyStaffBorrowDays}
                    onChange={(e) => setPolicyStaffBorrowDays(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">{language === 'dv' ? 'މުދައްރިސުންނަށް ފޮތް ދޫކުރެވޭ މުއްދަތު' : 'Extended period for teachers/staff'}</p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'dv' ? 'ގްރޭސް ޕީރިއަޑް (ދުވަސް)' : 'Grace Period (Days)'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={policyGracePeriodDays}
                    onChange={(e) => setPolicyGracePeriodDays(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">{language === 'dv' ? 'ޖޫރިމަނާ ހިނގަން ފެށުމުގެ ކުރިން ލިބޭ ލުއި' : 'Free days before late fine kicks in'}</p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'dv' ? 'އޮންލައިންކޮށް އިތުރުކުރެވޭ މިންވަރު' : 'Max Online Renewals'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={policyMaxRenewals}
                    onChange={(e) => setPolicyMaxRenewals(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">{language === 'dv' ? 'ކޮންމެ ފޮތަކަށް އިތުރުކުރެވޭނެ އެންމެ ގިނަ އަދަދު' : 'Max times a loan can be extended online'}</p>
                </div>
              </div>
            </div>

            {/* Section 2: Quotas & Holds */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
              <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-200 pb-2">
                <Users className="w-4 h-4 text-purple-600" />
                {language === 'dv' ? 'ފޮތް ނެގުމުގެ ކޯޓާއާއި ރިޒަވޭޝަން' : 'Borrowing Limits & Reservations'}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'dv' ? 'ދަރިވަރަކަށް އެންމެ ގިނަވެގެން ފޮތް' : 'Max Books / Student'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={policyMaxBooksStudent}
                    onChange={(e) => setPolicyMaxBooksStudent(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">{language === 'dv' ? 'އެކަކަށް އެއްފަހަރާ ނެގޭނެ ފޮތުގެ އަދަދު' : 'Simultaneous student checkout limit'}</p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'dv' ? 'މުވައްޒަފަކަށް އެންމެ ގިނަވެގެން ފޮތް' : 'Max Books / Staff'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={policyMaxBooksStaff}
                    onChange={(e) => setPolicyMaxBooksStaff(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">{language === 'dv' ? 'މުދައްރިސުންނަށް އެއްފަހަރާ ނެގޭނެ ކޯޓާ' : 'Simultaneous staff checkout limit'}</p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'dv' ? 'އެންމެ ގިނަވެގެން ރިޒަވޭޝަން' : 'Max Reservations / User'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={policyMaxActiveReservations}
                    onChange={(e) => setPolicyMaxActiveReservations(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">{language === 'dv' ? 'އޮންލައިންކޮށް އެކަކަށް ނަންނޯޓު ކުރެވޭނެ އަދަދު' : 'Simultaneous hold requests allowed'}</p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'dv' ? 'ރިޒަވޭޝަން ހޯލްޑް މުއްދަތު (ދުވަސް)' : 'Hold Desk Expiry (Days)'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={policyHoldExpiryDays}
                    onChange={(e) => setPolicyHoldExpiryDays(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">{language === 'dv' ? 'ޑެސްކުގައި ފޮތް ބަހައްޓައިދޭނެ ދުވަސް' : 'Days held before reservation expires'}</p>
                </div>
              </div>
            </div>

            {/* Section 3: Fees & Fine Caps */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
              <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-200 pb-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                {language === 'dv' ? 'ޖޫރިމަނާ، ފީ އަދި ސީލިންގް ގަވާއިދުތައް' : 'Fines, Maximum Caps & Damage Fees'}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'dv' ? 'ދުވަހު ޖޫރިމަނާ ($)' : 'Daily Late Fee Rate ($/day)'}
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min={0}
                    value={policyLateFeeRate}
                    onChange={(e) => setPolicyLateFeeRate(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">{language === 'dv' ? 'މުއްދަތު ހަމަވާ ފަހުން ކޮންމެ ދުވަހަކަށް' : 'Daily fine assessed after grace period'}</p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'dv' ? 'އެންމެ ބޮޑު ޖޫރިމަނާ ކެޕް ($)' : 'Max Fine Cap / Loan ($)'}
                  </label>
                  <input
                    type="number"
                    step="1.00"
                    min={0}
                    value={policyMaxOverdueFineCap}
                    onChange={(e) => setPolicyMaxOverdueFineCap(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">{language === 'dv' ? 'އެއް ފޮތަކުން ނެގެނޭ އެންމެ ބޮޑު ޖޫރިމަނާ' : 'Maximum fine accumulation limit per book'}</p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'dv' ? 'ގެއްލޭ ފޮތުގެ ރީޕްލޭސްމަންޓް ފީ ($)' : 'Lost Item Processing Fee ($)'}
                  </label>
                  <input
                    type="number"
                    step="1.00"
                    min={0}
                    value={policyLostBookReplacementFee}
                    onChange={(e) => setPolicyLostBookReplacementFee(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">{language === 'dv' ? 'ފޮތް ގެއްލުމުން ނެގޭ އެޑްމިން ފީ' : 'Flat administrative processing fee'}</p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'dv' ? 'ކުދި ހަލާކު/ބާކޯޑު ފީ ($)' : 'Minor Damage / Tag Fee ($)'}
                  </label>
                  <input
                    type="number"
                    step="0.50"
                    min={0}
                    value={policyDamagedBookMinorFee}
                    onChange={(e) => setPolicyDamagedBookMinorFee(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">{language === 'dv' ? 'ކުދި ހަލާކު ނުވަތަ ބާކޯޑު ގެއްލުމުން' : 'Fee for minor cover damage or tag loss'}</p>
                </div>
              </div>
            </div>

            {/* Section 4: Account Restrictions & System Controls */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
              <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-200 pb-2">
                <Shield className="w-4 h-4 text-indigo-600" />
                {language === 'dv' ? 'އެކައުންޓް ބްލޮކްކުރުމާއި، ކެލެންޑަރ އަދި ނޮޓިފިކޭޝަން ގަވާއިދު' : 'Borrowing Block Thresholds, Calendar Rules & Automated Reminders'}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'dv' ? 'ފޮތް ނެގުން ބްލޮކްވާ ޖޫރިމަނާ ލިމިޓް ($)' : 'Block Checkout Fine Limit ($)'}
                  </label>
                  <input
                    type="number"
                    step="1.00"
                    min={0}
                    value={policyBlockBorrowingFineThreshold}
                    onChange={(e) => setPolicyBlockBorrowingFineThreshold(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">{language === 'dv' ? 'މިއަށްވުރެ ގިނައިން ޖޫރިމަނާ އޮތްނަމަ ފޮތް ނުނެގޭނެ' : 'Unpaid balance that suspends new checkouts'}</p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'dv' ? 'އޮޓޯ މެސެޖް ފޮނުވާނެ ދުވަސް (ކުރިން)' : 'Auto Email Advance Notice (Days)'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={7}
                    value={policyAutoEmailRemindersDaysBefore}
                    onChange={(e) => setPolicyAutoEmailRemindersDaysBefore(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">{language === 'dv' ? 'މުއްދަތު ހަމަވުމުގެ ކިތައް ދުވަސް ކުރިން؟' : 'Days prior to due date to send reminder'}</p>
                </div>

                <div className="flex flex-col justify-center space-y-2">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={policyHolidayGraceDays}
                      onChange={(e) => setPolicyHolidayGraceDays(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-600 accent-amber-600"
                    />
                    <span className="font-bold text-xs text-slate-800">
                      {language === 'dv' ? 'ބަންދު ދުވަސްތަކުގައި ޖޫރިމަނާ ހިނގުން ހުއްޓުވުން' : 'Pause Fines During School Holidays & Weekends'}
                    </span>
                  </label>

                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={policyAllowRecallRequests}
                      onChange={(e) => setPolicyAllowRecallRequests(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-600 accent-amber-600"
                    />
                    <span className="font-bold text-xs text-slate-800">
                      {language === 'dv' ? 'އަވަސް ރީކޯލް (Recall) ހުއްދަދިނުން' : 'Enable Librarian Emergency Recall Requests'}
                    </span>
                  </label>

                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={policySummerVacationCheckout}
                      onChange={(e) => setPolicySummerVacationCheckout(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-600 accent-amber-600"
                    />
                    <span className="font-bold text-xs text-slate-800">
                      {language === 'dv' ? 'ބޮޑު ބަންދުގެ އިތުރު ފޮތް ދޫކުރުން' : 'Allow Vacation Long-Term Summer Loans'}
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Section 4: Notice Note */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-2">
              <label className="block font-bold text-slate-800 text-xs">
                {language === 'dv' ? 'މެންބަރުންނަށް ފެންނާނެ އުޞޫލުގެ އިޢުލާން' : 'Public Policy Notice / Member Instructions'}
              </label>
              <textarea
                rows={2}
                value={policyNoteText}
                onChange={(e) => setPolicyNoteText(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Notice displayed on borrowings and portal screens..."
              />
            </div>

            {settingsSavedMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 font-bold animate-fade-in">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                {language === 'dv' ? 'އުޞޫލުތައް ކާމިޔާބުކަމާއެކު އަދާހަމަކުރެވިއްޖެ!' : 'Circulation rules and settings saved successfully! All library desk policies updated.'}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold text-xs px-6 py-3 rounded-xl shadow-md transition cursor-pointer flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                {language === 'dv' ? 'އުޞޫލުތައް ސޭވްކުރައްވާ' : 'Save Circulation Rules'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add/Edit Book Modal */}
      {showBookModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 max-h-[90vh] overflow-y-auto space-y-4 text-slate-800">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="text-base font-black text-slate-900">
                {editingBookId ? 'Edit Book Details' : 'Add New Book Record'}
              </h3>
              <button onClick={() => setShowBookModal(false)} className="text-slate-400 hover:text-slate-700 font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveBook} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Book Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  id="book-title-input"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Author *</label>
                <input
                  type="text"
                  required
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  id="book-author-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">ISBN Code</label>
                  <input
                    type="text"
                    value={isbn}
                    onChange={(e) => setIsbn(e.target.value)}
                    placeholder="978..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    id="book-isbn-input"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Barcode Label</label>
                  <input
                    type="text"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="Same as ISBN..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    id="book-barcode-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Shelf Location</label>
                  <input
                    type="text"
                    value={shelfLocation}
                    onChange={(e) => setShelfLocation(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="font-extrabold text-amber-900">Reference Book Only</div>
                  <p className="text-[10px] text-amber-800 font-medium">Check this if the item is non-circulating (Library Use Only)</p>
                </div>
                <input
                  type="checkbox"
                  checked={isReferenceOnly}
                  onChange={(e) => setIsReferenceOnly(e.target.checked)}
                  className="w-5 h-5 rounded text-amber-500 accent-amber-500"
                  id="book-ref-only-checkbox"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Total Copies</label>
                <input
                  type="number"
                  min={1}
                  value={totalCopies}
                  onChange={(e) => setTotalCopies(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Cover Image URL</label>
                <input
                  type="text"
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowBookModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-extrabold rounded-xl shadow transition"
                >
                  Save Book Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
