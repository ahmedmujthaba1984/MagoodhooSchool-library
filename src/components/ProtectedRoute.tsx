import React from 'react';
import { ShieldAlert, LogIn, BookOpen, Lock } from 'lucide-react';
import { AccessRole, UserProfile } from '../types';
import { Permission, resolveAccessRole, ROLE_DEFINITIONS } from '../lib/rbac';
import { usePermission } from '../hooks/usePermission';
import { useLanguage } from '../lib/i18n';
import { LibraryEmblem } from './LibraryEmblem';

interface ProtectedRouteProps {
  currentUser: UserProfile;
  requiredPermission?: Permission;
  allowedAccessRoles?: AccessRole[];
  requireSignedIn?: boolean;
  requireParentOrAdmin?: boolean;
  areaNameEn: string;
  areaNameDv: string;
  onOpenLogin: () => void;
  onBackToOpac: () => void;
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  currentUser,
  requiredPermission,
  allowedAccessRoles,
  requireSignedIn = false,
  requireParentOrAdmin = false,
  areaNameEn,
  areaNameDv,
  onOpenLogin,
  onBackToOpac,
  children,
}) => {
  const { language } = useLanguage();
  const { can, cannotReason, accessRole } = usePermission(currentUser);
  const isGuest = !currentUser || currentUser.id === 'guest';

  let isAuthorized = true;
  let denialMessage = '';

  if (requireSignedIn && isGuest) {
    isAuthorized = false;
    denialMessage =
      language === 'dv'
        ? `${areaNameDv} ބޭނުންކުރެއްވުމަށް ލޮގިންވެލައްވާ.`
        : `Please sign in with your School Library account to open ${areaNameEn}.`;
  } else if (requireParentOrAdmin && currentUser.role !== 'parent' && accessRole !== 'super_admin') {
    isAuthorized = false;
    denialMessage =
      language === 'dv'
        ? `މި ސަފްޙާ ހުޅުވޭނީ ބެލެނިވެރިންނަށާއި ލައިބްރޭރިއަންނަށެވެ.`
        : `${areaNameEn} is restricted to Parent / Guardian and Lead Librarian accounts.`;
  } else if (requiredPermission && !can(requiredPermission)) {
    isAuthorized = false;
    denialMessage = cannotReason(requiredPermission);
  } else if (allowedAccessRoles && !allowedAccessRoles.includes(resolveAccessRole(currentUser))) {
    isAuthorized = false;
    denialMessage =
      language === 'dv'
        ? `${areaNameDv} އަށް ވަނުމުގެ ހުއްދަ މި އެކައުންޓަކަށް ނެތެވެ.`
        : `${areaNameEn} is restricted for ${ROLE_DEFINITIONS[accessRole].label}.`;
  }

  if (isAuthorized) {
    return <>{children}</>;
  }

  return (
    <div className="max-w-xl mx-auto my-8 bg-[#FFFFFF] dark:bg-[#1A1D1B] border border-[#E2DDD5] dark:border-[#2E3330] rounded-2xl p-6 sm:p-8 shadow-xs space-y-5">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-[#FEF2F2] dark:bg-[#7F1D1D]/30 border border-[#FECACA] dark:border-[#B91C1C]/60 text-[#B91C1C] dark:text-[#FCA5A5] flex items-center justify-center shrink-0">
          {isGuest ? <Lock className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
        </div>
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#0F4C45] dark:text-[#6EE7B7]">
            <LibraryEmblem size="sm" />
            <span>{language === 'dv' ? areaNameDv : areaNameEn}</span>
          </div>
          <h2 className="text-lg sm:text-xl font-extrabold text-[#1C1917] dark:text-[#F5F3EE] archival-heading">
            {isGuest
              ? language === 'dv'
                ? 'ލޮގިންވާން ޖެހޭ'
                : 'Sign-In Required'
              : language === 'dv'
              ? 'ވަނުމުގެ ހުއްދަ ނެތް'
              : 'Role Permission Required'}
          </h2>
          <p className="text-xs sm:text-sm text-[#6B655D] dark:text-[#A19B91] leading-relaxed">
            {denialMessage}
          </p>
        </div>
      </div>

      <div className="pt-4 border-t border-[#E2DDD5] dark:border-[#2E3330] flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBackToOpac}
          className="px-4 py-2.5 rounded-xl bg-[#EFECE6] hover:bg-[#E2DDD5] dark:bg-[#232724] dark:hover:bg-[#2E3330] text-[#1C1917] dark:text-[#F5F3EE] border border-[#E2DDD5] dark:border-[#2E3330] text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap"
        >
          <BookOpen className="w-4 h-4 text-[#0F4C45] dark:text-[#6EE7B7]" />
          <span>{language === 'dv' ? 'ޕަބްލިކް ކެޓަލޮގަށް ދޭ' : 'Browse Public OPAC'}</span>
        </button>

        <button
          type="button"
          onClick={onOpenLogin}
          className="px-5 py-2.5 rounded-xl bg-[#0F4C45] hover:bg-[#16655B] text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap"
        >
          <LogIn className="w-4 h-4" />
          <span>{language === 'dv' ? 'ލޮގިން / ރޯލް ބަދަލުކުރޭ' : 'Sign In / Switch Role'}</span>
        </button>
      </div>
    </div>
  );
};
