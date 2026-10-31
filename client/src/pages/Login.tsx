import React, { useState } from 'react';
import { User, Key, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { PageLoader } from '../components/QueryLoader';

const ROUTES = {
  dashboard: "/dashboard",
} as const;

export const LoginPage: React.FC = () => {
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const username = (form.elements.namedItem('username') as HTMLInputElement).value;
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;
    setError('');
    setIsLoading(true);
    try {
      const result = await login(username, password);
      if (result.requiresPasswordChange) {
        navigate('/reset-password?token=' + encodeURIComponent(result.token), { state: { token: result.token } });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch {
      setError(t('auth.wrongCredentials'));
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) return <PageLoader />;
  if (isAuthenticated) return <Navigate to={ROUTES.dashboard} replace />;

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen flex items-center justify-center bg-stone-50 px-4"
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="w-full max-w-[420px] bg-white p-12 rounded-2xl organic-shadow border border-outline-variant/30"
      >
        {/* Logo & Heading */}
        <div className="flex flex-col items-center mb-12">
          <div className="flex items-center justify-center mb-8 w-40 h-24">
            <img
              src="/logo.png"
              alt={t("common.appName")}
              className="max-w-full max-h-full object-contain"
            />
          </div>
          <h3 className="font-display text-4xl text-on-surface-variant">{t('auth.title')}</h3>
          <p className="text-[11px] font-sans uppercase tracking-[0.2em] text-on-surface-variant/40 mt-3 text-center">
            {t('auth.subtitle')}
          </p>
        </div>

        <form className="space-y-8" onSubmit={handleSubmit}>
          {error && (
            <p className="text-xs text-red-500 font-sans text-center bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              {error}
            </p>
          )}
          <div className="space-y-2">
            <label className="text-[10px] font-sans font-bold uppercase tracking-widest text-on-surface-variant/60 ml-1">
              {t('auth.username')}
            </label>
            <div className="relative group">
              <input
                name="username"
                type="text"
                autoComplete="username"
                className="w-full h-14 px-5 bg-stone-50 border border-stone-200 rounded-xl text-on-surface focus:border-primary-container focus:ring-4 focus:ring-primary/5 outline-none transition-all duration-300 placeholder:text-outline-variant font-sans"
                placeholder={t("auth.usernamePlaceholder")}
                required
              />
              <User className="absolute right-5 top-1/2 -translate-y-1/2 text-outline-variant w-5 h-5 group-focus-within:text-primary transition-colors" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
              <label className="text-[10px] font-sans font-bold uppercase tracking-widest text-on-surface-variant/60">
                {t('auth.password')}
              </label>
            </div>
            <div className="relative group">
              <input
                name="password"
                type="password"
                className="w-full h-14 px-5 bg-stone-50 border border-stone-200 rounded-xl text-on-surface focus:border-primary-container focus:ring-4 focus:ring-primary/5 outline-none transition-all duration-300 placeholder:text-outline-variant font-sans"
                placeholder={t('auth.passwordPlaceholder')}
                required
              />
              <Key className="absolute right-5 top-1/2 -translate-y-1/2 text-outline-variant w-5 h-5 group-focus-within:text-primary transition-colors" />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-14 bg-primary hover:bg-primary-container text-white font-sans text-xs font-bold tracking-[0.2em] uppercase rounded-xl organic-shadow transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-3 group disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? t('auth.signingIn') : t('auth.signin')}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>

          <p className="text-xs text-on-surface-variant/60 text-center">
            Identifiant de test administrateur : admin
            <br />
            Mot de passe de test : Admin@1234
          </p>
        </form>
      </motion.div>
    </motion.main>
  );
};
