import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import Sidebar from './Sidebar';
import Header from './Header';
import { Menu, X } from 'lucide-react';

export default function Layout() {
  const { isDark } = useTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('gestions-access-sidebar-collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('gestions-access-sidebar-collapsed', String(sidebarCollapsed));
    } catch {}
  }, [sidebarCollapsed]);

  // Lock scroll on mobile when sidebar is open
  useEffect(() => {
    if (mobileSidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileSidebarOpen]);

  const sidebarWidth = sidebarCollapsed ? 'lg:w-16' : 'lg:w-64';
  const contentMargin = sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64';

  return (
    <div className={`min-h-screen relative ${isDark ? 'bg-space-950' : 'bg-gray-50'}`}>
      {/* Mobile overlay */}
      <div className={`fixed inset-0 z-50 lg:hidden ${mobileSidebarOpen ? '' : 'pointer-events-none'}`}>
        <div
          className={`fixed inset-0 backdrop-blur-sm transition-opacity duration-300 ${
            mobileSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          } ${isDark ? 'bg-space-950/80' : 'bg-slate-900/40'}`}
          onClick={() => setMobileSidebarOpen(false)}
        />
        <div
          className={`fixed inset-y-0 left-0 w-64 shadow-2xl border-r transition-transform duration-300 flex flex-col min-h-0 ${
            mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } ${isDark ? 'bg-space-900 border-space-700' : 'bg-white border-zinc-200'}`}
        >
          <div className="absolute top-3 right-3 z-10">
            <button
              onClick={() => setMobileSidebarOpen(false)}
              className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-space-800 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-500'}`}
            >
              <X className="size-4" />
            </button>
          </div>
          <Sidebar
            collapsed={false}
            onToggleCollapse={() => {}}
            isMobile
            onItemClick={() => setMobileSidebarOpen(false)}
          />
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className={`hidden lg:fixed lg:inset-y-0 lg:flex lg:flex-col transition-all duration-300 ${sidebarWidth}`}>
        <div className={`flex flex-col flex-grow min-h-0 border-r ${isDark ? 'bg-space-900 border-space-700/60' : 'bg-white border-zinc-200'}`}>
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        </div>
      </div>

      {/* Main content area */}
      <div className={`flex flex-col min-h-screen transition-all duration-300 ${contentMargin}`}>
        {/* Mobile header */}
        <div className={`sticky top-0 z-40 flex h-14 items-center justify-between border-b backdrop-blur-md px-4 lg:hidden ${
          isDark ? 'border-space-700/60 bg-space-900/90' : 'border-zinc-200 bg-white/95'
        }`}>
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className={`flex items-center justify-center size-8 rounded-lg ${isDark ? 'hover:bg-space-800 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-500'}`}
          >
            <Menu className="size-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="size-7 bg-gradient-to-br from-gold-400 to-blue-500 rounded-lg flex items-center justify-center">
              <svg className="size-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7M4 7c0-2 1-3 3-3h10c2 0 3 1 3 3M4 7h16" /></svg>
            </div>
            <span className={`text-sm font-semibold ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>Gestions Access</span>
          </div>
        </div>

        {/* Desktop header */}
        <Header />

        {/* Page content */}
        <main className="flex-1 min-w-0 relative">
          <div className="w-full p-5 lg:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
