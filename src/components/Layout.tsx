import { useState, useRef, useEffect, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  FileText,
  LogOut,
  GraduationCap,
  Settings,
  Menu,
  X,
  Sun,
  Moon,
  ShieldCheck,
  BarChart3,
} from 'lucide-react';
import { useStore } from '../lib/store';
import { useTheme } from '../lib/useTheme';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { currentUser, logout, data, getCurrentDay } = useStore();
  const navigate = useNavigate();
  const { isDark, toggle } = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const currentDay = getCurrentDay();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isAdmin = currentUser?.role === 'admin';
  const isSupervisor = currentUser?.role === 'supervisor';
  const isStudent = currentUser?.role === 'student';

  const navItems = [
    ...(isStudent
      ? [
          { to: '/student', label: 'مهام اليوم', icon: LayoutDashboard },
          { to: '/student/days', label: 'جدول الأيام', icon: CalendarDays },
        ]
      : []),
    ...(isAdmin || isSupervisor
      ? [
          { to: '/dashboard', label: 'لوحة المتابعة', icon: LayoutDashboard },
          { to: '/students', label: 'الطلاب', icon: Users },
          { to: '/plan', label: 'الخطة اليومية', icon: CalendarDays },
          { to: '/reports', label: 'التقارير', icon: FileText },
          { to: '/analytics', label: 'تحليل البيانات', icon: BarChart3 },
        ]
      : []),
    ...(isAdmin ? [{ to: '/admin', label: 'لوحة الإدارة', icon: ShieldCheck }] : []),
    ...(isAdmin || isSupervisor ? [{ to: '/settings', label: 'الإعدادات', icon: Settings }] : []),
  ];

  const roleLabel = currentUser?.role === 'admin' ? 'مدير البرنامج' : currentUser?.role === 'supervisor' ? 'مشرف' : 'طالب';

  const sidebarContent = (
    <>
      <div className="px-5 py-5">
        <div className="flex items-center gap-3">
          <img
            src={`${import.meta.env.BASE_URL}logo.png`}
            alt="مُصلِح"
            className="w-11 h-11 rounded-2xl object-cover flex-shrink-0"
            style={{ boxShadow: '0 0 18px -4px var(--accent-glow)' }}
          />
          <div className="min-w-0">
            <div className="font-extrabold text-app text-base leading-tight tracking-tight">مُصلِح</div>
            <div className="text-[10px] text-dim font-medium truncate" style={{ maxWidth: '140px' }} title={data.config.programName}>{data.config.programName}</div>
          </div>
        </div>
      </div>

      <div className="mx-4 mb-4 p-4 rounded-2xl border" style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent-border)' }}>
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[11px] text-dim font-medium uppercase tracking-wide">اليوم الحالي</span>
          <span className="w-1.5 h-1.5 rounded-full breathe" style={{ background: 'var(--accent)' }} />
        </div>
        <div className="flex items-baseline gap-1.5 mb-2.5">
          <span className="text-3xl font-extrabold tracking-tight" style={{ color: 'var(--accent)' }}>{currentDay}</span>
          <span className="text-sm text-dim font-medium">/ {data.config.totalDays}</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border-soft)' }}>
          <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${(currentDay / data.config.totalDays) * 100}%`, background: 'var(--accent)' }} />
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end
            onClick={() => setDrawerOpen(false)}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-300 ${isActive ? 'text-accent' : 'text-sub hover:text-app'}`
            }
            style={({ isActive }) => (isActive ? { background: 'var(--accent-soft)' } : {})}
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.div layoutId="nav-active" className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-7 rounded-full" style={{ background: 'var(--accent)' }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                )}
                <item.icon className={`w-5 h-5 flex-shrink-0 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-105'}`} />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-3">
        <div className="flex items-center gap-3 px-3 py-2.5 mb-1 rounded-2xl" style={{ background: 'var(--bg-soft)' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ background: 'var(--border)', color: 'var(--text-primary)' }}>
            {currentUser?.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-app truncate">{currentUser?.name}</div>
            <div className="text-[10px] text-dim">{roleLabel}</div>
          </div>
        </div>
        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm transition-all duration-300" style={{ color: 'var(--c-rose)' }}>
          <LogOut className="w-4 h-4 flex-shrink-0" />
          تسجيل الخروج
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen ambient-bg">
      <aside className="hidden lg:flex w-64 flex-col fixed h-full z-30 no-print" style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(20px)', borderLeft: '1px solid var(--glass-border)' }}>
        {sidebarContent}
      </aside>

      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="lg:hidden fixed inset-0 bg-black/40 z-40" onClick={() => setDrawerOpen(false)} />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 350, damping: 35 }}
              className="lg:hidden fixed top-0 right-0 h-full w-72 flex flex-col z-50 no-print"
              style={{ background: 'var(--bg-card)', borderLeft: '1px solid var(--border)' }}
            >
              <button onClick={() => setDrawerOpen(false)} className="absolute top-5 left-4 w-9 h-9 rounded-xl flex items-center justify-center z-10 transition-colors" style={{ background: 'var(--bg-soft)', color: 'var(--text-secondary)' }}>
                <X className="w-5 h-5" />
              </button>
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="lg:mr-64 min-h-screen">
        <header className="sticky top-0 z-20 px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3 no-print" style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--glass-border)' }}>
          {/* Right: hamburger (mobile) + page title */}
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setDrawerOpen(true)} className="lg:hidden w-9 h-9 rounded-xl flex items-center justify-center transition-colors flex-shrink-0" style={{ background: 'var(--bg-soft)', color: 'var(--text-secondary)' }}>
              <Menu className="w-[18px] h-[18px]" />
            </button>
            <h1 className="text-sm font-bold text-app truncate">{data.config.programName}</h1>
          </div>

          {/* Left: user name + dark mode */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <button onClick={toggle} className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors" style={{ background: 'var(--bg-soft)', color: 'var(--text-secondary)' }}>
              <AnimatePresence mode="wait">
                <motion.div key={isDark ? 'moon' : 'sun'} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
                  {isDark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
                </motion.div>
              </AnimatePresence>
            </button>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
