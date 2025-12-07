
import React, { useState } from 'react';
import { Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { Language } from '../types';
import { t } from '../translations';
import Logo from './Logo';

interface LoginProps {
  lang: Language;
  onLogin: (password: string) => boolean;
}

const Login: React.FC<LoginProps> = ({ lang, onLogin }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [shaking, setShaking] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const success = onLogin(password);
    if (!success) {
      setError(true);
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 opacity-20 pointer-events-none" 
           style={{ 
               backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)', 
               backgroundSize: '30px 30px' 
           }} 
      />
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-purple-500 to-blue-600 opacity-50"></div>

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 relative z-10 animate-in fade-in zoom-in-95 duration-500">
        
        <div className="flex flex-col items-center mb-10">
            <Logo className="w-16 h-16 mb-4" />
            <h1 className="text-2xl font-bold text-white tracking-tight text-center">
              {t(lang, 'welcomeTitle')}
            </h1>
            <p className="text-slate-400 text-sm mt-2 text-center">
              {t(lang, 'welcomeSubtitle')}
            </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
            <div className={`space-y-2 ${shaking ? 'animate-shake' : ''}`}>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                    {t(lang, 'passwordLabel')}
                </label>
                <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 group-focus-within:text-blue-500 transition-colors">
                        <Lock size={18} />
                    </div>
                    <input 
                        type="password" 
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setError(false); }}
                        className={`w-full bg-slate-950 border ${error ? 'border-red-500 focus:border-red-500' : 'border-slate-700 focus:border-blue-500'} rounded-lg py-3 pl-10 pr-4 text-white placeholder-slate-600 outline-none transition-all shadow-inner`}
                        placeholder="••••••••"
                        autoFocus
                    />
                </div>
                {error && (
                    <div className="flex items-center gap-2 text-red-400 text-xs mt-2 ml-1 animate-in slide-in-from-top-1">
                        <AlertCircle size={12} />
                        {t(lang, 'wrongPassword')}
                    </div>
                )}
            </div>

            <button 
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-lg transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 group"
            >
                {t(lang, 'loginBtn')}
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
        </form>

        <div className="mt-8 text-center">
            <p className="text-xs text-slate-500">
                &copy; {new Date().getFullYear()} Alumetric Engineering Suite
            </p>
        </div>
      </div>

      <style>{`
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-5px); }
            75% { transform: translateX(5px); }
        }
        .animate-shake {
            animation: shake 0.2s ease-in-out 0s 2;
        }
      `}</style>
    </div>
  );
};

export default Login;
