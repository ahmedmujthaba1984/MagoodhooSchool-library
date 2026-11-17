import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Loader2, MessageSquare, Mail, Smartphone, RefreshCw } from 'lucide-react';
import { draftOverdueReminder, ReminderChannel, ReminderDraftResult } from '../services/ai';
import { useLanguage } from '../lib/i18n';
import { useToast } from '../lib/toast';

export interface ReminderTarget {
  loanId?: string;
  bookTitle: string;
  userName: string;
  userGrade?: string;
  dueDate: string;
  daysOverdue?: number;
  lateFeeMvr?: number;
}

interface ReminderDraftModalProps {
  target: ReminderTarget | null;
  onClose: () => void;
}

export const ReminderDraftModal: React.FC<ReminderDraftModalProps> = ({ target, onClose }) => {
  const { language: appLanguage } = useLanguage();
  const { toast } = useToast();

  const [channel, setChannel] = useState<ReminderChannel>('whatsapp');
  const [draftLang, setDraftLang] = useState<'en' | 'dv'>(appLanguage === 'dv' ? 'dv' : 'en');
  const [draft, setDraft] = useState<ReminderDraftResult | null>(null);
  const [editedBody, setEditedBody] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateDraft = async (ch: ReminderChannel, lang: 'en' | 'dv') => {
    if (!target) return;
    setIsLoading(true);
    try {
      const res = await draftOverdueReminder({
        loanId: target.loanId,
        bookTitle: target.bookTitle,
        userName: target.userName,
        userGrade: target.userGrade,
        dueDate: target.dueDate,
        daysOverdue: target.daysOverdue,
        lateFeeMvr: target.lateFeeMvr,
        channel: ch,
        language: lang,
      });
      setDraft(res);
      setEditedBody(res.messageBody);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (target) {
      setDraftLang(appLanguage === 'dv' ? 'dv' : 'en');
      void generateDraft(channel, appLanguage === 'dv' ? 'dv' : 'en');
    }
  }, [target]);

  if (!target) return null;

  const handleCopy = async () => {
    const fullText = channel === 'email' && draft?.subject
      ? `Subject: ${draft.subject}\n\n${editedBody}`
      : editedBody;
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      toast.success('Reminder message copied to clipboard.', 'Ready to Send');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Clipboard copy unavailable in this browser.', 'Copy Failed');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl max-w-lg w-full p-5 sm:p-6 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-black">Automated Reminder Drafter</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              <bdi>{target.userName}</bdi> · <bdi>{target.bookTitle}</bdi>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Channel & Language Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
            {(
              [
                { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
                { id: 'sms', label: 'SMS', icon: Smartphone },
                { id: 'email', label: 'Email', icon: Mail },
              ] as const
            ).map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setChannel(opt.id);
                    void generateDraft(opt.id, draftLang);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition ${
                    channel === opt.id
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => {
                setDraftLang('en');
                void generateDraft(channel, 'en');
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                draftLang === 'en' ? 'bg-emerald-700 text-white' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => {
                setDraftLang('dv');
                void generateDraft(channel, 'dv');
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                draftLang === 'dv' ? 'bg-emerald-700 text-white' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              ދިވެހި
            </button>
          </div>
        </div>

        {channel === 'email' && draft?.subject && (
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
            <span className="font-bold text-slate-500 dark:text-slate-400">Subject: </span>
            <span className="font-bold">{draft.subject}</span>
          </div>
        )}

        {isLoading ? (
          <div className="py-10 flex flex-col items-center justify-center gap-2 text-xs text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-700" />
            <span>Drafting polite {draftLang === 'dv' ? 'Dhivehi' : 'English'} reminder...</span>
          </div>
        ) : (
          <textarea
            rows={7}
            dir={draftLang === 'dv' ? 'rtl' : 'ltr'}
            value={editedBody}
            onChange={(e) => setEditedBody(e.target.value)}
            className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs sm:text-sm leading-relaxed font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        )}

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            disabled={isLoading}
            onClick={() => void generateDraft(channel, draftLang)}
            className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Regenerate</span>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied!' : 'Copy Message'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
