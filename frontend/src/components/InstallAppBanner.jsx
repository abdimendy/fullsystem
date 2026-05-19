import { useEffect, useState } from 'react';
import { Download, Share2, X } from 'lucide-react';

const DISMISS_KEY = 'yellowbook_install_dismissed';

function isMobileDevice() {
  if (typeof window === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function isIOS() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

export default function InstallAppBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (!isMobileDevice() || isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY) === '1') return;

    const onBip = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
      setIosHint(false);
    };

    window.addEventListener('beforeinstallprompt', onBip);

    let androidTimer;
    if (isIOS()) {
      setIosHint(true);
      setVisible(true);
    } else {
      androidTimer = window.setTimeout(() => setVisible(true), 1500);
    }

    return () => {
      if (androidTimer) window.clearTimeout(androidTimer);
      window.removeEventListener('beforeinstallprompt', onBip);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  };

  const installAndroid = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    dismiss();
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[60] border-t border-amber-500/30 bg-slate-900/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl backdrop-blur-md"
      role="dialog"
      aria-label="Install YellowBook app"
    >
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-3 top-3 rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="pr-8">
        <p className="text-sm font-bold text-amber-400">Ku rakib YellowBook</p>
        {iosHint ? (
          <p className="mt-1 text-xs leading-relaxed text-slate-300">
            iPhone (Safari): taabo <Share2 className="inline h-3.5 w-3.5 align-text-bottom" />{' '}
            Share → <strong>Add to Home Screen</strong>
          </p>
        ) : deferredPrompt ? (
          <p className="mt-1 text-xs text-slate-300">
            Rakib app-ka si aad ugu furto sida WhatsApp — hal taabo.
          </p>
        ) : (
          <p className="mt-1 text-xs leading-relaxed text-slate-300">
            Chrome: Menu ⋮ → <strong>Install app</strong> ama <strong>Add to Home screen</strong>
          </p>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        {!iosHint && deferredPrompt && (
          <button type="button" onClick={installAndroid} className="btn-primary flex-1 text-sm">
            <Download className="h-4 w-4" />
            Install app
          </button>
        )}
        <button type="button" onClick={dismiss} className="btn-secondary flex-1 text-sm">
          Hadda ma aha
        </button>
      </div>
    </div>
  );
}
