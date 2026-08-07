import React, { useState } from 'react';
import { Users, UserPlus, BookOpen, Clock, AlertCircle, CheckCircle, RotateCcw, Calendar, DollarSign, Shield, ArrowRight, User, Trash2, XCircle } from 'lucide-react';
import { UserProfile, Loan, Reservation, Book } from '../types';
import { useLanguage } from '../lib/i18n';

interface ParentDashboardProps {
  parentUser: UserProfile;
  allUsers: UserProfile[];
  loans: Loan[];
  reservations: Reservation[];
  books: Book[];
  onRenewLoan: (loan: Loan) => void;
  onAddChildToParent: (childName: string, grade: string, studentIdCode: string) => void;
  onOpenAddParentModal?: () => void;
  onDeleteUser?: (userId: string) => void;
  onCancelReservation?: (reservationId: string) => void;
}

export const ParentDashboard: React.FC<ParentDashboardProps> = ({
  parentUser,
  allUsers,
  loans,
  reservations,
  books,
  onRenewLoan,
  onAddChildToParent,
  onOpenAddParentModal,
  onDeleteUser,
  onCancelReservation
}) => {
  const { t, language } = useLanguage();
  // Find all children linked to this parent account
  const children = allUsers.filter(u => u.parentId === parentUser.id || parentUser.childrenIds?.includes(u.id));
  
  const [activeChildId, setActiveChildId] = useState<string>(children[0]?.id || '');
  const [showAddChildModal, setShowAddChildModal] = useState(false);
  const [childToDelete, setChildToDelete] = useState<UserProfile | null>(null);
  const [newChildName, setNewChildName] = useState('');
  const [newChildGrade, setNewChildGrade] = useState('Grade 5');
  const [newChildIdCode, setNewChildIdCode] = useState('');

  const selectedChild = children.find(c => c.id === activeChildId) || children[0];

  // Aggregate stats across all children
  const allChildrenLoans = loans.filter(l => children.some(c => c.id === l.userId || c.name === l.userName));
  const totalActiveLoans = allChildrenLoans.filter(l => l.status === 'active' || l.status === 'overdue').length;
  const totalOverdue = allChildrenLoans.filter(l => l.status === 'overdue').length;
  const totalFeesDue = allChildrenLoans.reduce((sum, l) => sum + (l.feePaid ? 0 : l.lateFee), 0);
  const totalReturned = allChildrenLoans.filter(l => l.status === 'returned').length;

  // Selected child specific loans & reservations
  const childLoans = selectedChild
    ? loans.filter(l => l.userId === selectedChild.id || l.userName === selectedChild.name)
    : [];

  const childActiveLoans = childLoans.filter(l => l.status === 'active' || l.status === 'overdue');
  const childReturnedLoans = childLoans.filter(l => l.status === 'returned');
  
  const childReservations = selectedChild
    ? reservations.filter(r => r.userId === selectedChild.id || r.userName === selectedChild.name)
    : [];

  const handleCreateChildAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChildName.trim() || !newChildIdCode.trim()) return;

    onAddChildToParent(newChildName.trim(), newChildGrade, newChildIdCode.trim());
    setNewChildName('');
    setNewChildIdCode('');
    setShowAddChildModal(false);
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 text-slate-900 border border-slate-200 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-purple-100 text-purple-900 border border-purple-200 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider">
              <Users className="w-3.5 h-3.5 text-purple-600" /> {t.parentPortal}
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
              {language === 'dv' ? `${parentUser.name} ގެ ބެލެނިވެރި ޕޯޓަލް` : `Parent Dashboard for ${parentUser.name}`}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 font-medium">
              {language === 'dv'
                ? 'ދަރިވަރުން ނަގާފައިވާ ފޮތްތަކާއި، މުއްދަތު ހަމަވާ ތާރީޚް އަދި ޖޫރިމަނާގެ މަޢުލޫމާތު ބައްލަވައި މުއްދަތު އިތުރުކުރައްވާ.'
                : 'Monitor reading activity, current loans, return histories, online renewals, and library fees for all your registered children.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
            {onOpenAddParentModal && (
              <button
                onClick={onOpenAddParentModal}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 transition flex items-center gap-1.5"
                id="parent-portal-add-parent-btn"
              >
                <Users className="w-4 h-4 text-purple-600" /> Register Parent Account
              </button>
            )}
            <button
              onClick={() => setShowAddChildModal(true)}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow transition flex items-center gap-2"
              id="add-child-account-btn"
            >
              <UserPlus className="w-4 h-4" /> Add Child Account
            </button>
          </div>
        </div>
      </div>

      {/* Aggregate Overview Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-md flex items-center gap-3 sm:gap-4">
          <div className="p-2.5 sm:p-3 bg-indigo-100 text-indigo-900 rounded-2xl border border-indigo-200 shrink-0">
            <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-slate-900">{totalActiveLoans}</div>
            <div className="text-[11px] sm:text-xs text-slate-500 font-bold leading-tight">
              {language === 'dv' ? 'މިވަގުތު ނަގާފައިވާ' : 'Books Currently on Loan'}
            </div>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-md flex items-center gap-3 sm:gap-4">
          <div className="p-2.5 sm:p-3 bg-emerald-100 text-emerald-900 rounded-2xl border border-emerald-200 shrink-0">
            <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-slate-900">{totalReturned}</div>
            <div className="text-[11px] sm:text-xs text-slate-500 font-bold leading-tight">
              {language === 'dv' ? 'އަނބުރާ ދެއްކި ފޮތްތައް' : 'Previously Returned Books'}
            </div>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-md flex items-center gap-3 sm:gap-4">
          <div className="p-2.5 sm:p-3 bg-amber-100 text-amber-900 rounded-2xl border border-amber-200 shrink-0">
            <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-slate-900">{totalOverdue}</div>
            <div className="text-[11px] sm:text-xs text-slate-500 font-bold leading-tight">
              {language === 'dv' ? 'މުއްދަތު ހަމަވެފައި' : 'Overdue Books'}
            </div>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-md flex items-center gap-3 sm:gap-4">
          <div className="p-2.5 sm:p-3 bg-rose-100 text-rose-900 rounded-2xl border border-rose-200 shrink-0">
            <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-rose-600" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-slate-900">${totalFeesDue.toFixed(2)}</div>
            <div className="text-[11px] sm:text-xs text-slate-500 font-bold leading-tight">
              {language === 'dv' ? 'ދައްކަންޖެހޭ ޖޫރިމަނާ' : 'Outstanding Late Fees'}
            </div>
          </div>
        </div>
      </div>

      {/* Children Accounts Tab Switcher */}
      {children.length > 0 ? (
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
          
          {/* Child Tabs Header */}
          <div className="bg-slate-50 p-3.5 sm:p-4 border-b border-slate-200 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none w-full sm:w-auto">
              <span className="text-[11px] sm:text-xs font-extrabold text-slate-500 uppercase tracking-wider pr-1 flex items-center gap-1 shrink-0">
                <User className="w-3.5 h-3.5 text-purple-600" /> {language === 'dv' ? 'ދަރިވަރު ޚިޔާރުކުރައްވާ:' : 'Select Child:'}
              </span>
              {children.map((child) => (
                <button
                  key={child.id}
                  onClick={() => setActiveChildId(child.id)}
                  className={`px-3.5 sm:px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 active:scale-95 cursor-pointer ${
                    activeChildId === child.id || (!activeChildId && children[0].id === child.id)
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                  id={`child-tab-${child.id}`}
                >
                  <div className="w-5 h-5 rounded-full bg-purple-200 text-purple-900 font-bold text-[10px] flex items-center justify-center">
                    {child.name.charAt(0)}
                  </div>
                  <span>{child.name}</span>
                  <span className="text-[10px] opacity-80 font-normal">({child.grade})</span>
                </button>
              ))}
            </div>

            {selectedChild && (
              <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200">
                <div className="text-xs font-mono bg-purple-50 text-purple-900 border border-purple-200 px-3 py-1 rounded-xl font-bold">
                  Student ID: <span className="font-extrabold">{selectedChild.studentIdCode}</span>
                </div>
                {onDeleteUser && (
                  <button
                    onClick={() => setChildToDelete(selectedChild)}
                    className="bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 text-xs font-bold px-3 py-1 rounded-xl transition flex items-center gap-1 cursor-pointer"
                    title="Remove Child Account"
                    id={`remove-child-btn-${selectedChild.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span className="hidden sm:inline">{language === 'dv' ? 'އުނިކުރައްވާ' : 'Remove Student'}</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Child Specific Content Body */}
          {selectedChild && (
            <div className="p-4 sm:p-6 space-y-6 sm:space-y-8">
              
              {/* Section 1: Books Currently On Loan */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-purple-600" />
                    {language === 'dv' ? `މިވަގުތު ނަގާފައިވާ ފޮތްތައް (${childActiveLoans.length})` : `Books Currently On Loan (${childActiveLoans.length})`}
                  </h3>
                </div>

                {childActiveLoans.length === 0 ? (
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 text-center text-xs text-slate-500 font-medium">
                    {language === 'dv' ? `${selectedChild.name} ނަގާފައިވާ އެއްވެސް ފޮތެއް މިވަގުތަކު ނެތެވެ.` : `No active loans for ${selectedChild.name} at this time.`}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {childActiveLoans.map((loan) => {
                      const book = books.find(b => b.id === loan.bookId);
                      const isOverdue = loan.status === 'overdue';

                      return (
                        <div
                          key={loan.id}
                          className={`p-3.5 sm:p-4 rounded-2xl border flex gap-3 sm:gap-4 ${
                            isOverdue ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-slate-50 border-slate-200 text-slate-800'
                          }`}
                        >
                          {book && (
                            <img
                              src={book.coverUrl}
                              alt={book.title}
                              className="w-14 sm:w-16 h-20 sm:h-22 object-cover rounded-xl shadow-md border border-slate-200 flex-shrink-0"
                            />
                          )}
                          <div className="flex-1 flex flex-col justify-between">
                            <div>
                              <div className="flex justify-between items-start gap-1">
                                <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm line-clamp-1">{loan.bookTitle}</h4>
                                {isOverdue ? (
                                  <span className="bg-rose-600 text-white text-[9px] sm:text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow shrink-0">
                                    OVERDUE
                                  </span>
                                ) : (
                                  <span className="bg-indigo-100 text-indigo-900 border border-indigo-200 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                                    ACTIVE
                                  </span>
                                )}
                              </div>

                              <div className="mt-2 space-y-1 text-xs text-slate-600 font-medium">
                                <div>Issued: <span className="font-bold text-slate-800">{loan.issueDate}</span></div>
                                <div>Due Date: <span className={`font-extrabold ${isOverdue ? 'text-rose-700' : 'text-slate-900'}`}>{loan.dueDate}</span></div>
                                {isOverdue && loan.lateFee > 0 && (
                                  <div className="text-rose-700 font-bold mt-1 text-[11px]">
                                    Late Fee: ${loan.lateFee.toFixed(2)}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-200">
                              <span className="text-[10px] sm:text-[11px] text-slate-500 font-medium">Renewed: {loan.renewalCount}/2</span>
                              <button
                                onClick={() => onRenewLoan(loan)}
                                disabled={isOverdue || loan.renewalCount >= 2}
                                className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 active:scale-95 cursor-pointer ${
                                  isOverdue || loan.renewalCount >= 2
                                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                                    : 'bg-purple-600 hover:bg-purple-700 text-white shadow'
                                }`}
                              >
                                <RotateCcw className="w-3 h-3" /> {language === 'dv' ? 'މުއްދަތު އިތުރުކުރައްވާ' : 'Renew Online'}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Section 2: Previously Returned Books */}
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  {language === 'dv' ? `އަނބުރާ ޙަވާލުކުރެވިފައިވާ ފޮތްތަކުގެ ތާރީޚް (${childReturnedLoans.length})` : `Previously Returned Books History (${childReturnedLoans.length})`}
                </h3>

                {childReturnedLoans.length === 0 ? (
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 text-center text-xs text-slate-500 font-medium">
                    {language === 'dv' ? `${selectedChild.name} ގެ ނެގުންތަކުގެ ތާރީޚެއް ނެތެވެ.` : `No past borrowing history recorded yet for ${selectedChild.name}.`}
                  </div>
                ) : (
                  <>
                    {/* Mobile Cards View */}
                    <div className="sm:hidden space-y-2.5">
                      {childReturnedLoans.map(loan => (
                        <div key={loan.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex justify-between items-center">
                          <div>
                            <div className="font-extrabold text-slate-900">{loan.bookTitle}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">Issued: {loan.issueDate} • Returned: <span className="text-emerald-700 font-bold">{loan.returnDate || 'Returned'}</span></div>
                          </div>
                          <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0">
                            Returned OK
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Tablet / Laptop / PC Table View */}
                    <div className="hidden sm:block overflow-x-auto border border-slate-200 rounded-2xl bg-white shadow-sm">
                      <table className="w-full text-left text-xs text-slate-700">
                        <thead className="bg-slate-100 text-slate-600 font-extrabold uppercase text-[10px] border-b border-slate-200">
                          <tr>
                            <th className="p-3">Book Title</th>
                            <th className="p-3">Issue Date</th>
                            <th className="p-3">Returned On</th>
                            <th className="p-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {childReturnedLoans.map(loan => (
                            <tr key={loan.id} className="hover:bg-slate-50 transition">
                              <td className="p-3 font-bold text-slate-900">{loan.bookTitle}</td>
                              <td className="p-3 font-mono text-slate-600">{loan.issueDate}</td>
                              <td className="p-3 font-mono text-emerald-700 font-bold">{loan.returnDate || 'Returned'}</td>
                              <td className="p-3">
                                <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                                  Returned OK
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>

              {/* Section 3: Online Book Reservations Queue */}
              {childReservations.length > 0 && (
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 mb-3 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-indigo-600" />
                    {language === 'dv' ? `ނަންނޯޓު ކުރެވިފައިވާ ފޮތްތައް (${childReservations.length})` : `Online Reserved Books (${childReservations.length})`}
                  </h3>
                  <div className="space-y-2">
                    {childReservations.map(res => (
                      <div key={res.id} className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center justify-between gap-3 text-xs text-indigo-900 font-medium shadow-2xs">
                        <div>
                          <span className="font-bold text-slate-900 text-sm block">{res.bookTitle}</span>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {language === 'dv' ? 'އެދިފައިވާ ތާރީޚް:' : 'Requested on:'} {res.requestDate}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="bg-indigo-600 text-white font-extrabold text-[10px] px-2.5 py-1 rounded-full uppercase">
                            {res.status}
                          </span>
                          {onCancelReservation && (
                            <button
                              onClick={() => onCancelReservation(res.id)}
                              className="bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl transition shadow flex items-center gap-1 cursor-pointer active:scale-95 shrink-0"
                              title={language === 'dv' ? 'ރިޒަވޭޝަން ކެންސަލް ކުރައްވާ' : 'Cancel Reservation'}
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>{language === 'dv' ? 'ކެންސަލް' : 'Cancel'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      ) : (
        <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center space-y-3 shadow-md">
          <Users className="w-12 h-12 text-slate-400 mx-auto" />
          <h3 className="text-lg font-bold text-slate-800">No Children Linked Yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">
            Click "Add Child Account" to register or link your children's student accounts to your parent dashboard.
          </p>
          <button
            onClick={() => setShowAddChildModal(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow"
          >
            Create Child Account
          </button>
        </div>
      )}

      {/* Add Child Account Modal */}
      {showAddChildModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-200 text-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-purple-600" /> Add Student Child Account
              </h3>
              <button
                onClick={() => setShowAddChildModal(false)}
                className="text-slate-400 hover:text-slate-700 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateChildAccount} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Student Full Name</label>
                <input
                  type="text"
                  required
                  value={newChildName}
                  onChange={(e) => setNewChildName(e.target.value)}
                  placeholder="e.g. Lucas Jenkins"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  id="add-child-name-input"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Grade Level</label>
                <select
                  value={newChildGrade}
                  onChange={(e) => setNewChildGrade(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
                  id="add-child-grade-select"
                >
                  <option value="Kindergarten">Kindergarten</option>
                  <option value="Grade 1">Grade 1</option>
                  <option value="Grade 2">Grade 2</option>
                  <option value="Grade 3">Grade 3</option>
                  <option value="Grade 4">Grade 4</option>
                  <option value="Grade 5">Grade 5</option>
                  <option value="Grade 6">Grade 6</option>
                  <option value="Grade 7">Grade 7</option>
                  <option value="Grade 8">Grade 8</option>
                  <option value="High School">High School</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Student ID Code (or Barcode)</label>
                <input
                  type="text"
                  required
                  value={newChildIdCode}
                  onChange={(e) => setNewChildIdCode(e.target.value)}
                  placeholder="e.g. STU-2045"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono font-bold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  id="add-child-id-input"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddChildModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-extrabold rounded-xl shadow transition"
                >
                  Save Child Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REMOVE CHILD CONFIRMATION MODAL */}
      {childToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4 text-slate-800">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Remove Student Child Account</h3>
                <p className="text-xs text-slate-500 font-semibold">Unlink from Guardian Profile</p>
              </div>
            </div>

            <p className="text-xs text-slate-700 font-medium leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200">
              Are you sure you want to remove <strong className="text-slate-900 font-extrabold">{childToDelete.name}</strong> ({childToDelete.grade}) from your guardian account?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setChildToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (onDeleteUser) {
                    onDeleteUser(childToDelete.id);
                  }
                  setChildToDelete(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer"
                id="confirm-remove-child-btn"
              >
                <Trash2 className="w-4 h-4" /> Confirm Remove
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
