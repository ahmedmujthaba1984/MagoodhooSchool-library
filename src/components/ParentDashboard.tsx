import React, { useState } from 'react';
import { Users, UserPlus, BookOpen, Clock, AlertCircle, CheckCircle, RotateCcw, Calendar, DollarSign, Shield, ArrowRight, User, Trash2 } from 'lucide-react';
import { UserProfile, Loan, Reservation, Book } from '../types';

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
  onDeleteUser
}) => {
  // Find all children linked to this parent account
  const children = allUsers.filter(u => u.parentId === parentUser.id || parentUser.childrenIds?.includes(u.id));
  
  const [activeChildId, setActiveChildId] = useState<string>(children[0]?.id || '');
  const [showAddChildModal, setShowAddChildModal] = useState(false);
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
              <Users className="w-3.5 h-3.5 text-purple-600" /> Parent Account Oversight Portal
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
              Parent Dashboard for {parentUser.name}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 font-medium">
              Monitor reading activity, current loans, return histories, online renewals, and library fees for all your registered children.
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-md flex items-center gap-4">
          <div className="p-3 bg-indigo-100 text-indigo-900 rounded-2xl border border-indigo-200">
            <BookOpen className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{totalActiveLoans}</div>
            <div className="text-xs text-slate-500 font-bold">Books Currently on Loan</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-md flex items-center gap-4">
          <div className="p-3 bg-emerald-100 text-emerald-900 rounded-2xl border border-emerald-200">
            <CheckCircle className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{totalReturned}</div>
            <div className="text-xs text-slate-500 font-bold">Previously Returned Books</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-md flex items-center gap-4">
          <div className="p-3 bg-amber-100 text-amber-900 rounded-2xl border border-amber-200">
            <Clock className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{totalOverdue}</div>
            <div className="text-xs text-slate-500 font-bold">Overdue Books</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-md flex items-center gap-4">
          <div className="p-3 bg-rose-100 text-rose-900 rounded-2xl border border-rose-200">
            <DollarSign className="w-6 h-6 text-rose-600" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">${totalFeesDue.toFixed(2)}</div>
            <div className="text-xs text-slate-500 font-bold">Outstanding Late Fees</div>
          </div>
        </div>
      </div>

      {/* Children Accounts Tab Switcher */}
      {children.length > 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
          
          {/* Child Tabs Header */}
          <div className="bg-slate-50 p-4 border-b border-slate-200 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider pr-2 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-purple-600" /> Select Child:
              </span>
              {children.map((child) => (
                <button
                  key={child.id}
                  onClick={() => setActiveChildId(child.id)}
                  className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
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
              <div className="flex items-center gap-2">
                <div className="text-xs font-mono bg-purple-50 text-purple-900 border border-purple-200 px-3 py-1 rounded-xl font-bold">
                  Student ID: <span className="font-extrabold">{selectedChild.studentIdCode}</span>
                </div>
                {onDeleteUser && (
                  <button
                    onClick={() => onDeleteUser(selectedChild.id)}
                    className="bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 text-xs font-bold px-3 py-1 rounded-xl transition flex items-center gap-1 cursor-pointer"
                    title="Remove Child Account"
                    id={`remove-child-btn-${selectedChild.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" /> Remove Student
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Child Specific Content Body */}
          {selectedChild && (
            <div className="p-6 space-y-8">
              
              {/* Section 1: Books Currently On Loan */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-purple-600" />
                    Books Currently On Loan ({childActiveLoans.length})
                  </h3>
                </div>

                {childActiveLoans.length === 0 ? (
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 text-center text-xs text-slate-500 font-medium">
                    No active loans for {selectedChild.name} at this time.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {childActiveLoans.map((loan) => {
                      const book = books.find(b => b.id === loan.bookId);
                      const isOverdue = loan.status === 'overdue';

                      return (
                        <div
                          key={loan.id}
                          className={`p-4 rounded-2xl border flex gap-4 ${
                            isOverdue ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-slate-50 border-slate-200 text-slate-800'
                          }`}
                        >
                          {book && (
                            <img
                              src={book.coverUrl}
                              alt={book.title}
                              className="w-16 h-22 object-cover rounded-xl shadow-md border border-slate-200 flex-shrink-0"
                            />
                          )}
                          <div className="flex-1 flex flex-col justify-between">
                            <div>
                              <div className="flex justify-between items-start">
                                <h4 className="font-extrabold text-slate-900 text-sm line-clamp-1">{loan.bookTitle}</h4>
                                {isOverdue ? (
                                  <span className="bg-rose-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow">
                                    OVERDUE
                                  </span>
                                ) : (
                                  <span className="bg-indigo-100 text-indigo-900 border border-indigo-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                    ACTIVE
                                  </span>
                                )}
                              </div>

                              <div className="mt-2 space-y-1 text-xs text-slate-600 font-medium">
                                <div>Issued: <span className="font-bold text-slate-800">{loan.issueDate}</span></div>
                                <div>Due Date: <span className={`font-extrabold ${isOverdue ? 'text-rose-700' : 'text-slate-900'}`}>{loan.dueDate}</span></div>
                                {isOverdue && loan.lateFee > 0 && (
                                  <div className="text-rose-700 font-bold mt-1">
                                    Late Fee Accumulating: ${loan.lateFee.toFixed(2)}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-200">
                              <span className="text-[11px] text-slate-500 font-medium">Renewals used: {loan.renewalCount}/2</span>
                              <button
                                onClick={() => onRenewLoan(loan)}
                                disabled={isOverdue || loan.renewalCount >= 2}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                                  isOverdue || loan.renewalCount >= 2
                                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                                    : 'bg-purple-600 hover:bg-purple-700 text-white shadow'
                                }`}
                              >
                                <RotateCcw className="w-3 h-3" /> Renew Online
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
                <h3 className="text-base font-black text-slate-900 mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  Previously Returned Books History ({childReturnedLoans.length})
                </h3>

                {childReturnedLoans.length === 0 ? (
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 text-center text-xs text-slate-500 font-medium">
                    No past borrowing history recorded yet for {selectedChild.name}.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white shadow-sm">
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
                )}
              </div>

              {/* Section 3: Online Book Reservations Queue */}
              {childReservations.length > 0 && (
                <div>
                  <h3 className="text-base font-black text-slate-900 mb-3 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-indigo-600" />
                    Online Reserved Books ({childReservations.length})
                  </h3>
                  <div className="space-y-2">
                    {childReservations.map(res => (
                      <div key={res.id} className="p-3 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center justify-between text-xs text-indigo-900 font-medium">
                        <div>
                          <span className="font-bold text-slate-900">{res.bookTitle}</span>
                          <p className="text-[11px] text-slate-500">Requested on: {res.requestDate}</p>
                        </div>
                        <span className="bg-indigo-600 text-white font-extrabold text-[10px] px-2.5 py-1 rounded-full uppercase">
                          {res.status}
                        </span>
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

    </div>
  );
};
