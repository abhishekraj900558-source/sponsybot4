import React, { useState, createContext, useContext, ReactNode, useCallback } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
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
  ArrowLeftIcon,
  CpuChipIcon,
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

export function Layout() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

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
    { name: 'Agent', href: '/agent', icon: CpuChipIcon },
    { name: 'Sponsors', href: '/sponsors', icon: BuildingOfficeIcon },
    { name: 'Emails', href: '/emails', icon: EnvelopeIcon },
    { name: 'Meetings', href: '/meetings', icon: CalendarDaysIcon },
    { name: 'Settings', href: '/settings', icon: Cog6ToothIcon },
  ];

  return (
    <ToastProvider>
      <div className="min-h-screen bg-gray-50">
        {/* Mobile sidebar backdrop */}
        <div
          className={`fixed inset-0 z-40 bg-gray-900/50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          aria-label="Sidebar"
        >
          <div className="flex h-16 items-center justify-between px-4 border-b border-gray-200">
            <h1 className="text-xl font-bold text-primary-600">SponsyBot</h1>
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
                localStorage.removeItem('user');
                window.location.href = '/login';
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5" />
              Sign out
            </button>
          </div>
        </aside>

        {/* Main content */}
        <div className="lg:pl-64">
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

              <div className="flex items-center gap-4">
                <button className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700">
                  <BellIcon className="w-5 h-5" />
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center text-[10px]">3</span>
                </button>

                <div className="hidden sm:flex items-center gap-2">
                  <img
                    src="https://ui-avatars.com/api/?name=John+Doe&background=0ea5e9&color=fff"
                    alt="John Doe"
                    className="w-8 h-8 rounded-full"
                  />
                  <span className="text-sm font-medium text-gray-700">John Doe</span>
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