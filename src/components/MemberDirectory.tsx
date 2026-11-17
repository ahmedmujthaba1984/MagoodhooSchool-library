import React, { useState, useEffect } from 'react';
import {
  Users, Search, UserCheck, Shield, UserPlus, CreditCard, BookOpen,
  AlertTriangle, FileSpreadsheet, Printer, Download, X, QrCode,
  Trash2, Zap, Flame, Award, ArrowRight
} from 'lucide-react';
import { UserProfile, UserRole, Loan, Book, PatronTier } from '../types';
import { useLanguage } from '../lib/i18n';
import { portalSyncManager, SyncStatusState } from '../lib/externalPortalSync';
import { generateCode128Bars } from '../lib/barcodeSvg';
import { printMemberIdCards } from '../lib/printableLabels';

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

const SvgBarcode: React.FC<{ code: string; height?: number }> = ({ code, height = 46 }) => {
  const { bars, totalWidth } = generateCode128Bars(code);
  return (
    <svg
      viewBox={`0 0 ${totalWidth} ${height}`}
      className="w-full max-w-[240px] h-12 mx-auto"
      role="img"
      aria-label={`Barcode ${code}`}
    >
      <rect width={totalWidth} height={height} fill="#ffffff" />
      {bars.map((bar, i) => (
        <rect key={i} x={bar.x} y={2} width={bar.width} height={height - 4} fill="#0f172a" />
      ))}
    </svg>
  );
};

