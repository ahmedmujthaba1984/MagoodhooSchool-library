import React, { useState } from 'react';
import { QrCode, BookOpen, User, Calendar, CheckCircle2, AlertTriangle, ArrowRight, RotateCcw, ShieldAlert, Sparkles, DollarSign, Search, Check, Layers } from 'lucide-react';
import { Book, UserProfile, Loan, LibrarySettings } from '../types';
import { useLanguage } from '../lib/i18n';

interface QuickCheckoutProps {
  books: Book[];
  users: UserProfile[];
  loans: Loan[];
  settings: LibrarySettings;
  onProcessCheckout: (book: Book, borrower: UserProfile, dueDateDays: number) => void;
  onProcessReturn: (loan: Loan, calculatedFee: number) => void;
  onOpenScanner: () => void;
}

export const QuickCheckout: React.FC<QuickCheckoutProps> = ({
  books,
  users,
  loans,
  settings,
  onProcessCheckout,
  onProcessReturn,
  onOpenScanner
}) => {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'checkout' | 'return'>('checkout');

  // Checkout Form State
  const [selectedBookBarcode, setSelectedBookBarcode] = useState('');
  const [selectedStudentCode, setSelectedStudentCode] = useState('');
  const [borrowDays, setBorrowDays] = useState(settings.maxBorrowDays || 14);
  const [checkoutSuccessMessage, setCheckoutSuccessMessage] = useState<string | null>(null);
  const [checkoutErrorMessage, setCheckoutErrorMessage] = useState<string | null>(null);

  // Return Form State
  const [returnBarcode, setReturnBarcode] = useState('');
  const [autoReturnOnScan, setAutoReturnOnScan] = useState(true);
  const [lastReturnedReceipt, setLastReturnedReceipt] = useState<{
    bookTitle: string;
    bookCover?: string;
    userName: string;
    userGrade?: string;
    studentIdCode?: string;
    userRole?: string;
    loanIssueDate: string;
    loanDueDate: string;
    returnDate: string;
    lateFee: number;
  } | null>(null);
  const [returnSuccessMessage, setReturnSuccessMessage] = useState<string | null>(null);
  const [returnErrorMessage, setReturnErrorMessage] = useState<string | null>(null);

  // Match Book & Student for Checkout
  const matchedBook = books.find(
    b => b.barcode.toLowerCase() === selectedBookBarcode.trim().toLowerCase() ||
         b.isbn.toLowerCase() === selectedBookBarcode.trim().toLowerCase() ||
         b.id === selectedBookBarcode.trim()
  );

  const matchedStudent = users.find(
    u => u.studentIdCode?.toLowerCase() === selectedStudentCode.trim().toLowerCase() ||
         u.id === selectedStudentCode.trim() ||
         u.name.toLowerCase().includes(selectedStudentCode.trim().toLowerCase())
  );

  // Match Book & Member for Return
  const returnTargetBook = books.find(
    b => b.barcode.toLowerCase() === returnBarcode.trim().toLowerCase() ||
         b.isbn.toLowerCase() === returnBarcode.trim().toLowerCase() ||
         b.id === returnBarcode.trim()
  );

  const returnActiveLoan = loans.find(
    l => l.bookId === returnTargetBook?.id && (l.status === 'active' || l.status === 'overdue')
  );

  const returnBorrowerUser = users.find(
    u => u.id === returnActiveLoan?.userId
  ) || (returnActiveLoan ? {
    id: returnActiveLoan.userId,
    name: returnActiveLoan.userName,
    role: 'student',
    grade: returnActiveLoan.userGrade
  } as UserProfile : undefined);

  const handleCheckoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutSuccessMessage(null);
    setCheckoutErrorMessage(null);

    if (!matchedBook) {
      setCheckoutErrorMessage('Please select or scan a valid book in the inventory.');
      return;
    }

    if (matchedBook.isReferenceOnly) {
      setCheckoutErrorMessage('Cannot checkout! This book is marked as REFERENCE ONLY (Non-circulating).');
      return;
    }

    if (matchedBook.availableCopies <= 0) {
      setCheckoutErrorMessage('Cannot checkout! All physical copies are currently checked out.');
      return;
    }

    if (!matchedStudent) {
      setCheckoutErrorMessage('Please select or scan a valid student member.');
      return;
    }

    onProcessCheckout(matchedBook, matchedStudent, borrowDays);
    setCheckoutSuccessMessage(`Successfully checked out "${matchedBook.title}" to ${matchedStudent.name}!`);
    setSelectedBookBarcode('');
    setSelectedStudentCode('');
  };

  const handleReturnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setReturnSuccessMessage(null);
    setReturnErrorMessage(null);

    if (!returnBarcode.trim()) return;

    if (!returnTargetBook) {
      setReturnErrorMessage(
        language === 'dv'
          ? 'މި ބާކޯޑު ނުވަތަ އައި.އެސް.ބީ.އެން ލައިބްރަރީ ކެޓަލޮގުން ނުފެނުނު.'
          : `No book found in catalog matching barcode/ISBN "${returnBarcode.trim()}".`
      );
      return;
    }

    if (!returnActiveLoan) {
      setReturnErrorMessage(
        language === 'dv'
          ? `"${returnTargetBook.title}" މިވަގުތު ދޫކޮށްފައެއް ނެތް.`
          : `"${returnTargetBook.title}" is not currently checked out (all copies are in inventory).`
      );
      return;
    }

    // Calculate late fee if overdue
    let lateFee = 0;
    const dueDate = new Date(returnActiveLoan.dueDate);
    const today = new Date();
    if (today > dueDate) {
      const diffTime = Math.abs(today.getTime() - dueDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      lateFee = diffDays * (settings.dailyLateFee || 0.5);
    }

    // Execute return
    onProcessReturn(returnActiveLoan, lateFee);

    const borrowerName = returnBorrowerUser?.name || returnActiveLoan.userName;
    const studentCode = returnBorrowerUser?.studentIdCode || returnBorrowerUser?.id || returnActiveLoan.userId;
    const todayStr = new Date().toISOString().split('T')[0];

    setLastReturnedReceipt({
      bookTitle: returnTargetBook.title,
      bookCover: returnTargetBook.coverUrl,
      userName: borrowerName,
      userGrade: returnBorrowerUser?.grade || returnActiveLoan.userGrade,
      studentIdCode: studentCode,
      userRole: returnBorrowerUser?.role || 'student',
      loanIssueDate: returnActiveLoan.issueDate,
      loanDueDate: returnActiveLoan.dueDate,
      returnDate: todayStr,
      lateFee
    });

    setReturnSuccessMessage(
      language === 'dv'
        ? `"${returnTargetBook.title}" އަނބުރާ ބަލައިގަނެވިއްޖެ! މެންބަރު: ${borrowerName}`
        : `Successfully checked in "${returnTargetBook.title}" returned by member ${borrowerName}!`
    );

    setReturnBarcode('');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      
      {/* Vibrant Top Hero Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-600 to-purple-700 text-white rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl relative z-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-md text-white font-extrabold px-3 py-1 rounded-full text-[11px] uppercase tracking-wider border border-white/20">
              <QrCode className="w-3.5 h-3.5 text-amber-300" /> {t.scanCheckout}
            </span>
            <span className="inline-flex items-center gap-1.5 bg-emerald-500/30 text-emerald-100 font-bold px-3 py-1 rounded-full text-[11px] border border-emerald-400/30">
              ⚡ USB & Bluetooth Scanner Ready
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight drop-shadow-sm">
            {t.scanCheckout}
          </h2>
          <p className="text-xs sm:text-sm text-blue-100 font-medium leading-relaxed">
            {language === 'dv'
              ? 'ފޮތްތަކާއި ދަރިވަރުންގެ ކާޑުގައިވާ ބާކޯޑް ސްކޭންކޮށްގެން އަވަހަށް ފޮތް ދޫކުރުމާއި އަނބުރާ ޙަވާލުކުރުން ކުރިއަށް ގެންދަވާ.'
              : 'Scan physical book barcodes and student ID cards for instant library checkout, automated renewals, and hassle-free returns.'}
          </p>
        </div>

        <button
          onClick={onOpenScanner}
          className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs px-5 py-3.5 rounded-2xl shadow-xl hover:shadow-2xl transition flex items-center gap-2 shrink-0 border-2 border-white/80 transform hover:-translate-y-0.5 cursor-pointer"
          id="desk-launch-camera-scanner-btn"
        >
          <QrCode className="w-5 h-5 text-slate-950" /> {language === 'dv' ? 'ކެމެރާ ސްކޭނަރ ހުޅުވާ' : 'Launch Camera Scanner'}
        </button>
      </div>

      {/* Colorful Mode Tabs */}
      <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-md flex gap-2">
        <button
          onClick={() => setActiveTab('checkout')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'checkout'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-bold'
          }`}
          id="checkout-tab-btn"
        >
          <BookOpen className="w-4 h-4" /> {language === 'dv' ? 'ފޮތް ދޫކުރުން (Checkout)' : 'Issue Book (Checkout)'}
        </button>
        <button
          onClick={() => setActiveTab('return')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'return'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/30'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-bold'
          }`}
          id="return-tab-btn"
        >
          <RotateCcw className="w-4 h-4" /> {language === 'dv' ? 'ފޮތް އަނބުރާ ބަލައިގަތުން (Return)' : 'Receive Book (Check-in Return)'}
        </button>
      </div>

      {/* ISSUE BOOK (CHECKOUT) FORM CARD */}
      {activeTab === 'checkout' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xl space-y-6">
          <form onSubmit={handleCheckoutSubmit} className="space-y-6">
            
            {/* STEP 1: BOOK SELECTION */}
            <div className="bg-gradient-to-br from-blue-50/80 to-indigo-50/50 p-5 rounded-2xl border border-blue-100 space-y-3">
              <label className="block text-xs font-black uppercase tracking-wider text-blue-900 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-black shadow-sm">1</span>
                  Step 1: Scan or Select Book
                </span>
                <span className="text-[11px] font-bold text-blue-700 bg-blue-100 px-2.5 py-0.5 rounded-full border border-blue-200">
                  Catalog Search
                </span>
              </label>
              
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={selectedBookBarcode}
                    onChange={(e) => setSelectedBookBarcode(e.target.value)}
                    placeholder="Scan barcode, ISBN (e.g. 9780061120084), or type title..."
                    className="w-full pl-10 pr-3.5 py-3 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                    id="checkout-book-barcode-input"
                  />
                </div>
                <select
                  onChange={(e) => setSelectedBookBarcode(e.target.value)}
                  className="px-3.5 py-3 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 sm:max-w-[220px] focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                >
                  <option value="">Quick Select From List...</option>
                  {books.map(b => (
                    <option key={b.id} value={b.barcode}>
                      {b.title} {b.isReferenceOnly ? '(Ref Only)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {matchedBook ? (
                <div className={`p-4 rounded-2xl border text-xs flex items-center gap-4 transition shadow-sm ${
                  matchedBook.isReferenceOnly
                    ? 'bg-amber-50 border-amber-200 text-amber-950'
                    : matchedBook.availableCopies > 0
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : 'bg-rose-50 border-rose-200 text-rose-950'
                }`}>
                  <img src={matchedBook.coverUrl} alt={matchedBook.title} className="w-12 h-16 object-cover rounded-xl shadow border border-slate-200 shrink-0" />
                  <div className="space-y-1 flex-1">
                    <div className="font-extrabold text-sm text-slate-900">{matchedBook.title}</div>
                    <div className="text-[11px] text-slate-600 font-medium">By {matchedBook.author} | Category: <span className="font-bold text-indigo-700">{matchedBook.category}</span></div>
                    <div className="text-[11px] text-slate-500 font-mono">Location: <strong className="text-slate-800">{matchedBook.shelfLocation}</strong> | ISBN: <strong>{matchedBook.isbn}</strong></div>
                    {matchedBook.isReferenceOnly ? (
                      <span className="font-extrabold text-amber-800 flex items-center gap-1.5 mt-1 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300 w-fit">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-600" /> REFERENCE ONLY - NON-CIRCULATING!
                      </span>
                    ) : (
                      <span className={`font-extrabold text-[11px] inline-block px-2.5 py-0.5 rounded-full border mt-1 ${
                        matchedBook.availableCopies > 0 ? 'bg-emerald-100 text-emerald-900 border-emerald-300' : 'bg-rose-100 text-rose-900 border-rose-300'
                      }`}>
                        Available Stock: {matchedBook.availableCopies} of {matchedBook.totalCopies} copies
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-blue-700 font-medium italic bg-white/60 p-2.5 rounded-xl border border-blue-100 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  Type or scan book barcode to preview title and real-time inventory count.
                </div>
              )}
            </div>

            {/* STEP 2: STUDENT SELECTION */}
            <div className="bg-gradient-to-br from-purple-50/80 to-indigo-50/50 p-5 rounded-2xl border border-purple-100 space-y-3">
              <label className="block text-xs font-black uppercase tracking-wider text-purple-900 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-purple-600 text-white flex items-center justify-center text-xs font-black shadow-sm">2</span>
                  Step 2: Scan or Select Student Member
                </span>
                <span className="text-[11px] font-bold text-purple-700 bg-purple-100 px-2.5 py-0.5 rounded-full border border-purple-200">
                  Student Verification
                </span>
              </label>

              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={selectedStudentCode}
                    onChange={(e) => setSelectedStudentCode(e.target.value)}
                    placeholder="Scan Student ID card barcode (e.g. STU-2041) or type student name..."
                    className="w-full pl-10 pr-3.5 py-3 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-sm"
                    id="checkout-student-code-input"
                  />
                </div>
                <select
                  onChange={(e) => setSelectedStudentCode(e.target.value)}
                  className="px-3.5 py-3 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 sm:max-w-[220px] focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-sm"
                >
                  <option value="">Select Student...</option>
                  {users.filter(u => u.role === 'student').map(u => (
                    <option key={u.id} value={u.studentIdCode || u.id}>
                      {u.name} ({u.grade})
                    </option>
                  ))}
                </select>
              </div>

              {matchedStudent ? (
                <div className="p-3.5 bg-purple-100/70 border border-purple-200 text-purple-950 rounded-2xl text-xs flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-purple-600 text-white font-extrabold flex items-center justify-center text-xs shadow">
                      {matchedStudent.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-extrabold text-sm text-slate-900">{matchedStudent.name}</div>
                      <div className="text-[11px] text-purple-900 font-semibold">
                        Student ID: <span className="font-mono font-bold text-purple-700">{matchedStudent.studentIdCode || matchedStudent.id}</span>
                      </div>
                    </div>
                  </div>
                  <span className="bg-purple-600 text-white font-extrabold text-[10px] px-3 py-1 rounded-full shadow-xs">
                    {matchedStudent.grade}
                  </span>
                </div>
              ) : (
                <div className="text-[11px] text-purple-700 font-medium italic bg-white/60 p-2.5 rounded-xl border border-purple-100 flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                  Select or scan student barcode to attach borrower record.
                </div>
              )}
            </div>

            {/* STEP 3: LOAN PERIOD */}
            <div className="bg-gradient-to-br from-emerald-50/80 to-teal-50/50 p-5 rounded-2xl border border-emerald-100 space-y-3">
              <label className="block text-xs font-black uppercase tracking-wider text-emerald-900 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs font-black shadow-sm">3</span>
                  Step 3: Loan Duration & Due Date
                </span>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  Circulation Policy
                </span>
              </label>
              
              <div className="flex flex-wrap items-center gap-4 bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-700">Days:</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={borrowDays}
                    onChange={(e) => setBorrowDays(parseInt(e.target.value) || 14)}
                    className="w-20 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-extrabold text-center text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="text-xs text-slate-600 font-medium flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  Calculated Due Date: <span className="font-extrabold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                    {new Date(Date.now() + borrowDays * 86400000).toISOString().split('T')[0]}
                  </span>
                </div>
              </div>
            </div>

            {/* Feedback Alerts */}
            {checkoutErrorMessage && (
              <div className="p-4 bg-rose-50 border border-rose-200 text-rose-900 text-xs rounded-2xl flex items-center gap-3 font-bold shadow-sm">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                {checkoutErrorMessage}
              </div>
            )}

            {checkoutSuccessMessage && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs rounded-2xl flex items-center gap-3 font-extrabold shadow-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                {checkoutSuccessMessage}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-black text-sm py-3.5 rounded-2xl shadow-lg shadow-indigo-500/25 transition flex items-center justify-center gap-2 cursor-pointer transform hover:-translate-y-0.5"
              id="confirm-checkout-btn"
            >
              <CheckCircle2 className="w-5 h-5" /> Confirm & Issue Book Loan
            </button>
          </form>
        </div>
      )}

      {/* RECEIVE BOOK (CHECK-IN RETURN) FORM CARD */}
      {activeTab === 'return' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xl space-y-6">
          <form onSubmit={handleReturnSubmit} className="space-y-6">
            
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-5 rounded-2xl border border-emerald-100 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="text-xs font-black uppercase tracking-wider text-emerald-900 flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-emerald-600" /> Scan Returned Book Barcode or ISBN
                </label>
                <label className="flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoReturnOnScan}
                    onChange={(e) => setAutoReturnOnScan(e.target.checked)}
                    className="accent-emerald-600 rounded cursor-pointer"
                  />
                  <span>⚡ Auto Member Check & Return</span>
                </label>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={returnBarcode}
                  onChange={(e) => setReturnBarcode(e.target.value)}
                  placeholder="Scan book barcode or type ISBN (e.g. 9780061120084)..."
                  className="flex-1 px-4 py-3 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
                  autoFocus
                  id="return-barcode-input"
                />
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-6 py-3 rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer shrink-0"
                >
                  <RotateCcw className="w-4 h-4" /> Check Member & Process Return
                </button>
              </div>

              {/* Live Member Match Preview Card */}
              {returnTargetBook && returnActiveLoan && (
                <div className="p-4 bg-emerald-100/60 border-2 border-emerald-500/40 rounded-2xl space-y-3 animate-in fade-in zoom-in-95 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-wider text-emerald-900 bg-emerald-200/80 px-2.5 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-emerald-700" /> Borrower Member Identified
                    </span>
                    <span className="text-[11px] font-mono text-slate-600">
                      ISBN: {returnTargetBook.isbn}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-3.5 rounded-xl border border-emerald-200 shadow-xs">
                    <div className="flex items-center gap-3">
                      {returnTargetBook.coverUrl ? (
                        <img src={returnTargetBook.coverUrl} alt={returnTargetBook.title} className="w-12 h-16 object-cover rounded-lg shadow-sm border border-slate-200 shrink-0" />
                      ) : (
                        <div className="w-12 h-16 bg-slate-100 rounded-lg flex items-center justify-center shrink-0 border">
                          <BookOpen className="w-6 h-6 text-slate-400" />
                        </div>
                      )}
                      <div className="space-y-0.5">
                        <h4 className="font-black text-sm text-slate-900">{returnTargetBook.title}</h4>
                        <p className="text-xs font-semibold text-indigo-700">Author: {returnTargetBook.author}</p>
                        <p className="text-[11px] text-slate-500">Location: {returnTargetBook.shelfLocation}</p>
                      </div>
                    </div>

                    {returnBorrowerUser && (
                      <div className="flex items-center gap-3 bg-purple-50 p-2.5 rounded-xl border border-purple-200 shrink-0">
                        <div className="w-9 h-9 rounded-full bg-purple-600 text-white font-black flex items-center justify-center text-xs shadow-xs">
                          {returnBorrowerUser.name.charAt(0)}
                        </div>
                        <div>
                          <div className="text-xs font-extrabold text-purple-950">{returnBorrowerUser.name}</div>
                          <div className="text-[10px] text-purple-700 font-medium">
                            ID: <span className="font-mono font-bold text-purple-900">{returnBorrowerUser.studentIdCode || returnBorrowerUser.id}</span> ({returnBorrowerUser.grade || 'Member'})
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs font-medium text-slate-700 px-1">
                    <div>Issued: <strong className="text-slate-900">{returnActiveLoan.issueDate}</strong> | Due: <strong className="text-slate-900">{returnActiveLoan.dueDate}</strong></div>
                    {returnActiveLoan.status === 'overdue' && (
                      <span className="text-[11px] font-extrabold bg-rose-600 text-white px-2.5 py-0.5 rounded-full">
                        Overdue Notice
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Last Return Receipt Confirmation Card */}
            {lastReturnedReceipt && (
              <div className="p-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-3xl shadow-xl space-y-3 border-2 border-emerald-400/50">
                <div className="flex items-center justify-between border-b border-white/20 pb-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-300" />
                    <span className="font-extrabold text-sm uppercase tracking-wider text-emerald-100">
                      Return Verified & Stock Restored
                    </span>
                  </div>
                  <span className="text-[11px] font-mono bg-white/20 px-2.5 py-0.5 rounded-full text-emerald-100">
                    {lastReturnedReceipt.returnDate}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {lastReturnedReceipt.bookCover && (
                      <img src={lastReturnedReceipt.bookCover} alt="" className="w-12 h-16 object-cover rounded-xl shadow border border-white/30 shrink-0" />
                    )}
                    <div>
                      <div className="font-extrabold text-base text-white">{lastReturnedReceipt.bookTitle}</div>
                      <div className="text-xs text-emerald-100 font-medium">
                        Book copy returned and catalog inventory updated.
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/20 space-y-1 text-xs shrink-0">
                    <div className="text-[10px] uppercase font-extrabold text-emerald-200">Borrower Member</div>
                    <div className="font-black text-sm text-white">{lastReturnedReceipt.userName}</div>
                    <div className="text-[11px] text-emerald-100 font-mono">
                      ID: {lastReturnedReceipt.studentIdCode} ({lastReturnedReceipt.userGrade})
                    </div>
                  </div>
                </div>

                {lastReturnedReceipt.lateFee > 0 ? (
                  <div className="p-2.5 bg-amber-500/20 border border-amber-300/40 rounded-xl text-xs font-bold text-amber-200 flex items-center justify-between">
                    <span>Overdue Late Fee:</span>
                    <span className="font-mono text-sm font-black text-amber-300">${lastReturnedReceipt.lateFee.toFixed(2)}</span>
                  </div>
                ) : (
                  <div className="text-[11px] text-emerald-200 font-semibold italic">
                    ✓ Returned on time — No overdue fees. Member account cleared.
                  </div>
                )}
              </div>
            )}

            {/* Active Loans Quick Check-in List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-emerald-600" /> Active Loans Pending Return ({loans.filter(l => l.status === 'active' || l.status === 'overdue').length})
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto p-1">
                {loans.filter(l => l.status === 'active' || l.status === 'overdue').map(loan => (
                  <button
                    key={loan.id}
                    type="button"
                    onClick={() => {
                      const lateFee = loan.status === 'overdue' ? (loan.lateFee || 1.0) : 0;
                      onProcessReturn(loan, lateFee);
                      const borrower = users.find(u => u.id === loan.userId);
                      const bookObj = books.find(b => b.id === loan.bookId);
                      setLastReturnedReceipt({
                        bookTitle: loan.bookTitle,
                        bookCover: bookObj?.coverUrl,
                        userName: loan.userName,
                        userGrade: loan.userGrade,
                        studentIdCode: borrower?.studentIdCode || borrower?.id || loan.userId,
                        userRole: borrower?.role || 'student',
                        loanIssueDate: loan.issueDate,
                        loanDueDate: loan.dueDate,
                        returnDate: new Date().toISOString().split('T')[0],
                        lateFee
                      });
                      setReturnSuccessMessage(`Checked in "${loan.bookTitle}" returned by member ${loan.userName}!`);
                    }}
                    className={`p-4 rounded-2xl border text-left transition flex items-start justify-between group shadow-sm hover:shadow-md cursor-pointer ${
                      loan.status === 'overdue' 
                        ? 'bg-rose-50/80 border-rose-200 hover:bg-rose-100' 
                        : 'bg-slate-50 hover:bg-emerald-50/80 border-slate-200 hover:border-emerald-300'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="font-extrabold text-xs text-slate-900 group-hover:text-emerald-950">{loan.bookTitle}</div>
                      <div className="text-[11px] text-slate-600 font-medium">Borrower: <span className="font-bold text-slate-800">{loan.userName}</span></div>
                      <div className="text-[10px] text-slate-500 font-mono">Due Date: {loan.dueDate}</div>
                    </div>
                    
                    <div className="text-right shrink-0">
                      {loan.status === 'overdue' ? (
                        <span className="text-[10px] font-extrabold bg-rose-600 text-white px-2.5 py-0.5 rounded-full shadow-xs">
                          Overdue (${loan.lateFee.toFixed(2)})
                        </span>
                      ) : (
                        <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                          Click to Check-in
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {returnErrorMessage && (
              <div className="p-4 bg-rose-50 border border-rose-200 text-rose-900 text-xs rounded-2xl flex items-center gap-3 font-bold shadow-sm">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                {returnErrorMessage}
              </div>
            )}

            {returnSuccessMessage && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs rounded-2xl flex items-center gap-3 font-extrabold shadow-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                {returnSuccessMessage}
              </div>
            )}
          </form>
        </div>
      )}

    </div>
  );
};
