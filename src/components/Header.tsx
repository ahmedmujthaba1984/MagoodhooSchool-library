import React, { useState } from 'react';
import {
  BookOpen, UserCheck, Shield, Users, QrCode, Search, ChevronDown,
  UserPlus, Share2, Copy, Check, Smartphone, X, Menu, Globe, WifiOff,
  LogIn, LogOut, Sun, Moon
} from 'lucide-react';
import { UserProfile } from '../types';
import { useThemeLocale } from '../lib/i18n';
import { resolveAccessRole } from '../lib/rbac';
import { PWAInstallButton } from './PWAInstallButton';
import { useOnlineStatus } from '../lib/usePWAInstall';

interface HeaderProps {
  currentUser: UserProfile;
  allUsers: UserProfile[];
  onSwitchUser: (user: UserProfile) => void;
  setActiveTab: (tab: string) => void;
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
          <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-md border border-amber-300 inline-flex items-center gap-1">
            <Shield className="w-3 h-3 text-amber-600" /> {language === 'dv' ? 'ސުޕަރ އެޑްމިން' : 'Super Admin'}
          </span>
        );
      case 'desk_assistant':
        return (
          <span className="bg-indigo-100 text-indigo-900 text-[10px] font-bold px-2 py-0.5 rounded-md border border-indigo-300 inline-flex items-center gap-1">
            <UserCheck className="w-3 h-3 text-indigo-700" /> {language === 'dv' ? 'ލައިބްރަރީ ޕްރީފެކްޓް' : 'Desk Assistant / Prefect'}
          </span>
        );
      case 'teacher':
        return (
          <span className="bg-emerald-100 text-emerald-900 text-[10px] font-bold px-2 py-0.5 rounded-md border border-emerald-300 inline-flex items-center gap-1">
            <UserCheck className="w-3 h-3 text-emerald-700" /> {language === 'dv' ? 'މުދައްރިސް' : 'Teacher'}
          </span>
        );
      case 'student_guest':
        return (
          <span className="bg-sky-100 text-sky-900 text-[10px] font-bold px-2 py-0.5 rounded-md border border-sky-300 inline-flex items-center gap-1">
            <Users className="w-3 h-3 text-sky-700" /> {user.role === 'parent' ? t.parentRole : t.studentRole}
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

  return (
    <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md text-slate-800 dark:text-slate-100 sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 no-print">
      <div className="max-w-[1600px] mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Start: Sidebar Toggle + Concise Brand Wordmark */}
        <div className="flex items-center gap-2.5 min-w-0">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition cursor-pointer shrink-0"
              title="Toggle Navigation Sidebar"
              id="header-mobile-menu-toggle-btn"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('catalog')}
            className="flex items-center gap-2.5 text-start cursor-pointer min-w-0"
          >
            <div className="bg-emerald-700 p-2 rounded-xl flex items-center justify-center shrink-0 shadow-xs">
              <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 truncate hidden sm:block">
                {t.schoolPortal}
              </div>
              <h1 className="text-sm sm:text-base font-black tracking-tight text-slate-900 dark:text-white truncate">
                {t.schoolLibrary}
              </h1>
            </div>
          </button>
        </div>

        {/* Center: Cmd/Ctrl + K Global Command Palette Search Bar */}
        {onOpenCommandPalette && (
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="hidden md:flex items-center justify-between gap-3 w-full max-w-sm px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/70 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 text-xs transition cursor-pointer"
            id="header-command-palette-btn"
          >
            <span className="flex items-center gap-2 truncate">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{t.commandSearch}</span>
            </span>
            <kbd className="font-mono text-[10px] font-bold bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600 shrink-0">
              ⌘K
            </kbd>
          </button>
        )}

        {/* End: Concise Utility Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {!isOnline && (
            <div className="flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold px-2.5 py-1 rounded-lg">
              <WifiOff className="w-3.5 h-3.5 text-amber-700" />
              <span className="hidden sm:inline">{t.offlineMode}</span>
            </div>
          )}

          {onOpenCommandPalette && (
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="md:hidden p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
              title={t.commandSearch}
            >
              <Search className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={onOpenScanner}
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-emerald-700 dark:hover:bg-emerald-800 text-white px-2.5 sm:px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
            id="open-barcode-scanner-btn"
            title={t.barcodeReader}
          >
            <QrCode className="w-4 h-4 shrink-0" />
            <span className="hidden lg:inline whitespace-nowrap">{t.barcodeReader}</span>
          </button>

          <button
            type="button"
            onClick={() => setLanguage(language === 'en' ? 'dv' : 'en')}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 px-2.5 sm:px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
            id="header-language-toggle-btn"
            title="Switch Language (English / ދިވެހި)"
          >
            <Globe className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <span className="whitespace-nowrap">{language === 'en' ? 'ދިވެހި' : 'English'}</span>
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-amber-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer shrink-0"
            id="header-theme-toggle-btn"
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          <PWAInstallButton compact={true} />

          <button
            type="button"
            onClick={() => setShowShareModal(true)}
            className="hidden sm:flex p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
            id="header-direct-link-btn"
            title={t.directLink}
          >
            <Share2 className="w-4 h-4" />
          </button>

          {/* Profile Switcher Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-2.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer"
              id="user-profile-menu-btn"
            >
              <div className="w-6 h-6 rounded-full bg-emerald-700 text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                {currentUser.name.charAt(0)}
              </div>
              <div className="text-start hidden lg:block max-w-[120px]">
                <div className="text-xs font-bold truncate text-slate-900 dark:text-slate-100">
                  <bdi>{currentUser.name}</bdi>
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </button>

            {showUserDropdown && (
              <div
                className="absolute end-0 mt-2 w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 py-2 z-50"
              >
                <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/70 rounded-t-2xl">
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase">{t.activeProfile}</p>
                  <p className="text-sm font-black text-slate-900 dark:text-slate-100 truncate mt-0.5">
                    <bdi>{currentUser.name}</bdi>
                  </p>
                  <div className="mt-1">{getAccessRoleBadge(currentUser)}</div>
                </div>

                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 space-y-1.5">
                  {onOpenLoginModal && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserDropdown(false);
                        onOpenLoginModal();
                      }}
                      className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold text-xs py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                      id="header-superadmin-login-btn"
                    >
                      <LogIn className="w-3.5 h-3.5" /> {t.login} / {t.admin}
                    </button>
                  )}

                  {onOpenAddParentModal && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserDropdown(false);
                        onOpenAddParentModal();
                      }}
                      className="w-full bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 font-bold text-xs py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                      id="header-add-parent-btn"
                    >
                      <UserPlus className="w-3.5 h-3.5" /> {t.registerParentAccount}
                    </button>
                  )}
                </div>

                <div className="px-3 py-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 px-1">
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
                            ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-950 dark:text-emerald-200 font-bold border border-emerald-200 dark:border-emerald-800'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        <div className="truncate">
                          <div className="font-bold truncate">
                            <bdi>{user.name}</bdi>
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            {user.role === 'student' ? <bdi>{user.grade}</bdi> : <bdi>{user.email}</bdi>}
                          </div>
                        </div>
                        <span className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded ms-2 whitespace-nowrap shrink-0">
                          {formatShortAccessRole(user)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {onLogout && currentUser.id !== 'guest' && (
                  <div className="px-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserDropdown(false);
                        onLogout();
                      }}
                      className="w-full text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-bold text-xs py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" /> {t.logout}
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
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-5 relative">
            <button
              onClick={() => setShowShareModal(false)}
              className="absolute top-4 end-4 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1.5 text-center">
              <div className="w-11 h-11 bg-emerald-700 text-white rounded-xl flex items-center justify-center mx-auto">
                <Share2 className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">{t.directWebPortalLink}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">{t.multiBrowserDesc}</p>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                {t.directLink}:
              </label>
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-2 rounded-xl border border-slate-300 dark:border-slate-700">
                <input
                  type="text"
                  readOnly
                  value={directWebUrl}
                  className="bg-transparent text-xs font-mono font-bold text-slate-800 dark:text-slate-100 flex-1 outline-none truncate"
                />
                <button
                  onClick={handleCopyLink}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    copiedLink ? 'bg-emerald-600 text-white' : 'bg-slate-900 hover:bg-slate-800 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white'
                  }`}
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedLink ? t.copied : t.copyLink}
                </button>
              </div>
            </div>

            <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3.5 text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
              <div className="font-bold flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-700 dark:text-emerald-400" /> {t.multiBrowserSupport}
              </div>
              <p className="text-[11px] text-emerald-800 dark:text-emerald-300">{t.multiBrowserDesc}</p>
            </div>

            <button
              onClick={() => setShowShareModal(false)}
              className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold text-xs py-2.5 rounded-xl transition cursor-pointer"
            >
              {t.closeWindow}
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
