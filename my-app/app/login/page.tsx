'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    if (user.role === 'admin') router.replace('/admin');
    else if (user.role === 'territorial_design_manager') router.replace('/tdm/register');
    else if (user.role === 'dqc_manager') router.replace('/dqc-manager/register');
    else if (user.role === 'mmt_manager') router.replace('/mmt-manager/register');
    else router.replace('/');
  }, [user, loading, router]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-white"><p className="text-gray-500">Loading…</p></div>;
  if (user) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const result = await login(email.trim(), password);
    setSubmitting(false);
    if (!result.success) {
      setError(result.message || 'Login failed');
      return;
    }
    const role = result.user.role;
    if (role === 'admin') router.replace('/admin');
    else if (role === 'territorial_design_manager') router.replace('/tdm/register');
    else if (role === 'dqc_manager') router.replace('/dqc-manager/register');
    else if (role === 'mmt_manager') router.replace('/mmt-manager/register');
    else router.replace('/');
  }

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left panel - Login form */}
      <div className="flex-1 flex items-center justify-center p-8 md:p-12">
        <div className="w-full max-w-[380px]">
          <h1 className="text-3xl font-bold text-black mb-2">Welcome back!</h1>
          <p className="text-gray-500 text-sm mb-8">
            Simplify your workflow and boost your productivity with Design Module. Use your @hubinterior.com account.
          </p>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
            )}
            <div>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3.5 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                placeholder="Username"
                required
                autoComplete="email"
              />
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3.5 pr-12 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                placeholder="Password"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.228 3.228m3.228 3.228 3 3m-9-9 3.228-3.228" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                )}
              </button>
            </div>
            <div className="flex justify-end">
              <a href="#" className="text-sm text-gray-500 hover:text-gray-700">Forgot Password?</a>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-xl bg-black text-white font-medium hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-60 transition-colors"
            >
              {submitting ? 'Signing in…' : 'Login'}
            </button>
          </form>
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-3 text-gray-500">or continue with</span>
            </div>
          </div>
          <div className="flex justify-center gap-4">
            <button type="button" className="w-12 h-12 rounded-full bg-black text-white flex items-center justify-center hover:bg-gray-800 transition-colors" aria-label="Google">
              <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            </button>
            <button type="button" className="w-12 h-12 rounded-full bg-black text-white flex items-center justify-center hover:bg-gray-800 transition-colors" aria-label="Apple">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
            </button>
            <button type="button" className="w-12 h-12 rounded-full bg-black text-white flex items-center justify-center hover:bg-gray-800 transition-colors" aria-label="Facebook">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            </button>
          </div>
          <p className="text-gray-500 text-sm mt-8 text-center">
            Not a member? <span className="text-green-600 font-medium">Contact your Admin or TDM for access</span>
          </p>
        </div>
      </div>

      {/* Right panel - Illustration / marketing */}
      <div className="hidden lg:flex flex-1 bg-[#e8f5e9] min-h-screen items-center justify-center p-12 relative overflow-hidden">
        <div className="max-w-md w-full relative">
          {/* Decorative waves */}
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-full h-full max-w-md max-h-md text-emerald-300/60" viewBox="0 0 400 400" fill="none">
              <path d="M50 200 Q150 80 250 200 T450 200" stroke="currentColor" strokeWidth="2" fill="none" className="opacity-70"/>
              <path d="M30 250 Q130 130 230 250 T430 250" stroke="currentColor" strokeWidth="2" fill="none" className="opacity-50"/>
              <path d="M70 150 Q170 30 270 150 T470 150" stroke="currentColor" strokeWidth="2" fill="none" className="opacity-60"/>
            </svg>
          </div>
          {/* Central figure - simplified meditative pose */}
          <div className="relative flex justify-center items-center py-16">
            <div className="w-48 h-56 flex flex-col items-center">
              <div className="w-20 h-20 rounded-full bg-emerald-200/80 border-4 border-emerald-300 mb-2" />
              <div className="w-32 h-24 rounded-t-full bg-emerald-100 border-2 border-emerald-200" />
              <div className="w-40 h-16 rounded-b-full bg-emerald-100 border-2 border-emerald-200 -mt-2" />
            </div>
            {/* Side avatars */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white border-2 border-emerald-200 shadow-sm" />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white border-2 border-emerald-200 shadow-sm" />
          </div>
          {/* Task card overlay */}
          <div className="relative bg-white rounded-2xl shadow-lg p-4 border border-emerald-100 max-w-[220px] mx-auto -mt-8">
            <p className="font-semibold text-gray-800 text-sm">Design Module</p>
            <p className="text-gray-500 text-xs mt-0.5">Leads & milestones</p>
            <div className="flex items-center gap-2 mt-3">
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full w-[84%] bg-emerald-500 rounded-full" />
              </div>
              <span className="text-xs font-medium text-gray-600">84%</span>
            </div>
            <button type="button" className="mt-3 w-full py-2 rounded-lg bg-emerald-500 text-white text-xs font-medium hover:bg-emerald-600">
              Design
            </button>
          </div>
          {/* Pagination dots */}
          <div className="flex justify-center gap-2 mt-8">
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            <span className="w-2 h-2 rounded-full bg-emerald-200" />
            <span className="w-2 h-2 rounded-full bg-emerald-200" />
          </div>
          {/* Tagline */}
          <p className="text-center text-gray-800 font-medium mt-6 text-lg">
            Make your work easier and organized with Design Module
          </p>
        </div>
      </div>
    </div>
  );
}
