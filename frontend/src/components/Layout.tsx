import React, { useState, createContext, useContext, ReactNode, useCallback } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  HomeIcon,
  BuildingOfficeIcon,
  EnvelopeIcon,
  CalendarDaysIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  MagnifyingGlassIcon,
  BellIcon,
  UserCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

// Simple toast notification system
interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (message: string, type: Toast['type']) => void;
  removeToast: (id: number) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: Toast['type']) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border animate-slide-in ${
              toast.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-800'
                : toast.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-blue-50 border-blue-200 text-blue-800'
            }`}
            role="alert"
          >
            <span className="flex-1 text-sm">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-current opacity-50 hover:opacity-100"
              aria-label="Dismiss"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkAllNotificationsRead,
} from '../hooks/useApi';

export function Layout() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const navigate = useNavigate();

  const teamMemberId = Number(user?.id) || 1;
  const { data: notificationsData } = useNotifications(teamMemberId);
  const { data: unreadCountData } = useUnreadNotificationCount(teamMemberId);
  const markAllReadMutation = useMarkAllNotificationsRead(teamMemberId);

  const notificationsList: any[] = Array.isArray(notificationsData)
    ? notificationsData
    : (notificationsData as any)?.notifications || [];
  const unreadCount =
    typeof unreadCountData === 'number'
      ? unreadCountData
      : (unreadCountData as any)?.unread_count ??
        notificationsList.filter((n: any) => !n.is_read).length;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/sponsors?search=${encodeURIComponent(searchQuery.trim())}`);
      setShowSearchResults(false);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setShowSearchResults(value.length > 0);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setShowSearchResults(false);
  };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
    { name: 'Sponsors', href: '/sponsors', icon: BuildingOfficeIcon },
    { name: 'Emails', href: '/emails', icon: EnvelopeIcon },
    { name: 'Meetings', href: '/meetings', icon: CalendarDaysIcon },
    { name: 'Settings', href: '/settings', icon: Cog6ToothIcon },
  ];

  return (
    <ToastProvider>
      <div className="min-h-screen bg-gray-50 relative">
        {/* Cyan geometric squares background matching reference image */}
        <div
          className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage:
              "url('/bg-cyan-squares.png'), linear-gradient(35deg, #42f5ff 0%, #29c7e8 48%, #2286b6 100%)",
          }}
        >
          <svg
            className="w-full h-full opacity-55"
            viewBox="0 0 1440 900"
            preserveAspectRatio="xMidYMid slice"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Filled translucent squares */}
            <rect x="180" y="450" width="160" height="160" fill="white" fillOpacity="0.25" />
            <rect x="580" y="210" width="150" height="150" fill="white" fillOpacity="0.32" />
            <rect x="860" y="410" width="150" height="150" fill="white" fillOpacity="0.4" />
            <rect x="1000" y="510" width="170" height="170" fill="white" fillOpacity="0.28" />
            <rect x="820" y="610" width="150" height="150" fill="#a7f3d0" fillOpacity="0.3" />
            <rect x="210" y="10" width="140" height="140" fill="#99f6e4" fillOpacity="0.25" />
            {/* Outlined geometric squares */}
            <rect x="90" y="620" width="140" height="140" stroke="white" strokeOpacity="0.38" strokeWidth="14" />
            <rect x="220" y="160" width="120" height="120" stroke="white" strokeOpacity="0.32" strokeWidth="10" />
            <rect x="470" y="640" width="170" height="170" stroke="#0284c7" strokeOpacity="0.28" strokeWidth="16" />
            <rect x="610" y="480" width="150" height="150" stroke="#0369a1" strokeOpacity="0.22" strokeWidth="14" />
            <rect x="890" y="160" width="175" height="175" stroke="white" strokeOpacity="0.24" strokeWidth="16" />
            <rect x="1030" y="210" width="125" height="125" stroke="#a7f3d0" strokeOpacity="0.38" strokeWidth="12" />
            <rect x="1220" y="130" width="130" height="130" stroke="white" strokeOpacity="0.35" strokeWidth="14" />
            <rect x="1310" y="290" width="160" height="160" stroke="white" strokeOpacity="0.28" strokeWidth="10" />
            <rect x="1050" y="30" width="105" height="105" stroke="#67e8f9" strokeOpacity="0.45" strokeWidth="8" />
            <rect x="550" y="160" width="55" height="55" stroke="#6ee7b7" strokeOpacity="0.45" strokeWidth="7" />
          </svg>
        </div>

        {/* Mobile sidebar backdrop */}
        <div
          className={`fixed inset-0 z-40 bg-gray-900/50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-64 flex flex-col bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          aria-label="Sidebar"
        >
          <div className="flex h-16 items-center justify-between px-4 border-b border-gray-200">
            <h1 className="text-xl font-bold text-primary-600">Sponsoris</h1>
            <button
              className="lg:hidden p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`
                }
              >
                <item.icon className="w-5 h-5" aria-hidden="true" />
                {item.name}
              </NavLink>
            ))}
          </nav>

          <div className="p-4 border-t border-gray-200">
            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5" />
              Sign out
            </button>
          </div>
        </aside>

        {/* Main content */}
        <div className="lg:pl-64 relative z-10">
          {/* Top bar */}
          <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
            <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
              <button
                className="lg:hidden p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open sidebar"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <div className="flex-1 max-w-md mx-4 sm:mx-0">
                <form onSubmit={handleSearch} className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 transition-colors duration-200" />
                  <input
                    type="text"
                    placeholder="Search sponsors, emails, meetings..."
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    onFocus={() => setShowSearchResults(searchQuery.length > 0)}
                    onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
                    className="w-full pl-10 pr-12 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 bg-white"
                    autoComplete="off"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={clearSearch}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                      aria-label="Clear search"
                    >
                      <XMarkIcon className="w-5 h-5" />
                    </button>
                  )}
                </form>
                {showSearchResults && searchQuery && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50 animate-fade-in">
                    <div className="px-4 py-2 text-sm text-gray-500">
                      Press Enter to search for "{searchQuery}" in sponsors
                    </div>
                    <div className="border-t border-gray-100 px-4 py-2 text-sm text-primary-600 font-medium cursor-pointer hover:bg-gray-50" 
                         onClick={() => { navigate(`/sponsors?search=${encodeURIComponent(searchQuery.trim())}`); setShowSearchResults(false); }}
                    >
                      View all results →
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4 relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                  title="Reply & Outreach Notifications"
                >
                  <BellIcon className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute right-0 top-12 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
                    <div className="p-3.5 border-b border-gray-200 flex items-center justify-between">
                      <span className="text-sm font-bold text-gray-900">
                        Sponsor Reply & Outreach Alerts
                      </span>
                      {unreadCount > 0 && (
                        <button
                          onClick={() => markAllReadMutation.mutate()}
                          className="text-xs text-primary-600 hover:underline font-medium"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                      {notificationsList.length > 0 ? (
                        notificationsList.slice(0, 8).map((notif: any) => (
                          <div
                            key={notif.id}
                            onClick={() => {
                              setShowNotifications(false);
                              if (notif.sponsor_id) navigate(`/sponsors/${notif.sponsor_id}`);
                            }}
                            className={`p-3.5 hover:bg-gray-50 cursor-pointer text-xs ${
                              !notif.is_read ? 'bg-primary-50/20' : ''
                            }`}
                          >
                            <p className="font-semibold text-gray-900">{notif.title}</p>
                            <p className="text-gray-600 mt-0.5">{notif.message}</p>
                          </div>
                        ))
                      ) : (
                        <div className="p-6 text-center text-xs text-gray-500">
                          No new notifications. Alerts appear here when sponsors reply!
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="hidden sm:flex items-center gap-2">
                  <img
                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=0ea5e9&color=fff`}
                    alt={user?.name || 'User'}
                    className="w-8 h-8 rounded-full"
                  />
                  <span className="text-sm font-medium text-gray-700">{user?.name || 'User'}</span>
                </div>

                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center lg:hidden">
                  <UserCircleIcon className="w-5 h-5 text-primary-600" />
                </div>
              </div>
            </div>
          </header>

          <main className="p-4 sm:p-6 lg:p-8 animate-fade-in">
            <Outlet />
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}

// Add custom styles for animations
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fade-in {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes slide-in {
      from { opacity: 0; transform: translateX(100%); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes slide-in-left {
      from { opacity: 0; transform: translateX(-20px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes scale-in {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
    @keyframes pulse-soft {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
    .animate-fade-in { animation: fade-in 0.3s ease-out; }
    .animate-slide-in { animation: slide-in 0.3s ease-out; }
    .animate-slide-in-left { animation: slide-in-left 0.3s ease-out; }
    .animate-scale-in { animation: scale-in 0.2s ease-out; }
    .animate-pulse-soft { animation: pulse-soft 2s ease-in-out infinite; }
    .stagger-1 { animation-delay: 0.05s; }
    .stagger-2 { animation-delay: 0.1s; }
    .stagger-3 { animation-delay: 0.15s; }
    .stagger-4 { animation-delay: 0.2s; }
    .stagger-5 { animation-delay: 0.25s; }
    .stagger-6 { animation-delay: 0.3s; }
  `;
  document.head.appendChild(style);
}