export const MemberDirectory: React.FC<MemberDirectoryProps> = ({
  allUsers,
  loans,
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
  const [tierFilter, setTierFilter] = useState<'all' | PatronTier>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [selectedMember, setSelectedMember] = useState<UserProfile | null>(null);
  const [showLibraryCardModal, setShowLibraryCardModal] = useState<UserProfile | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatusState>(portalSyncManager.getStatus());
  const [isSyncingDirectory, setIsSyncingDirectory] = useState(false);

  useEffect(() => {
    const unsub = portalSyncManager.subscribeStatus((st) => setSyncStatus(st));
    return () => unsub();
  }, []);

  const handleQuickSync = async () => {
    setIsSyncingDirectory(true);
    try {
      await portalSyncManager.performManualSync();
    } catch (e) {
      console.warn('Manual sync error:', e);
    } finally {
      setIsSyncingDirectory(false);
    }
  };

  const filteredUsers = allUsers.filter(user => {
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const effectiveTier: PatronTier = user.patronTier || (user.role === 'staff' ? 'teacher' : user.role === 'admin' ? 'staff' : 'student');
    const matchesTier = tierFilter === 'all' || effectiveTier === tierFilter;
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      !q ||
      user.name.toLowerCase().includes(q) ||
      (user.dhivehiName && user.dhivehiName.toLowerCase().includes(q)) ||
      user.email.toLowerCase().includes(q) ||
      (user.studentIdCode && user.studentIdCode.toLowerCase().includes(q)) ||
      (user.staffIdCode && user.staffIdCode.toLowerCase().includes(q)) ||
      (user.staffDepartment && user.staffDepartment.toLowerCase().includes(q)) ||
      (user.grade && user.grade.toLowerCase().includes(q)) ||
      (user.phone && user.phone.includes(searchTerm));
    return matchesRole && matchesTier && matchesSearch;
  });

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return (
          <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-extrabold px-2 py-0.5 rounded-md inline-flex items-center gap-1 whitespace-nowrap">
            <Shield className="w-3 h-3 text-amber-600" /> {t.adminRole}
          </span>
        );
      case 'parent':
        return (
          <span className="bg-slate-100 text-slate-800 border border-slate-300 text-[10px] font-extrabold px-2 py-0.5 rounded-md inline-flex items-center gap-1 whitespace-nowrap">
            <Users className="w-3 h-3 text-slate-600" /> {t.parentRole}
          </span>
        );
      case 'staff':
        return (
          <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-extrabold px-2 py-0.5 rounded-md inline-flex items-center gap-1 whitespace-nowrap">
            <UserCheck className="w-3 h-3 text-emerald-700" /> {t.staffRole}
          </span>
        );
      case 'student':
        return (
          <span className="bg-sky-100 text-sky-900 border border-sky-300 text-[10px] font-extrabold px-2 py-0.5 rounded-md inline-flex items-center gap-1 whitespace-nowrap">
            <UserCheck className="w-3 h-3 text-sky-700" /> {t.studentRole}
          </span>
        );
    }
  };

  const getPatronCode = (u: UserProfile) =>
    u.studentIdCode || u.staffIdCode || `MAG-${u.id.slice(-6).toUpperCase()}`;

  const getUnpaidFinesMvr = (userId: string) =>
    loans
      .filter(l => l.userId === userId && !l.feePaid && (l.lateFee || 0) > 0)
      .reduce((sum, l) => sum + (l.lateFee || 0), 0);

  const handleExportCSV = () => {
    const headers = ['ID', 'Name', 'Email', 'Role', 'Patron Tier', 'Grade/Dept', 'Barcode ID', 'Phone', 'Streak Days'];
    const rows = filteredUsers.map(u => [
      u.id,
      `"${u.name}"`,
      `"${u.email}"`,
      u.role,
      `"${u.patronTier || u.role}"`,
      `"${u.grade || u.staffDepartment || 'N/A'}"`,
      `"${getPatronCode(u)}"`,
      `"${u.phone || 'N/A'}"`,
      u.readingStreakDays || 0
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `magoodhoo_library_members_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectedMemberUnpaid = selectedMember ? getUnpaidFinesMvr(selectedMember.id) : 0;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl p-6 text-slate-900 border border-slate-200 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider">
              <Users className="w-3.5 h-3.5 text-emerald-700" /> {t.memberDirectory}
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
              {t.memberDirectory}
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              {t.searchMembersPlaceholder}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onOpenReportCardSyncModal && (
              <button
                onClick={onOpenReportCardSyncModal}
                className={`font-bold text-xs px-3 py-2 rounded-xl transition flex items-center gap-2 border cursor-pointer ${
                  syncStatus.isLiveConnected
                    ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-300'
                }`}
                id="directory-reportcard-sync-btn"
              >
                <Zap className="w-3.5 h-3.5 text-emerald-600" />
                <span>{language === 'dv' ? 'ރިޕޯޓް ކާޑު ޕޯޓަލް ސިންކް' : 'Report Card Sync'}</span>
              </button>
            )}
            {onOpenAddParentModal && (
              <button
                onClick={onOpenAddParentModal}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                id="directory-add-parent-btn"
              >
                <UserPlus className="w-3.5 h-3.5" /> {t.addParent}
              </button>
            )}
            {onOpenImportModal && (
              <button
                onClick={() => onOpenImportModal('parents')}
                className="bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs px-3 py-2 rounded-xl transition flex items-center gap-1.5 border border-slate-300 cursor-pointer"
                id="directory-import-csv-btn"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" /> {t.importBulk}
              </button>
            )}
            <button
              onClick={() => printMemberIdCards(filteredUsers)}
              disabled={filteredUsers.length === 0}
              className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              id="directory-batch-print-ids-btn"
            >
              <Printer className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t.printBatchIdCards} (<bdi className="font-mono tabular-nums">{filteredUsers.length}</bdi>)</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs px-3 py-2 rounded-xl transition flex items-center gap-1.5 border border-slate-300 cursor-pointer"
              id="directory-export-csv-btn"
            >
              <Download className="w-3.5 h-3.5 text-slate-700" /> {t.exportCsv}
            </button>
          </div>
        </div>

        {/* Role & Patron Tier Filter Strip */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {([
              { id: 'all', label: t.allMembers, count: allUsers.length },
              { id: 'student', label: t.students, count: allUsers.filter(u => u.role === 'student').length },
              { id: 'parent', label: t.parents, count: allUsers.filter(u => u.role === 'parent').length },
              { id: 'staff', label: t.facultyStaff, count: allUsers.filter(u => u.role === 'staff').length },
              { id: 'admin', label: t.adminRole, count: allUsers.filter(u => u.role === 'admin').length }
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => setRoleFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  roleFilter === tab.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {tab.label} (<bdi className="font-mono tabular-nums">{tab.count}</bdi>)
              </button>
            ))}
          </div>

          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value as 'all' | PatronTier)}
            className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            aria-label="Filter by Patron Borrowing Tier"
          >
            <option value="all">{language === 'dv' ? 'ހުރިހާ ޕެޓްރަން ފެންވަރެއް' : 'All Patron Tiers'}</option>
            <option value="student">Student Tier</option>
            <option value="teacher">Teacher Tier</option>
            <option value="staff">Staff Tier</option>
            <option value="external">External / Community Tier</option>
          </select>
        </div>
      </div>

      {/* Report Card Portal Sync Strip */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Zap className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-black text-white">
              {language === 'dv' ? 'މަގޫދޫ ސްކޫލް ރިޕޯޓް ކާޑު ޕޯޓަލް ސިންކް' : 'Magoodhoo School Report Card Portal Directory'}
            </h3>
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-[10px] font-bold px-2 py-0.5 rounded-md font-mono tabular-nums">
              <bdi>215 Students • 215 Parents • 46 Staff</bdi>
            </span>
          </div>
          <p className="text-xs text-slate-300">
            {language === 'dv'
              ? 'ރިޕޯޓް ކާޑު ޕޯޓަލް އިން ހުރިހާ ގްރޭޑްތަކެއްގެ ދަރިވަރުންނާއި ބެލެނިވެރިން ސިންކްކުރައްވާ.'
              : 'Direct synchronization with reportcard-fmagoodhooschool.vercel.app across LKG to Grade 10.'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
          <button
            onClick={handleQuickSync}
            disabled={isSyncingDirectory}
            className="w-full md:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            id="directory-quick-sync-btn"
          >
            <Zap className={`w-3.5 h-3.5 ${isSyncingDirectory ? 'animate-spin' : ''}`} />
            <span>
              {isSyncingDirectory
                ? (language === 'dv' ? 'ސިންކް ވަނީ...' : 'Syncing Directory...')
                : (language === 'dv' ? 'މިހާރު ސިންކްކުރައްވާ' : 'Sync Portal Roster')}
            </span>
          </button>
          {onOpenReportCardSyncModal && (
            <button
              onClick={onOpenReportCardSyncModal}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 border border-slate-700"
            >
              {language === 'dv' ? 'ސެޓިންގްސް' : 'Settings'}
            </button>
          )}
        </div>
      </div>

      {/* Search Bar & View Mode Toggle */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t.searchMembersPlaceholder}
            className="w-full py-2.5 ps-10 pe-8 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            id="member-directory-search-input"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute top-1/2 -translate-y-1/2 end-3 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <span className="text-xs text-slate-500 font-semibold">
            {t.showing} <strong className="text-slate-900 font-mono tabular-nums"><bdi>{filteredUsers.length}</bdi></strong> {t.entries}
          </span>
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'grid' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {language === 'dv' ? 'ގްރިޑް' : 'Grid'}
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {language === 'dv' ? 'ޓޭބަލް' : 'Table'}
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
            const unpaidFines = getUnpaidFinesMvr(user.id);
            const children = allUsers.filter(u => user.childrenIds?.includes(u.id) || u.parentId === user.id);

            return (
              <div
                key={user.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-900 text-white font-extrabold text-sm flex items-center justify-center shrink-0">
                        {user.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-extrabold text-slate-900 text-sm leading-snug flex items-center gap-1.5 flex-wrap">
                          <span><bdi>{user.name}</bdi></span>
                          {user.dhivehiName && (
                            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              {user.dhivehiName}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium truncate max-w-[180px]">
                          <bdi>{user.email}</bdi>
                        </div>
                      </div>
                    </div>
                    {getRoleBadge(user.role)}
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                    {user.role === 'student' && (
                      <>
                        <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                          <span className="text-slate-400 font-semibold block text-[10px]">
                            {language === 'dv' ? 'ގްރޭޑް:' : 'Grade:'}
                          </span>
                          <span className="font-extrabold text-slate-800">
                            <bdi>{user.grade || (language === 'dv' ? 'ހަމަނުޖެހޭ' : 'Not Assigned')}</bdi>
                          </span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                          <span className="text-slate-400 font-semibold block text-[10px]">{t.studentId}:</span>
                          <span className="font-mono tabular-nums font-extrabold text-slate-900">
                            <bdi>{getPatronCode(user)}</bdi>
                          </span>
                        </div>
                      </>
                    )}

                    {user.role === 'parent' && (
                      <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 col-span-2">
                        <span className="text-slate-500 font-semibold block text-[10px]">{t.linkedChildren}:</span>
                        <span className="font-extrabold text-slate-900">
                          {children.length > 0
                            ? children.map(c => c.name).join(', ')
                            : (language === 'dv' ? 'ގުޅިފައިވާ ދަރިވަރަކު ނެތް' : 'No linked students')}
                        </span>
                      </div>
                    )}

                    {user.role === 'staff' && (
                      <>
                        <div className="bg-emerald-50 p-2 rounded-xl border border-emerald-200">
                          <span className="text-emerald-700 font-semibold block text-[10px]">{t.staffId}:</span>
                          <span className="font-mono tabular-nums font-extrabold text-emerald-950">
                            <bdi>{getPatronCode(user)}</bdi>
                          </span>
                        </div>
                        <div className="bg-emerald-50 p-2 rounded-xl border border-emerald-200">
                          <span className="text-emerald-700 font-semibold block text-[10px]">{t.department}:</span>
                          <span className="font-extrabold text-emerald-950">
                            <bdi>{user.staffDepartment || 'Faculty Staff'}</bdi>
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Patron Tier + Streak + Fines */}
                  <div className="flex items-center justify-between gap-2 text-[11px] flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold border border-slate-200 uppercase text-[10px]">
                        <bdi>{user.patronTier || user.role}</bdi>
                      </span>
                      {(user.readingStreakDays || 0) > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-bold inline-flex items-center gap-1 font-mono tabular-nums">
                          <Flame className="w-3 h-3 text-amber-600" /> <bdi>{user.readingStreakDays}d</bdi>
                        </span>
                      )}
                    </div>
                    {unpaidFines > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-mono tabular-nums font-extrabold">
                        <bdi>MVR {unpaidFines.toFixed(2)}</bdi>
                      </span>
                    )}
                  </div>

                  {/* Active Borrowing Summary */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-emerald-700" />
                      <div>
                        <div className="font-extrabold text-slate-900">
                          <bdi className="font-mono tabular-nums">{activeLoans.length}</bdi>{' '}
                          {language === 'dv' ? 'އެކްޓިވް ލޯން' : `Active Loan${activeLoans.length !== 1 ? 's' : ''}`}
                        </div>
                        {overdueLoans.length > 0 && (
                          <div className="text-[10px] text-rose-600 font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> <bdi>{overdueLoans.length}</bdi> {t.overdue}
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
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold py-2 px-3 rounded-xl transition cursor-pointer"
                  >
                    {t.viewMemberFile}
                  </button>
                  <button
                    onClick={() => setShowLibraryCardModal(user)}
                    className="bg-slate-900 hover:bg-slate-800 text-white p-2 rounded-xl transition shadow-sm cursor-pointer"
                    title="Print Digital Library Pass Barcode"
                  >
                    <QrCode className="w-4 h-4" />
                  </button>
                  {onDeleteUser && user.role !== 'admin' && currentUserRole === 'admin' && (
                    <button
                      onClick={() => setUserToDelete(user)}
                      className="bg-rose-50 hover:bg-rose-100 text-rose-700 p-2 rounded-xl transition border border-rose-200 cursor-pointer"
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
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-600 font-extrabold uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="p-4 border-e border-slate-200">{language === 'dv' ? 'މެންބަރުގެ ނަން' : 'Member Name'}</th>
                  <th className="p-4 border-e border-slate-200">{language === 'dv' ? 'ރޯލް' : 'Role / Tier'}</th>
                  <th className="p-4 border-e border-slate-200">{language === 'dv' ? 'ގްރޭޑް / އައިޑީ' : 'Grade / Barcode ID'}</th>
                  <th className="p-4 border-e border-slate-200">{language === 'dv' ? 'އީމެއިލް އަދި ފޯނު' : 'Contact'}</th>
                  <th className="p-4 border-e border-slate-200">{t.activeLoans}</th>
                  <th className="p-4 text-end">{language === 'dv' ? 'ޢަމަލުތައް' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user) => {
                  const memberLoans = loans.filter(l => l.userId === user.id && (l.status === 'active' || l.status === 'overdue'));
                  const unpaidFines = getUnpaidFinesMvr(user.id);

                  return (
                    <tr key={user.id} className="hover:bg-slate-50 transition">
                      <td className="p-4 border-e border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                            {user.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-extrabold text-slate-900 flex items-center gap-1.5 flex-wrap">
                              <span><bdi>{user.name}</bdi></span>
                              {user.dhivehiName && (
                                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-1.5 rounded border border-emerald-200">
                                  {user.dhivehiName}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                              <bdi>{getPatronCode(user)}</bdi>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 border-e border-slate-100">
                        <div className="space-y-1">
                          {getRoleBadge(user.role)}
                          <div className="text-[10px] uppercase font-bold text-slate-400">
                            <bdi>{user.patronTier || user.role}</bdi>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 border-e border-slate-100 font-medium">
                        {user.role === 'student' ? (
                          <div>
                            <div className="font-extrabold text-slate-900"><bdi>{user.grade || 'Grade N/A'}</bdi></div>
                            <div className="font-mono tabular-nums text-[11px] text-slate-600 font-bold"><bdi>{getPatronCode(user)}</bdi></div>
                          </div>
                        ) : user.role === 'staff' ? (
                          <div>
                            <div className="font-extrabold text-emerald-900"><bdi>{user.staffDepartment || 'Faculty Staff'}</bdi></div>
                            <div className="font-mono tabular-nums text-[11px] text-emerald-700 font-bold"><bdi>{getPatronCode(user)}</bdi></div>
                          </div>
                        ) : (
                          <div className="font-semibold text-slate-500">{language === 'dv' ? 'ޢާންމު މެންބަރު' : 'Guardian / Admin'}</div>
                        )}
                      </td>
                      <td className="p-4 border-e border-slate-100">
                        <div className="font-medium text-slate-800"><bdi>{user.email}</bdi></div>
                        <div className="text-[11px] text-slate-500 font-mono tabular-nums"><bdi>{user.phone || 'N/A'}</bdi></div>
                      </td>
                      <td className="p-4 border-e border-slate-100">
                        <div className="flex flex-col gap-1">
                          <span className={`font-extrabold px-2.5 py-0.5 rounded-md text-[11px] w-fit font-mono tabular-nums ${
                            memberLoans.length > 0 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                          }`}>
                            <bdi>{memberLoans.length}</bdi> {language === 'dv' ? 'ލޯން' : 'Loans'}
                          </span>
                          {unpaidFines > 0 && (
                            <span className="text-[10px] font-mono tabular-nums font-bold text-rose-600">
                              <bdi>MVR {unpaidFines.toFixed(2)}</bdi>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-end">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedMember(user)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-3 py-1.5 rounded-xl text-xs transition cursor-pointer"
                          >
                            {t.viewMemberFile}
                          </button>
                          <button
                            onClick={() => setShowLibraryCardModal(user)}
                            className="bg-slate-900 hover:bg-slate-800 text-white font-bold p-1.5 rounded-xl transition cursor-pointer"
                            title="Print Barcode Card"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                          {onDeleteUser && user.role !== 'admin' && (
                            <button
                              onClick={() => setUserToDelete(user)}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold p-1.5 rounded-xl transition border border-rose-200 cursor-pointer"
                              title="Remove Account"
                            >
                              <Trash2 className="w-4 h-4 text-rose-600" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MEMBER FILE 360° DETAIL MODAL */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 border border-slate-200 max-h-[90vh] overflow-y-auto space-y-5 text-slate-800">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-slate-900 text-white font-extrabold text-base flex items-center justify-center shrink-0">
                  {selectedMember.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-black text-slate-900"><bdi>{selectedMember.name}</bdi></h3>
                    {selectedMember.dhivehiName && (
                      <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {selectedMember.dhivehiName}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    {getRoleBadge(selectedMember.role)}
                    <span className="text-[10px] font-bold uppercase text-slate-500">
                      <bdi>{selectedMember.patronTier || selectedMember.role}</bdi>
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedMember(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* KPI Strip */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-amber-50 p-3 rounded-xl border border-amber-200">
                <div className="text-[10px] font-bold uppercase text-amber-700 flex items-center justify-center gap-1">
                  <Flame className="w-3.5 h-3.5" /> {language === 'dv' ? 'ކިޔުމުގެ ސްޓްރީކް' : 'Reading Streak'}
                </div>
                <div className="font-mono tabular-nums text-lg font-black text-amber-950 mt-0.5">
                  <bdi>{selectedMember.readingStreakDays || 0}d</bdi>
                </div>
              </div>
              <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                <div className="text-[10px] font-bold uppercase text-emerald-700 flex items-center justify-center gap-1">
                  <Award className="w-3.5 h-3.5" /> {language === 'dv' ? 'ނިންމި ފޮތް' : 'Books Read'}
                </div>
                <div className="font-mono tabular-nums text-lg font-black text-emerald-950 mt-0.5">
                  <bdi>{selectedMember.booksCompletedCount || loans.filter(l => l.userId === selectedMember.id && l.status === 'returned').length}</bdi>
                </div>
              </div>
              <div className={`p-3 rounded-xl border ${selectedMemberUnpaid > 0 ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'}`}>
                <div className={`text-[10px] font-bold uppercase ${selectedMemberUnpaid > 0 ? 'text-rose-700' : 'text-slate-500'}`}>
                  {language === 'dv' ? 'ނުދައްކާ ޖޫރިމަނާ' : 'Unpaid Balance'}
                </div>
                <div className={`font-mono tabular-nums text-lg font-black mt-0.5 ${selectedMemberUnpaid > 0 ? 'text-rose-700' : 'text-slate-900'}`}>
                  <bdi>MVR {selectedMemberUnpaid.toFixed(2)}</bdi>
                </div>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 font-bold block text-[10px]">Email Address:</span>
                  <span className="font-extrabold text-slate-900"><bdi>{selectedMember.email}</bdi></span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block text-[10px]">Phone Number:</span>
                  <span className="font-mono tabular-nums font-extrabold text-slate-900"><bdi>{selectedMember.phone || '+960 6740018'}</bdi></span>
                </div>
                {selectedMember.grade && (
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px]">Grade Level:</span>
                    <span className="font-extrabold text-slate-900"><bdi>{selectedMember.grade}</bdi></span>
                  </div>
                )}
                <div>
                  <span className="text-slate-400 font-bold block text-[10px]">Patron Barcode ID:</span>
                  <span className="font-mono tabular-nums font-extrabold text-emerald-700"><bdi>{getPatronCode(selectedMember)}</bdi></span>
                </div>
              </div>

              {/* Borrowing Loans History */}
              <div className="space-y-2">
                <h4 className="font-black text-slate-900 uppercase text-[11px] tracking-wider">
                  {language === 'dv' ? 'ފޮތް ނެގުމުގެ ރެކޯޑް' : 'Current & Past Book Loans'}
                </h4>
                {loans.filter(l => l.userId === selectedMember.id).length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-slate-500 italic text-center">
                    No loan records found for this member.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {loans.filter(l => l.userId === selectedMember.id).map(loan => (
                      <div key={loan.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                        <div>
                          <div className="font-extrabold text-slate-900"><bdi>{loan.bookTitle}</bdi></div>
                          <div className="text-[10px] text-slate-500 font-mono tabular-nums">
                            <bdi>Issued: {loan.issueDate} | Due: {loan.dueDate}</bdi>
                            {loan.lateFee > 0 && (
                              <span className="text-rose-600 font-bold ms-2">
                                <bdi>MVR {loan.lateFee.toFixed(2)}</bdi>
                              </span>
                            )}
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                          loan.status === 'returned'
                            ? 'bg-emerald-100 text-emerald-900'
                            : loan.status === 'overdue'
                            ? 'bg-rose-100 text-rose-900'
                            : 'bg-sky-100 text-sky-900'
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
                  <Trash2 className="w-4 h-4 text-rose-600" /> {language === 'dv' ? 'އެކައުންޓް ފޮހެލާ' : 'Remove'}
                </button>
              ) : <div />}

              <div className="flex items-center gap-2 flex-wrap">
                {onSelectMemberForCheckout && (
                  <button
                    onClick={() => {
                      const code = getPatronCode(selectedMember);
                      setSelectedMember(null);
                      onSelectMemberForCheckout(code);
                    }}
                    className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer text-xs"
                  >
                    <span>{language === 'dv' ? 'ފޮތެއް ދޫކުރޭ' : 'Issue Book'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowLibraryCardModal(selectedMember);
                    setSelectedMember(null);
                  }}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer text-xs"
                >
                  <QrCode className="w-4 h-4" /> {language === 'dv' ? 'ލައިބްރަރީ ކާޑު' : 'Digital Pass'}
                </button>
                <button
                  onClick={() => setSelectedMember(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition text-xs cursor-pointer"
                >
                  {t.closeWindow}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DIGITAL LIBRARY PASS / SVG BARCODE MODAL */}
      {showLibraryCardModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4 text-center">
            <div className="flex justify-between items-center border-b pb-3 border-slate-100 no-print">
              <div className="text-start">
                <h3 className="font-black text-slate-900 text-base">
                  {language === 'dv' ? 'ފ. މަގޫދޫ ސްކޫލް ލައިބްރަރީ ކާޑު' : 'Magoodhoo School Library Pass'}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {language === 'dv' ? 'ޕްރިންޓް ނުވަތަ ސްކޭން ކުރެއްވުމަށް' : 'Official printable Code-128 patron ID card'}
                </p>
              </div>
              <button onClick={() => setShowLibraryCardModal(null)} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-900 p-6 rounded-2xl text-white shadow-lg space-y-4 text-start border border-slate-800">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400">
                    F. Magoodhoo School Library
                  </div>
                  <div className="text-lg font-black text-white mt-0.5"><bdi>{showLibraryCardModal.name}</bdi></div>
                  <div className="text-xs text-slate-300 capitalize">
                    <bdi>{showLibraryCardModal.patronTier || showLibraryCardModal.role}</bdi> • <bdi>{showLibraryCardModal.grade || showLibraryCardModal.staffDepartment || 'Faculty'}</bdi>
                  </div>
                </div>
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-400/30">
                  <CreditCard className="w-5 h-5 text-emerald-300" />
                </div>
              </div>

              <div className="bg-white p-3.5 rounded-xl text-center space-y-1.5">
                <SvgBarcode code={getPatronCode(showLibraryCardModal)} />
                <div className="font-mono tabular-nums text-xs font-extrabold text-slate-900 tracking-wider">
                  <bdi>{getPatronCode(showLibraryCardModal)}</bdi>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 text-center font-medium">
                {language === 'dv'
                  ? 'ފޮތް ދޫކުރުމަށާއި އަނބުރާ ހަވާލުކުރުމަށް ލައިބްރަރީ ޑެސްކަށް މި ކާޑު ދައްކަވާ.'
                  : 'Present this barcode at the circulation desk for instant checkouts & renewals.'}
              </div>
            </div>

            <div className="flex gap-2 justify-center pt-2 no-print">
              <button
                onClick={() => printMemberIdCards([showLibraryCardModal])}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl shadow transition flex items-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" /> {language === 'dv' ? 'ކާޑު ޕްރިންޓްކުރޭ' : 'Print Member Library Card'}
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
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-5 text-slate-800">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-11 h-11 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Confirm Account Deletion</h3>
                <p className="text-xs text-slate-500 font-semibold">Permanent Database Operation</p>
              </div>
            </div>

            <div className="bg-rose-50/70 p-4 rounded-xl border border-rose-100 text-xs space-y-2">
              <p className="text-slate-800 font-bold">
                Are you sure you want to delete <strong className="text-rose-950 font-black"><bdi>{userToDelete.name}</bdi></strong> from the library database?
              </p>
              <div className="text-[11px] text-slate-600 space-y-1 pt-1.5 border-t border-rose-200/60">
                <div>• Role: <span className="font-bold uppercase text-slate-800">{userToDelete.role}</span></div>
                <div>• Email: <span className="font-mono text-slate-800"><bdi>{userToDelete.email}</bdi></span></div>
                {userToDelete.studentIdCode && (
                  <div>• Student ID: <span className="font-mono font-bold text-slate-800"><bdi>{userToDelete.studentIdCode}</bdi></span></div>
                )}
              </div>
            </div>

            {loans.filter(l => l.userId === userToDelete.id && (l.status === 'active' || l.status === 'overdue')).length > 0 && (
              <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 flex items-start gap-2 text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-black">Active Loans Notice:</strong> This member currently has{' '}
                  <strong className="text-rose-700 font-mono tabular-nums">
                    {loans.filter(l => l.userId === userToDelete.id && (l.status === 'active' || l.status === 'overdue')).length}
                  </strong> active book loan(s).
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (onDeleteUser) onDeleteUser(userToDelete.id);
                  if (selectedMember?.id === userToDelete.id) setSelectedMember(null);
                  setUserToDelete(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer"
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
