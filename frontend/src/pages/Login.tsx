import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { EnvelopeIcon, BuildingOfficeIcon, SparklesIcon, BoltIcon } from '@heroicons/react/24/outline';

export function Login() {
  const { login, isLoading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    setAnimate(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await login(email);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-primary-100/50 rounded-full blur-3xl animate-pulse-soft" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-100/50 rounded-full blur-3xl animate-pulse-soft" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-green-100/50 rounded-full blur-3xl animate-pulse-soft" style={{ animationDelay: '2s' }} />
      </div>

      <div className={`relative max-w-md w-full space-y-8 bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-xl border border-gray-200/50 animate-fade-in ${animate ? 'animate-slide-in-left' : ''}`}>
        {/* Logo & Title */}
        <div className="text-center">
          <div className={`mx-auto h-16 w-16 bg-gradient-to-br from-primary-500 to-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-primary-500/25 ${animate ? 'animate-scale-in' : ''}`}>
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14m14 0H7m0 0l-5 5m0 0l5 5m-5-5h14" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Welcome to SponsyBot</h1>
          <p className="mt-2 text-gray-600">Sign in to manage sponsorships</p>
          <div className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
            Local Development Mode (Node.js Backend)
          </div>
        </div>

        {/* Features highlights */}
        <div className="grid grid-cols-3 gap-4 mb-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="p-3 bg-gray-50 rounded-xl text-center hover:bg-gray-100 transition-colors">
            <BuildingOfficeIcon className="w-6 h-6 text-primary-600 mx-auto mb-1" />
            <p className="text-xs font-medium text-gray-700">Sponsors</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl text-center hover:bg-gray-100 transition-colors">
            <BoltIcon className="w-6 h-6 text-yellow-500 mx-auto mb-1" />
            <p className="text-xs font-medium text-gray-700">Automation</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl text-center hover:bg-gray-100 transition-colors">
            <SparklesIcon className="w-6 h-6 text-purple-500 mx-auto mb-1" />
            <p className="text-xs font-medium text-gray-700">AI Powered</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="animate-fade-in" style={{ animationDelay: '0.15s' }}>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email address
            </label>
            <div className="relative">
              <EnvelopeIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 bg-white"
                placeholder="john@club.org"
                disabled={isLoading}
              />
            </div>
          </div>

          {error && (
            <div className="text-red-600 text-sm text-center bg-red-50 p-3 rounded-lg animate-slide-in" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || authLoading}
            className="w-full py-3 px-4 bg-gradient-to-r from-primary-600 to-blue-600 text-white rounded-lg font-medium text-sm hover:from-primary-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-primary-500/25"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Signing in...
              </span>
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <p>Demo accounts:</p>
          <p className="text-xs text-gray-400 mt-1">john@club.org (Sponsorship Lead)</p>
          <p className="text-xs text-gray-400">jane@club.org (Team Member)</p>
        </div>
      </div>

      {/* Floating decorative elements */}
      <div className="absolute bottom-8 right-8 opacity-20 animate-pulse-soft" style={{ animationDelay: '0.5s' }}>
        <SparklesIcon className="w-8 h-8 text-primary-500" />
      </div>
      <div className="absolute top-8 left-8 opacity-20 animate-pulse-soft" style={{ animationDelay: '1.5s' }}>
        <BoltIcon className="w-8 h-8 text-blue-500" />
      </div>
    </div>
  );
}

export default Login;