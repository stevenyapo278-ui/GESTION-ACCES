import { useLocation } from 'react-router-dom';
import { Database, Loader2 } from 'lucide-react';

export function PageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return (
    <div key={location.pathname} className="page-transition">
      {children}
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 bg-space-950">
      <div className="relative size-14">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-gold-400 to-blue-500 opacity-30 animate-ping" />
        <div className="relative size-full rounded-2xl bg-gradient-to-br from-gold-400 to-blue-500 flex items-center justify-center shadow-lg shadow-gold-400/20">
          <Database className="size-7 text-white" />
        </div>
      </div>
      <div className="h-1 w-44 overflow-hidden rounded-full bg-space-800">
        <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-gold-400 to-blue-500 animate-loading-bar" />
      </div>
      <p className="text-sm text-zinc-400">Chargement…</p>
    </div>
  );
}

export function ContentLoader() {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4">
      <div className="size-10 rounded-xl bg-gradient-to-br from-gold-400 to-blue-500 flex items-center justify-center shadow-lg shadow-gold-400/20">
        <Database className="size-5 text-white" />
      </div>
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <Loader2 className="size-4 animate-spin" />
        Chargement…
      </div>
    </div>
  );
}
