import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useResetPasswordMutation, useVerifyResetPasswordToken } from '../hooks/useResetPassword';

export const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const t = useTranslation().t;
  const navigate = useNavigate();
  const resetPassword = useResetPasswordMutation();
  const { data: isTokenValid } = useVerifyResetPasswordToken(token);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!token || !isTokenValid) {
        throw new Error(t('resetPassword.invalidToken'));
      }
      if (password !== confirmPassword) {
        throw new Error(t('resetPassword.passwordMismatch'));
      }
      await resetPassword.mutateAsync({ token, password: password });
      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 2000);

    } catch (err: any) {
      setError(err.message || t('resetPassword.resetFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen flex items-center justify-center bg-stone-50 px-4"
    >
      {!isTokenValid ? (
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-stone-100 p-4 sm:p-10 text-center">
          <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-red-600">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
            {t('resetPassword.invalidTokenTitle')}
          </h1>
          <p className="text-sm text-stone-500 mt-2">
            {t('resetPassword.invalidTokenMessage')}
          </p>
        </div>
      ) : (
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-stone-100 p-4 sm:p-10">
          <div className="text-center mb-8">
          <div className="w-12 h-12 bg-stone-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-stone-800">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
            Nouveau mot de passe
          </h1>
          <p className="text-sm text-stone-500 mt-2">
            Veuillez définir votre nouveau mot de passe sécurisé pour finaliser l'accès à votre compte.
          </p>
        </div>

        {success ? (
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center"
          >
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
            <h3 className="font-semibold text-emerald-900">Mot de passe mis à jour !</h3>
            <p className="text-xs text-emerald-700 mt-1">
              Redirection en cours vers la page de connexion...
            </p>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-xs p-3.5 rounded-xl font-medium">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                Nouveau mot de passe
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-900 transition-all pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                Confirmer le mot de passe
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-900 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-stone-900 hover:bg-stone-800 text-white font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-stone-900/10 disabled:opacity-50"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Enregistrer le mot de passe
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
      )}
    </motion.main>
  );
}