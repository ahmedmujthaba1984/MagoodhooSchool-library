import React, { useState } from 'react';
import { BookOpen, UserCheck, Shield, Users, QrCode, Search, LogOut, ChevronDown, Bell, Sparkles, BookMarked, Home, UserPlus, Key, Share2, ExternalLink, Copy, Check, Smartphone, X, Menu, Globe } from 'lucide-react';
import { UserProfile, UserRole } from '../types';
import { useLanguage } from '../lib/i18n';

interface HeaderProps {
  currentUser: UserProfile;
  allUsers: UserProfile[];
  onSwitchUser: (user: UserProfile) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenScanner: () => void;
  overdueCount: number;
  onOpenAddParentModal?: () => void;
  onOpenLoginModal?: () => void;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  allUsers,
  onSwitchUser,
  activeTab,
  setActiveTab,
  onOpenScanner,
  overdueCount,
  onOpenAddParentModal,
  onOpenLoginModal,
  onToggleSidebar
}) => {
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const { language, setLanguage, t } = useLanguage();

  const directWebUrl = typeof window !== 'undefined' && window.location.origin && window.location.origin !== 'null'
    ? window.location.origin
    : 'https://ais-dev-knsj3zyatbs3y5amkjnsch-736669025161.asia-east1.run.app';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(directWebUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return <span className="bg-amber-100 text-amber-900 text-xs font-bold px-2.5 py-0.5 rounded-full border border-amber-300 flex items-center gap-1"><Shield className="w-3 h-3 text-amber-600" /> {t.adminRole}</span>;
      case 'parent':
        return <span className="bg-purple-100 text-purple-900 text-xs font-bold px-2.5 py-0.5 rounded-full border border-purple-300 flex items-center gap-1"><Users className="w-3 h-3 text-purple-600" /> {t.parentRole}</span>;
      case 'staff':
        return <span className="bg-emerald-100 text-emerald-900 text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1"><UserCheck className="w-3 h-3 text-emerald-600" /> {t.staffRole}</span>;
      case 'student':
        return <span className="bg-sky-100 text-sky-900 text-xs font-bold px-2.5 py-0.5 rounded-full border border-sky-300 flex items-center gap-1"><UserCheck className="w-3 h-3 text-sky-600" /> {t.studentRole}</span>;
    }
  };

  return (
    <header className="bg-white/90 backdrop-blur-md text-slate-800 shadow-md shadow-slate-200/50 sticky top-0 z-40 border-b border-slate-200">
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4">
        
        {/* Brand, Hamburger & Logo */}
        <div className="flex items-center justify-between md:justify-start gap-2 sm:gap-3">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setActiveTab('catalog')}>
            {onToggleSidebar && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSidebar();
                }}
                className="lg:hidden p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition active:scale-95 cursor-pointer"
                title="Open Navigation Menu"
                id="header-mobile-menu-toggle-btn"
              >
                <Menu className="w-5 h-5 text-indigo-700" />
              </button>
            )}
            <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-2 sm:p-2.5 rounded-2xl shadow-md flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div>
              <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-indigo-600">
                {t.schoolPortal}
              </div>
              <h1 className="text-base sm:text-lg md:text-xl font-black tracking-tight text-slate-900 flex flex-wrap items-center gap-1.5 sm:gap-2">
                {t.schoolLibrary}
                <span className="text-[9px] sm:text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full whitespace-nowrap">
                  {t.liveSync}
                </span>
              </h1>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between md:justify-end gap-1.5 sm:gap-3 flex-wrap">
          {/* Language Switcher Button (English / Dhivehi) */}
          <button
            onClick={() => setLanguage(language === 'en' ? 'dv' : 'en')}
            className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 px-3 py-1.5 sm:py-2 rounded-xl text-xs font-black transition-all shadow-sm active:scale-95 cursor-pointer"
            id="header-language-toggle-btn"
            title="Switch Language (English / ދިވެހި)"
          >
            <Globe className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="whitespace-nowrap">
              {language === 'en' ? 'ދިވެހި (Dhivehi)' : 'English'}
            </span>
          </button>

          {/* Quick Scanner Launcher */}
          <button
            onClick={onOpenScanner}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 sm:gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md active:scale-95 cursor-pointer"
            id="open-barcode-scanner-btn"
          >
            <QrCode className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">{t.barcodeReader}</span>
          </button>

          {/* Direct Link Share Button */}
          <button
            onClick={() => setShowShareModal(true)}
            className="flex items-center justify-center gap-1 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-black transition-all shadow-md active:scale-95 border border-teal-300 cursor-pointer"
            id="header-direct-link-btn"
            title="Get Direct Portal URL"
          >
            <Share2 className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline whitespace-nowrap">{t.directLink}</span>
          </button>

          {/* Super Admin Login Button */}
          {onOpenLoginModal && (
            <button
              onClick={onOpenLoginModal}
              className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all shadow-md active:scale-95 border border-amber-300 cursor-pointer"
              id="header-superadmin-login-btn"
            >
              <Shield className="w-3.5 h-3.5 text-white shrink-0" />
              <span className="whitespace-nowrap">{t.admin}</span>
            </button>
          )}

          {/* Quick Role Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 px-3 py-1.5 rounded-xl text-sm font-bold transition-all cursor-pointer"
              id="user-profile-menu-btn"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-xs flex items-center justify-center shadow">
                {currentUser.name.charAt(0)}
              </div>
              <div className="text-left hidden md:block">
                <div className="text-xs font-bold truncate max-w-[140px] text-slate-900">{currentUser.name}</div>
                <div className="text-[10px] text-slate-500 uppercase font-semibold">{currentUser.role}</div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </button>


            {showUserDropdown && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50 rounded-t-2xl">
                  <p className="text-[11px] text-slate-500 font-semibold uppercase">{t.activeProfile}</p>
                  <p className="text-sm font-bold text-slate-900 truncate">{currentUser.name}</p>
                  <div className="mt-1">{getRoleBadge(currentUser.role)}</div>
                </div>

                <div className="px-3 py-2 border-b border-slate-100">
                  {onOpenAddParentModal && (
                    <button
                      onClick={() => {
                        setShowUserDropdown(false);
                        onOpenAddParentModal();
                      }}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 shadow cursor-pointer"
                      id="header-add-parent-btn"
                    >
                      <UserPlus className="w-3.5 h-3.5" /> {t.registerParentAccount}
                    </button>
                  )}
                </div>

                <div className="px-3 py-2">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 px-1">
                    {t.quickProfileSwitcher}
                  </p>
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {allUsers.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => {
                          onSwitchUser(user);
                          setShowUserDropdown(false);
                          if (user.role === 'parent') setActiveTab('parent-portal');
                          else if (user.role === 'student') setActiveTab('my-loans');
                          else if (user.role === 'admin') setActiveTab('admin-panel');
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between transition ${
                          user.id === currentUser.id ? 'bg-indigo-50 text-indigo-900 font-bold border border-indigo-200' : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <div className="truncate">
                          <div className="font-bold truncate">{user.name}</div>
                          <div className="text-[10px] text-slate-500">
                            {user.role === 'student' ? user.grade : user.email}
                          </div>
                        </div>
                        <span className="text-[10px] uppercase font-bold text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md ml-2">
                          {user.role}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="bg-slate-50/80 px-4 sm:px-6 lg:px-8 border-t border-slate-200">
        <div className="max-w-7xl mx-auto flex items-center space-x-1.5 overflow-x-auto py-2 scrollbar-none">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'catalog'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-200/60'
            }`}
            id="tab-catalog"
          >
            <BookOpen className="w-4 h-4" />
            {t.catalog}
          </button>

          <button
            onClick={() => setActiveTab('ai-assistant')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'ai-assistant'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/20 ring-2 ring-purple-400/30'
                : 'text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200'
            }`}
            id="tab-ai-assistant"
          >
            <Sparkles className="w-4 h-4 text-purple-600 animate-pulse" />
            {t.aiLibrarian}
          </button>

          <button
            onClick={() => setActiveTab('reference')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'reference'
                ? 'bg-amber-500 text-white shadow-md'
                : 'text-slate-600 hover:text-amber-600 hover:bg-amber-50'
            }`}
            id="tab-reference"
          >
            <BookMarked className="w-4 h-4" />
            {t.reference}
          </button>

          {currentUser.role === 'parent' && (
            <button
              onClick={() => setActiveTab('parent-portal')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'parent-portal'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-purple-700 hover:bg-purple-50'
              }`}
              id="tab-parent-portal"
            >
              <Users className="w-4 h-4" />
              Parent Portal
            </button>
          )}

          <button
            onClick={() => setActiveTab('my-loans')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'my-loans'
                ? 'bg-sky-600 text-white shadow-md'
                : 'text-slate-600 hover:text-sky-600 hover:bg-sky-50'
            }`}
            id="tab-my-loans"
          >
            <UserCheck className="w-4 h-4" />
            {t.borrowingHistory}
          </button>

          {(currentUser.role === 'admin' || currentUser.role === 'student') && (
            <button
              onClick={() => setActiveTab('checkout-hub')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'checkout-hub'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-600 hover:text-emerald-600 hover:bg-emerald-50'
              }`}
              id="tab-checkout-hub"
            >
              <QrCode className="w-4 h-4" />
              {t.scanCheckout}
            </button>
          )}

          {currentUser.role === 'admin' && (
            <button
              onClick={() => setActiveTab('admin-panel')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'admin-panel'
                  ? 'bg-orange-600 text-white shadow-md'
                  : 'text-slate-600 hover:text-orange-600 hover:bg-orange-50'
              }`}
              id="tab-admin-panel"
            >
              <Shield className="w-4 h-4" />
              {t.adminInventory}
              {overdueCount > 0 && (
                <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                  {overdueCount}
                </span>
              )}
            </button>
          )}

          <button
            onClick={() => setActiveTab('reports')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'reports'
                ? 'bg-pink-600 text-white shadow-md'
                : 'text-slate-600 hover:text-pink-600 hover:bg-pink-50'
            }`}
            id="tab-reports"
          >
            <Sparkles className="w-4 h-4" />
            {t.reportsTrends}
          </button>

          <button
            onClick={() => setActiveTab('login')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'login'
                ? 'bg-amber-500 text-white shadow-md'
                : 'text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200'
            }`}
            id="tab-login-portal"
          >
            <Key className="w-4 h-4" />
            {t.login}
          </button>
        </div>
      </div>

      {/* Direct Portal Link Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 relative">
            <button
              onClick={() => setShowShareModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-2 text-center">
              <div className="w-12 h-12 bg-gradient-to-tr from-teal-500 to-emerald-500 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg">
                <Share2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-slate-900">{t.directWebPortalLink}</h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                {t.multiBrowserDesc}
              </p>
            </div>

            <div className="space-y-3">
              <label className="text-[11px] font-black uppercase text-slate-500 tracking-wider">
                {t.directLink}:
              </label>
              <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-300">
                <input
                  type="text"
                  readOnly
                  value={directWebUrl}
                  className="bg-transparent text-xs font-mono font-bold text-slate-800 flex-1 outline-none truncate"
                />
                <button
                  onClick={handleCopyLink}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 shrink-0 ${
                    copiedLink
                      ? 'bg-emerald-600 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow'
                  }`}
                >
                  {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiedLink ? t.copied : t.copyLink}
                </button>
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs text-emerald-900 space-y-2">
              <div className="font-extrabold flex items-center gap-2 text-emerald-950">
                <Smartphone className="w-4 h-4 text-emerald-600" /> {t.multiBrowserSupport}
              </div>
              <p className="text-[11px] text-emerald-800 font-medium leading-relaxed">
                {t.multiBrowserDesc}
              </p>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowShareModal(false)}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs py-3 rounded-xl transition cursor-pointer"
              >
                {t.closeWindow}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
