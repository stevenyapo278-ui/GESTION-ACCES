import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Database, Eye, EyeOff, Loader2, Moon, Sun } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import toast from 'react-hot-toast';

export default function Login() {
  const { login } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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
    <div className="min-h-screen flex relative">
      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className={`absolute top-4 right-4 z-10 flex items-center justify-center size-10 rounded-xl transition-colors ${
          isDark ? 'hover:bg-space-800 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-500'
        }`}
      >
        {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
      </button>

      {/* Left panel — decorative */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-space-950">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
        <div className="relative flex flex-col justify-center px-16">
          <div className="flex items-center gap-4 mb-8">
            <div className="size-16 bg-gradient-to-br from-gold-400 to-blue-500 rounded-2xl flex items-center justify-center shadow-lg shadow-gold-400/20">
              <Database className="size-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white font-display">Gestions Access</h1>
              <p className="text-gold-400 mt-1 font-medium">Table Builder No-Code</p>
            </div>
          </div>
          <p className="text-zinc-400 text-lg leading-relaxed">
            Créez des tableaux dynamiques, <br />
            gérez vos données en toute simplicité, <br />
            sans écrire une ligne de code.
          </p>
          <div className="mt-12 grid grid-cols-3 gap-4">
            {['Tableau', 'Cartes', 'Kanban'].map((view) => (
              <div key={view} className="bg-white/5 backdrop-blur rounded-xl px-4 py-3 text-center border border-white/5">
                <p className="text-zinc-200 text-sm font-medium">{view}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className={`flex-1 flex items-center justify-center px-6 ${isDark ? 'bg-space-950' : 'bg-white'}`}>
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="lg:hidden flex items-center justify-center gap-3 mb-6">
              <div className="size-10 bg-gradient-to-br from-gold-400 to-blue-500 rounded-xl flex items-center justify-center">
                <Database className="size-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-zinc-200">Gestions Access</h1>
              </div>
            </div>
            <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Connexion</h2>
            <p className="text-zinc-500 mt-1">Connectez-vous à votre espace</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                className="input"
                placeholder="vous@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={isLoading} className="btn-primary w-full py-3">
              {isLoading ? <Loader2 className="size-5 animate-spin" /> : 'Se connecter'}
            </button>
          </form>

          <p className="text-center text-sm text-zinc-500 mt-6">
            Pas encore de compte ?{' '}
            <Link to="/register" className="text-accent-blue hover:underline font-medium">
              S'inscrire
            </Link>
          </p>

          {/* Demo credentials */}
          <div className={`mt-8 p-4 rounded-xl border ${isDark ? 'bg-space-900 border-space-700' : 'bg-slate-50 border-zinc-200'}`}>
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Comptes de démo</p>
            <div className="space-y-1.5 mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <p><span className="font-medium" style={{ color: 'var(--text-primary)' }}>Admin :</span> admin@example.com / admin123</p>
              <p><span className="font-medium" style={{ color: 'var(--text-primary)' }}>Éditeur :</span> editor@example.com / editor123</p>
              <p><span className="font-medium" style={{ color: 'var(--text-primary)' }}>Lecteur :</span> reader@example.com / reader123</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
