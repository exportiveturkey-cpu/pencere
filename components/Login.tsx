
import React, { useState } from 'react';
import { Key, ArrowRight, AlertCircle, ShieldCheck, Loader2, Mail } from 'lucide-react';
import { Language } from '../types';
import { t } from '../translations';
import Logo from './Logo';

interface LoginProps {
  lang: Language;
  onLogin: (licenseKey: string) => Promise<boolean>; 
  theme?: 'light' | 'dark';
}

const Login: React.FC<LoginProps> = ({ lang, onLogin, theme }) => {
  const [key, setKey] = useState('');
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    setError(false);

    try {
      const success = await onLogin(key);
      if (success) {
        setIsSuccess(true);
      } else {
        setError(true);
        setShaking(true);
        setTimeout(() => setShaking(false), 500);
      }
    } catch (err) {
      setError(true);
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
      return (
          <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
              <div className="text-center animate-in fade-in zoom-in-95 duration-700">
                  <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/30">
                      <ShieldCheck size={40} className="text-emerald-500" />
                  </div>
                  <h1 className="text-3xl font-bold text-white mb-2">Erişim Doğrulandı</h1>
                  <p className="text-slate-400">Bulut verileri senkronize ediliyor...</p>
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-20 pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)', backgroundSize: '30px 30px' }} 
      />
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-purple-500 to-blue-600 opacity-50"></div>

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 relative z-10 animate-in fade-in zoom-in-95 duration-500">
        
        <div className="flex flex-col items-center mb-10">
            {/* Dynamic theme for the login screen logo to stay matching with custom wrappers */}
            <Logo className="w-16 h-16 mb-4" theme={theme} />
            <h1 className="text-2xl font-bold text-white tracking-tight text-center">
              {t(lang, 'welcomeTitle')}
            </h1>
            <p className="text-slate-400 text-sm mt-2 text-center">
              Bulut tabanlı lisans kontrolü aktif
            </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
            <div className={`space-y-2 ${shaking ? 'animate-shake' : ''}`}>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                    {t(lang, 'passwordLabel')}
                </label>
                <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 group-focus-within:text-blue-500 transition-colors">
                        <Key size={18} />
                    </div>
                    <input 
                        type="password" 
                        value={key}
                        disabled={isLoading}
                        onChange={(e) => { setKey(e.target.value); setError(false); }}
                        className={`w-full bg-slate-950 border ${error ? 'border-red-500 focus:border-red-500' : 'border-slate-700 focus:border-blue-500'} rounded-lg py-3 pl-10 pr-4 text-white placeholder-slate-600 outline-none transition-all shadow-inner font-mono disabled:opacity-50`}
                        placeholder="ŞİFREYİ GİRİNİZ"
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

            <div className="flex flex-col gap-4">
                <button 
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-lg transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 group disabled:bg-slate-800 disabled:cursor-wait"
                >
                    {isLoading ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <>
                        {t(lang, 'loginBtn')}
                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                </button>

                <a 
                    href="mailto:alumetric@alumetric.net" 
                    className="flex items-center justify-center gap-2 text-[11px] text-slate-500 hover:text-blue-400 transition-colors py-2 group"
                >
                    <Mail size={12} className="group-hover:scale-110 transition-transform" />
                    {t(lang, 'noKeyContact')}
                </a>
            </div>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-800 text-center space-y-3">
            <p className="text-xs text-slate-500">
                &copy; {new Date().getFullYear()} Alumetric Cloud Licensing
            </p>
            <div className="text-[10px] text-slate-600 uppercase tracking-tighter">
                Güvenli Bulut Bağlantısı Sağlandı
            </div>
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
