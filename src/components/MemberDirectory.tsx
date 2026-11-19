import React, { useState, useEffect } from 'react';
import {
  Users, Search, UserCheck, Shield, UserPlus, BookOpen,
  AlertTriangle, FileSpreadsheet, Printer, Download, X, QrCode,
  Trash2, Zap, Flame, Award, ArrowRight
} from 'lucide-react';
import { UserProfile, UserRole, Loan, Book, PatronTier } from '../types';
import { useLanguage } from '../lib/i18n';
import { portalSyncManager, SyncStatusState } from '../lib/externalPortalSync';
import { generateCode128Bars } from '../lib/barcodeSvg';
import { printMemberIdCards } from '../lib/printableLabels';
import { LibraryEmblem } from './LibraryEmblem';
import { StatusPill } from './StatusPill';

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
  initialSelectedMemberId?: string | null;
  onSelectedMemberChange?: (memberId: string | null) => void;
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
  onDeleteUser,
  initialSelectedMemberId = null,
  onSelectedMemberChange
}) => {
  const { t, language, isRtl } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [tierFilter, setTierFilter] = useState<'all' | PatronTier>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [selectedMember, setSelectedMemberState] = useState<UserProfile | null>(() => {
    if (!initialSelectedMemberId) return null;
    return (
      allUsers.find(
        (u) =>
          u.id === initialSelectedMemberId ||
          u.studentIdCode === initialSelectedMemberId ||
          u.staffIdCode === initialSelectedMemberId
      ) || null
    );
  });
  const [showLibraryCardModal, setShowLibraryCardModal] = useState<UserProfile | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatusState>(portalSyncManager.getStatus());
  const [isSyncingDirectory, setIsSyncingDirectory] = useState(false);

  const setSelectedMember = (member: UserProfile | null) => {
    setSelectedMemberState(member);
    if (onSelectedMemberChange) {
      onSelectedMemberChange(member ? member.id : null);
    }
  };

  useEffect(() => {
    if (!initialSelectedMemberId) {
      setSelectedMemberState(null);
      return;
    }
    const found =
      allUsers.find(
        (u) =>
          u.id === initialSelectedMemberId ||
          u.studentIdCode === initialSelectedMemberId ||
          u.staffIdCode === initialSelectedMemberId
      ) || null;
    if (found) setSelectedMemberState(found);
  }, [initialSelectedMemberId, allUsers]);

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
          <span className="bg-[#FFFBEB] dark:bg-[#78350F]/35 text-[#B45309] dark:text-[#FCD34D] border border-[#FDE68A] dark:border-[#B45309]/60 text-[10px] font-extrabold px-2 py-0.5 rounded-full inline-flex items-center gap-1 whitespace-nowrap">
            <Shield className="w-3 h-3 text-[#C26D3A] dark:text-[#FCD34D]" /> {t.adminRole}
          </span>
        );
      case 'parent':
        return (
          <span className="bg-[#EFECE6] dark:bg-[#232724] text-[#1C1917] dark:text-[#F5F3EE] border border-[#E2DDD5] dark:border-[#2E3330] text-[10px] font-extrabold px-2 py-0.5 rounded-full inline-flex items-center gap-1 whitespace-nowrap">
            <Users className="w-3 h-3 text-[#6B655D] dark:text-[#A19B91]" /> {t.parentRole}
          </span>
        );
      case 'staff':
        return (
          <span className="bg-[#ECFDF5] dark:bg-[#0F4C45]/40 text-[#0F4C45] dark:text-[#6EE7B7] border border-[#A7F3D0] dark:border-[#16655B] text-[10px] font-extrabold px-2 py-0.5 rounded-full inline-flex items-center gap-1 whitespace-nowrap">
            <UserCheck className="w-3 h-3 text-[#0F4C45] dark:text-[#6EE7B7]" /> {t.staffRole}
          </span>
        );
      case 'student':
        return (
          <span className="bg-[#EFF6FF] dark:bg-[#1E3A8A]/30 text-[#1D4ED8] dark:text-[#93C5FD] border border-[#BFDBFE] dark:border-[#1D4ED8]/60 text-[10px] font-extrabold px-2 py-0.5 rounded-full inline-flex items-center gap-1 whitespace-nowrap">
            <UserCheck className="w-3 h-3 text-[#1D4ED8] dark:text-[#93C5FD]" /> {t.studentRole}
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
      <div className="bg-white dark:bg-[#1A1D1B] rounded-2xl p-6 text-[#1C1917] dark:text-[#F5F3EE] border border-[#E2DDD5] dark:border-[#2E3330] shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 bg-[#ECFDF5] dark:bg-[#0F4C45]/40 text-[#0F4C45] dark:text-[#6EE7B7] border border-[#A7F3D0] dark:border-[#16655B] px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider">
              <Users className="w-3.5 h-3.5" /> {t.memberDirectory}
            </div>
            <h2 className="archival-heading text-xl sm:text-2xl font-black tracking-tight text-[#1C1917] dark:text-[#F5F3EE]">
              {t.memberDirectory}
            </h2>
            <p className="text-xs text-[#6B655D] dark:text-[#A19B91] font-medium">
              {t.searchMembersPlaceholder}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onOpenReportCardSyncModal && (
              <button
                onClick={onOpenReportCardSyncModal}
                className={`font-bold text-xs px-3 py-2 rounded-xl transition flex items-center gap-2 border cursor-pointer ${
                  syncStatus.isLiveConnected
                    ? 'bg-[#ECFDF5] dark:bg-[#0F4C45]/35 hover:bg-[#D1FAE5] dark:hover:bg-[#0F4C45]/50 text-[#0F4C45] dark:text-[#6EE7B7] border-[#A7F3D0] dark:border-[#16655B]'
                    : 'bg-[#F7F5F0] dark:bg-[#232724] hover:bg-[#EFECE6] dark:hover:bg-[#2E3330] text-[#1C1917] dark:text-[#F5F3EE] border-[#E2DDD5] dark:border-[#2E3330]'
                }`}
                id="directory-reportcard-sync-btn"
              >
                <Zap className="w-3.5 h-3.5 text-[#0F4C45] dark:text-[#6EE7B7]" />
                <span>{language === 'dv' ? 'ރިޕޯޓް ކާޑު ޕޯޓަލް ސިންކް' : 'Report Card Sync'}</span>
              </button>
            )}
            {onOpenAddParentModal && (
              <button
                onClick={onOpenAddParentModal}
                className="bg-[#0F4C45] hover:bg-[#16655B] text-white font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                id="directory-add-parent-btn"
              >
                <UserPlus className="w-3.5 h-3.5" /> {t.addParent}
              </button>
            )}
            {onOpenImportModal && (
              <button
                onClick={() => onOpenImportModal('parents')}
                className="bg-[#F7F5F0] dark:bg-[#232724] hover:bg-[#EFECE6] dark:hover:bg-[#2E3330] text-[#1C1917] dark:text-[#F5F3EE] font-bold text-xs px-3 py-2 rounded-xl transition flex items-center gap-1.5 border border-[#E2DDD5] dark:border-[#2E3330] cursor-pointer"
                id="directory-import-csv-btn"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#0F4C45] dark:text-[#6EE7B7]" /> {t.importBulk}
              </button>
            )}
            <button
              onClick={() => printMemberIdCards(filteredUsers)}
              disabled={filteredUsers.length === 0}
              className="bg-[#0D2623] dark:bg-[#232724] hover:bg-[#0F4C45] dark:hover:bg-[#2E3330] disabled:opacity-50 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 border border-[#16655B]/40 dark:border-[#2E3330]"
              id="directory-batch-print-ids-btn"
            >
              <Printer className="w-3.5 h-3.5 text-[#C26D3A]" />
              <span>{t.printBatchIdCards} (<bdi dir="ltr" className="font-mono tabular-nums">{filteredUsers.length}</bdi>)</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="bg-[#F7F5F0] dark:bg-[#232724] hover:bg-[#EFECE6] dark:hover:bg-[#2E3330] text-[#1C1917] dark:text-[#F5F3EE] font-bold text-xs px-3 py-2 rounded-xl transition flex items-center gap-1.5 border border-[#E2DDD5] dark:border-[#2E3330] cursor-pointer"
              id="directory-export-csv-btn"
            >
              <Download className="w-3.5 h-3.5 text-[#6B655D] dark:text-[#A19B91]" /> {t.exportCsv}
            </button>
          </div>
        </div>

        {/* Role & Patron Tier Filter Strip */}
        <div className="mt-5 pt-4 border-t border-[#E2DDD5] dark:border-[#2E3330] flex flex-wrap items-center justify-between gap-3">
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
                    ? 'bg-[#0F4C45] text-white shadow-xs'
                    : 'bg-[#F7F5F0] dark:bg-[#232724] text-[#6B655D] dark:text-[#A19B91] hover:bg-[#EFECE6] dark:hover:bg-[#2E3330]'
                }`}
              >
                {tab.label} (<bdi dir="ltr" className="font-mono tabular-nums">{tab.count}</bdi>)
              </button>
            ))}
          </div>

          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value as 'all' | PatronTier)}
            className="bg-[#F7F5F0] dark:bg-[#232724] border border-[#E2DDD5] dark:border-[#2E3330] rounded-xl px-3 py-1.5 text-xs font-bold text-[#1C1917] dark:text-[#F5F3EE] focus:outline-none focus:ring-2 focus:ring-[#0F4C45]"
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
      <div className="bg-[#0D2623] dark:bg-[#161918] text-white rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-[#16655B]/40 dark:border-[#2E3330]">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Zap className="w-4 h-4 text-[#C26D3A]" />
            <h3 className="archival-heading text-sm font-black text-white">
              {language === 'dv' ? 'މަގޫދޫ ސްކޫލް ރިޕޯޓް ކާޑު ޕޯޓަލް ސިންކް' : 'Magoodhoo School Report Card Portal Directory'}
            </h3>
            <span className="bg-[#0F4C45]/70 text-[#A7F3D0] border border-[#6EE7B7]/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full font-mono tabular-nums">
              <bdi dir="ltr">215 Students • 215 Parents • 46 Staff</bdi>
            </span>
          </div>
          <p className="text-xs text-[#D5E2DF]">
            {language === 'dv'
              ? 'ރިޕޯޓް ކާޑު ޕޯޓަލް އިން ހުރިހާ ގްރޭޑްތަކެއްގެ ދަރިވަރުންނާއި ބެލެނިވެރިން ސިންކްކުރައްވާ.'
              : 'Direct synchronization with reportcard-fmagoodhooschool.vercel.app across LKG to Grade 10.'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
          <button
            onClick={handleQuickSync}
            disabled={isSyncingDirectory}
            className="w-full md:w-auto px-4 py-2 bg-[#0F4C45] hover:bg-[#16655B] text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 border border-[#6EE7B7]/25"
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
              className="px-3 py-2 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-bold transition cursor-pointer shrink-0 border border-white/15"
            >
              {language === 'dv' ? 'ސެޓިންގްސް' : 'Settings'}
            </button>
          )}
        </div>
      </div>

      {/* Search Bar & View Mode Toggle */}
      <div className="bg-white dark:bg-[#1A1D1B] p-4 rounded-2xl border border-[#E2DDD5] dark:border-[#2E3330] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 text-[#6B655D] dark:text-[#A19B91] absolute top-1/2 -translate-y-1/2 start-3.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t.searchMembersPlaceholder}
            className="w-full py-2.5 ps-10 pe-8 bg-[#F7F5F0] dark:bg-[#232724] border border-[#E2DDD5] dark:border-[#2E3330] rounded-xl text-xs font-bold text-[#1C1917] dark:text-[#F5F3EE] placeholder-[#6B655D] dark:placeholder-[#A19B91] focus:outline-none focus:ring-2 focus:ring-[#0F4C45]"
            id="member-directory-search-input"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute top-1/2 -translate-y-1/2 end-3 text-[#6B655D] hover:text-[#1C1917] dark:hover:text-[#F5F3EE] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <span className="text-xs text-[#6B655D] dark:text-[#A19B91] font-semibold">
            {t.showing} <strong className="text-[#1C1917] dark:text-[#F5F3EE] font-mono tabular-nums"><bdi dir="ltr">{filteredUsers.length}</bdi></strong> {t.entries}
          </span>
          <div className="flex bg-[#EFECE6] dark:bg-[#232724] p-1 rounded-xl border border-[#E2DDD5] dark:border-[#2E3330]">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'grid' ? 'bg-white dark:bg-[#1A1D1B] text-[#0F4C45] dark:text-[#6EE7B7] shadow-xs' : 'text-[#6B655D] dark:text-[#A19B91] hover:text-[#1C1917] dark:hover:text-[#F5F3EE]'
              }`}
            >
              {language === 'dv' ? 'ގްރިޑް' : 'Grid'}
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'table' ? 'bg-white dark:bg-[#1A1D1B] text-[#0F4C45] dark:text-[#6EE7B7] shadow-xs' : 'text-[#6B655D] dark:text-[#A19B91] hover:text-[#1C1917] dark:hover:text-[#F5F3EE]'
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
                className="bg-white dark:bg-[#1A1D1B] rounded-2xl border border-[#E2DDD5] dark:border-[#2E3330] p-5 shadow-xs hover:shadow-md transition space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      {user.photoUrl ? (
                        <img
                          src={user.photoUrl}
                          alt={user.name}
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 rounded-full object-cover border border-[#E2DDD5] dark:border-[#2E3330] shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-[#0F4C45] text-white font-extrabold text-sm flex items-center justify-center shrink-0">
                          {user.name.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-extrabold text-[#1C1917] dark:text-[#F5F3EE] text-sm leading-snug flex items-center gap-1.5 flex-wrap">
                          <span><bdi>{user.name}</bdi></span>
                          {user.dhivehiName && (
                            <span className="text-[11px] font-bold text-[#0F4C45] dark:text-[#6EE7B7] bg-[#ECFDF5] dark:bg-[#0F4C45]/35 px-1.5 py-0.5 rounded border border-[#A7F3D0] dark:border-[#16655B]">
                              {user.dhivehiName}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#6B655D] dark:text-[#A19B91] font-medium truncate max-w-[180px]">
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
                        <div className="bg-[#F7F5F0] dark:bg-[#232724] p-2 rounded-xl border border-[#E2DDD5] dark:border-[#2E3330]">
                          <span className="text-[#6B655D] dark:text-[#A19B91] font-semibold block text-[10px]">
                            {language === 'dv' ? 'ގްރޭޑް:' : 'Grade:'}
                          </span>
                          <span className="font-extrabold text-[#1C1917] dark:text-[#F5F3EE]">
                            <bdi>{user.grade || (language === 'dv' ? 'ހަމަނުޖެހޭ' : 'Not Assigned')}</bdi>
                          </span>
                        </div>
                        <div className="bg-[#F7F5F0] dark:bg-[#232724] p-2 rounded-xl border border-[#E2DDD5] dark:border-[#2E3330]">
                          <span className="text-[#6B655D] dark:text-[#A19B91] font-semibold block text-[10px]">{t.studentId}:</span>
                          <span className="font-mono tabular-nums font-extrabold text-[#1C1917] dark:text-[#F5F3EE]">
                            <bdi dir="ltr">{getPatronCode(user)}</bdi>
                          </span>
                        </div>
                      </>
                    )}

                    {user.role === 'parent' && (
                      <div className="bg-[#F7F5F0] dark:bg-[#232724] p-2 rounded-xl border border-[#E2DDD5] dark:border-[#2E3330] col-span-2">
                        <span className="text-[#6B655D] dark:text-[#A19B91] font-semibold block text-[10px]">{t.linkedChildren}:</span>
                        <span className="font-extrabold text-[#1C1917] dark:text-[#F5F3EE]">
                          {children.length > 0
                            ? children.map(c => c.name).join(', ')
                            : (language === 'dv' ? 'ގުޅިފައިވާ ދަރިވަރަކު ނެތް' : 'No linked students')}
                        </span>
                      </div>
                    )}

                    {user.role === 'staff' && (
                      <>
                        <div className="bg-[#ECFDF5] dark:bg-[#0F4C45]/30 p-2 rounded-xl border border-[#A7F3D0] dark:border-[#16655B]">
                          <span className="text-[#0F4C45] dark:text-[#6EE7B7] font-semibold block text-[10px]">{t.staffId}:</span>
                          <span className="font-mono tabular-nums font-extrabold text-[#1C1917] dark:text-[#F5F3EE]">
                            <bdi dir="ltr">{getPatronCode(user)}</bdi>
                          </span>
                        </div>
                        <div className="bg-[#ECFDF5] dark:bg-[#0F4C45]/30 p-2 rounded-xl border border-[#A7F3D0] dark:border-[#16655B]">
                          <span className="text-[#0F4C45] dark:text-[#6EE7B7] font-semibold block text-[10px]">{t.department}:</span>
                          <span className="font-extrabold text-[#1C1917] dark:text-[#F5F3EE]">
                            <bdi>{user.staffDepartment || 'Faculty Staff'}</bdi>
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Patron Tier + Streak + Fines */}
                  <div className="flex items-center justify-between gap-2 text-[11px] flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-full bg-[#EFECE6] dark:bg-[#232724] text-[#6B655D] dark:text-[#A19B91] font-bold border border-[#E2DDD5] dark:border-[#2E3330] uppercase text-[10px]">
                        <bdi>{user.patronTier || user.role}</bdi>
                      </span>
                      {(user.readingStreakDays || 0) > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-[#FFFBEB] dark:bg-[#78350F]/35 text-[#B45309] dark:text-[#FCD34D] border border-[#FDE68A] dark:border-[#B45309]/60 font-bold inline-flex items-center gap-1 font-mono tabular-nums">
                          <Flame className="w-3 h-3 text-[#C26D3A]" /> <bdi dir="ltr">{user.readingStreakDays}d</bdi>
                        </span>
                      )}
                    </div>
                    {unpaidFines > 0 && (
                      <StatusPill
                        compact
                        status="overdue"
                        countPrefix={`MVR ${unpaidFines.toFixed(2)}`}
                        label={language === 'dv' ? 'ޖޫރިމަނާ' : 'Due'}
                      />
                    )}
                  </div>

                  {/* Active Borrowing Summary */}
                  <div className="bg-[#F7F5F0] dark:bg-[#232724] p-3 rounded-xl border border-[#E2DDD5] dark:border-[#2E3330] flex items-center justify-between text-xs gap-2">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-[#0F4C45] dark:text-[#6EE7B7]" />
                      <div className="font-extrabold text-[#1C1917] dark:text-[#F5F3EE]">
                        <bdi dir="ltr" className="font-mono tabular-nums">{activeLoans.length}</bdi>{' '}
                        {language === 'dv' ? 'އެކްޓިވް ލޯން' : `Active Loan${activeLoans.length !== 1 ? 's' : ''}`}
                      </div>
                    </div>
                    {overdueLoans.length > 0 ? (
                      <StatusPill compact status="overdue" countPrefix={`${overdueLoans.length}`} label={t.overdue} />
                    ) : activeLoans.length > 0 ? (
                      <StatusPill compact status="checked_out" label={t.statusActive} />
                    ) : (
                      <StatusPill compact status="available" label={language === 'dv' ? 'ރަނގަޅު' : 'Clear'} />
                    )}
                  </div>
                </div>

                {/* Footer Action Buttons */}
                <div className="pt-3 border-t border-[#E2DDD5] dark:border-[#2E3330] flex items-center gap-2">
                  <button
                    onClick={() => setSelectedMember(user)}
                    className="flex-1 bg-[#F7F5F0] dark:bg-[#232724] hover:bg-[#EFECE6] dark:hover:bg-[#2E3330] text-[#1C1917] dark:text-[#F5F3EE] border border-[#E2DDD5] dark:border-[#2E3330] text-xs font-bold py-2 px-3 rounded-xl transition cursor-pointer"
                  >
                    {t.viewMemberFile}
                  </button>
                  <button
                    onClick={() => setShowLibraryCardModal(user)}
                    className="bg-[#0F4C45] hover:bg-[#16655B] text-white p-2 rounded-xl transition shadow-xs cursor-pointer"
                    title="Print Digital Library Pass Barcode"
                  >
                    <QrCode className="w-4 h-4" />
                  </button>
                  {onDeleteUser && user.role !== 'admin' && currentUserRole === 'admin' && (
                    <button
                      onClick={() => setUserToDelete(user)}
                      className="bg-[#FEF2F2] dark:bg-[#7F1D1D]/30 hover:bg-[#FEE2E2] dark:hover:bg-[#7F1D1D]/50 text-[#B91C1C] dark:text-[#FCA5A5] p-2 rounded-xl transition border border-[#FECACA] dark:border-[#B91C1C]/60 cursor-pointer"
                      title="Remove Account"
                    >
                      <Trash2 className="w-4 h-4" />
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
        <div className="bg-white dark:bg-[#1A1D1B] rounded-2xl border border-[#E2DDD5] dark:border-[#2E3330] overflow-hidden shadow-xs">
          <div className="w-full overflow-x-auto scrollbar-thin max-h-[70vh]">
            <table className="w-full text-start text-xs text-[#1C1917] dark:text-[#F5F3EE]">
              <thead className="sticky top-0 z-20 bg-[#0D2623] dark:bg-[#232724] text-[#F5F3EE] font-extrabold uppercase text-[10px] border-b border-[#16655B]/40 dark:border-[#2E3330]">
                <tr>
                  <th className="p-4 border-e border-white/10 dark:border-[#2E3330] sticky start-0 z-30 bg-[#0D2623] dark:bg-[#232724] min-w-[200px]">{language === 'dv' ? 'މެންބަރުގެ ނަން' : 'Member Name'}</th>
                  <th className="p-4 border-e border-white/10 dark:border-[#2E3330]">{language === 'dv' ? 'ރޯލް' : 'Role / Tier'}</th>
                  <th className="p-4 border-e border-white/10 dark:border-[#2E3330]">{language === 'dv' ? 'ގްރޭޑް / އައިޑީ' : 'Grade / Barcode ID'}</th>
                  <th className="p-4 border-e border-white/10 dark:border-[#2E3330]">{language === 'dv' ? 'އީމެއިލް އަދި ފޯނު' : 'Contact'}</th>
                  <th className="p-4 border-e border-white/10 dark:border-[#2E3330]">{t.activeLoans}</th>
                  <th className="p-4 text-end">{language === 'dv' ? 'ޢަމަލުތައް' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2DDD5] dark:divide-[#2E3330]">
                {filteredUsers.map((user) => {
                  const memberLoans = loans.filter(l => l.userId === user.id && (l.status === 'active' || l.status === 'overdue'));
                  const hasOverdue = memberLoans.some(l => l.status === 'overdue');
                  const unpaidFines = getUnpaidFinesMvr(user.id);

                  return (
                    <tr key={user.id} className="hover:bg-[#F7F5F0] dark:hover:bg-[#232724] transition">
                      <td className="p-4 border-e border-[#E2DDD5] dark:border-[#2E3330] sticky start-0 z-10 bg-white dark:bg-[#1A1D1B]">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#0F4C45] text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                            {user.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-extrabold text-[#1C1917] dark:text-[#F5F3EE] flex items-center gap-1.5 flex-wrap">
                              <span><bdi>{user.name}</bdi></span>
                              {user.dhivehiName && (
                                <span className="text-[11px] font-bold text-[#0F4C45] dark:text-[#6EE7B7] bg-[#ECFDF5] dark:bg-[#0F4C45]/35 px-1.5 rounded border border-[#A7F3D0] dark:border-[#16655B]">
                                  {user.dhivehiName}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[#6B655D] dark:text-[#A19B91] font-mono tabular-nums">
                              <bdi dir="ltr">{getPatronCode(user)}</bdi>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 border-e border-[#E2DDD5] dark:border-[#2E3330]">
                        <div className="space-y-1">
                          {getRoleBadge(user.role)}
                          <div className="text-[10px] uppercase font-bold text-[#6B655D] dark:text-[#A19B91]">
                            <bdi>{user.patronTier || user.role}</bdi>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 border-e border-[#E2DDD5] dark:border-[#2E3330] font-medium">
                        {user.role === 'student' ? (
                          <div>
                            <div className="font-extrabold text-[#1C1917] dark:text-[#F5F3EE]"><bdi>{user.grade || 'Grade N/A'}</bdi></div>
                            <div className="font-mono tabular-nums text-[11px] text-[#6B655D] dark:text-[#A19B91] font-bold"><bdi dir="ltr">{getPatronCode(user)}</bdi></div>
                          </div>
                        ) : user.role === 'staff' ? (
                          <div>
                            <div className="font-extrabold text-[#0F4C45] dark:text-[#6EE7B7]"><bdi>{user.staffDepartment || 'Faculty Staff'}</bdi></div>
                            <div className="font-mono tabular-nums text-[11px] text-[#6B655D] dark:text-[#A19B91] font-bold"><bdi dir="ltr">{getPatronCode(user)}</bdi></div>
                          </div>
                        ) : (
                          <div className="font-semibold text-[#6B655D] dark:text-[#A19B91]">{language === 'dv' ? 'ޢާންމު މެންބަރު' : 'Guardian / Admin'}</div>
                        )}
                      </td>
                      <td className="p-4 border-e border-[#E2DDD5] dark:border-[#2E3330]">
                        <div className="font-medium text-[#1C1917] dark:text-[#F5F3EE]"><bdi>{user.email}</bdi></div>
                        <div className="text-[11px] text-[#6B655D] dark:text-[#A19B91] font-mono tabular-nums"><bdi dir="ltr">{user.phone || 'N/A'}</bdi></div>
                      </td>
                      <td className="p-4 border-e border-[#E2DDD5] dark:border-[#2E3330]">
                        <div className="flex flex-col gap-1 items-start">
                          <StatusPill
                            compact
                            status={hasOverdue ? 'overdue' : memberLoans.length > 0 ? 'checked_out' : 'available'}
                            countPrefix={`${memberLoans.length}`}
                            label={language === 'dv' ? 'ލޯން' : 'Loans'}
                          />
                          {unpaidFines > 0 && (
                            <span className="text-[10px] font-mono tabular-nums font-bold text-[#B91C1C] dark:text-[#FCA5A5]">
                              <bdi dir="ltr">MVR {unpaidFines.toFixed(2)}</bdi>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-end">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedMember(user)}
                            className="bg-[#F7F5F0] dark:bg-[#232724] hover:bg-[#EFECE6] dark:hover:bg-[#2E3330] text-[#1C1917] dark:text-[#F5F3EE] border border-[#E2DDD5] dark:border-[#2E3330] font-bold px-3 py-1.5 rounded-xl text-xs transition cursor-pointer"
                          >
                            {t.viewMemberFile}
                          </button>
                          <button
                            onClick={() => setShowLibraryCardModal(user)}
                            className="bg-[#0F4C45] hover:bg-[#16655B] text-white font-bold p-1.5 rounded-xl transition cursor-pointer"
                            title="Print Barcode Card"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                          {onDeleteUser && user.role !== 'admin' && (
                            <button
                              onClick={() => setUserToDelete(user)}
                              className="bg-[#FEF2F2] dark:bg-[#7F1D1D]/30 hover:bg-[#FEE2E2] dark:hover:bg-[#7F1D1D]/50 text-[#B91C1C] dark:text-[#FCA5A5] font-bold p-1.5 rounded-xl transition border border-[#FECACA] dark:border-[#B91C1C]/60 cursor-pointer"
                              title="Remove Account"
                            >
                              <Trash2 className="w-4 h-4" />
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
        <div className="fixed inset-0 z-50 bg-[#0D2623]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1A1D1B] rounded-2xl shadow-2xl max-w-xl w-full p-6 border border-[#E2DDD5] dark:border-[#2E3330] max-h-[90vh] overflow-y-auto space-y-5 text-[#1C1917] dark:text-[#F5F3EE]">
            <div className="flex items-center justify-between border-b pb-3 border-[#E2DDD5] dark:border-[#2E3330]">
              <div className="flex items-center gap-3">
                {selectedMember.photoUrl ? (
                  <img
                    src={selectedMember.photoUrl}
                    alt={selectedMember.name}
                    referrerPolicy="no-referrer"
                    className="w-11 h-11 rounded-full object-cover border border-[#E2DDD5] dark:border-[#2E3330] shrink-0"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-[#0F4C45] text-white font-extrabold text-base flex items-center justify-center shrink-0">
                    {selectedMember.name.charAt(0)}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="archival-heading text-base font-black text-[#1C1917] dark:text-[#F5F3EE]"><bdi>{selectedMember.name}</bdi></h3>
                    {selectedMember.dhivehiName && (
                      <span className="text-xs font-bold text-[#0F4C45] dark:text-[#6EE7B7] bg-[#ECFDF5] dark:bg-[#0F4C45]/35 px-2 py-0.5 rounded border border-[#A7F3D0] dark:border-[#16655B]">
                        {selectedMember.dhivehiName}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    {getRoleBadge(selectedMember.role)}
                    <span className="text-[10px] font-bold uppercase text-[#6B655D] dark:text-[#A19B91]">
                      <bdi>{selectedMember.patronTier || selectedMember.role}</bdi>
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedMember(null)}
                className="text-[#6B655D] hover:text-[#1C1917] dark:text-[#A19B91] dark:hover:text-[#F5F3EE] p-1 rounded-lg hover:bg-[#EFECE6] dark:hover:bg-[#232724] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* KPI Strip */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-[#FFFBEB] dark:bg-[#78350F]/30 p-3 rounded-xl border border-[#FDE68A] dark:border-[#B45309]/50">
                <div className="text-[10px] font-bold uppercase text-[#C26D3A] dark:text-[#FCD34D] flex items-center justify-center gap-1">
                  <Flame className="w-3.5 h-3.5" /> {language === 'dv' ? 'ކިޔުމުގެ ސްޓްރީކް' : 'Reading Streak'}
                </div>
                <div className="font-mono tabular-nums text-lg font-black text-[#1C1917] dark:text-[#F5F3EE] mt-0.5">
                  <bdi dir="ltr">{selectedMember.readingStreakDays || 0}d</bdi>
                </div>
              </div>
              <div className="bg-[#ECFDF5] dark:bg-[#0F4C45]/35 p-3 rounded-xl border border-[#A7F3D0] dark:border-[#16655B]">
                <div className="text-[10px] font-bold uppercase text-[#0F4C45] dark:text-[#6EE7B7] flex items-center justify-center gap-1">
                  <Award className="w-3.5 h-3.5" /> {language === 'dv' ? 'ނިންމި ފޮތް' : 'Books Read'}
                </div>
                <div className="font-mono tabular-nums text-lg font-black text-[#1C1917] dark:text-[#F5F3EE] mt-0.5">
                  <bdi dir="ltr">{selectedMember.booksCompletedCount || loans.filter(l => l.userId === selectedMember.id && l.status === 'returned').length}</bdi>
                </div>
              </div>
              <div className={`p-3 rounded-xl border ${selectedMemberUnpaid > 0 ? 'bg-[#FEF2F2] dark:bg-[#7F1D1D]/30 border-[#FECACA] dark:border-[#B91C1C]/60' : 'bg-[#F7F5F0] dark:bg-[#232724] border-[#E2DDD5] dark:border-[#2E3330]'}`}>
                <div className={`text-[10px] font-bold uppercase ${selectedMemberUnpaid > 0 ? 'text-[#B91C1C] dark:text-[#FCA5A5]' : 'text-[#6B655D] dark:text-[#A19B91]'}`}>
                  {language === 'dv' ? 'ނުދައްކާ ޖޫރިމަނާ' : 'Unpaid Balance'}
                </div>
                <div className={`font-mono tabular-nums text-lg font-black mt-0.5 ${selectedMemberUnpaid > 0 ? 'text-[#B91C1C] dark:text-[#FCA5A5]' : 'text-[#1C1917] dark:text-[#F5F3EE]'}`}>
                  <bdi dir="ltr">MVR {selectedMemberUnpaid.toFixed(2)}</bdi>
                </div>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-[#F7F5F0] dark:bg-[#232724] p-4 rounded-xl border border-[#E2DDD5] dark:border-[#2E3330]">
                <div>
                  <span className="text-[#6B655D] dark:text-[#A19B91] font-bold block text-[10px]">Email Address:</span>
                  <span className="font-extrabold text-[#1C1917] dark:text-[#F5F3EE]"><bdi>{selectedMember.email}</bdi></span>
                </div>
                <div>
                  <span className="text-[#6B655D] dark:text-[#A19B91] font-bold block text-[10px]">Phone Number:</span>
                  <span className="font-mono tabular-nums font-extrabold text-[#1C1917] dark:text-[#F5F3EE]"><bdi dir="ltr">{selectedMember.phone || '+960 6740018'}</bdi></span>
                </div>
                {selectedMember.grade && (
                  <div>
                    <span className="text-[#6B655D] dark:text-[#A19B91] font-bold block text-[10px]">Grade Level:</span>
                    <span className="font-extrabold text-[#1C1917] dark:text-[#F5F3EE]"><bdi>{selectedMember.grade}</bdi></span>
                  </div>
                )}
                <div>
                  <span className="text-[#6B655D] dark:text-[#A19B91] font-bold block text-[10px]">Patron Barcode ID:</span>
                  <span className="font-mono tabular-nums font-extrabold text-[#0F4C45] dark:text-[#6EE7B7]"><bdi dir="ltr">{getPatronCode(selectedMember)}</bdi></span>
                </div>
              </div>

              {/* Borrowing Loans History */}
              <div className="space-y-2">
                <h4 className="font-black text-[#1C1917] dark:text-[#F5F3EE] uppercase text-[11px] tracking-wider">
                  {language === 'dv' ? 'ފޮތް ނެގުމުގެ ރެކޯޑް' : 'Current & Past Book Loans'}
                </h4>
                {loans.filter(l => l.userId === selectedMember.id).length === 0 ? (
                  <div className="p-4 bg-[#F7F5F0] dark:bg-[#232724] rounded-xl border border-[#E2DDD5] dark:border-[#2E3330] text-[#6B655D] dark:text-[#A19B91] italic text-center">
                    No loan records found for this member.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {loans.filter(l => l.userId === selectedMember.id).map(loan => (
                      <div key={loan.id} className="checkout-ledger-slip p-3 rounded-xl flex items-center justify-between gap-2">
                        <div>
                          <div className="font-extrabold text-[#1C1917] dark:text-[#F5F3EE]"><bdi>{loan.bookTitle}</bdi></div>
                          <div className="text-[10px] text-[#6B655D] dark:text-[#A19B91] font-mono tabular-nums">
                            <bdi dir="ltr">Issued: {loan.issueDate} | Due: {loan.dueDate}</bdi>
                            {loan.lateFee > 0 && (
                              <span className="text-[#B91C1C] dark:text-[#FCA5A5] font-bold ms-2">
                                <bdi dir="ltr">MVR {loan.lateFee.toFixed(2)}</bdi>
                              </span>
                            )}
                          </div>
                        </div>
                        <StatusPill
                          compact
                          status={
                            loan.status === 'returned'
                              ? 'available'
                              : loan.status === 'overdue'
                              ? 'overdue'
                              : 'checked_out'
                          }
                          label={loan.status}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#E2DDD5] dark:border-[#2E3330]">
              {onDeleteUser && selectedMember.role !== 'admin' ? (
                <button
                  onClick={() => setUserToDelete(selectedMember)}
                  className="px-3 py-2 bg-[#FEF2F2] dark:bg-[#7F1D1D]/30 hover:bg-[#FEE2E2] dark:hover:bg-[#7F1D1D]/50 text-[#B91C1C] dark:text-[#FCA5A5] border border-[#FECACA] dark:border-[#B91C1C]/60 rounded-xl font-bold text-xs transition flex items-center gap-1.5 cursor-pointer"
                  id="modal-delete-member-btn"
                >
                  <Trash2 className="w-4 h-4" /> {language === 'dv' ? 'އެކައުންޓް ފޮހެލާ' : 'Remove'}
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
                    className="px-3.5 py-2 bg-[#0F4C45] hover:bg-[#16655B] text-white rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer text-xs"
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
                  className="px-4 py-2 bg-[#0D2623] dark:bg-[#232724] hover:bg-[#0F4C45] dark:hover:bg-[#2E3330] text-white rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer text-xs border border-[#16655B]/40 dark:border-[#2E3330]"
                >
                  <QrCode className="w-4 h-4 text-[#C26D3A]" /> {language === 'dv' ? 'ލައިބްރަރީ ކާޑު' : 'Digital Pass'}
                </button>
                <button
                  onClick={() => setSelectedMember(null)}
                  className="px-4 py-2 bg-[#F7F5F0] dark:bg-[#232724] text-[#6B655D] dark:text-[#A19B91] border border-[#E2DDD5] dark:border-[#2E3330] rounded-xl font-bold hover:bg-[#EFECE6] dark:hover:bg-[#2E3330] transition text-xs cursor-pointer"
                >
                  {t.closeWindow}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DIGITAL LIBRARY PASS / MAGOODHOO SCHOOL LIBRARY MEMBER CARD MODAL */}
      {showLibraryCardModal && (
        <div className="fixed inset-0 z-50 bg-[#0D2623]/65 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1A1D1B] rounded-2xl shadow-2xl max-w-md w-full p-6 border border-[#E2DDD5] dark:border-[#2E3330] space-y-4 text-center">
            <div className="flex justify-between items-center border-b pb-3 border-[#E2DDD5] dark:border-[#2E3330] no-print">
              <div className="text-start">
                <h3 className="archival-heading font-black text-[#1C1917] dark:text-[#F5F3EE] text-base">
                  {language === 'dv' ? 'ފ. މަގޫދޫ ސްކޫލް ލައިބްރަރީ ކާޑު' : 'Magoodhoo School Library Card'}
                </h3>
                <p className="text-xs text-[#6B655D] dark:text-[#A19B91] font-medium">
                  {language === 'dv' ? 'ޕްރިންޓް ނުވަތަ ސްކޭން ކުރެއްވުމަށް' : 'Official printable Code-128 patron library membership card'}
                </p>
              </div>
              <button
                onClick={() => setShowLibraryCardModal(null)}
                className="text-[#6B655D] hover:text-[#1C1917] dark:text-[#A19B91] dark:hover:text-[#F5F3EE] p-1 rounded-lg hover:bg-[#EFECE6] dark:hover:bg-[#232724] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Archival Member Card Artifact */}
            <div className="rounded-2xl overflow-hidden shadow-lg border border-[#0F4C45]/30 dark:border-[#2E3330] text-start bg-[#F7F5F0] dark:bg-[#232724]">
              {/* Heritage Emerald Crest Top Strip */}
              <div className="bg-[#0F4C45] px-5 py-3.5 text-white flex items-center justify-between gap-3 border-b-2 border-[#C26D3A]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <LibraryEmblem size="sm" />
                  <div className="min-w-0">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-[#A7F3D0]">
                      F. Magoodhoo School
                    </div>
                    <div className="archival-heading text-xs font-extrabold text-white truncate">
                      {language === 'dv' ? 'ސްކޫލް ލައިބްރަރީ މެންބަރު ކާޑު' : 'Official Library Patron Card'}
                    </div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-white/15 border border-white/25 text-[9px] font-mono uppercase tracking-wider text-white shrink-0">
                  {showLibraryCardModal.patronTier || showLibraryCardModal.role}
                </span>
              </div>

              {/* Warm Archival Body */}
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3.5">
                  {showLibraryCardModal.photoUrl ? (
                    <img
                      src={showLibraryCardModal.photoUrl}
                      alt={showLibraryCardModal.name}
                      referrerPolicy="no-referrer"
                      className="w-14 h-14 rounded-xl object-cover border-2 border-[#0F4C45] shrink-0 shadow-xs"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-[#0F4C45] text-[#F7F5F0] font-black text-lg flex items-center justify-center shrink-0 border-2 border-[#C26D3A]/60 shadow-xs">
                      {showLibraryCardModal.name.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="archival-heading text-base font-black text-[#1C1917] dark:text-[#F5F3EE] truncate">
                      <bdi>{showLibraryCardModal.name}</bdi>
                    </div>
                    {showLibraryCardModal.dhivehiName && (
                      <div className="text-xs font-bold text-[#0F4C45] dark:text-[#6EE7B7]">
                        {showLibraryCardModal.dhivehiName}
                      </div>
                    )}
                    <div className="flex items-center gap-2 flex-wrap text-[11px] text-[#6B655D] dark:text-[#A19B91]">
                      <span className="font-semibold">
                        <bdi>{showLibraryCardModal.grade || showLibraryCardModal.staffDepartment || 'Faculty Member'}</bdi>
                      </span>
                      {(showLibraryCardModal.readingStreakDays || 0) > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FFFBEB] dark:bg-[#78350F]/40 text-[#C26D3A] dark:text-[#FCD34D] border border-[#FDE68A] dark:border-[#B45309]/50 font-mono tabular-nums text-[10px] font-bold">
                          <Flame className="w-3 h-3" /> <bdi dir="ltr">{showLibraryCardModal.readingStreakDays}d</bdi>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Code-128 Barcode Panel */}
                <div className="bg-white p-3.5 rounded-xl border border-[#E2DDD5] text-center space-y-1.5 shadow-xs">
                  <SvgBarcode code={getPatronCode(showLibraryCardModal)} />
                  <div className="font-mono tabular-nums text-xs font-extrabold text-[#1C1917] tracking-wider">
                    <bdi dir="ltr">{getPatronCode(showLibraryCardModal)}</bdi>
                  </div>
                </div>

                <div className="text-[10px] text-[#6B655D] dark:text-[#A19B91] text-center font-medium">
                  {language === 'dv'
                    ? 'ފޮތް ދޫކުރުމަށާއި އަނބުރާ ހަވާލުކުރުމަށް ލައިބްރަރީ ޑެސްކަށް މި ކާޑު ދައްކަވާ.'
                    : 'Present this membership card at the circulation desk for instant checkouts & renewals.'}
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-center pt-2 no-print">
              <button
                onClick={() => printMemberIdCards([showLibraryCardModal])}
                className="bg-[#0F4C45] hover:bg-[#16655B] text-white font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
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
          className="fixed inset-0 z-50 bg-[#0D2623]/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setUserToDelete(null);
          }}
        >
          <div className="bg-white dark:bg-[#1A1D1B] rounded-2xl shadow-2xl max-w-md w-full p-6 border border-[#E2DDD5] dark:border-[#2E3330] space-y-5 text-[#1C1917] dark:text-[#F5F3EE]">
            <div className="flex items-center gap-3 text-[#B91C1C] dark:text-[#FCA5A5]">
              <div className="w-11 h-11 rounded-xl bg-[#FEF2F2] dark:bg-[#7F1D1D]/40 border border-[#FECACA] dark:border-[#B91C1C]/60 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="archival-heading text-base font-black text-[#1C1917] dark:text-[#F5F3EE]">Confirm Account Deletion</h3>
                <p className="text-xs text-[#6B655D] dark:text-[#A19B91] font-semibold">Permanent Database Operation</p>
              </div>
            </div>

            <div className="bg-[#FEF2F2] dark:bg-[#7F1D1D]/25 p-4 rounded-xl border border-[#FECACA] dark:border-[#B91C1C]/50 text-xs space-y-2">
              <p className="text-[#1C1917] dark:text-[#F5F3EE] font-bold">
                Are you sure you want to delete <strong className="text-[#B91C1C] dark:text-[#FCA5A5] font-black"><bdi>{userToDelete.name}</bdi></strong> from the library database?
              </p>
              <div className="text-[11px] text-[#6B655D] dark:text-[#A19B91] space-y-1 pt-1.5 border-t border-[#FECACA] dark:border-[#B91C1C]/40">
                <div>• Role: <span className="font-bold uppercase text-[#1C1917] dark:text-[#F5F3EE]">{userToDelete.role}</span></div>
                <div>• Email: <span className="font-mono text-[#1C1917] dark:text-[#F5F3EE]"><bdi>{userToDelete.email}</bdi></span></div>
                {userToDelete.studentIdCode && (
                  <div>• Student ID: <span className="font-mono font-bold text-[#1C1917] dark:text-[#F5F3EE]"><bdi dir="ltr">{userToDelete.studentIdCode}</bdi></span></div>
                )}
              </div>
            </div>

            {loans.filter(l => l.userId === userToDelete.id && (l.status === 'active' || l.status === 'overdue')).length > 0 && (
              <div className="bg-[#FFFBEB] dark:bg-[#78350F]/30 p-3 rounded-xl border border-[#FDE68A] dark:border-[#B45309]/50 flex items-start gap-2 text-xs text-[#B45309] dark:text-[#FCD34D]">
                <AlertTriangle className="w-4 h-4 text-[#C26D3A] shrink-0 mt-0.5" />
                <div>
                  <strong className="font-black">Active Loans Notice:</strong> This member currently has{' '}
                  <strong className="text-[#B91C1C] dark:text-[#FCA5A5] font-mono tabular-nums">
                    <bdi dir="ltr">{loans.filter(l => l.userId === userToDelete.id && (l.status === 'active' || l.status === 'overdue')).length}</bdi>
                  </strong> active book loan(s).
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E2DDD5] dark:border-[#2E3330]">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 bg-[#F7F5F0] dark:bg-[#232724] hover:bg-[#EFECE6] dark:hover:bg-[#2E3330] text-[#6B655D] dark:text-[#A19B91] border border-[#E2DDD5] dark:border-[#2E3330] font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (onDeleteUser) onDeleteUser(userToDelete.id);
                  if (selectedMember?.id === userToDelete.id) setSelectedMember(null);
                  setUserToDelete(null);
                }}
                className="px-4 py-2 bg-[#B91C1C] hover:bg-[#991B1B] text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
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
