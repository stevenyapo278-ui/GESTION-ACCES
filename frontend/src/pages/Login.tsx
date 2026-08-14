import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Database, Eye, EyeOff, Loader2, Moon, Sun, ShieldCheck, Mail, ArrowLeft } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { publicRequestsAPI } from '../services/api';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

export default function Login() {
  const { login } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');

  useEffect(() => {
    publicRequestsAPI.contact()
      .then((res) => setLogoUrl(res.data.logoUrl || ''))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }
    setIsLoading(true);
    try {
      await login(email, password);
      toast.success('Connexion réussie');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Échec de la connexion');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex relative overflow-hidden" style={{ background: isDark ? '#05070d' : '#f1f5f9' }}>
      {/* Blobs décoratifs */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className={`absolute -top-32 -left-24 size-[28rem] rounded-full blur-3xl ${isDark ? 'bg-blue-500/15' : 'bg-blue-400/15'}`} />
        <div className={`absolute bottom-0 right-0 size-[26rem] rounded-full blur-3xl ${isDark ? 'bg-gold-400/10' : 'bg-gold-400/20'}`} />
      </div>

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className={`absolute top-4 right-4 z-10 flex items-center justify-center size-10 rounded-xl transition-colors backdrop-blur ${
          isDark ? 'hover:bg-space-800 text-zinc-400' : 'hover:bg-zinc-200 text-zinc-600'
        }`}
      >
        {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
      </button>

      {/* Left panel — présentation */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-center px-16 relative">
        <div className="relative z-10 max-w-md">
          <div className="flex items-center gap-4 mb-10">
            {logoUrl ? (
              <div className="size-16 rounded-2xl overflow-hidden flex items-center justify-center bg-white/90 shadow-lg">
                <img src={logoUrl} alt="Logo" className="size-full object-contain p-1" />
              </div>
            ) : (
              <div className="size-16 bg-gradient-to-br from-gold-400 to-blue-500 rounded-2xl flex items-center justify-center shadow-lg shadow-gold-400/20">
                <Database className="size-8 text-white" />
              </div>
            )}
            <div>
              <h1 className="text-3xl font-bold text-white font-display">Gestions Access</h1>
              <p className="text-gold-400 mt-1 font-medium">Gestion des accès et des demandes</p>
            </div>
          </div>
          <h2 className="text-4xl font-bold text-white leading-tight">
            Vos demandes d'accès, <br />
            <span className="text-gradient">simplifiées.</span>
          </h2>
          <p className="text-zinc-400 text-lg leading-relaxed mt-5">
            Créez votre demande en quelques minutes, votre supérieur la valide par email,
            et l'équipe est notifiée automatiquement.
          </p>
          <div className="mt-12 flex items-start gap-4">
            <div className="size-10 shrink-0 rounded-xl bg-gold-400/10 border border-gold-400/30 flex items-center justify-center">
              <ShieldCheck className="size-5 text-gold-400" />
            </div>
            <p className="text-sm text-zinc-500 leading-relaxed">
              Chaque décision est tracée (identité du validateur, date et commentaire)
              et notifiée par email.
            </p>
          </div>
        </div>
      </div>

      {/* Right panel — formulaire */}
      <div className={`flex-1 flex items-center justify-center px-6 py-12 relative z-10 ${isDark ? 'bg-space-950' : 'bg-white'}`}>
        <div className="w-full max-w-sm animate-fade-in-up">
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            {logoUrl ? (
              <div className="size-12 rounded-xl overflow-hidden flex items-center justify-center bg-white shadow">
                <img src={logoUrl} alt="Logo" className="size-full object-contain p-0.5" />
              </div>
            ) : (
              <div className="size-12 bg-gradient-to-br from-gold-400 to-blue-500 rounded-xl flex items-center justify-center">
                <Database className="size-6 text-white" />
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold text-zinc-200">Gestions Access</h1>
            </div>
          </div>

          <div className={`rounded-2xl border p-8 shadow-2xl ${isDark ? 'bg-space-900/80 border-space-800/60 shadow-black/30' : 'bg-white border-zinc-200 shadow-zinc-200/60'}`}>
            <div className="mb-7 text-center">
              <div className={`mx-auto mb-5 size-16 rounded-2xl flex items-center justify-center overflow-hidden ${
                logoUrl ? '' : isDark ? 'bg-gold-400/10' : 'bg-gold-50'
              }`}>
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="size-full object-contain p-0.5" />
                ) : (
                  <Database className={`size-8 ${isDark ? 'text-gold-400' : 'text-gold-600'}`} />
                )}
              </div>
              <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Connexion</h2>
              <p className="text-sm text-zinc-500 mt-1">Accédez à votre espace de demandes</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label" htmlFor="email">Email ou identifiant</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
                  <input
                    id="email"
                    type="text"
                    inputMode="email"
                    autoComplete="username"
                    className="input !pl-9"
                    placeholder="vous@exemple.com ou votre identifiant"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="label" htmlFor="password">Mot de passe</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    className="input pr-10"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={isLoading} className="btn-primary w-full py-3 cursor-pointer disabled:opacity-60 disabled:pointer-events-none">
                {isLoading ? <Loader2 className="size-5 animate-spin" /> : <ShieldCheck className="size-5" />}
                Se connecter
              </button>
            </form>

            <Link to="/" className="mt-6 inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
              <ArrowLeft className="size-3.5" />
              Retour à l'accueil
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
