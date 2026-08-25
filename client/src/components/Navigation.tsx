import React, { useState, useRef, useEffect } from 'react';
import { LayoutDashboard, CalendarDays, Bed, Users, Settings, LogOut, Search, Bell, Menu, X, Star, ShieldCheck, Check, Trash2, BellOff, FileText, Receipt, Wallet, Scale, ChevronDown, ShieldAlert, Lock } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useNow } from '../hooks/useNow';
import { formatRelativeTime } from '../lib/relativeTime';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user, logout, can } = useAuth();
  const { t }     = useTranslation();

  // `permission` optionnel = item toujours visible à tout personnel authentifié (dashboard,
  // réservations...). Sinon filtré sur la même permission que celle qui protège la route
  // (App.tsx/ProtectedRoute) — évite d'afficher un lien menant à une redirection immédiate.
  const navGroups = [
    {
      key:   'general',
      label: t('nav.groupGeneral'),
      items: [
        { path: '/dashboard',    label: t('nav.dashboard'),    icon: LayoutDashboard },
        { path: '/reservations', label: t('nav.reservations'), icon: CalendarDays    },
        { path: '/rooms',        label: t('nav.rooms'),        icon: Bed             },
        { path: '/guests',       label: t('nav.guests'),       icon: Users           },
        // { path: '/amenities', label: t('nav.amenities'),    icon: Star            },
      ],
    },
    {
      key:   'accounting',
      label: t('nav.groupAccounting'),
      items: [
        { path: '/invoices',     label: t('nav.invoices'),     icon: FileText        },
        { path: '/expenses',     label: t('nav.expenses'),     icon: Receipt,        permission: 'expenses.view'       },
        { path: '/treasury',     label: t('nav.treasury'),     icon: Wallet,         permission: 'ledger.view_reports' },
        { path: '/reports',      label: t('nav.reports'),      icon: Scale,          permission: 'ledger.view_reports' },
      ],
    },
    {
      key:   'admin',
      label: t('nav.groupAdmin'),
      items: [
        { path: '/staff',        label: t('nav.staff'),        icon: ShieldCheck,    permission: 'staff.view'          },
        { path: '/settings',     label: t('nav.settings'),     icon: Settings        },
        { path: '/audit-log',    label: t('nav.auditLog'),     icon: ShieldAlert,    permission: 'auditLogs.view'      },
        { path: '/permissions',  label: t('nav.permissions'),  icon: Lock,           permission: 'permissions.manage'  },
      ],
    },
  ].map(group => ({ ...group, items: group.items.filter(i => !i.permission || can(i.permission)) }));

  // Le groupe contenant la page active s'ouvre automatiquement (au montage et à chaque
  // navigation) — jamais atterrir sur une page dont le groupe est replié. Les autres groupes
  // gardent l'état choisi par l'utilisateur.
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const active = navGroups.find(g => g.items.some(i => location.pathname.startsWith(i.path)));
    return new Set(active ? [active.key] : [navGroups[0].key]);
  });

  useEffect(() => {
    const active = navGroups.find(g => g.items.some(i => location.pathname.startsWith(i.path)));
    if (active) setOpenGroups(prev => prev.has(active.key) ? prev : new Set(prev).add(active.key));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const toggleGroup = (key: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    onClose();
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-[60] lg:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      <aside className={cn(
        "no-print fixed left-0 top-0 h-screen w-60 bg-surface-container-low border-r border-outline-variant flex flex-col z-[70] transition-transform duration-300 lg:translate-x-0 overflow-y-auto",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-8 flex items-center justify-between">
          <div>
            <h1 className="font-display italic text-primary text-3xl leading-none">Natura Lodge</h1>
            <p className="text-[10px] font-sans uppercase tracking-[0.2em] text-on-surface-variant opacity-70 mt-2">{t('nav.portal')}</p>
          </div>
          <button onClick={onClose} className="lg:hidden p-2 text-on-surface-variant hover:bg-teal-50 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

      <nav className="flex-1 px-4 space-y-1">
        {navGroups.map((group) => {
          const isOpen = openGroups.has(group.key);
          return (
            <div key={group.key}>
              <button
                onClick={() => toggleGroup(group.key)}
                className="w-full flex items-center justify-between px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 hover:text-on-surface-variant transition-colors"
              >
                {group.label}
                <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", isOpen ? "rotate-180" : "")} />
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-1 pb-2">
                      {group.items.map((item) => {
                        const isActive = location.pathname.startsWith(item.path);
                        return (
                          <button
                            key={item.path}
                            onClick={() => handleNavigate(item.path)}
                            className={cn(
                              "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 font-sans text-sm tracking-wide",
                              isActive
                                ? "bg-teal-50 text-primary font-semibold"
                                : "text-on-surface-variant hover:bg-surface-container-high"
                            )}
                          >
                            <item.icon className={cn("w-5 h-5", isActive ? "fill-primary/10" : "")} />
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

      <div className="p-4 mt-auto space-y-2">
        <div className="bg-stone-50 rounded-xl border border-outline-variant/30 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-teal-100 border border-outline-variant flex items-center justify-center shrink-0">
            {user?.avatar ? (
              <img src={user.avatar} className="w-full h-full object-cover rounded-full" alt="Profile" />
            ) : (
              <span className="text-xs font-bold text-primary">{user?.name?.split(' ').map(n => n[0]).join('') ?? 'U'}</span>
            )}
          </div>
          <div className="overflow-hidden flex-1">
            <p className="text-xs font-bold text-on-surface truncate">{user?.name ?? '—'}</p>
            <p className="text-[10px] text-primary uppercase font-semibold truncate">{user?.role ?? ''}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-on-surface-variant hover:bg-red-50 hover:text-red-500 transition-all font-sans text-sm"
        >
          <LogOut className="w-4 h-4" /> {t('nav.logout')}
        </button>
      </div>
    </aside>
    </>
  );
};

export const TopBar: React.FC<{ onMenuClick: () => void }> = ({ onMenuClick }) => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotification, clearAll } = useNotifications();
  const now = useNow();
  const { logout } = useAuth();
  const navigate   = useNavigate();
  const { t }      = useTranslation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <header className="no-print h-16 px-4 md:px-8 bg-white border-b border-outline-variant flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-4 flex-1">
        <button 
          onClick={onMenuClick}
          className="lg:hidden p-2 text-on-surface-variant hover:bg-teal-50 rounded-full transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        
        <div className="relative w-full max-w-md hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
          <input 
            className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-full text-sm font-sans focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-outline/70"
            placeholder={t('topbar.searchPlaceholder')}
            type="text"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Navigation Bell Dropdown Area */}
        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={cn(
              "p-2 text-on-surface-variant hover:bg-teal-50 rounded-full transition-colors relative",
              isDropdownOpen && "bg-teal-50 text-primary"
            )}
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-[8px] font-bold text-white flex items-center justify-center border border-white leading-none shadow-sm animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Elegant Dropdown Container */}
          <AnimatePresence>
            {isDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-3 w-80 md:w-96 bg-white rounded-2xl border border-stone-200 shadow-xl overflow-hidden flex flex-col z-50 origin-top-right"
              >
                {/* Dropdown Header */}
                <div className="p-4 bg-stone-50 border-b border-stone-100 flex items-center justify-between">
                  <div>
                    <h5 className="text-xs font-bold text-on-surface uppercase tracking-wider">{t('topbar.alertCenter')}</h5>
                    <p className="text-[9px] text-on-surface-variant/60 tracking-wider font-semibold uppercase">{t('topbar.unreadAlerts', { count: unreadCount })}</p>
                  </div>
                  {unreadCount > 0 && (
                    <button 
                      onClick={markAllAsRead}
                      className="text-[9px] font-bold text-primary hover:underline uppercase tracking-wider flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" /> {t('topbar.markAllRead')}
                    </button>
                  )}
                </div>

                {/* Dropdown List */}
                <div className="max-h-[320px] overflow-y-auto divide-y divide-stone-100 no-scrollbar">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center flex flex-col items-center justify-center text-stone-300">
                      <BellOff className="w-8 h-8 mb-2 stroke-1" />
                      <p className="text-xs font-semibold text-on-surface-variant/40">{t('topbar.quietDay')}</p>
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div 
                        key={notif.id}
                        className={cn(
                          "p-4 hover:bg-stone-50/75 transition-all cursor-pointer flex gap-3 relative group/item",
                          !notif.read && "bg-teal-50/20"
                        )}
                        onClick={() => markAsRead(notif.id)}
                      >
                        <div className={cn(
                          "w-2 h-2 rounded-full mt-1.5 shrink-0",
                          notif.source === 'direct' ? "bg-primary" : 
                          notif.source === 'ota' ? "bg-amber-500" : 
                          notif.source === 'system' ? "bg-red-500 animate-pulse" : "bg-teal-500"
                        )} />
                        
                        <div className="flex-1 space-y-1 pr-6">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[9px] font-bold text-on-surface-variant/40 uppercase tracking-widest">{notif.title}</span>
                            <span className="text-[9px] font-mono text-on-surface-variant/30">{formatRelativeTime(notif.createdAt, now)}</span>
                          </div>
                          <p className="text-xs font-medium text-on-surface leading-tight">{notif.subtitle}</p>
                          {notif.amount && notif.amount !== '--' && (
                            <p className="text-[10px] font-mono font-bold text-primary">{notif.amount}</p>
                          )}
                        </div>

                        {/* Dropdown individual actions */}
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/item:opacity-100 transition-opacity flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              clearNotification(notif.id);
                            }}
                            className="p-1 hover:bg-stone-100 rounded text-stone-400 hover:text-red-500 transition-colors"
                            title="Dismiss Notification"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Dropdown Footer */}
                {notifications.length > 0 && (
                  <div className="p-3 border-t border-stone-100 bg-stone-50 text-center">
                    <button 
                      onClick={clearAll}
                      className="text-[9px] font-bold text-on-surface-variant/50 hover:text-red-500 transition-colors uppercase tracking-widest"
                    >
                      {t('topbar.clearAllLogs')}
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="w-px h-6 bg-outline-variant"></div>
        <LanguageSwitcher />
        <div className="w-px h-6 bg-outline-variant"></div>
        <button onClick={handleLogout} className="p-2 text-on-surface-variant hover:bg-red-50 hover:text-red-500 rounded-full transition-colors" title={t('nav.logout')}>
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};
