import React, { useState } from 'react';
import { Lock, User, KeyRound, X, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import logoImg from '../assets/logo.webp';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedPass = password.trim();
    const trimmedUser = username.trim();

    if (!trimmedUser || !trimmedPass) {
      setErrorMsg('Παρακαλώ συμπληρώστε όνομα χρήστη και κωδικό πρόσβασης.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmedUser, password: trimmedPass })
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Λανθασμένο όνομα χρήστη ή κωδικός πρόσβασης.');
      }

      setIsSuccess(true);
      if (rememberMe) {
        localStorage.setItem('admin_token', data.token);
        localStorage.setItem('admin_user', data.username || trimmedUser);
      } else {
        sessionStorage.setItem('admin_token', data.token);
        sessionStorage.setItem('admin_user', data.username || trimmedUser);
      }

      setTimeout(() => {
        setIsSuccess(false);
        setPassword('');
        onLoginSuccess();
        onClose();
      }, 400);
    } catch (err: any) {
      setErrorMsg(err.message || 'Αποτυχία σύνδεσης. Ελέγξτε τα στοιχεία σας.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-md p-6 shadow-2xl relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute -top-16 -right-16 w-44 h-44 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center space-y-3 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-slate-950 border border-slate-800 p-2 mx-auto flex items-center justify-center shadow-lg shadow-black/40">
            <img src={logoImg} alt="nimalakasiotis.gr" className="w-full h-full object-contain" />
          </div>

          <div>
            <h2 className="text-lg font-bold text-white flex items-center justify-center gap-2">
              <Lock className="w-4 h-4 text-amber-400" />
              <span>Σύνδεση Διαχειριστή</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Εισάγετε τα στοιχεία διαχειριστή για πρόσβαση στις ρυθμίσεις μαθήματος.
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMsg && (
            <div className="bg-rose-950/60 border border-rose-800 text-rose-300 p-2.5 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {isSuccess && (
            <div className="bg-emerald-950/60 border border-emerald-800 text-emerald-300 p-2.5 rounded-xl text-xs flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Επιτυχής σύνδεση! Είσοδος...</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Όνομα Χρήστη
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Όνομα χρήστη"
                autoComplete="username"
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl py-2.5 pl-10 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-500 outline-none transition"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Κωδικός Πρόσβασης
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                autoFocus
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl py-2.5 pl-10 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-500 outline-none transition"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="accent-amber-500 rounded cursor-pointer"
              />
              <span>Απομνημόνευση σύνδεσης</span>
            </label>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg cursor-pointer transition active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Lock className="w-3.5 h-3.5" />
              )}
              <span>{isSubmitting ? 'Έλεγχος στοιχείων...' : 'Σύνδεση'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
