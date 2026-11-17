import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  BookOpen,
  Users,
  RotateCcw,
  Shield,
  Sparkles,
  Library,
  QrCode,
  LayoutDashboard,
  X,
  ArrowRight,
  Bookmark,
  Mic,
  MicOff,
  Loader2
} from 'lucide-react';
import { Book, UserProfile, PersonalItem } from '../types';
import { useLanguage } from '../lib/i18n';
import { useVoiceAssistant } from '../hooks/useVoiceAssistant';
import { useToast } from '../lib/toast';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  books: Book[];
  users: UserProfile[];
  personalItems: PersonalItem[];
  isAdmin: boolean;
  onSelectBook: (book: Book) => void;
  onSelectUser: (user: UserProfile) => void;
  onNavigateTab: (tab: string) => void;
  onOpenScanner: () => void;
}

interface PaletteItem {
  id: string;
  group: 'action' | 'book' | 'patron' | 'personal';
  title: string;
  subtitle: string;
  code?: string;
  onRun: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  books,
  users,
  personalItems,
  isAdmin,
  onSelectBook,
  onSelectUser,
  onNavigateTab,
  onOpenScanner
}) => {
  const { t, language, isRtl } = useLanguage();
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { isRecording, isTranscribing, toggleRecording } = useVoiceAssistant({
    language,
    onTranscript: (text) => setQuery(text),
    onError: (msg) => toast.warning(msg, t.voiceAssistant),
  });

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const items = useMemo<PaletteItem[]>(() => {
    const q = query.trim().toLowerCase();

    const quickActions: PaletteItem[] = [
      {
        id: 'act-catalog',
        group: 'action',
        title: language === 'dv' ? 'ސްކޫލް ކެޓަލޮގް (OPAC)' : 'School Catalog & OPAC',
        subtitle: language === 'dv' ? 'ފޮތްތައް ހޯދައި ބެލުން' : 'Browse & search full school holdings',
        code: 'OPAC',
        onRun: () => { onNavigateTab('catalog'); onClose(); }
      },
      {
        id: 'act-personal',
        group: 'action',
        title: language === 'dv' ? 'އަމިއްލަ ކަލެކްޝަން (Personal Library)' : 'Personal Library Mode',
        subtitle: language === 'dv' ? 'އަމިއްލަ ފޮތްތަކާއި ކިޔުމުގެ ޕްރޮގްރެސް' : 'Multi-media shelving & reading tracker',
        code: 'LIBIB',
        onRun: () => { onNavigateTab('personal-library'); onClose(); }
      },
      {
        id: 'act-scanner',
        group: 'action',
        title: language === 'dv' ? 'ކެމެރާ ބާކޯޑް ސްކޭނަރ' : 'Launch Barcode / ISBN Camera Scanner',
        subtitle: language === 'dv' ? 'ބާކޯޑް ނުވަތަ އައި.އެސް.ބީ.އެން ސްކޭންކުރުން' : 'Scan copy barcodes or patron IDs',
        code: 'SCAN',
        onRun: () => { onClose(); onOpenScanner(); }
      },
      {
        id: 'act-ai',
        group: 'action',
        title: language === 'dv' ? 'އޭ.އައި ލައިބްރޭރިއަން' : 'AI Natural Language OPAC & Librarian',
        subtitle: language === 'dv' ? 'ސުވާލުކޮށްގެން ފޮތް ހޯދުން' : 'Conversational search & curriculum matcher',
        code: 'AI',
        onRun: () => { onNavigateTab('ai-assistant'); onClose(); }
      }
    ];

    if (isAdmin) {
      quickActions.unshift(
        {
          id: 'act-desk',
          group: 'action',
          title: language === 'dv' ? 'ފޮތް ދޫކުރުން / ހަވާލުކުރުން' : 'Rapid Circulation Desk',
          subtitle: language === 'dv' ? 'ޗެކްއައުޓް، ރިޓާން އަދި ރިނިއު' : 'Split-screen Check-Out, Check-In & Renew',
          code: 'DESK',
          onRun: () => { onNavigateTab('checkout-hub'); onClose(); }
        },
        {
          id: 'act-dash',
          group: 'action',
          title: language === 'dv' ? 'ލައިބްރަރީ އެނަލިޓިކްސް ޑޭޝްބޯޑް' : 'ILS Analytics Dashboard',
          subtitle: language === 'dv' ? 'ޓްރެފިކް އަދި ކަލެކްޝަން ހެލްތު' : 'KPIs, Peak Traffic & Predictive Insights',
          code: 'KPI',
          onRun: () => { onNavigateTab('dashboard'); onClose(); }
        },
        {
          id: 'act-admin',
          group: 'action',
          title: language === 'dv' ? 'ފައިނޭންޝަލް ލެޖަރ އަދި އެޑްމިން' : 'Financial Ledger & Admin Console',
          subtitle: language === 'dv' ? 'ޖޫރިމަނާ، ޕޭމަންޓް އަދި ބާކޯޑް ޕްރިންޓް' : 'MVR ledger, copy inventory & rules',
          code: 'ADMIN',
          onRun: () => { onNavigateTab('admin-panel'); onClose(); }
        }
      );
    }

    const filteredActions = q
      ? quickActions.filter((a) => a.title.toLowerCase().includes(q) || a.subtitle.toLowerCase().includes(q))
      : quickActions;

    const matchedBooks: PaletteItem[] = books
      .filter((b) => {
        if (!q) return true;
        const copyMatch = (b.copies || []).some((c) => c.barcode.toLowerCase().includes(q));
        return (
          b.title.toLowerCase().includes(q) ||
          b.author.toLowerCase().includes(q) ||
          b.isbn.toLowerCase().includes(q) ||
          b.barcode.toLowerCase().includes(q) ||
          (b.ddcCallNumber || '').toLowerCase().includes(q) ||
          copyMatch
        );
      })
      .slice(0, q ? 6 : 3)
      .map((b) => ({
        id: `book-${b.id}`,
        group: 'book',
        title: b.title,
        subtitle: `${b.author} · ${b.availableCopies}/${b.totalCopies} avail · ${b.shelfLocation}`,
        code: b.ddcCallNumber || b.isbn,
        onRun: () => { onSelectBook(b); onClose(); }
      }));

    const matchedUsers: PaletteItem[] = (isAdmin ? users : [])
      .filter((u) => {
        if (!q) return false;
        return (
          u.name.toLowerCase().includes(q) ||
          (u.studentIdCode || '').toLowerCase().includes(q) ||
          (u.staffIdCode || '').toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
        );
      })
      .slice(0, 5)
      .map((u) => ({
        id: `user-${u.id}`,
        group: 'patron',
        title: u.name,
        subtitle: `${u.role.toUpperCase()} ${u.grade ? `· ${u.grade}` : ''} · ${u.email}`,
        code: u.studentIdCode || u.staffIdCode || u.id,
        onRun: () => { onSelectUser(u); onClose(); }
      }));

    const matchedPersonal: PaletteItem[] = personalItems
      .filter((p) => !q || p.title.toLowerCase().includes(q) || p.author.toLowerCase().includes(q))
      .slice(0, q ? 4 : 0)
      .map((p) => ({
        id: `pers-${p.id}`,
        group: 'personal',
        title: p.title,
        subtitle: `${p.mediaType} · ${p.readingStatus} · ${p.shelfGroup}`,
        code: p.isbn || p.upc || p.mediaType,
        onRun: () => { onNavigateTab('personal-library'); onClose(); }
      }));

    return [...filteredActions, ...matchedBooks, ...matchedUsers, ...matchedPersonal];
  }, [query, books, users, personalItems, isAdmin, language, onSelectBook, onSelectUser, onNavigateTab, onOpenScanner, onClose]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (items.length ? (prev + 1) % items.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (items.length ? (prev - 1 + items.length) % items.length : 0));
      } else if (e.key === 'Enter' && items[selectedIndex]) {
        e.preventDefault();
        items[selectedIndex].onRun();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, items, selectedIndex, onClose]);

  if (!isOpen) return null;

  const getIcon = (group: PaletteItem['group'], id: string) => {
    if (group === 'book') return <BookOpen className="w-4 h-4 text-emerald-700" />;
    if (group === 'patron') return <Users className="w-4 h-4 text-sky-700" />;
    if (group === 'personal') return <Bookmark className="w-4 h-4 text-amber-700" />;
    if (id.includes('desk')) return <RotateCcw className="w-4 h-4 text-emerald-700" />;
    if (id.includes('dash')) return <LayoutDashboard className="w-4 h-4 text-slate-700" />;
    if (id.includes('scanner')) return <QrCode className="w-4 h-4 text-slate-700" />;
    if (id.includes('ai')) return <Sparkles className="w-4 h-4 text-slate-700" />;
    if (id.includes('admin')) return <Shield className="w-4 h-4 text-slate-700" />;
    return <Library className="w-4 h-4 text-slate-700" />;
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-start justify-center pt-[10vh] px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              language === 'dv'
                ? 'ފޮތް، ބާކޯޑް، ދަރިވަރުގެ އައި.ޑީ، ނުވަތަ އެޑްމިން ކޮމާންޑް ލިޔުއްވާ...'
                : 'Jump to book, ISBN, copy barcode, student ID, or module...'
            }
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={toggleRecording}
            disabled={isTranscribing}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0 whitespace-nowrap ${
              isRecording
                ? 'bg-rose-600 text-white animate-pulse'
                : 'bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200'
            }`}
            title={t.voiceAssistant}
          >
            {isTranscribing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isRecording ? (
              <MicOff className="w-3.5 h-3.5" />
            ) : (
              <Mic className="w-3.5 h-3.5 text-emerald-700" />
            )}
            <span className="hidden sm:inline">
              {isTranscribing ? '...' : isRecording ? t.voiceListening : t.voiceAssistant}
            </span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            aria-label="Close Command Palette"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
          {items.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">
              {language === 'dv' ? 'އެއްވެސް ނަތީޖާއެއް ނުފެނުނު' : `No catalog items, patrons, or commands match "${query}"`}
            </div>
          ) : (
            items.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={item.onRun}
                  className={`w-full px-4 py-3 flex items-center justify-between gap-3 text-start transition-colors cursor-pointer ${
                    isSelected ? 'bg-emerald-50/80' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                      {getIcon(item.group, item.id)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900 truncate">
                        <bdi>{item.title}</bdi>
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        <bdi>{item.subtitle}</bdi>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.code && (
                      <span className="text-[11px] font-mono tabular-nums text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                        <bdi>{item.code}</bdi>
                      </span>
                    )}
                    <ArrowRight className={`w-3.5 h-3.5 text-slate-400 ${isRtl ? 'rtl-mirror' : ''}`} />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Keyboard Hints Footer */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-3">
            <span><kbd className="font-mono bg-white border border-slate-300 px-1.5 py-0.5 rounded text-[10px]">↑↓</kbd> Navigate</span>
            <span><kbd className="font-mono bg-white border border-slate-300 px-1.5 py-0.5 rounded text-[10px]">↵</kbd> Open</span>
            <span><kbd className="font-mono bg-white border border-slate-300 px-1.5 py-0.5 rounded text-[10px]">Esc</kbd> Close</span>
          </div>
          <span className="font-mono tabular-nums">{items.length} matches</span>
        </div>
      </div>
    </div>
  );
};
