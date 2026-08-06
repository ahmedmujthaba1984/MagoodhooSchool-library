import React, { useState } from 'react';
import {
  Shield, Users, Lock, Mail, CheckCircle2, AlertCircle,
  LogIn, BookOpen, UserPlus, QrCode, Smartphone,
  Phone, Check, RefreshCw, Copy, School,
  GraduationCap, Key, Globe, ArrowRight
} from 'lucide-react';
import { UserProfile } from '../types';

interface LoginPageProps {
  currentUser: UserProfile;
  allUsers: UserProfile[];
  onLoginSuccess: (user: UserProfile) => void;
  onOpenAddParentModal?: () => void;
  onNavigateTab: (tab: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  currentUser,
  allUsers,
  onLoginSuccess,
  onOpenAddParentModal,
  onNavigateTab
}) => {
  // Member (Student/Parent) Form Inputs
  const [memberInput, setMemberInput] = useState('ahmed.mujthaba@fmagoodhooschool.edu.mv');
  const [memberPassword, setMemberPassword] = useState('0000');

  // Admin Form Inputs
  const [adminInput, setAdminInput] = useState('library@fmagoodhooschool.edu.mv');
  const [adminPassword, setAdminPassword] = useState('0000');

  // UI States
  const [isDhivehi, setIsDhivehi] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmittingMember, setIsSubmittingMember] = useState(false);
  const [isSubmittingAdmin, setIsSubmittingAdmin] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const sharedPortalUrl = typeof window !== 'undefined' && window.location.origin && window.location.origin !== 'null'
    ? window.location.origin
    : 'https://ais-dev-knsj3zyatbs3y5amkjnsch-736669025161.asia-east1.run.app';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(sharedPortalUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const adminUsers = allUsers.filter(u => u.role === 'admin');
  const parentUsers = allUsers.filter(u => u.role === 'parent');
  const studentUsers = allUsers.filter(u => u.role === 'student');

  // Helper search
  const cleanPhone = (str: string) => str.replace(/\D/g, '');

  const findUserByAnyIdentifier = (input: string) => {
    const clean = input.trim().toLowerCase();
    if (!clean) return null;

    // By email
    let found = allUsers.find(u => u.email.toLowerCase() === clean);
    if (found) return found;

    // By phone
    const digits = cleanPhone(clean);
    if (digits) {
      found = allUsers.find(u => u.phone && cleanPhone(u.phone).includes(digits));
      if (found) return found;
    }

    // By student ID
    found = allUsers.find(u => u.studentIdCode && u.studentIdCode.toLowerCase() === clean);
    if (found) return found;

    // Fallback default student / parent
    return null;
  };

  // Submit Member Login (Student / Parent)
  const handleMemberSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!memberInput.trim()) {
      setErrorMsg(isDhivehi ? 'މެންބަރު އައިޑީ ނުވަތަ އީމެއިލް ލިޔުއްވާ' : 'Please enter your email, mobile number, or student ID.');
      return;
    }

    const matchedUser = findUserByAnyIdentifier(memberInput) || parentUsers[0] || studentUsers[0];
    if (!matchedUser) {
      setErrorMsg(isDhivehi ? 'އެކައުންޓެއް ނުފެނުނު' : 'No account found matching this input. Try sample email or student ID like STU-2041.');
      return;
    }

    setIsSubmittingMember(true);
    setSuccessMsg(isDhivehi ? `${matchedUser.name} ލޮގިންވަނީ...` : `Verifying credentials... Logging in as ${matchedUser.name}`);
    
    setTimeout(() => {
      setIsSubmittingMember(false);
      onLoginSuccess(matchedUser);
      if (matchedUser.role === 'parent') onNavigateTab('parent-portal');
      else onNavigateTab('my-loans');
    }, 500);
  };

  // Submit Admin Login
  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!adminInput.trim()) {
      setErrorMsg(isDhivehi ? 'އެޑްމިން އީމެއިލް ލިޔުއްވާ' : 'Please enter admin email or username.');
      return;
    }

    const matchedAdmin = findUserByAnyIdentifier(adminInput) || adminUsers[0] || {
      id: 'user-superadmin-fmagoodhoo',
      email: 'library@fmagoodhooschool.edu.mv',
      name: 'Super Admin (F. Magoodhoo School Library)',
      role: 'admin',
      phone: '960-7770000',
      createdAt: '2026-08-04'
    };

    setIsSubmittingAdmin(true);
    setSuccessMsg(isDhivehi ? 'އެޑްމިން ޕޯޓަލް އަށް ވަންނަނީ...' : 'Authenticating Super Admin Security Access...');

    setTimeout(() => {
      setIsSubmittingAdmin(false);
      onLoginSuccess(matchedAdmin);
      onNavigateTab('admin-panel');
    }, 500);
  };

  // Direct Profile Switcher
  const handleQuickSelect = (user: UserProfile) => {
    setErrorMsg('');
    setSuccessMsg(`Logging in as ${user.name}...`);
    setTimeout(() => {
      onLoginSuccess(user);
      if (user.role === 'admin') onNavigateTab('admin-panel');
      else if (user.role === 'parent') onNavigateTab('parent-portal');
      else onNavigateTab('my-loans');
    }, 300);
  };

  return (
    <div className="min-h-[85vh] bg-slate-50/80 -m-4 sm:-m-6 lg:-m-8 p-4 sm:p-6 lg:p-10 flex flex-col justify-between font-sans">
      
      <div>
        {/* Top Header Navigation matching the screenshot */}
        <header className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs mb-8 max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-600/20 shrink-0">
              <School className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Magoodhoo School Library Portal</span>
              </h1>
              <div className="text-xs text-emerald-700 font-bold flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Secure Portal | Library Directory</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Language Toggle matching Dhivehi pill in screenshot */}
            <button
              type="button"
              onClick={() => setIsDhivehi(!isDhivehi)}
              className="bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-300/70 px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-2xs"
            >
              <Globe className="w-3.5 h-3.5 text-slate-500" />
              <span>{isDhivehi ? 'English' : 'Dhivehi / ދިވެހި'}</span>
            </button>

            {onOpenAddParentModal && (
              <button
                type="button"
                onClick={onOpenAddParentModal}
                className="bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5 text-purple-600" />
                <span className="hidden sm:inline">Register Parent</span>
              </button>
            )}
          </div>
        </header>

        {/* Global Notifications */}
        {(errorMsg || successMsg) && (
          <div className="max-w-4xl mx-auto mb-6 space-y-2">
            {errorMsg && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-800 flex items-center gap-2 shadow-sm">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2 shadow-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}
          </div>
        )}

        {/* MAIN TWO-COLUMN CARDS CONTAINER (EXACT MATCH TO USER SCREENSHOT) */}
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          
          {/* ========================================================================= */}
          {/* CARD 1 (LEFT): STAFF / PARENT & STUDENT ACCESS */}
          {/* ========================================================================= */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-6">
            
            <div className="space-y-6">
              {/* Top Light Green Icon Box */}
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <GraduationCap className="w-6 h-6" />
              </div>

              {/* Title & Subtitle */}
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  {isDhivehi ? 'ދަރިވަރުން އަދި ބެލެނިވެރިންގެ ޕޯޓަލް' : 'Staff & Student Access'}
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  {isDhivehi ? 'ފޮތްތަކުގެ މަޢުލޫމާތާއި ދޫކުރެވިފައިވާ ފޮތްތައް ބެއްލެވުމަށް' : 'View your personal borrowing and library information'}
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleMemberSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {isDhivehi ? 'އީމެއިލް / ފޯނު ނަންބަރު / އައިޑީ' : 'Email ID / Phone / Student ID'}
                  </label>
                  <input
                    type="text"
                    required
                    value={memberInput}
                    onChange={(e) => setMemberInput(e.target.value)}
                    placeholder="e.g. ahmed.mujthaba@fmagoodhooschool.edu.mv"
                    className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/80 focus:bg-white"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      {isDhivehi ? 'ޕާސްވަރޑް' : 'Password'}
                    </label>
                    <button
                      type="button"
                      onClick={() => setErrorMsg(isDhivehi ? 'Default password is 0000' : 'Default access password for testing is 0000.')}
                      className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <span>Forgot Password?</span>
                    </button>
                  </div>
                  <input
                    type="password"
                    value={memberPassword}
                    onChange={(e) => setMemberPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/80 focus:bg-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingMember}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-60"
                >
                  {isSubmittingMember ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" /> Loading...
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" /> View My Info
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Demo Quick Select Pill Bar for Member Accounts */}
            <div className="pt-4 border-t border-slate-100">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Quick Sample Accounts:
              </div>
              <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                {parentUsers.slice(0, 2).map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleQuickSelect(p)}
                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold px-2.5 py-1 rounded-md border border-emerald-200/80 transition cursor-pointer"
                  >
                    Parent: {p.name.split(' ')[0]}
                  </button>
                ))}
                {studentUsers.slice(0, 2).map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleQuickSelect(s)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-2.5 py-1 rounded-md border border-slate-200 transition cursor-pointer"
                  >
                    Student: {s.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* ========================================================================= */}
          {/* CARD 2 (RIGHT): ADMIN PORTAL */}
          {/* ========================================================================= */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-6">
            
            <div className="space-y-6">
              {/* Top Light Blue Icon Box */}
              <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
                <Shield className="w-6 h-6" />
              </div>

              {/* Title & Subtitle */}
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  {isDhivehi ? 'އެޑްމިން ޕޯޓަލް' : 'Admin Portal'}
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  {isDhivehi ? 'ލައިބްރަރީ ފޮތްތަކާއި އަދި ރެކޯޑްތައް ބެލެހެއްޓެވުމަށް' : 'Manage directory and library records'}
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleAdminSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {isDhivehi ? 'އީމެއިލް / ޔޫޒަރނޭމް' : 'Email / Username'}
                  </label>
                  <input
                    type="text"
                    required
                    value={adminInput}
                    onChange={(e) => setAdminInput(e.target.value)}
                    placeholder="e.g. library@fmagoodhooschool.edu.mv"
                    className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/80 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {isDhivehi ? 'ޕާސްވަރޑް' : 'Password'}
                  </label>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/80 focus:bg-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingAdmin}
                  className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-lg transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-60"
                >
                  {isSubmittingAdmin ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" /> Authenticating...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" /> Admin Login
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Quick Launch Super Admin Pill */}
            <div className="pt-4 border-t border-slate-100">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Librarian Desk Direct Switch:
              </div>
              <button
                type="button"
                onClick={() => handleQuickSelect(adminUsers[0] || {
                  id: 'user-superadmin-fmagoodhoo',
                  email: 'library@fmagoodhooschool.edu.mv',
                  name: 'Super Admin (F. Magoodhoo School Library)',
                  role: 'admin',
                  phone: '960-7770000',
                  createdAt: '2026-08-04'
                })}
                className="w-full bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200/80 font-bold px-3 py-1.5 rounded-lg text-xs transition flex items-center justify-between cursor-pointer"
              >
                <span>Log in as Super Admin (Library Desk)</span>
                <ArrowRight className="w-3.5 h-3.5 text-sky-600" />
              </button>
            </div>

          </div>

        </div>
      </div>

      {/* Footer Branding matching the clean look */}
      <footer className="mt-12 text-center text-[11px] text-slate-400 font-medium">
        <span>Magoodhoo School Library Management System • Secure Portal</span>
      </footer>

    </div>
  );
};
