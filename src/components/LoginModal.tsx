import React, { useState } from 'react';
import { Lock, Mail, Shield, Check, X, LogIn, Sparkles, AlertCircle, Users, User, Smartphone, QrCode } from 'lucide-react';
import { UserProfile } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  allUsers: UserProfile[];
  onLoginSuccess: (user: UserProfile) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  allUsers,
  onLoginSuccess,
}) => {
  const [loginMode, setLoginMode] = useState<'admin' | 'parent' | 'general'>('admin');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('0000');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleQuickSuperAdminFill = () => {
    setLoginMode('admin');
    setIdentifier('library@fmagoodhooschool.edu.mv');
    setPassword('0000');
    setErrorMsg('');
  };

  const handleQuickParentFill = () => {
    setLoginMode('parent');
    const parentUser = allUsers.find(u => u.role === 'parent') || { email: 'sarah.jenkins@gmail.com' };
    setIdentifier(parentUser.email);
    setPassword('0000');
    setErrorMsg('');
  };

  const cleanPhone = (str: string) => str.replace(/\D/g, '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!identifier.trim()) {
      setErrorMsg('Please enter your registered Email, Mobile Phone Number, or Student Barcode ID.');
      return;
    }

    setIsSubmitting(true);

    setTimeout(() => {
      const cleanInput = identifier.trim();
      const cleanLower = cleanInput.toLowerCase();
      const digits = cleanPhone(cleanInput);

      // Search by Email, Phone, or Student ID
      let matchedUser = allUsers.find(u =>
        u.email.toLowerCase() === cleanLower ||
        (u.phone && digits.length >= 4 && cleanPhone(u.phone).includes(digits)) ||
        (u.studentIdCode && u.studentIdCode.toUpperCase() === cleanInput.toUpperCase())
      );

      // Super admin override
      if (cleanLower === 'library@fmagoodhooschool.edu.mv' || cleanLower === '0000' || digits === '9607770000') {
        if (!matchedUser) {
          matchedUser = {
            id: 'user-superadmin-fmagoodhoo',
            email: 'library@fmagoodhooschool.edu.mv',
            name: 'Super Admin (F. Magoodhoo School Library)',
            role: 'admin',
            phone: '960-7770000',
            createdAt: '2026-08-04',
          };
        }
      }

      if (matchedUser) {
        setSuccessMsg(`Welcome back, ${matchedUser.name}!`);
        setTimeout(() => {
          setIsSubmitting(false);
          onLoginSuccess(matchedUser!);
          onClose();
        }, 600);
      } else {
        setIsSubmitting(false);
        setErrorMsg('No registered account found with this Email, Phone, or Student ID.');
      }
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-200 text-slate-800 space-y-5">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b pb-4 border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-2xl">
              <Shield className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">Magoodhoo Library Portal</h3>
              <p className="text-xs text-slate-500 font-medium">Log in from Mobile, Laptop, or PC</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 hover:bg-slate-100 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Login Mode Selector Tabs */}
        <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-extrabold">
          <button
            type="button"
            onClick={() => setLoginMode('admin')}
            className={`flex-1 py-2 px-3 rounded-lg transition flex items-center justify-center gap-1.5 ${
              loginMode === 'admin' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-amber-600" />
            <span>Super Admin</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setLoginMode('parent');
              handleQuickParentFill();
            }}
            className={`flex-1 py-2 px-3 rounded-lg transition flex items-center justify-center gap-1.5 ${
              loginMode === 'parent' ? 'bg-white text-purple-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-purple-600" />
            <span>Parent</span>
          </button>

          <button
            type="button"
            onClick={() => setLoginMode('general')}
            className={`flex-1 py-2 px-3 rounded-lg transition flex items-center justify-center gap-1.5 ${
              loginMode === 'general' ? 'bg-white text-blue-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <User className="w-3.5 h-3.5 text-blue-600" />
            <span>Student / Staff</span>
          </button>
        </div>

        {/* Quick Fill Banners */}
        {loginMode === 'admin' && (
          <div className="p-3.5 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl space-y-2">
            <div className="flex items-center justify-between text-xs text-amber-900 font-bold">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-600" /> Super Admin Credentials
              </span>
            </div>
            <p className="text-[11px] text-slate-700 font-medium">
              Email: <code className="bg-white border border-amber-300 text-amber-900 px-1.5 py-0.5 rounded font-mono font-bold">library@fmagoodhooschool.edu.mv</code>
            </p>
            <button
              type="button"
              onClick={handleQuickSuperAdminFill}
              className="w-full text-xs bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 px-3 rounded-xl transition shadow flex items-center justify-center gap-1.5"
              id="quick-fill-superadmin-btn"
            >
              <Shield className="w-3.5 h-3.5" /> Auto-Fill Admin Credentials
            </button>
          </div>
        )}

        {loginMode === 'parent' && (
          <div className="p-3.5 bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl space-y-2">
            <div className="flex items-center justify-between text-xs text-purple-900 font-bold">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-purple-600" /> Parent Account Quick Fill
              </span>
            </div>
            <p className="text-[11px] text-slate-700 font-medium">
              Email: <code className="bg-white border border-purple-300 text-purple-900 px-1.5 py-0.5 rounded font-mono font-bold">sarah.jenkins@gmail.com</code> | Phone: <code className="bg-white border border-purple-300 text-purple-900 px-1.5 py-0.5 rounded font-mono font-bold">(555) 234-5678</code>
            </p>
            <button
              type="button"
              onClick={handleQuickParentFill}
              className="w-full text-xs bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-3 rounded-xl transition shadow flex items-center justify-center gap-1.5"
              id="quick-fill-parent-btn"
            >
              <Users className="w-3.5 h-3.5" /> Auto-Fill Parent Account
            </button>
          </div>
        )}

        {/* Error / Success Messages */}
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-purple-600" /> Email, Mobile Number, or Student ID:
            </label>
            <input
              type="text"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="e.g. (555) 234-5678, sarah.jenkins@gmail.com, or STU-2041"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
              id="login-identifier-input"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-600" /> Password / PIN (Default: 0000)
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="0000"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
              id="login-password-input"
            />
          </div>

          <div className="pt-3 flex justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition border border-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-5 py-2.5 text-white font-extrabold rounded-xl shadow transition flex items-center gap-2 ${
                loginMode === 'parent'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600'
              }`}
              id="submit-login-btn"
            >
              <LogIn className="w-4 h-4" />
              {isSubmitting ? 'Authenticating...' : 'Sign In'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
