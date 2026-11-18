import React, { useState } from 'react';
import {
  UserCheck, Shield, Users, QrCode, Search, ChevronDown,
  UserPlus, Share2, Copy, Check, Smartphone, X, Menu, Globe, WifiOff,
  LogIn, LogOut, Sun, Moon, BookOpen, Bookmark, Briefcase
} from 'lucide-react';
import { UserProfile } from '../types';
import { useThemeLocale } from '../lib/i18n';
import { resolveAccessRole } from '../lib/rbac';
import { PWAInstallButton } from './PWAInstallButton';
import { useOnlineStatus } from '../lib/usePWAInstall';
import { LibraryEmblem } from './LibraryEmblem';

export type WorkspaceMode = 'librarian' | 'opac' | 'personal';

interface HeaderProps {
  currentUser: UserProfile;
  allUsers: UserProfile[];
  onSwitchUser: (user: UserProfile) => void;
  setActiveTab: (tab: string) => void;
  workspaceMode?: WorkspaceMode;
  onSelectWorkspaceMode?: (mode: WorkspaceMode) => void;
  onOpenScanner: () => void;
  onOpenCommandPalette?: () => void;
  onOpenAddParentModal?: () => void;
  onOpenLoginModal?: () => void;
  onLogout?: () => void;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  allUsers,
  onSwitchUser,
  setActiveTab,
  workspaceMode = 'opac',
  onSelectWorkspaceMode,
  onOpenScanner,
  onOpenCommandPalette,
  onOpenAddParentModal,
  onOpenLoginModal,
  onLogout,
  onToggleSidebar
}) => {
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const { language, setLanguage, theme, toggleTheme, t } = useThemeLocale();
  const isOnline = useOnlineStatus();

  const directWebUrl =
    typeof window !== 'undefined' && window.location.origin && window.location.origin !== 'null'
      ? window.location.origin
      : 'https://magoodhoo-school-library.vercel.app';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(directWebUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const getAccessRoleBadge = (user: UserProfile) => {
    const resolved = resolveAccessRole(user);
    switch (resolved) {
      case 'super_admin':
        return (
          <span className="bg-[#FFFBEB] dark:bg-[#78350F]/40 text-[#B45309] dark:text-[#FCD34D] text-[10px] font-bold px-2 py-0.5 rounded-md border border-[#FDE68A] dark:border-[#B45309]/60 inline-flex items-center gap-1">
            <Shield className="w-3 h-3" strokeWidth={1.75} /> {language === 'dv' ? 'ސުޕަރ އެޑްމިން' : 'Super Admin'}
          </span>
        );
      case 'desk_assistant':
        return (
          <span className="bg-[#EFF6FF] dark:bg-[#1E3A8A]/40 text-[#1D4ED8] dark:text-[#93C5FD] text-[10px] font-bold px-2 py-0.5 rounded-md border border-[#BFDBFE] dark:border-[#1D4ED8]/60 inline-flex items-center gap-1">
            <UserCheck className="w-3 h-3" strokeWidth={1.75} /> {language === 'dv' ? 'ލައިބްރަރީ ޕްރީފެކްޓް' : 'Desk Assistant / Prefect'}
          </span>
        );
      case 'teacher':
        return (
          <span className="bg-[#ECFDF5] dark:bg-[#0F4C45]/50 text-[#0F4C45] dark:text-[#6EE7B7] text-[10px] font-bold px-2 py-0.5 rounded-md border border-[#A7F3D0] dark:border-[#16655B] inline-flex items-center gap-1">
            <UserCheck className="w-3 h-3" strokeWidth={1.75} /> {language === 'dv' ? 'މުދައްރިސް' : 'Teacher'}
          </span>
        );
      case 'student_guest':
        return (
          <span className="bg-[#EFECE6] dark:bg-[#232724] text-[#1C1917] dark:text-[#F5F3EE] text-[10px] font-bold px-2 py-0.5 rounded-md border border-[#E2DDD5] dark:border-[#2E3330] inline-flex items-center gap-1">
            <Users className="w-3 h-3" strokeWidth={1.75} /> {user.role === 'parent' ? t.parentRole : t.studentRole}
          </span>
        );
    }
  };

  const formatShortAccessRole = (user: UserProfile) => {
    const resolved = resolveAccessRole(user);
    if (resolved === 'super_admin') return 'Super Admin';
    if (resolved === 'desk_assistant') return 'Prefect';
    if (resolved === 'teacher') return 'Teacher';
    return user.role === 'parent' ? 'Parent' : 'Student';
  };

  const modeOptions: Array<{
    id: WorkspaceMode;
    labelEn: string;
    labelDv: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  }> = [
    {
      id: 'librarian',
      labelEn: 'Librarian Desk',
      labelDv: 'ލައިބްރޭރިއަން ޑެސްކް',
      icon: Briefcase,
    },
    {
      id: 'opac',
      labelEn: 'Student OPAC',
      labelDv: 'ދަރިވަރުންގެ ކެޓަލޮގް',
      icon: BookOpen,
    },
    {
      id: 'personal',
      labelEn: 'My Personal Shelf',
      labelDv: 'ޕާސަނަލް ރެކު',
      icon: Bookmark,
    },
  ];

  return (
    <header className="bg-[#FFFFFF]/95 dark:bg-[#1A1D1B]/95 backdrop-blur-md text-[#1C1917] dark:text-[#F5F3EE] sticky top-0 z-40 border-b border-[#E2DDD5] dark:border-[#2E3330] no-print">
      <div className="max-w-[1600px] mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-3">
        {/* Start: Sidebar Toggle + Bespoke Library Crest & Title */}
        <div className="flex items-center gap-2.5 min-w-0 shrink-0">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="p-2 rounded-xl bg-[#EFECE6] hover:bg-[#E2DDD5] dark:bg-[#232724] dark:hover:bg-[#2E3330] text-[#1C1917] dark:text-[#F5F3EE] border border-[#E2DDD5] dark:border-[#2E3330] transition cursor-pointer shrink-0"
              title="Toggle Navigation Sidebar"
              id="header-mobile-menu-toggle-btn"
            >
              <Menu className="w-4 h-4" strokeWidth={1.75} />
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('catalog')}
            className="flex items-center gap-2.5 text-start cursor-pointer min-w-0"
          >
            <LibraryEmblem size="md" />
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#0F4C45] dark:text-[#6EE7B7] truncate hidden sm:block">
                {t.schoolPortal}
              </div>
              <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-[#1C1917] dark:text-[#F5F3EE] truncate archival-heading">
                {t.schoolLibrary}
              </h1>
            </div>
          </button>
        </div>

        {/* Center-Start: Workspace Role / Mode Switcher Segmented Pill */}
        {onSelectWorkspaceMode && (
          <div
            role="group"
            aria-label="Library Workspace Mode"
            className="hidden xl:inline-flex items-center gap-1 p-1 rounded-xl bg-[#EFECE6] dark:bg-[#232724] border border-[#E2DDD5] dark:border-[#2E3330] shrink-0"
          >
            {modeOptions.map((mode) => {
              const Icon = mode.icon;
              const isActive = workspaceMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => onSelectWorkspaceMode(mode.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-[#0F4C45] text-[#FFFFFF] shadow-xs'
                      : 'text-[#6B655D] dark:text-[#A19B91] hover:text-[#1C1917] dark:hover:text-[#F5F3EE]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
                  <span>{language === 'dv' ? mode.labelDv : mode.labelEn}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Center: Cmd/Ctrl + K Global Command Palette Search Bar */}
        {onOpenCommandPalette && (
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="hidden md:flex items-center justify-between gap-2 w-full max-w-[240px] xl:max-w-[270px] px-3 py-2 rounded-xl bg-[#F7F5F0] hover:bg-[#EFECE6] dark:bg-[#232724] dark:hover:bg-[#2E3330] border border-[#E2DDD5] dark:border-[#2E3330] text-[#6B655D] dark:text-[#A19B91] text-xs transition cursor-pointer"
            id="header-command-palette-btn"
          >
            <span className="flex items-center gap-2 truncate">
              <Search className="w-3.5 h-3.5 text-[#0F4C45] dark:text-[#6EE7B7] shrink-0" strokeWidth={1.75} />
              <span className="truncate">{t.commandSearch}</span>
            </span>
            <kbd className="font-mono text-[10px] font-bold bg-[#FFFFFF] dark:bg-[#1A1D1B] text-[#1C1917] dark:text-[#F5F3EE] px-1.5 py-0.5 rounded border border-[#E2DDD5] dark:border-[#2E3330] shrink-0">
              ⌘K
            </kbd>
          </button>
        )}

        {/* End: Concise Utility Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {!isOnline && (
            <div className="flex items-center gap-1 bg-[#FFFBEB] dark:bg-[#78350F]/40 text-[#B45309] dark:text-[#FCD34D] border border-[#FDE68A] dark:border-[#B45309]/60 text-[11px] font-bold px-2.5 py-1 rounded-lg whitespace-nowrap">
              <WifiOff className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span className="hidden sm:inline">{t.offlineMode}</span>
            </div>
          )}

          {onOpenCommandPalette && (
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="md:hidden p-2 rounded-xl bg-[#EFECE6] hover:bg-[#E2DDD5] dark:bg-[#232724] dark:hover:bg-[#2E3330] text-[#1C1917] dark:text-[#F5F3EE] border border-[#E2DDD5] dark:border-[#2E3330] transition cursor-pointer"
              title={t.commandSearch}
            >
              <Search className="w-4 h-4" strokeWidth={1.75} />
            </button>
          )}

          <button
            type="button"
            onClick={onOpenScanner}
            className="flex items-center gap-1.5 bg-[#0F4C45] hover:bg-[#16655B] text-white px-2.5 sm:px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0 shadow-2xs"
            id="open-barcode-scanner-btn"
            title={t.barcodeReader}
          >
            <QrCode className="w-4 h-4 shrink-0" strokeWidth={1.75} />
            <span className="hidden lg:inline whitespace-nowrap">{t.barcodeReader}</span>
          </button>

          {/* Instant EN / ދިވެހި Toggle */}
          <button
            type="button"
            onClick={() => setLanguage(language === 'en' ? 'dv' : 'en')}
            className="flex items-center gap-1.5 bg-[#EFECE6] hover:bg-[#E2DDD5] dark:bg-[#232724] dark:hover:bg-[#2E3330] text-[#1C1917] dark:text-[#F5F3EE] border border-[#E2DDD5] dark:border-[#2E3330] px-2.5 sm:px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0"
            id="header-language-toggle-btn"
            title="Switch Language (EN / ދިވެހި)"
          >
            <Globe className="w-3.5 h-3.5 text-[#0F4C45] dark:text-[#6EE7B7] shrink-0" strokeWidth={1.75} />
            <span className="whitespace-nowrap">{language === 'en' ? 'ދިވެހި' : 'EN'}</span>
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-[#EFECE6] hover:bg-[#E2DDD5] dark:bg-[#232724] dark:hover:bg-[#2E3330] text-[#1C1917] dark:text-[#FCD34D] border border-[#E2DDD5] dark:border-[#2E3330] transition cursor-pointer shrink-0"
            id="header-theme-toggle-btn"
            title={theme === 'light' ? 'Switch to Evening Study (Dark)' : 'Switch to Daylight Reading Room (Light)'}
          >
            {theme === 'light' ? <Moon className="w-4 h-4" strokeWidth={1.75} /> : <Sun className="w-4 h-4" strokeWidth={1.75} />}
          </button>

          <PWAInstallButton compact={true} />

          <button
            type="button"
            onClick={() => setShowShareModal(true)}
            className="hidden sm:flex p-2 rounded-xl bg-[#EFECE6] hover:bg-[#E2DDD5] dark:bg-[#232724] dark:hover:bg-[#2E3330] text-[#1C1917] dark:text-[#F5F3EE] border border-[#E2DDD5] dark:border-[#2E3330] transition cursor-pointer"
            id="header-direct-link-btn"
            title={t.directLink}
          >
            <Share2 className="w-4 h-4" strokeWidth={1.75} />
          </button>

          {/* Profile Switcher Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className="flex items-center gap-2 bg-[#EFECE6] hover:bg-[#E2DDD5] dark:bg-[#232724] dark:hover:bg-[#2E3330] border border-[#E2DDD5] dark:border-[#2E3330] text-[#1C1917] dark:text-[#F5F3EE] px-2.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer"
              id="user-profile-menu-btn"
            >
              <div className="w-6 h-6 rounded-full bg-[#0F4C45] text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                {currentUser.name.charAt(0)}
              </div>
              <div className="text-start hidden lg:block max-w-[110px]">
                <div className="text-xs font-bold truncate text-[#1C1917] dark:text-[#F5F3EE]">
                  <bdi>{currentUser.name}</bdi>
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-[#6B655D] dark:text-[#A19B91]" strokeWidth={1.75} />
            </button>

            {showUserDropdown && (
              <div
                className="absolute end-0 mt-2 w-72 bg-[#FFFFFF] dark:bg-[#1A1D1B] rounded-2xl shadow-xl border border-[#E2DDD5] dark:border-[#2E3330] py-2 z-50"
              >
                <div className="px-4 py-2.5 border-b border-[#E2DDD5] dark:border-[#2E3330] bg-[#F7F5F0] dark:bg-[#232724] rounded-t-2xl">
                  <p className="text-[10px] text-[#6B655D] dark:text-[#A19B91] font-bold uppercase">{t.activeProfile}</p>
                  <p className="text-sm font-black text-[#1C1917] dark:text-[#F5F3EE] truncate mt-0.5">
                    <bdi>{currentUser.name}</bdi>
                  </p>
                  <div className="mt-1">{getAccessRoleBadge(currentUser)}</div>
                </div>

                {onSelectWorkspaceMode && (
                  <div className="xl:hidden px-3 py-2 border-b border-[#E2DDD5] dark:border-[#2E3330] space-y-1">
                    <p className="text-[10px] font-bold text-[#6B655D] dark:text-[#A19B91] uppercase tracking-wider px-1">
                      {language === 'dv' ? 'މޯޑް ބަދަލުކުރޭ' : 'Workspace View'}
                    </p>
                    <div className="grid grid-cols-3 gap-1">
                      {modeOptions.map((mode) => (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => {
                            onSelectWorkspaceMode(mode.id);
                            setShowUserDropdown(false);
                          }}
                          className={`px-2 py-1.5 rounded-lg text-[10px] font-bold text-center transition cursor-pointer ${
                            workspaceMode === mode.id
                              ? 'bg-[#0F4C45] text-white'
                              : 'bg-[#EFECE6] dark:bg-[#232724] text-[#1C1917] dark:text-[#F5F3EE]'
                          }`}
                        >
                          {mode.id === 'librarian' ? 'Librarian' : mode.id === 'opac' ? 'OPAC' : 'Personal'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="px-3 py-2 border-b border-[#E2DDD5] dark:border-[#2E3330] space-y-1.5">
                  {onOpenLoginModal && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserDropdown(false);
                        onOpenLoginModal();
                      }}
                      className="w-full bg-[#1C1917] hover:bg-[#2E2A27] dark:bg-[#0F4C45] dark:hover:bg-[#16655B] text-white font-bold text-xs py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                      id="header-superadmin-login-btn"
                    >
                      <LogIn className="w-3.5 h-3.5" strokeWidth={1.75} /> {t.login} / {t.admin}
                    </button>
                  )}

                  {onOpenAddParentModal && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserDropdown(false);
                        onOpenAddParentModal();
                      }}
                      className="w-full bg-[#ECFDF5] hover:bg-[#D1FAE5] dark:bg-[#0F4C45]/40 dark:hover:bg-[#0F4C45]/60 text-[#0F4C45] dark:text-[#6EE7B7] border border-[#A7F3D0] dark:border-[#16655B] font-bold text-xs py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                      id="header-add-parent-btn"
                    >
                      <UserPlus className="w-3.5 h-3.5" strokeWidth={1.75} /> {t.registerParentAccount}
                    </button>
                  )}
                </div>

                <div className="px-3 py-2">
                  <p className="text-[10px] font-bold text-[#6B655D] dark:text-[#A19B91] uppercase tracking-wider mb-1.5 px-1">
                    {t.quickProfileSwitcher}
                  </p>
                  <div className="space-y-1 max-h-52 overflow-y-auto">
                    {allUsers.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => {
                          onSwitchUser(user);
                          setShowUserDropdown(false);
                        }}
                        className={`w-full text-start px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between transition cursor-pointer ${
                          user.id === currentUser.id
                            ? 'bg-[#ECFDF5] dark:bg-[#0F4C45]/40 text-[#0F4C45] dark:text-[#6EE7B7] font-bold border border-[#A7F3D0] dark:border-[#16655B]'
                            : 'hover:bg-[#EFECE6] dark:hover:bg-[#232724] text-[#1C1917] dark:text-[#F5F3EE]'
                        }`}
                      >
                        <div className="truncate">
                          <div className="font-bold truncate">
                            <bdi>{user.name}</bdi>
                          </div>
                          <div className="text-[10px] text-[#6B655D] dark:text-[#A19B91]">
                            {user.role === 'student' ? <bdi>{user.grade}</bdi> : <bdi>{user.email}</bdi>}
                          </div>
                        </div>
                        <span className="text-[10px] uppercase font-bold text-[#6B655D] dark:text-[#A19B91] bg-[#EFECE6] dark:bg-[#232724] border border-[#E2DDD5] dark:border-[#2E3330] px-1.5 py-0.5 rounded ms-2 whitespace-nowrap shrink-0">
                          {formatShortAccessRole(user)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {onLogout && currentUser.id !== 'guest' && (
                  <div className="px-3 pt-2 border-t border-[#E2DDD5] dark:border-[#2E3330]">
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserDropdown(false);
                        onLogout();
                      }}
                      className="w-full text-[#B91C1C] dark:text-[#FCA5A5] hover:bg-[#FEF2F2] dark:hover:bg-[#7F1D1D]/30 font-bold text-xs py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" strokeWidth={1.75} /> {t.logout}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Direct Portal Link Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] dark:bg-[#1A1D1B] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E2DDD5] dark:border-[#2E3330] space-y-5 relative">
            <button
              onClick={() => setShowShareModal(false)}
              className="absolute top-4 end-4 text-[#6B655D] hover:text-[#1C1917] dark:hover:text-[#F5F3EE] p-1.5 rounded-lg hover:bg-[#EFECE6] dark:hover:bg-[#232724] transition cursor-pointer"
            >
              <X className="w-5 h-5" strokeWidth={1.75} />
            </button>

            <div className="space-y-1.5 text-center">
              <div className="w-11 h-11 bg-[#0F4C45] text-white rounded-xl flex items-center justify-center mx-auto">
                <Share2 className="w-5 h-5" strokeWidth={1.75} />
              </div>
              <h3 className="text-lg font-black text-[#1C1917] dark:text-[#F5F3EE] archival-heading">{t.directWebPortalLink}</h3>
              <p className="text-xs text-[#6B655D] dark:text-[#A19B91] font-medium leading-relaxed">{t.multiBrowserDesc}</p>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase text-[#6B655D] dark:text-[#A19B91] tracking-wider">
                {t.directLink}:
              </label>
              <div className="flex items-center gap-2 bg-[#F7F5F0] dark:bg-[#232724] p-2 rounded-xl border border-[#E2DDD5] dark:border-[#2E3330]">
                <input
                  type="text"
                  readOnly
                  value={directWebUrl}
                  className="bg-transparent text-xs font-mono font-bold text-[#1C1917] dark:text-[#F5F3EE] flex-1 outline-none truncate"
                />
                <button
                  onClick={handleCopyLink}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    copiedLink ? 'bg-[#15803D] text-white' : 'bg-[#0F4C45] hover:bg-[#16655B] text-white'
                  }`}
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedLink ? t.copied : t.copyLink}
                </button>
              </div>
            </div>

            <div className="bg-[#ECFDF5] dark:bg-[#0F4C45]/30 border border-[#A7F3D0] dark:border-[#16655B] rounded-xl p-3.5 text-xs text-[#0F4C45] dark:text-[#A7F3D0] space-y-1">
              <div className="font-bold flex items-center gap-2">
                <Smartphone className="w-4 h-4 shrink-0" strokeWidth={1.75} /> {t.multiBrowserSupport}
              </div>
              <p className="text-[11px] opacity-90">{t.multiBrowserDesc}</p>
            </div>

            <button
              onClick={() => setShowShareModal(false)}
              className="w-full bg-[#1C1917] hover:bg-[#2E2A27] dark:bg-[#232724] dark:hover:bg-[#2E3330] text-white font-bold text-xs py-2.5 rounded-xl transition cursor-pointer"
            >
              {t.closeWindow}
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
