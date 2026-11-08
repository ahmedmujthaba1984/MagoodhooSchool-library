import React, { useState } from 'react';
import { Download, Smartphone, X, Check, Apple } from 'lucide-react';
import { usePWAInstall } from '../lib/usePWAInstall';
import { useLanguage } from '../lib/i18n';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const { language } = useLanguage();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // If already running inside standalone PWA window, suppress install prompt
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    setIsInstalling(true);
    try {
      await install();
    } finally {
      setIsInstalling(false);
    }
  };

  // Chromium / Android / Desktop Install Flow
  if (isInstallable) {
    if (compact) {
      return (
        <button
          type="button"
          onClick={handleInstallClick}
          disabled={isInstalling}
          title={language === 'dv' ? 'އެޕް އިންސްޓޯލް ކުރައްވާ' : 'Install PWA App'}
          className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold text-xs px-3 py-1.5 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer border border-emerald-300/40"
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span className="whitespace-nowrap">{language === 'dv' ? 'އިންސްޓޯލް' : 'Install'}</span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={handleInstallClick}
        disabled={isInstalling}
        className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 via-teal-600 to-indigo-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-xs px-3.5 py-2 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer border border-emerald-300/30"
      >
        <Download className="w-4 h-4 shrink-0 animate-bounce" />
        <span className="whitespace-nowrap">
          {language === 'dv' ? 'އެޕް އިންސްޓޯލް ކުރައްވާ' : 'Install App'}
        </span>
      </button>
    );
  }

  // iOS Safari Flow with Guide Modal
  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold px-3 py-1.5 rounded-xl transition cursor-pointer"
          title="Install on iOS Home Screen"
        >
          <Apple className="w-3.5 h-3.5 text-slate-300" />
          <span>{language === 'dv' ? 'އައިފޯން' : 'iOS App'}</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-700 p-6 shadow-2xl text-slate-100 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-white font-black text-sm">
                  <Apple className="w-5 h-5 text-indigo-400" />
                  <span>{language === 'dv' ? 'އައިފޯނަށް އަޅުއްވާ' : 'Install on iPhone / iPad'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
                <div className="flex items-start gap-3 bg-slate-800/60 p-3 rounded-2xl border border-slate-700/60">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-extrabold flex items-center justify-center shrink-0 text-xs">
                    1
                  </span>
                  <div>
                    {language === 'dv' ? (
                      <p>ސަފާރީ ބްރައުޒަރގެ ތިރީގައިވާ <strong>Share (ޙިއްޞާކުރުން)</strong> ފިތަށް ފިއްތާލައްވާ.</p>
                    ) : (
                      <p>Tap the <strong>Share</strong> icon in the Safari navigation bar at bottom.</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-slate-800/60 p-3 rounded-2xl border border-slate-700/60">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-extrabold flex items-center justify-center shrink-0 text-xs">
                    2
                  </span>
                  <div>
                    {language === 'dv' ? (
                      <p>ތިރިއަށް ޖައްސަވާލައްވައި <strong>Add to Home Screen (ހޯމް ސްކްރީނަށް އިތުރުކުރޭ)</strong> ނަންގަވާ.</p>
                    ) : (
                      <p>Scroll down and select <strong>Add to Home Screen</strong>.</p>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2.5 rounded-xl transition cursor-pointer shadow-md"
              >
                {language === 'dv' ? 'ރަނގަޅު' : 'Got It'}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
