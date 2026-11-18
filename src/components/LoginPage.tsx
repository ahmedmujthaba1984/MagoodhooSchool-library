import React, { useMemo, useState } from 'react';
import {
  Shield,
  Users,
  Lock,
  CheckCircle2,
  AlertCircle,
  LogIn,
  BookOpen,
  UserPlus,
  KeyRound,
  RefreshCw,
  GraduationCap,
  Globe,
  ArrowRight,
  Delete,
  Sparkles,
  Smartphone,
} from 'lucide-react';
import { UserProfile } from '../types';
import { resolveAccessRole } from '../lib/rbac';
import { useLanguage } from '../lib/i18n';
import { LibraryEmblem } from './LibraryEmblem';

export interface LoginPageProps {
  currentUser: UserProfile;
  allUsers: UserProfile[];
  onLoginSuccess: (user: UserProfile) => void;
  onOpenAddParentModal?: () => void;
  onNavigateTab: (tab: string) => void;
  onEnterGuestOpac?: () => void;
  onGoogleLogin?: () => Promise<UserProfile>;
  onDeskPinLogin?: (pin: string) => { matched: boolean; user?: UserProfile };
}

type LoginRoleTab = 'staff' | 'student' | 'parent';

export const LoginPage: React.FC<LoginPageProps> = ({
  currentUser,
  allUsers,
  onLoginSuccess,
  onOpenAddParentModal,
  onNavigateTab,
  onEnterGuestOpac,
  onGoogleLogin,
  onDeskPinLogin,
}) => {
  const { language, setLanguage, isRtl } = useLanguage();
  const isDv = language === 'dv';

  const [activeRoleTab, setActiveRoleTab] = useState<LoginRoleTab>('staff');

  // Staff / Librarian form
  const [staffIdentifier, setStaffIdentifier] = useState('library@fmagoodhooschool.edu.mv');
  const [staffPassword, setStaffPassword] = useState('0000');

  // Student form
  const [studentIdentifier, setStudentIdentifier] = useState('STU-2041');
  const [studentPin, setStudentPin] = useState('0000');

  // Parent form
  const [parentIdentifier, setParentIdentifier] = useState('960-7785678');
  const [parentOtp, setParentOtp] = useState('');
  const [generatedParentOtp, setGeneratedParentOtp] = useState<string | null>(null);

  // 4-digit Circulation Desk Quick-Switch PIN
  const [deskPin, setDeskPin] = useState('');
  const [showDeskPad, setShowDeskPad] = useState(true);

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const adminUsers = useMemo(
    () => allUsers.filter((u) => resolveAccessRole(u) === 'super_admin'),
    [allUsers]
  );
  const deskUsers = useMemo(
    () => allUsers.filter((u) => resolveAccessRole(u) === 'desk_assistant'),
    [allUsers]
  );
  const teacherUsers = useMemo(
    () => allUsers.filter((u) => resolveAccessRole(u) === 'teacher'),
    [allUsers]
  );
  const parentUsers = useMemo(
    () => allUsers.filter((u) => u.role === 'parent'),
    [allUsers]
  );
  const studentUsers = useMemo(
    () => allUsers.filter((u) => resolveAccessRole(u) === 'student_guest' && u.role === 'student'),
    [allUsers]
  );

  const cleanDigits = (str: string) => str.replace(/\D/g, '');

  const findUserByIdentifier = (input: string, pool: UserProfile[]): UserProfile | null => {
    const clean = input.trim().toLowerCase();
    if (!clean) return null;

    let found = pool.find((u) => u.email?.toLowerCase() === clean);
    if (found) return found;

    found = pool.find((u) => u.studentIdCode?.toLowerCase() === clean);
    if (found) return found;

    found = pool.find((u) => u.staffIdCode?.toLowerCase() === clean);
    if (found) return found;

    const digits = cleanDigits(clean);
    if (digits.length >= 4) {
      found = pool.find((u) => u.phone && cleanDigits(u.phone).includes(digits));
      if (found) return found;
    }

    found = pool.find((u) => u.name.toLowerCase().includes(clean));
    return found || null;
  };

  const navigateForUser = (user: UserProfile) => {
    const role = resolveAccessRole(user);
    if (role === 'super_admin') onNavigateTab('dashboard');
    else if (role === 'desk_assistant') onNavigateTab('checkout-hub');
    else if (user.role === 'parent') onNavigateTab('parent-portal');
    else onNavigateTab('my-borrowings');
  };

  const handleQuickSelect = (user: UserProfile, targetTab?: string) => {
    setErrorMsg('');
    setSuccessMsg(
      isDv ? `${user.dhivehiName || user.name} ގެ އެކައުންޓަށް ވަދެވިއްޖެ.` : `Signed in as ${user.name}.`
    );
    onLoginSuccess(user);
    if (targetTab) {
      onNavigateTab(targetTab);
    } else {
      navigateForUser(user);
    }
  };

  const handleStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!staffIdentifier.trim()) {
      setErrorMsg(isDv ? 'ސްޓާފް އީމެއިލް ނުވަތަ އައިޑީ ލިޔުއްވާ' : 'Please enter your staff email or ID.');
      return;
    }
    if (staffPassword.trim().length < 4) {
      setErrorMsg(isDv ? 'މަދުވެގެން 4 އަކުރުގެ ޕާސްވަރޑް ލިޔުއްވާ' : 'Enter your 4+ character staff password or PIN.');
      return;
    }

    const staffPool = allUsers.filter(
      (u) =>
        resolveAccessRole(u) === 'super_admin' ||
        resolveAccessRole(u) === 'desk_assistant' ||
        resolveAccessRole(u) === 'teacher'
    );
    const matched = findUserByIdentifier(staffIdentifier, staffPool) || adminUsers[0];
    if (!matched) {
      setErrorMsg(isDv ? 'ސްޓާފް އެކައުންޓެއް ނުފެނުނު' : 'No matching staff account found.');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      handleQuickSelect(matched);
    }, 250);
  };

  const handleGoogleSso = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    if (!onGoogleLogin) {
      if (adminUsers[0]) handleQuickSelect(adminUsers[0]);
      return;
    }

    setIsGoogleLoading(true);
    try {
      const signedInUser = await onGoogleLogin();
      setSuccessMsg(
        isDv
          ? `ގޫގުލް އެކައުންޓުން (${signedInUser.name}) ލޮގިންވެވިއްޖެ.`
          : `Authenticated via Google SSO as ${signedInUser.name}.`
      );
      navigateForUser(signedInUser);
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes('popup-closed-by-user')) {
        setErrorMsg(isDv ? 'ގޫގުލް ލޮގިން ކެންސަލް ކުރެވިއްޖެ.' : 'Google sign-in popup was closed before completing.');
      } else if (msg.includes('popup-blocked')) {
        setErrorMsg(
          isDv
            ? 'ބްރައުޒަރުން ޕޮޕް-އަޕް ބްލޮކް ކޮށްފައިވެއެވެ. ޕޮޕް-އަޕް ހުއްދަ ދެއްވާ ނުވަތަ ޕިން ބޭނުންކުރައްވާ.'
            : 'Popup blocked by browser. Allow popups or use your 4-digit Desk PIN below.'
        );
      } else {
        setErrorMsg(
          isDv
            ? 'ގޫގުލް އެސް.އެސް.އޯ މިވަގުތު ނުގުޅުނު. ތިރީގައިވާ ޑެސްކް ޕިން ނުވަތަ އީމެއިލް ބޭނުންކުރައްވާ.'
            : 'Google SSO is unavailable in this session. Use Staff Email or the 4-digit Desk PIN.'
        );
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!studentIdentifier.trim()) {
      setErrorMsg(
        isDv ? 'ދަރިވަރުގެ އިންޑެކްސް ނަންބަރު (މިސާލު: STU-2041) ލިޔުއްވާ' : 'Enter your Student Index Number or Barcode ID (e.g. STU-2041).'
      );
      return;
    }
    if (!studentPin.trim()) {
      setErrorMsg(isDv ? 'ސްކޫލް ޕިން ލިޔުއްވާ' : 'Enter your school reading PIN (default: 0000).');
      return;
    }

    const matched = findUserByIdentifier(studentIdentifier, studentUsers) || findUserByIdentifier(studentIdentifier, allUsers);
    if (!matched) {
      setErrorMsg(
        isDv
          ? `"${studentIdentifier}" އާ ގުޅޭ ދަރިވަރެއް ނުފެނުނު. STU-2041 ޓެސްޓުކުރައްވާ.`
          : `No student record matches "${studentIdentifier}". Try STU-2041 or STU-1088.`
      );
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      handleQuickSelect(matched, 'my-borrowings');
    }, 250);
  };

  const handleRequestParentOtp = () => {
    setErrorMsg('');
    const matched = findUserByIdentifier(parentIdentifier, parentUsers) || parentUsers[0];
    if (!matched) {
      setErrorMsg(isDv ? 'ރަޖިސްޓަރީވެފައިވާ ބެލެނިވެރިއެއް ނުފެނުނު.' : 'No registered guardian matches that phone or email.');
      return;
    }
    const code = '4829';
    setGeneratedParentOtp(code);
    setParentOtp(code);
    setSuccessMsg(
      isDv
        ? `${matched.phone || matched.email} އަށް 4-ޑިޖިޓް ކޯޑު (4829) ފޮނުވިއްޖެ.`
        : `Verification code sent to ${matched.phone || matched.email} (Demo code: 4829).`
    );
  };

  const handleParentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const matched = findUserByIdentifier(parentIdentifier, parentUsers) || parentUsers[0];
    if (!matched) {
      setErrorMsg(
        isDv ? 'ބެލެނިވެރިޔާގެ ފޯނު ނުވަތަ އީމެއިލް ރަނގަޅެއް ނޫން.' : 'No guardian found. Please register a parent account first.'
      );
      return;
    }
    if (parentOtp.trim().length < 4) {
      setErrorMsg(
        isDv ? '4-ޑިޖިޓް ޕިން ނުވަތަ އޯ.ޓީ.ޕީ ކޯޑު ލިޔުއްވާ.' : 'Enter your 4-digit verification OTP/PIN (click "Send Code" if needed).'
      );
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      handleQuickSelect(matched, 'parent-portal');
    }, 250);
  };

  const handleDeskPinDigit = (digit: string) => {
    setErrorMsg('');
    if (deskPin.length >= 4) return;
    const nextPin = deskPin + digit;
    setDeskPin(nextPin);

    if (nextPin.length === 4) {
      if (onDeskPinLogin) {
        const res = onDeskPinLogin(nextPin);
        if (res.matched && res.user) {
          setSuccessMsg(
            isDv ? `ޑެސްކް ޕިން ކާމިޔާބު: ${res.user.name}` : `Desk Quick-Switch unlocked: ${res.user.name}`
          );
          navigateForUser(res.user);
          return;
        }
      }
      // Fallback lookup directly if onDeskPinLogin not passed
      const fallbackMap: Record<string, UserProfile | undefined> = {
        '0000': adminUsers[0],
        '1111': deskUsers[0],
        '2222': teacherUsers[0],
        '4444': parentUsers[0],
      };
      const matched = fallbackMap[nextPin];
      if (matched) {
        handleQuickSelect(matched);
      } else {
        setErrorMsg(
          isDv
            ? 'ރަނގަޅު 4-ޑިޖިޓް ޑެސްކް ޕިންއެއް ޖައްސަވާ (0000 / 1111 / 2222)'
            : 'Invalid Desk PIN. Try 0000 (Admin), 1111 (Prefect), or 2222 (Teacher).'
        );
        setTimeout(() => setDeskPin(''), 350);
      }
    }
  };

  const handleGuestBrowse = () => {
    if (onEnterGuestOpac) {
      onEnterGuestOpac();
    }
    onNavigateTab('catalog');
  };

  return (
    <div className="max-w-5xl mx-auto py-2 sm:py-4 space-y-5">
      {/* Split-Screen Archival Auth Frame */}
      <div className="bg-[#FFFFFF] dark:bg-[#1A1D1B] border border-[#E2DDD5] dark:border-[#2E3330] rounded-3xl shadow-sm overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
        {/* LEFT HERO PANEL — Heritage Deep Emerald Sanctuary */}
        <div className="lg:col-span-5 bg-[#0D2623] text-[#F7F5F0] p-6 sm:p-8 flex flex-col justify-between gap-8 relative overflow-hidden">
          <div className="space-y-6 relative z-10">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <LibraryEmblem size="lg" />
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#F3DFB1]">
                    {isDv ? 'ފ. މަގޫދޫ ސްކޫލް' : 'F. Magoodhoo School'}
                  </div>
                  <h1 className={`text-lg font-extrabold tracking-tight text-white archival-heading ${isDv ? 'leading-[1.85]' : ''}`}>
                    {isDv ? 'ލައިބްރަރީ ޕޯޓަލް' : 'Library Portal'}
                  </h1>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setLanguage(isDv ? 'en' : 'dv')}
                className="px-3 py-1.5 rounded-xl bg-[#163B36] hover:bg-[#1D4C46] border border-[#24534C] text-[#F7F5F0] text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Globe className="w-3.5 h-3.5 text-[#F3DFB1]" />
                <span>{isDv ? 'English' : 'ދިވެހި'}</span>
              </button>
            </div>

            <div className="space-y-3">
              <h2 className={`text-2xl sm:text-3xl font-extrabold text-white tracking-tight text-balance archival-heading ${isDv ? 'leading-[1.85]' : 'leading-tight'}`}>
                {isDv
                  ? 'ކިޔުމާއި، ދޫކުރުމާއި، އަމިއްލަ ރެކު އެއްތަނަކުން'
                  : 'Reading Sanctuary & School Circulation Desk'}
              </h2>
              <p className={`text-xs sm:text-sm text-[#CBD5D1] ${isDv ? 'leading-[1.85]' : 'leading-relaxed'}`}>
                {isDv
                  ? 'ދަރިވަރުންނާއި ބެލެނިވެރިން އަދި ލައިބްރޭރިއަނުންނަށް ޚާއްޞަ ރައްކާތެރި ލައިބްރަރީ ނިޒާމު.'
                  : 'Role-aware access for Librarians, Desk Prefects, Faculty, Students, and Parents — built to run smoothly online and offline.'}
              </p>
            </div>

            {/* Concise Role Summary List */}
            <div className="space-y-2.5 pt-2 border-t border-[#193D38] text-xs text-[#CBD5D1]">
              <div className="flex items-start gap-2.5">
                <Shield className="w-4 h-4 text-[#C26D3A] shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-white">{isDv ? 'ލައިބްރޭރިއަން & ޕްރީފެކްޓް:' : 'Staff & Desk Prefects:'}</span>{' '}
                  <span className={isDv ? 'leading-[1.85]' : ''}>
                    {isDv ? 'ގޫގުލް އެސް.އެސް.އޯ ނުވަތަ 4-ޑިޖިޓް ޑެސްކް ޕިންއިން ވަދެވޭނެ.' : 'Google SSO, staff credentials, or 4-digit shared desk quick-switch PIN.'}
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <GraduationCap className="w-4 h-4 text-[#6EE7B7] shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-white">{isDv ? 'ދަރިވަރުން:' : 'Students:'}</span>{' '}
                  <span className={isDv ? 'leading-[1.85]' : ''}>
                    {isDv ? 'އިންޑެކްސް ނަންބަރު (STU-2041) އިން ފޮތް ނަންނޯޓުކޮށް ރެކު ބެލެހެއްޓޭނެ.' : 'Use your Student Index ID & school PIN to place holds and track reading streaks.'}
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Users className="w-4 h-4 text-[#F3DFB1] shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-white">{isDv ? 'ބެލެނިވެރިން:' : 'Parents & Guardians:'}</span>{' '}
                  <span className={isDv ? 'leading-[1.85]' : ''}>
                    {isDv ? 'ދަރިވަރުން ގެންގުޅޭ ފޮތްތަކާއި، ޖޫރިމަނާ (MVR) އަދި ސެޓްފިކެޓް ބެއްލެވޭނެ.' : 'Track children’s due dates, MVR ledger, online renewals, and term certificates.'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Public OPAC Guest Browse CTA */}
          <div className="space-y-3 pt-4 border-t border-[#193D38] relative z-10">
            <button
              type="button"
              onClick={handleGuestBrowse}
              className="w-full py-3 px-4 rounded-xl bg-[#F7F5F0] hover:bg-white text-[#0D2623] text-xs font-extrabold transition flex items-center justify-between gap-2 cursor-pointer shadow-xs"
              id="login-guest-opac-btn"
            >
              <span className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#0F4C45]" />
                <span>{isDv ? 'ލޮގިންނުވެ ކެޓަލޮގް ބައްލަވާ (މެހެމާނު)' : 'Browse Public OPAC (Guest Mode)'}</span>
              </span>
              <ArrowRight className={`w-4 h-4 text-[#0F4C45] ${isRtl ? 'rotate-180' : ''}`} />
            </button>

            <div className="text-[11px] text-[#9CB3AD] flex items-center justify-between gap-2">
              <span>{isDv ? 'މިހާރުގެ ސެޝަން:' : 'Active Session:'}</span>
              <span className="font-bold text-[#F3DFB1] truncate">
                <bdi>{currentUser.name}</bdi>
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT SIGN-IN PANEL */}
        <div className="lg:col-span-7 p-6 sm:p-8 space-y-6 flex flex-col justify-between">
          <div className="space-y-5">
            {/* Role Tabs */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div
                role="tablist"
                aria-label="Account Role"
                className="inline-flex p-1 rounded-xl bg-[#EFECE6] dark:bg-[#232724] border border-[#E2DDD5] dark:border-[#2E3330] gap-1"
              >
                {(
                  [
                    { id: 'staff', labelEn: 'Staff / Librarian', labelDv: 'މުވައްޒަފުން', icon: Shield },
                    { id: 'student', labelEn: 'Student', labelDv: 'ދަރިވަރު', icon: GraduationCap },
                    { id: 'parent', labelEn: 'Parent / Guardian', labelDv: 'ބެލެނިވެރިޔާ', icon: Users },
                  ] as const
                ).map((tab) => {
                  const Icon = tab.icon;
                  const active = activeRoleTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => {
                        setActiveRoleTab(tab.id);
                        setErrorMsg('');
                        setSuccessMsg('');
                      }}
                      className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-[#0F4C45] text-white shadow-xs'
                          : 'text-[#6B655D] dark:text-[#A19B91] hover:text-[#1C1917] dark:hover:text-[#F5F3EE]'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span>{isDv ? tab.labelDv : tab.labelEn}</span>
                    </button>
                  );
                })}
              </div>

              {onOpenAddParentModal && (
                <button
                  type="button"
                  onClick={onOpenAddParentModal}
                  className="px-3 py-2 rounded-xl bg-[#EFECE6] hover:bg-[#E2DDD5] dark:bg-[#232724] dark:hover:bg-[#2E3330] text-[#0F4C45] dark:text-[#6EE7B7] border border-[#E2DDD5] dark:border-[#2E3330] text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{isDv ? 'ބެލެނިވެރިޔާ ރަޖިސްޓަރީ' : 'Register Parent'}</span>
                </button>
              )}
            </div>

            {/* Alerts */}
            {(errorMsg || successMsg) && (
              <div className="space-y-2">
                {errorMsg && (
                  <div className="p-3 bg-[#FEF2F2] dark:bg-[#7F1D1D]/30 border border-[#FECACA] dark:border-[#B91C1C]/60 rounded-xl text-xs font-bold text-[#B91C1C] dark:text-[#FCA5A5] flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}
                {successMsg && (
                  <div className="p-3 bg-[#F0FDF4] dark:bg-[#0F4C45]/40 border border-[#BBF7D0] dark:border-[#16655B] rounded-xl text-xs font-bold text-[#15803D] dark:text-[#6EE7B7] flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{successMsg}</span>
                  </div>
                )}
              </div>
            )}

            {/* STAFF / LIBRARIAN TAB */}
            {activeRoleTab === 'staff' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                  {/* Email + Google SSO */}
                  <div className="md:col-span-7 space-y-4">
                    <button
                      type="button"
                      onClick={handleGoogleSso}
                      disabled={isGoogleLoading}
                      className="w-full py-2.5 px-4 rounded-xl bg-[#F7F5F0] hover:bg-[#EFECE6] dark:bg-[#232724] dark:hover:bg-[#2E3330] border border-[#E2DDD5] dark:border-[#2E3330] text-[#1C1917] dark:text-[#F5F3EE] text-xs font-bold transition flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60"
                      id="google-sso-signin-btn"
                    >
                      {isGoogleLoading ? (
                        <RefreshCw className="w-4 h-4 animate-spin text-[#0F4C45]" />
                      ) : (
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            fill="#4285F4"
                            d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
                          />
                        </svg>
                      )}
                      <span>
                        {isDv ? 'ގޫގުލް އެކައުންޓުން ލޮގިންވޭ (Staff SSO)' : 'Sign in with Google Workspace SSO'}
                      </span>
                    </button>

                    <div className="flex items-center gap-3 text-[11px] text-[#6B655D] dark:text-[#A19B91]">
                      <div className="h-px flex-1 bg-[#E2DDD5] dark:bg-[#2E3330]" />
                      <span>{isDv ? 'ނުވަތަ ސްކޫލް އީމެއިލްއިން' : 'or staff credentials'}</span>
                      <div className="h-px flex-1 bg-[#E2DDD5] dark:bg-[#2E3330]" />
                    </div>

                    <form onSubmit={handleStaffSubmit} className="space-y-3.5">
                      <div>
                        <label className="block text-xs font-bold text-[#1C1917] dark:text-[#F5F3EE] mb-1.5">
                          {isDv ? 'ސްޓާފް އީމެއިލް ނުވަތަ ކޯޑު' : 'Staff Email or Employee ID'}
                        </label>
                        <input
                          type="text"
                          value={staffIdentifier}
                          onChange={(e) => setStaffIdentifier(e.target.value)}
                          placeholder="library@fmagoodhooschool.edu.mv"
                          className="w-full px-3.5 py-2.5 bg-[#F7F5F0] dark:bg-[#232724] border border-[#E2DDD5] dark:border-[#2E3330] rounded-xl text-xs font-medium text-[#1C1917] dark:text-[#F5F3EE] focus:outline-none focus:ring-2 focus:ring-[#0F4C45]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#1C1917] dark:text-[#F5F3EE] mb-1.5">
                          {isDv ? 'ޕާސްވަރޑް' : 'Password'}
                        </label>
                        <input
                          type="password"
                          value={staffPassword}
                          onChange={(e) => setStaffPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full px-3.5 py-2.5 bg-[#F7F5F0] dark:bg-[#232724] border border-[#E2DDD5] dark:border-[#2E3330] rounded-xl text-xs font-medium text-[#1C1917] dark:text-[#F5F3EE] focus:outline-none focus:ring-2 focus:ring-[#0F4C45]"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-2.5 px-4 bg-[#0F4C45] hover:bg-[#16655B] text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                      >
                        {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                        <span>{isDv ? 'ލައިބްރަރީ ޑެސްކަށް ވަންނަވާ' : 'Sign In to Staff Workspace'}</span>
                      </button>
                    </form>
                  </div>

                  {/* 4-Digit Circulation Desk Quick-Switch PIN */}
                  <div className="md:col-span-5 bg-[#F7F5F0] dark:bg-[#232724] border border-[#E2DDD5] dark:border-[#2E3330] rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#1C1917] dark:text-[#F5F3EE]">
                        <KeyRound className="w-3.5 h-3.5 text-[#C26D3A]" />
                        <span>{isDv ? 'ޑެސްކް ޕިން' : 'Desk Quick-Switch PIN'}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowDeskPad((p) => !p)}
                        className="text-[11px] font-bold text-[#0F4C45] dark:text-[#6EE7B7] hover:underline cursor-pointer"
                      >
                        {showDeskPad ? (isDv ? 'ފޮރުވާ' : 'Hide') : isDv ? 'ދައްކާ' : 'Pad'}
                      </button>
                    </div>

                    <div className="flex items-center justify-center gap-2 py-1" dir="ltr">
                      {[0, 1, 2, 3].map((idx) => (
                        <div
                          key={idx}
                          className={`w-9 h-10 rounded-lg border flex items-center justify-center font-mono text-base font-extrabold ${
                            deskPin[idx]
                              ? 'bg-[#0F4C45] text-white border-[#0F4C45]'
                              : 'bg-[#FFFFFF] dark:bg-[#1A1D1B] text-[#6B655D] border-[#E2DDD5] dark:border-[#2E3330]'
                          }`}
                        >
                          {deskPin[idx] ? '•' : ''}
                        </div>
                      ))}
                    </div>

                    {showDeskPad && (
                      <div className="grid grid-cols-3 gap-1.5" dir="ltr">
                        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => handleDeskPinDigit(d)}
                            className="h-9 rounded-lg bg-[#FFFFFF] dark:bg-[#1A1D1B] hover:bg-[#EFECE6] dark:hover:bg-[#2E3330] border border-[#E2DDD5] dark:border-[#2E3330] text-xs font-mono font-bold text-[#1C1917] dark:text-[#F5F3EE] transition cursor-pointer"
                          >
                            {d}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setDeskPin('')}
                          className="h-9 rounded-lg bg-[#FFFFFF] dark:bg-[#1A1D1B] hover:bg-[#EFECE6] dark:hover:bg-[#2E3330] border border-[#E2DDD5] dark:border-[#2E3330] text-[10px] font-bold text-[#6B655D] dark:text-[#A19B91] transition cursor-pointer"
                        >
                          CLR
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeskPinDigit('0')}
                          className="h-9 rounded-lg bg-[#FFFFFF] dark:bg-[#1A1D1B] hover:bg-[#EFECE6] dark:hover:bg-[#2E3330] border border-[#E2DDD5] dark:border-[#2E3330] text-xs font-mono font-bold text-[#1C1917] dark:text-[#F5F3EE] transition cursor-pointer"
                        >
                          0
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeskPin((p) => p.slice(0, -1))}
                          className="h-9 rounded-lg bg-[#FFFFFF] dark:bg-[#1A1D1B] hover:bg-[#EFECE6] dark:hover:bg-[#2E3330] border border-[#E2DDD5] dark:border-[#2E3330] flex items-center justify-center text-[#6B655D] dark:text-[#A19B91] transition cursor-pointer"
                          title="Backspace"
                        >
                          <Delete className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    <div className="text-[10px] text-[#6B655D] dark:text-[#A19B91] leading-relaxed font-mono">
                      <bdi dir="ltr">0000</bdi> Admin · <bdi dir="ltr">1111</bdi> Prefect · <bdi dir="ltr">2222</bdi> Teacher
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STUDENT TAB */}
            {activeRoleTab === 'student' && (
              <form onSubmit={handleStudentSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#1C1917] dark:text-[#F5F3EE] mb-1.5">
                      {isDv ? 'ދަރިވަރުގެ އިންޑެކްސް / ބާކޯޑް' : 'Student Index Number / Barcode ID'}
                    </label>
                    <input
                      type="text"
                      value={studentIdentifier}
                      onChange={(e) => setStudentIdentifier(e.target.value)}
                      placeholder="STU-2041"
                      className="w-full px-3.5 py-2.5 bg-[#F7F5F0] dark:bg-[#232724] border border-[#E2DDD5] dark:border-[#2E3330] rounded-xl text-xs font-mono font-bold text-[#1C1917] dark:text-[#F5F3EE] focus:outline-none focus:ring-2 focus:ring-[#0F4C45]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#1C1917] dark:text-[#F5F3EE] mb-1.5">
                      {isDv ? 'ސްކޫލް ޕިން' : 'School Reading PIN'}
                    </label>
                    <input
                      type="password"
                      value={studentPin}
                      onChange={(e) => setStudentPin(e.target.value)}
                      placeholder="0000"
                      className="w-full px-3.5 py-2.5 bg-[#F7F5F0] dark:bg-[#232724] border border-[#E2DDD5] dark:border-[#2E3330] rounded-xl text-xs font-mono text-[#1C1917] dark:text-[#F5F3EE] focus:outline-none focus:ring-2 focus:ring-[#0F4C45]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 bg-[#0F4C45] hover:bg-[#16655B] text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{isDv ? 'ދަރިވަރުންގެ އެކައުންޓަށް ވަންނަވާ' : 'Sign In as Student'}</span>
                </button>
              </form>
            )}

            {/* PARENT / GUARDIAN TAB */}
            {activeRoleTab === 'parent' && (
              <form onSubmit={handleParentSubmit} className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-[#1C1917] dark:text-[#F5F3EE] mb-1.5">
                      {isDv ? 'ރަޖިސްޓަރީކޮށްފައިވާ މޯބައިލް ނުވަތަ އީމެއިލް' : 'Registered Mobile Number or Parent Email'}
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={parentIdentifier}
                        onChange={(e) => setParentIdentifier(e.target.value)}
                        placeholder="960-7785678 or sarah.jenkins@fmagoodhooschool.edu.mv"
                        className="flex-1 px-3.5 py-2.5 bg-[#F7F5F0] dark:bg-[#232724] border border-[#E2DDD5] dark:border-[#2E3330] rounded-xl text-xs font-medium text-[#1C1917] dark:text-[#F5F3EE] focus:outline-none focus:ring-2 focus:ring-[#0F4C45]"
                      />
                      <button
                        type="button"
                        onClick={handleRequestParentOtp}
                        className="px-4 py-2.5 rounded-xl bg-[#EFECE6] hover:bg-[#E2DDD5] dark:bg-[#232724] dark:hover:bg-[#2E3330] border border-[#E2DDD5] dark:border-[#2E3330] text-[#1C1917] dark:text-[#F5F3EE] text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <Smartphone className="w-3.5 h-3.5 text-[#C26D3A]" />
                        <span>{isDv ? 'ކޯޑު ފޮނުވާ' : 'Send Code'}</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#1C1917] dark:text-[#F5F3EE] mb-1.5">
                      {isDv ? '4-ޑިޖިޓް ވެރިފިކޭޝަން ކޯޑު' : '4-Digit Verification OTP / PIN'}
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={parentOtp}
                      onChange={(e) => setParentOtp(e.target.value)}
                      placeholder={generatedParentOtp ? `Code: ${generatedParentOtp}` : '4829'}
                      className="w-full px-3.5 py-2.5 bg-[#F7F5F0] dark:bg-[#232724] border border-[#E2DDD5] dark:border-[#2E3330] rounded-xl text-xs font-mono font-bold text-[#1C1917] dark:text-[#F5F3EE] focus:outline-none focus:ring-2 focus:ring-[#0F4C45]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 bg-[#0F4C45] hover:bg-[#16655B] text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  <Users className="w-4 h-4" />
                  <span>{isDv ? 'ބެލެނިވެރިންގެ ޕޯޓަލް ހުޅުވާ' : 'Verify & Open Parent Portal'}</span>
                </button>
              </form>
            )}
          </div>

          {/* 1-Click School Kiosk Role Switcher Strip */}
          <div className="pt-4 border-t border-[#E2DDD5] dark:border-[#2E3330] space-y-2.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-[#6B655D] dark:text-[#A19B91]">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#C26D3A]" />
                <span>{isDv ? 'އަވަހަށް ރޯލް ބަދަލުކުރެއްވުމަށް:' : 'Quick Kiosk Profile Switch:'}</span>
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {adminUsers[0] && (
                <button
                  type="button"
                  onClick={() => handleQuickSelect(adminUsers[0], 'dashboard')}
                  className="px-3 py-1.5 rounded-lg bg-[#ECFDF5] hover:bg-[#D1FAE5] dark:bg-[#0F4C45]/40 dark:hover:bg-[#0F4C45]/60 text-[#0F4C45] dark:text-[#6EE7B7] border border-[#A7F3D0] dark:border-[#16655B] text-[11px] font-bold transition cursor-pointer"
                >
                  Lead Librarian
                </button>
              )}
              {deskUsers[0] && (
                <button
                  type="button"
                  onClick={() => handleQuickSelect(deskUsers[0], 'checkout-hub')}
                  className="px-3 py-1.5 rounded-lg bg-[#EFF6FF] hover:bg-[#DBEAFE] dark:bg-[#1E3A8A]/35 dark:hover:bg-[#1E3A8A]/55 text-[#1D4ED8] dark:text-[#93C5FD] border border-[#BFDBFE] dark:border-[#1D4ED8]/60 text-[11px] font-bold transition cursor-pointer"
                >
                  Desk Prefect ({deskUsers[0].name.split(' ')[0]})
                </button>
              )}
              {teacherUsers[0] && (
                <button
                  type="button"
                  onClick={() => handleQuickSelect(teacherUsers[0], 'catalog')}
                  className="px-3 py-1.5 rounded-lg bg-[#EFECE6] hover:bg-[#E2DDD5] dark:bg-[#232724] dark:hover:bg-[#2E3330] text-[#1C1917] dark:text-[#F5F3EE] border border-[#E2DDD5] dark:border-[#2E3330] text-[11px] font-bold transition cursor-pointer"
                >
                  Teacher ({teacherUsers[0].name.split(' ')[1] || teacherUsers[0].name})
                </button>
              )}
              {parentUsers[0] && (
                <button
                  type="button"
                  onClick={() => handleQuickSelect(parentUsers[0], 'parent-portal')}
                  className="px-3 py-1.5 rounded-lg bg-[#FFFBEB] hover:bg-[#FEF3C7] dark:bg-[#78350F]/35 dark:hover:bg-[#78350F]/55 text-[#B45309] dark:text-[#FCD34D] border border-[#FDE68A] dark:border-[#B45309]/60 text-[11px] font-bold transition cursor-pointer"
                >
                  Parent ({parentUsers[0].name.split(' ')[0]})
                </button>
              )}
              {studentUsers.slice(0, 2).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleQuickSelect(s, 'my-borrowings')}
                  className="px-3 py-1.5 rounded-lg bg-[#F7F5F0] hover:bg-[#EFECE6] dark:bg-[#232724] dark:hover:bg-[#2E3330] text-[#1C1917] dark:text-[#F5F3EE] border border-[#E2DDD5] dark:border-[#2E3330] text-[11px] font-bold transition cursor-pointer"
                >
                  Student: {s.name.split(' ')[0]} (<bdi dir="ltr" className="font-mono">{s.studentIdCode}</bdi>)
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
