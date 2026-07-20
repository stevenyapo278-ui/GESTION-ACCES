import { useLocation } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';

const routeNames: Record<string, string> = {
  '/': 'Tableau de bord',
  '/tables': 'Tableaux',
  '/tables/new': 'Nouveau tableau',
  '/users': 'Utilisateurs',
};

export default function Header() {
  const location = useLocation();
  const { isDark } = useTheme();

  let currentName = routeNames[location.pathname] || 'Tableau';
  if (location.pathname.startsWith('/tables/') && !location.pathname.endsWith('/new')) {
    const segments = location.pathname.split('/');
    if (segments[segments.length - 1] === 'settings') {
      currentName = 'Paramètres du tableau';
    } else {
      currentName = 'Tableau';
    }
  }

  return (
    <div className={`hidden lg:flex sticky top-0 z-40 h-14 items-center border-b backdrop-blur-md px-6 ${
      isDark ? 'border-space-700/60 bg-space-900/95' : 'border-zinc-200 bg-white/95'
    }`}>
      <div className="flex items-center gap-3">
        <div className={`w-px h-5 ${isDark ? 'bg-space-700' : 'bg-zinc-200'}`} />
        <h1 className={`text-sm font-semibold ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
          {currentName}
        </h1>
      </div>
    </div>
  );
}
