import { useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import ThemeToggle from '../components/ThemeToggle';
import LanguageToggle from '../components/LanguageToggle';
import Logo from '../components/Logo';

export default function Login() {
  const { login, loading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await login(username.trim(), password);
    if (result.success) {
      toast.success(result.devFallback ? t('common.welcomeDev') : t('common.welcome'));
      const from = location.state?.from || searchParams.get('from') || '/admin';
      navigate(from.startsWith('/') ? from : '/admin', { replace: true });
    } else {
      toast.error(result.message || t('common.invalidCredentials'));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative flex min-h-screen items-center justify-center overflow-hidden app-bg px-4 py-12"
    >
      <motion.div
        className="pointer-events-none absolute -left-32 top-20 h-72 w-72 rounded-full bg-amber-400/25 blur-3xl"
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="pointer-events-none absolute -right-24 bottom-16 h-64 w-64 rounded-full bg-yellow-300/20 blur-3xl"
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="absolute right-4 top-4 z-20 flex gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="glass-card overflow-hidden p-8 shadow-2xl shadow-amber-500/10 sm:p-10">
          <div className="mb-8 flex flex-col items-center text-center">
            <Logo linkTo="/" size="lg" />
            <h1 className="mt-6 text-2xl font-extrabold text-slate-900 dark:text-white">{t('login.title')}</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t('login.brand')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="username" className="sr-only">
                {t('login.username')}
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                placeholder={t('login.username')}
                className="input-field w-full"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="relative">
              <label htmlFor="password" className="sr-only">
                {t('login.password')}
              </label>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder={t('login.password')}
                className="input-field w-full pr-12"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                aria-label={showPassword ? t('login.password') : t('login.password')}
              >
                {showPassword ? <FaEyeSlash className="h-4 w-4" /> : <FaEye className="h-4 w-4" />}
              </button>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3.5 text-base">
              {loading ? t('login.signingIn') : t('login.signIn')}
            </button>
          </form>

          {import.meta.env.DEV && (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-700/40 dark:bg-amber-950/30">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400">
                Local Dev Credentials
              </p>
              <div className="mt-1.5 flex items-center justify-between gap-3">
                <div className="space-y-0.5 text-sm text-amber-900 dark:text-amber-200">
                  <p><span className="font-semibold">Username:</span> admin</p>
                  <p><span className="font-semibold">Password:</span> Admin@123</p>
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded-lg border border-amber-300 bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-900 transition hover:bg-amber-200 dark:border-amber-600 dark:bg-amber-900/40 dark:text-amber-200 dark:hover:bg-amber-900/70"
                  onClick={() => {
                    setUsername('admin');
                    setPassword('Admin@123');
                  }}
                >
                  Fill In
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
