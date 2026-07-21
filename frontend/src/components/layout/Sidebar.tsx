import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Table2,
  Users,
  LogOut,
  Database,
  Moon,
  Sun,
  ChevronLeft,
  HardDrive,
  FileText,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import clsx from 'clsx';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Tableau de bord', end: true },
  { to: '/tables', icon: Table2, label: 'Tableaux', end: true },
  { to: '/backups', icon: HardDrive, label: 'Sauvegardes', end: true },
];

const adminItems = [
  { to: '/users', icon: Users, label: 'Utilisateurs' },
  { to: '/documents', icon: FileText, label: 'Documents' },
];

export default function Sidebar({
  collapsed,
  onToggleCollapse,
  isMobile,
  onItemClick,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
  isMobile?: boolean;
  onItemClick?: () => void;
}) {
  const { user, logout, isAdmin } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Logo */}
      <div className={clsx(
        'flex h-14 items-center gap-3 flex-shrink-0 border-b',
        isDark ? 'border-space-700/60' : 'border-zinc-200'
      )}>
        <div className={clsx(
          'flex items-center gap-3',
          collapsed && !isMobile ? 'justify-center w-full px-2' : 'px-4 w-full'
        )}>
          <div className={clsx(
            'flex items-center justify-center flex-shrink-0',
            collapsed && !isMobile ? '' : ''
          )}>
            <div className="size-9 bg-gradient-to-br from-gold-400 to-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-gold-400/20">
              <Database className="size-5 text-white" />
            </div>
          </div>
          {(!collapsed || isMobile) && (
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-white truncate">Gestions Access</h1>
              <p className="text-[10px] text-zinc-500 truncate">Table Builder</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 min-h-0 overflow-y-auto py-4 px-2 space-y-1 scrollbar-hide">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onItemClick}
            className={({ isActive }) =>
              clsx(
                'nav-item group relative flex items-center gap-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                collapsed && !isMobile ? 'justify-center px-2 py-2' : 'px-3 py-2',
                isActive
                  ? 'bg-blue-500/15 text-accent-blue'
                  : isDark
                    ? 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
              )
            }
          >
            {({ isActive }) => (
              <>
                <span className={clsx(
                  'nav-active-bar absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full transition-all duration-200',
                  isActive ? 'bg-accent-blue opacity-100' : 'opacity-0'
                )} />
                <item.icon className="size-4 flex-shrink-0" />
                {(!collapsed || isMobile) && <span className="truncate">{item.label}</span>}
              </>
            )}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <div className={clsx('pt-4 pb-1', collapsed && !isMobile ? 'px-0' : 'px-3')}>
              {(!collapsed || isMobile) && (
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gold-400">
                  Administration
                </p>
              )}
            </div>
            {adminItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onItemClick}
                className={({ isActive }) =>
                  clsx(
                    'nav-item group relative flex items-center gap-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                    collapsed && !isMobile ? 'justify-center px-2 py-2' : 'px-3 py-2',
                    isActive
                      ? 'bg-gold-400/15 text-gold-400'
                      : isDark
                        ? 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                        : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={clsx(
                      'nav-active-bar absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full transition-all duration-200',
                      isActive ? 'bg-gold-400 opacity-100' : 'opacity-0'
                    )} />
                    <item.icon className="size-4 flex-shrink-0" />
                    {(!collapsed || isMobile) && <span className="truncate">{item.label}</span>}
                  </>
                )}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* Bottom section */}
      <div className={clsx(
        'flex-shrink-0 px-3 py-3 border-t',
        isDark ? 'border-space-700/60 bg-space-900' : 'border-zinc-200 bg-white'
      )}>
        {/* Theme toggle + collapse */}
        <div className={clsx(
          'flex items-center gap-1 mb-2',
          collapsed && !isMobile ? 'justify-center' : 'justify-between'
        )}>
          <button
            onClick={toggleTheme}
            className={clsx(
              'flex items-center justify-center size-8 rounded-lg transition-colors',
              isDark ? 'hover:bg-space-800 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-500'
            )}
            title={isDark ? 'Mode clair' : 'Mode sombre'}
          >
            {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>

          {!isMobile && (
            <button
              onClick={onToggleCollapse}
              className={clsx(
                'flex items-center justify-center size-8 rounded-lg transition-colors',
                isDark ? 'hover:bg-space-800 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-500'
              )}
              title={collapsed ? 'Développer' : 'Réduire'}
            >
              <ChevronLeft className={clsx('size-4 transition-transform', collapsed && 'rotate-180')} />
            </button>
          )}
        </div>

        {/* User */}
        <div className={clsx(
          'flex items-center gap-2.5',
          collapsed && !isMobile ? 'justify-center' : ''
        )}>
          <div className={clsx(
            'size-8 rounded-full flex items-center justify-center flex-shrink-0',
            user?.role === 'ADMIN'
              ? 'bg-gradient-to-br from-gold-400 to-blue-500'
              : 'bg-gradient-to-br from-blue-500 to-blue-700'
          )}>
            {user?.role === 'ADMIN' ? (
              <span className="text-white font-bold text-xs">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </span>
            ) : (
              <span className="text-white font-bold text-xs">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </span>
            )}
          </div>
          {(!collapsed || isMobile) && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate text-zinc-200">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-[10px] text-zinc-500 truncate capitalize">{user?.role?.toLowerCase()}</p>
            </div>
          )}
          <button
            onClick={logout}
            className={clsx(
              'p-1.5 rounded-lg transition-colors',
              isDark ? 'text-zinc-500 hover:text-red-400 hover:bg-red-500/10' : 'text-zinc-400 hover:text-red-500 hover:bg-red-50'
            )}
            title="Déconnexion"
          >
            <LogOut className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
