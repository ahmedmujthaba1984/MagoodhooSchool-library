import React, { useState, useEffect } from 'react';
import { Users, Search, Filter, UserCheck, Shield, UserPlus, CreditCard, BookOpen, AlertTriangle, Phone, Mail, FileSpreadsheet, Printer, Download, Check, X, ChevronRight, QrCode, Trash2, Zap, Radio } from 'lucide-react';
import { UserProfile, UserRole, Loan, Book } from '../types';
import { useLanguage } from '../lib/i18n';
import { portalSyncManager, SyncStatusState } from '../lib/externalPortalSync';

interface MemberDirectoryProps {
  allUsers: UserProfile[];
  loans: Loan[];
  books: Book[];
  currentUserRole?: string;
  onOpenAddParentModal?: () => void;
  onOpenImportModal?: (type: 'books' | 'parents' | 'staff') => void;
  onOpenReportCardSyncModal?: () => void;
  onSelectMemberForCheckout?: (memberId: string) => void;
  onDeleteUser?: (userId: string) => void;
}

export const MemberDirectory: React.FC<MemberDirectoryProps> = ({
  allUsers,
  loans,
  books,
  currentUserRole,
  onOpenAddParentModal,
  onOpenImportModal,
  onOpenReportCardSyncModal,
  onSelectMemberForCheckout,
  onDeleteUser
}) => {
  const { t, language, isRtl } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [selectedMember, setSelectedMember] = useState<UserProfile | null>(null);
  const [showLibraryCardModal, setShowLibraryCardModal] = useState<UserProfile | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatusState>(portalSyncManager.getStatus());

  useEffect(() => {
    const unsub = portalSyncManager.subscribeStatus((st) => setSyncStatus(st));
    return () => unsub();
  }, []);

  // Filter users based on search and role
  const filteredUsers = allUsers.filter(user => {
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesSearch = 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.studentIdCode && user.studentIdCode.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.staffIdCode && user.staffIdCode.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.staffDepartment && user.staffDepartment.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.grade && user.grade.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.phone && user.phone.includes(searchTerm));
    return matchesRole && matchesSearch;
  });

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return (
          <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <Shield className="w-3 h-3 text-amber-600" /> {t.adminRole}
          </span>
        );
      case 'parent':
        return (
          <span className="bg-purple-100 text-purple-900 border border-purple-300 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <Users className="w-3 h-3 text-purple-600" /> {t.parentRole}
          </span>
        );
      case 'staff':
        return (
          <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <UserCheck className="w-3 h-3 text-emerald-600" /> {t.staffRole}
          </span>
        );
      case 'student':
        return (
          <span className="bg-sky-100 text-sky-900 border border-sky-300 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <UserCheck className="w-3 h-3 text-sky-600" /> {t.studentRole}
          </span>
        );
    }
  };

  // CSV Export for Member Directory
  const handleExportCSV = () => {
    const headers = ['ID', 'Name', 'Email', 'Role', 'Grade/Position', 'Student ID', 'Phone', 'Created Date'];
    const rows = filteredUsers.map(u => [
      u.id,
      `"${u.name}"`,
      `"${u.email}"`,
      u.role,
      `"${u.grade || 'N/A'}"`,
      `"${u.studentIdCode || 'N/A'}"`,
      `"${u.phone || 'N/A'}"`,
      u.createdAt || 'N/A'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `oakridge_library_members_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 text-slate-900 border border-slate-200 shadow-xl relative overflow-hidden">
        <div className="max-w-3xl space-y-2 relative z-10">
          <div className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-900 border border-indigo-200 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider">
            <Users className="w-3.5 h-3.5 text-indigo-600" /> {t.memberDirectory}
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            {t.memberDirectory}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 font-medium">
            {t.searchMembersPlaceholder}
          </p>
        </div>

        {/* Action Controls Header */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setRoleFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                roleFilter === 'all' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {t.allMembers} ({allUsers.length})
            </button>
            <button
              onClick={() => setRoleFilter('student')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                roleFilter === 'student' ? 'bg-sky-600 text-white shadow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {t.students} ({allUsers.filter(u => u.role === 'student').length})
            </button>
            <button
              onClick={() => setRoleFilter('parent')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                roleFilter === 'parent' ? 'bg-purple-600 text-white shadow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {t.parents} ({allUsers.filter(u => u.role === 'parent').length})
            </button>
            <button
              onClick={() => setRoleFilter('staff')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                roleFilter === 'staff' ? 'bg-emerald-600 text-white shadow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {t.facultyStaff} ({allUsers.filter(u => u.role === 'staff').length})
            </button>
            <button
              onClick={() => setRoleFilter('admin')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                roleFilter === 'admin' ? 'bg-amber-600 text-white shadow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {t.adminRole} ({allUsers.filter(u => u.role === 'admin').length})
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onOpenReportCardSyncModal && (
              <button
                onClick={onOpenReportCardSyncModal}
                className={`font-black text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-2 shadow-xs border cursor-pointer ${
                  syncStatus.isLiveConnected
                    ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border-indigo-200'
                }`}
                id="directory-reportcard-sync-btn"
                title="Real-Time Cloud Firestore Sync with https://reportcard-fmagoodhooschool.vercel.app/"
              >
                <Zap className={`w-3.5 h-3.5 ${syncStatus.isLiveConnected ? 'text-emerald-600 animate-pulse' : 'text-indigo-600'}`} />
                <span>
                  {language === 'dv' ? 'ރިޕޯޓް ކާޑު ޕޯޓަލް ލައިވް ސިންކް' : 'Report Card Live Sync'}
                </span>
                {syncStatus.isLiveConnected && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                )}
              </button>
            )}
            {onOpenAddParentModal && (
              <button
                onClick={onOpenAddParentModal}
                className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow cursor-pointer"
                id="directory-add-parent-btn"
              >
                <UserPlus className="w-3.5 h-3.5" /> {t.addParent}
              </button>
            )}
            {onOpenImportModal && (
              <button
                onClick={() => onOpenImportModal('parents')}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 border border-slate-300 cursor-pointer"
                id="directory-import-csv-btn"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-purple-600" /> {t.importBulk}
              </button>
            )}
            <button
              onClick={handleExportCSV}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 border border-slate-300 cursor-pointer"
              id="directory-export-csv-btn"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600" /> {t.exportCsv}
            </button>
          </div>
        </div>
      </div>

      {/* Search Bar & View Mode Toggle */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-md flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-md">
          <Search className={`w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 ${isRtl ? 'right-3.5' : 'left-3.5'}`} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t.searchMembersPlaceholder}
            className={`w-full py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'}`}
            id="member-directory-search-input"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <span className="text-xs text-slate-500 font-semibold">
            Showing <strong className="text-slate-900">{filteredUsers.length}</strong> members
          </span>
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                viewMode === 'grid' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Grid View
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                viewMode === 'table' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Table View
            </button>
          </div>
        </div>
      </div>

      {/* GRID VIEW */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUsers.map((user) => {
            const memberLoans = loans.filter(l => l.userId === user.id);
            const activeLoans = memberLoans.filter(l => l.status === 'active' || l.status === 'overdue');
            const overdueLoans = memberLoans.filter(l => l.status === 'overdue');
            const linkedParent = allUsers.find(u => u.id === user.parentId);
            const children = allUsers.filter(u => user.childrenIds?.includes(u.id) || u.parentId === user.id);

            return (
              <div
                key={user.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-extrabold text-sm flex items-center justify-center shadow">
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-extrabold text-slate-900 text-sm leading-snug">{user.name}</div>
                        <div className="text-[11px] text-slate-500 font-medium truncate max-w-[180px]">{user.email}</div>
                      </div>
                    </div>
                    {getRoleBadge(user.role)}
                  </div>

                  {/* Details Badge Pills */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                    {user.role === 'student' && (
                      <>
                        <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                          <span className="text-slate-400 font-semibold block text-[10px]">Grade:</span>
                          <span className="font-extrabold text-slate-800">{user.grade || 'Not Assigned'}</span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                          <span className="text-slate-400 font-semibold block text-[10px]">Student ID:</span>
                          <span className="font-mono font-extrabold text-indigo-700">{user.studentIdCode || `STU-${user.id.slice(-4)}`}</span>
                        </div>
                      </>
                    )}

                    {user.role === 'parent' && (
                      <>
                        <div className="bg-purple-50 p-2 rounded-xl border border-purple-100 col-span-2">
                          <span className="text-purple-600 font-semibold block text-[10px]">Linked Student Children:</span>
                          <span className="font-extrabold text-purple-900">
                            {children.length > 0 ? children.map(c => c.name).join(', ') : 'No linked students'}
                          </span>
                        </div>
                      </>
                    )}

                    {user.role === 'staff' && (
                      <>
                        <div className="bg-emerald-50 p-2 rounded-xl border border-emerald-100">
                          <span className="text-emerald-700 font-semibold block text-[10px]">Staff ID Code:</span>
                          <span className="font-mono font-extrabold text-emerald-900">{user.staffIdCode || `STF-${user.id.slice(-4)}`}</span>
                        </div>
                        <div className="bg-emerald-50 p-2 rounded-xl border border-emerald-100">
                          <span className="text-emerald-700 font-semibold block text-[10px]">Department / Role:</span>
                          <span className="font-extrabold text-emerald-900">{user.staffDepartment || 'Faculty Staff'}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Active Borrowing Summary */}
                  <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-indigo-600" />
                      <div>
                        <div className="font-extrabold text-indigo-950">
                          {activeLoans.length} Active Book Loan{activeLoans.length !== 1 ? 's' : ''}
                        </div>
                        {overdueLoans.length > 0 && (
                          <div className="text-[10px] text-rose-600 font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> {overdueLoans.length} Overdue Item(s)
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Action Buttons */}
                <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                  <button
                    onClick={() => setSelectedMember(user)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold py-2 px-3 rounded-xl transition"
                  >
                    View Member File
                  </button>
                  <button
                    onClick={() => setShowLibraryCardModal(user)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-xl transition shadow"
                    title="Print Digital Library Pass Barcode"
                  >
                    <QrCode className="w-4 h-4" />
                  </button>
                  {onDeleteUser && user.role !== 'admin' && (
                    <button
                      onClick={() => setUserToDelete(user)}
                      className="bg-rose-100 hover:bg-rose-200 text-rose-800 p-2 rounded-xl transition border border-rose-200 cursor-pointer"
                      title="Remove Account"
                    >
                      <Trash2 className="w-4 h-4 text-rose-600" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TABLE VIEW */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 text-slate-600 font-extrabold uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="p-4">Member Name</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Grade / ID / Dept</th>
                  <th className="p-4">Email & Phone</th>
                  <th className="p-4">Active Loans</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user) => {
                  const memberLoans = loans.filter(l => l.userId === user.id && (l.status === 'active' || l.status === 'overdue'));

                  return (
                    <tr key={user.id} className="hover:bg-slate-50 transition">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-extrabold text-xs flex items-center justify-center">
                            {user.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-extrabold text-slate-900">{user.name}</div>
                            <div className="text-[11px] text-slate-500 font-medium">{user.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">{getRoleBadge(user.role)}</td>
                      <td className="p-4 font-medium">
                        {user.role === 'student' ? (
                          <div>
                            <div className="font-extrabold text-slate-900">{user.grade || 'Grade N/A'}</div>
                            <div className="font-mono text-[11px] text-indigo-700 font-bold">{user.studentIdCode || 'N/A'}</div>
                          </div>
                        ) : user.role === 'staff' ? (
                          <div>
                            <div className="font-extrabold text-emerald-900">{user.staffDepartment || 'Faculty Staff'}</div>
                            <div className="font-mono text-[11px] text-emerald-700 font-bold">{user.staffIdCode || `STF-${user.id.slice(-4)}`}</div>
                          </div>
                        ) : (
                          <div>
                            <div className="font-semibold text-slate-500">General Member</div>
                            <div className="font-mono text-[11px] text-slate-400">N/A</div>
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-slate-800">{user.email}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{user.phone || 'N/A'}</div>
                      </td>
                      <td className="p-4">
                        <span className={`font-extrabold px-2.5 py-1 rounded-full text-[11px] ${
                          memberLoans.length > 0 ? 'bg-indigo-100 text-indigo-900' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {memberLoans.length} Loans
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-2">
                        <button
                          onClick={() => setSelectedMember(user)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-3 py-1.5 rounded-xl text-xs transition cursor-pointer"
                        >
                          View File
                        </button>
                        <button
                          onClick={() => setShowLibraryCardModal(user)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold p-1.5 rounded-xl transition cursor-pointer"
                          title="Print Barcode Card"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>
                        {onDeleteUser && user.role !== 'admin' && (
                          <button
                            onClick={() => setUserToDelete(user)}
                            className="bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold p-1.5 rounded-xl transition border border-rose-200 cursor-pointer"
                            title="Remove Account"
                          >
                            <Trash2 className="w-4 h-4 text-rose-600" />
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
      )}

      {/* MEMBER FILE DETAIL MODAL */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full p-6 border border-slate-200 max-h-[90vh] overflow-y-auto space-y-5 text-slate-800">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-extrabold text-base flex items-center justify-center shadow">
                  {selectedMember.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">{selectedMember.name}</h3>
                  <div className="mt-0.5">{getRoleBadge(selectedMember.role)}</div>
                </div>
              </div>
              <button
                onClick={() => setSelectedMember(null)}
                className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-slate-400 font-bold block text-[10px]">Email Address:</span>
                  <span className="font-extrabold text-slate-900">{selectedMember.email}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block text-[10px]">Phone Number:</span>
                  <span className="font-extrabold text-slate-900">{selectedMember.phone || '(555) 000-0000'}</span>
                </div>
                {selectedMember.grade && (
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px]">Grade Level:</span>
                    <span className="font-extrabold text-slate-900">{selectedMember.grade}</span>
                  </div>
                )}
                {selectedMember.studentIdCode && (
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px]">Student ID / Barcode:</span>
                    <span className="font-mono font-extrabold text-indigo-700">{selectedMember.studentIdCode}</span>
                  </div>
                )}
              </div>

              {/* Active Borrowing Loans History */}
              <div className="space-y-2">
                <h4 className="font-black text-slate-900 uppercase text-[11px] tracking-wider">
                  Current & Past Book Loans
                </h4>
                {loans.filter(l => l.userId === selectedMember.id).length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-slate-500 italic text-center">
                    No loan records found for this member.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {loans.filter(l => l.userId === selectedMember.id).map(loan => (
                      <div key={loan.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                        <div>
                          <div className="font-extrabold text-slate-900">{loan.bookTitle}</div>
                          <div className="text-[10px] text-slate-500 font-medium">Issued: {loan.issueDate} | Due: {loan.dueDate}</div>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                          loan.status === 'returned'
                            ? 'bg-emerald-100 text-emerald-900'
                            : loan.status === 'overdue'
                            ? 'bg-rose-100 text-rose-900'
                            : 'bg-indigo-100 text-indigo-900'
                        }`}>
                          {loan.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100">
              {onDeleteUser && selectedMember.role !== 'admin' ? (
                <button
                  onClick={() => setUserToDelete(selectedMember)}
                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-bold text-xs transition flex items-center gap-1.5 cursor-pointer"
                  id="modal-delete-member-btn"
                >
                  <Trash2 className="w-4 h-4 text-rose-600" /> Remove Account
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowLibraryCardModal(selectedMember);
                    setSelectedMember(null);
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition flex items-center gap-1.5 shadow cursor-pointer text-xs"
                >
                  <QrCode className="w-4 h-4" /> Digital Library Pass
                </button>
                <button
                  onClick={() => setSelectedMember(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition text-xs cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DIGITAL LIBRARY PASS / BARCODE MODAL */}
      {showLibraryCardModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4 text-center">
            <div className="flex justify-between items-center border-b pb-3 border-slate-100">
              <div className="text-left">
                <h3 className="font-black text-slate-900 text-base">Oakridge Library Member Pass</h3>
                <p className="text-xs text-slate-500 font-medium">Print or scan this official barcode</p>
              </div>
              <button onClick={() => setShowLibraryCardModal(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Simulated Digital Card */}
            <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-purple-950 p-6 rounded-2xl text-white shadow-xl space-y-4 text-left border border-indigo-500/30">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-300">Oakridge Academy Library</div>
                  <div className="text-lg font-black text-white">{showLibraryCardModal.name}</div>
                  <div className="text-xs text-slate-300 capitalize">{showLibraryCardModal.role} • {showLibraryCardModal.grade || 'Staff'}</div>
                </div>
                <div className="w-8 h-8 rounded-xl bg-indigo-500/30 flex items-center justify-center border border-indigo-400/30">
                  <CreditCard className="w-5 h-5 text-indigo-300" />
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl text-center space-y-1 shadow-inner">
                <div className="font-mono text-2xl font-black tracking-[0.25em] text-slate-900">
                  |||||| | |||| | ||||||
                </div>
                <div className="font-mono text-xs font-bold text-slate-700">
                  {showLibraryCardModal.studentIdCode || `STU-${showLibraryCardModal.id.slice(-6)}`}
                </div>
              </div>

              <div className="text-[10px] text-slate-400 text-center font-medium">
                Present barcode to librarian desk for instant checkouts & renewals.
              </div>
            </div>

            <div className="flex gap-2 justify-center pt-2">
              <button
                onClick={() => window.print()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow transition flex items-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" /> Print Member Library Card
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MEMBER CONFIRMATION MODAL */}
      {userToDelete && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setUserToDelete(null);
          }}
        >
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-5 text-slate-800">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Confirm Account Deletion</h3>
                <p className="text-xs text-slate-500 font-semibold">Permanent Database Operation</p>
              </div>
            </div>

            <div className="bg-rose-50/70 p-4 rounded-2xl border border-rose-100 text-xs space-y-2">
              <p className="text-slate-800 font-bold">
                Are you sure you want to delete <strong className="text-rose-950 font-black">{userToDelete.name}</strong> from the library database?
              </p>
              <div className="text-[11px] text-slate-600 space-y-1 pt-1.5 border-t border-rose-200/60">
                <div>• Account Role: <span className="font-bold uppercase text-slate-800">{userToDelete.role}</span></div>
                <div>• Email: <span className="font-mono text-slate-800">{userToDelete.email}</span></div>
                {userToDelete.studentIdCode && <div>• Student ID: <span className="font-mono font-bold text-slate-800">{userToDelete.studentIdCode}</span></div>}
              </div>
            </div>

            {/* Active Loans Warning */}
            {loans.filter(l => l.userId === userToDelete.id && (l.status === 'active' || l.status === 'overdue')).length > 0 && (
              <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 flex items-start gap-2 text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-black">Active Loans Notice:</strong> This member currently has{' '}
                  <strong className="text-rose-700">{loans.filter(l => l.userId === userToDelete.id && (l.status === 'active' || l.status === 'overdue')).length} active book loan(s)</strong> checked out.
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setUserToDelete(null);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (onDeleteUser) {
                    onDeleteUser(userToDelete.id);
                  }
                  if (selectedMember?.id === userToDelete.id) {
                    setSelectedMember(null);
                  }
                  setUserToDelete(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
                id="confirm-delete-member-btn"
              >
                <Trash2 className="w-4 h-4" /> Delete Account
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
