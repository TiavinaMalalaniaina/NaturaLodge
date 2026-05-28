import React, { useState } from 'react';
import { User, Key, ArrowRight, Fingerprint, Scan, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const email = (form.elements.namedItem('email') as HTMLInputElement).value;
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;
    setError('');
    setIsLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard', { replace: true });
    } catch {
      setError('Email ou mot de passe incorrect');
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <motion.main 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen flex items-stretch bg-stone-50"
    >
      {/* Left side - Atmospheric Image */}
      <section className="hidden lg:flex lg:w-7/12 relative overflow-hidden">
        <img 
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuCvd3RIz8lbVX-TfL-s3P_COZLC5JfYA5vdxerGmB4z_n1XXg61JOW8HgXvn-QwTWVNUHrtcX21-bRErRfZjkv5Sd6rF6e9gfnaZAsjzMFM8lcX004R8jlgBWnHcJ8wAqn2R8tT2o7RjgQJCXsc_ohIWR7FamzATH-sSdrhIcCM64CX_TTGbZcLK-XIbxZLQQra3PBH3ok8b9NnKl_O4vM210ZEscbLR6KXqQA02J7HZ0HCx6z7MahBN8pz2J2oRJtKkLjRn7j7LoA"
          alt="Luxury Hotel Spa"
          className="absolute inset-0 w-full h-full object-cover scale-105"
        />
        <div className="absolute inset-0 bg-primary/10 backdrop-blur-[2px]"></div>
        <div className="relative z-10 p-16 flex flex-col justify-between h-full w-full text-white">
          <div>
            <div className="flex items-center gap-4 mb-12">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 4, repeat: Infinity }}
                >
                  <ShieldCheck className="w-6 h-6" />
                </motion.div>
              </div>
              <h1 className="font-display italic text-4xl tracking-tight">Natura Lodge</h1>
            </div>
            <div className="max-w-md">
              <h2 className="font-display text-6xl mb-8 leading-tight">Organic Precision</h2>
              <p className="font-sans text-xl text-white/80 leading-relaxed font-light">
                Experience a management interface that mirrors the serenity of our retreats. 
                Designed for operational excellence with a touch of discrete luxury.
              </p>
            </div>
          </div>
          <div className="font-sans text-[10px] tracking-[0.4em] text-white/60 uppercase">
            ESTABLISHED IN NATURA VALLEY • MMXXIV
          </div>
        </div>
      </section>

      {/* Right side - Login Form */}
      <section className="w-full lg:w-5/12 flex flex-col justify-center items-center px-8 subtle-grain relative">
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="w-full max-w-[420px] bg-white p-12 rounded-2xl organic-shadow border border-outline-variant/30"
        >
          {/* Logo & Heading */}
          <div className="flex flex-col items-center mb-12">
            <div className="relative w-20 h-20 flex items-center justify-center mb-8">
              <div className="absolute inset-0 bg-primary rotate-45 rounded-xl"></div>
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-gold-400 rotate-45 rounded-md"></div>
              <span className="relative font-display text-5xl text-white italic">N</span>
            </div>
            <h3 className="font-display text-4xl text-on-surface-variant">Login</h3>
            <p className="text-[11px] font-sans uppercase tracking-[0.2em] text-on-surface-variant/40 mt-3 text-center">
              Enter your credentials to access the portal
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
                Work Email
              </label>
              <div className="relative group">
                <input
                  name="email"
                  type="email"
                  className="w-full h-14 px-5 bg-stone-50 border border-stone-200 rounded-xl text-on-surface focus:border-primary-container focus:ring-4 focus:ring-primary/5 outline-none transition-all duration-300 placeholder:text-outline-variant font-sans"
                  placeholder="admin@naturalodge.mg"
                  required
                />
                <User className="absolute right-5 top-1/2 -translate-y-1/2 text-outline-variant w-5 h-5 group-focus-within:text-primary transition-colors" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-sans font-bold uppercase tracking-widest text-on-surface-variant/60">
                  Password
                </label>
                <a href="#" className="text-[9px] font-sans font-bold text-primary hover:text-primary-container transition-colors tracking-widest uppercase">
                  Forgot?
                </a>
              </div>
              <div className="relative group">
                <input
                  name="password"
                  type="password"
                  className="w-full h-14 px-5 bg-stone-50 border border-stone-200 rounded-xl text-on-surface focus:border-primary-container focus:ring-4 focus:ring-primary/5 outline-none transition-all duration-300 placeholder:text-outline-variant font-sans"
                  placeholder="••••••••"
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
              {isLoading ? 'Connexion...' : 'Sign In'}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>

            <div className="relative flex items-center py-4">
              <div className="flex-grow border-t border-outline-variant/30"></div>
              <span className="flex-shrink mx-4 text-[9px] font-sans font-bold tracking-[0.2em] text-outline-variant uppercase">OR ACCESS VIA</span>
              <div className="flex-grow border-t border-outline-variant/30"></div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button 
                type="button" 
                className="flex items-center justify-center gap-3 h-12 bg-white border border-stone-200 rounded-xl text-[10px] font-sans font-bold tracking-widest text-on-surface-variant hover:bg-stone-50 transition-colors uppercase"
              >
                <Scan className="w-4 h-4 text-primary" /> SSO
              </button>
              <button 
                type="button" 
                className="flex items-center justify-center gap-3 h-12 bg-white border border-stone-200 rounded-xl text-[10px] font-sans font-bold tracking-widest text-on-surface-variant hover:bg-stone-50 transition-colors uppercase"
              >
                <Fingerprint className="w-4 h-4 text-primary" /> Bio
              </button>
            </div>
          </form>
        </motion.div>

        <footer className="absolute bottom-12 w-full text-center">
          <p className="font-mono text-[9px] uppercase tracking-widest text-outline-variant flex items-center justify-center gap-2">
            <ShieldCheck className="w-3 h-3 text-status-available" />
            Verified & Secured by Natura Systems
          </p>
        </footer>
      </section>
    </motion.main>
  );
};
