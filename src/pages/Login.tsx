import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import simplifyStructLogo from '../assets/simplifystruct-logo.png';
import { useWebsiteStyleSettings } from '../utils/websiteStyle';

type AuthMode = 'signin' | 'create';

export const Login: React.FC = () => {
  const { user, login, createAccount, authConfigured } = useAuth();
  const navigate = useNavigate();
  const { isDesktopStyle, isDesktopGlass } = useWebsiteStyleSettings();
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage('');

    if (authMode === 'create' && password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (authMode === 'create') {
        await createAccount(email, password, inviteCode);
      } else {
        await login(email, password);
      }

      navigate('/', { replace: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to continue.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchMode = (mode: AuthMode) => {
    setAuthMode(mode);
    setErrorMessage('');
    setPassword('');
    setConfirmPassword('');
    setInviteCode('');
  };

  if (isDesktopStyle) {
    return (
      <div className="ss-shell relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
        {isDesktopGlass && (
          <>
            <span className="ss-orb left-10 top-16 h-80 w-80 bg-blue-500/25" />
            <span className="ss-orb right-10 top-24 h-96 w-96 bg-purple-500/20" />
            <span className="ss-orb bottom-12 left-1/2 h-72 w-72 bg-amber-500/10" />
          </>
        )}

        <div className="relative w-full max-w-5xl">
          <div className="mb-10 text-center">
            <div className="mb-6 flex justify-center">
              <img src={simplifyStructLogo} alt="SimplifyStruct logo" className="h-16 max-w-[300px] rounded-xl bg-white/90 object-contain p-2" />
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-white md:text-6xl">
              SimplifyStruct. Now in Desktop Style.
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-slate-300">
              A darker, glass-based workspace for structural design, documents, and visual maps.
            </p>
          </div>

          <div className="mx-auto max-w-md rounded-[2rem] border border-white/15 bg-white/10 p-8 shadow-2xl backdrop-blur-3xl">
            <div className="mb-8 flex gap-2">
              <span className="ss-window-dot bg-red-400" />
              <span className="ss-window-dot bg-amber-300" />
              <span className="ss-window-dot bg-green-400" />
            </div>

            <div className="mb-6 flex justify-center">
              <div className="rounded-2xl border border-white/15 bg-black/30 p-3 text-white">
                <Sparkles size={24} />
              </div>
            </div>

            <h2 className="text-center text-2xl font-bold text-white">
              {authMode === 'create' ? 'Create a SimplifyStruct account' : 'Sign in to SimplifyStruct'}
            </h2>
            <p className="mt-3 text-center text-slate-300">
              {authMode === 'create'
                ? 'Create a tester account using the signup code.'
                : 'Sign in with your SimplifyStruct account.'}
            </p>

            <div className="mt-6 grid grid-cols-2 rounded-xl border border-white/10 bg-black/25 p-1">
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                  authMode === 'signin' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-300 hover:text-white'
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => switchMode('create')}
                className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                  authMode === 'create' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-300 hover:text-white'
                }`}
              >
                Create account
              </button>
            </div>

            {!authConfigured && (
              <div className="mt-6 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-200">
                Firebase is not configured yet. Add the Firebase environment variables in Vercel, then redeploy.
              </div>
            )}

            {errorMessage && (
              <div className="mt-6 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <label className="block text-sm font-medium text-slate-200">
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </label>

              <label className="block text-sm font-medium text-slate-200">
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="Password"
                  autoComplete={authMode === 'create' ? 'new-password' : 'current-password'}
                  minLength={6}
                  required
                />
              </label>

              {authMode === 'create' && (
                <>
                  <label className="block text-sm font-medium text-slate-200">
                    Confirm password
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      className="mt-1 w-full rounded-xl border px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      placeholder="Confirm password"
                      autoComplete="new-password"
                      minLength={6}
                      required
                    />
                  </label>

                  <label className="block text-sm font-medium text-slate-200">
                    Signup code
                    <input
                      type="text"
                      value={inviteCode}
                      onChange={(event) => setInviteCode(event.target.value)}
                      className="mt-1 w-full rounded-xl border px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      placeholder="Enter invite code"
                      autoComplete="off"
                      required
                    />
                  </label>
                </>
              )}

              <button
                type="submit"
                disabled={!authConfigured || isSubmitting}
                className="w-full rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-950 shadow-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting
                  ? authMode === 'create'
                    ? 'Creating account...'
                    : 'Signing in...'
                  : authMode === 'create'
                    ? 'Create Account'
                    : 'Sign In'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="mb-6 flex justify-center">
          <img
            src={simplifyStructLogo}
            alt="SimplifyStruct logo"
            className="h-16 max-w-[280px] object-contain"
          />
        </div>

        <h1 className="text-center text-2xl font-bold text-gray-900">
          {authMode === 'create' ? 'Create a SimplifyStruct account' : 'Sign in to SimplifyStruct'}
        </h1>
        <p className="mt-3 text-center text-gray-500">
          {authMode === 'create'
            ? 'Create a tester account using the signup code.'
            : 'Sign in with your SimplifyStruct account.'}
        </p>

        <div className="mt-6 grid grid-cols-2 rounded-lg border border-gray-200 bg-gray-50 p-1">
          <button
            type="button"
            onClick={() => switchMode('signin')}
            className={`rounded-md px-3 py-2 text-sm font-semibold ${
              authMode === 'signin' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => switchMode('create')}
            className={`rounded-md px-3 py-2 text-sm font-semibold ${
              authMode === 'create' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            Create account
          </button>
        </div>

        {!authConfigured && (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Firebase is not configured yet. Add the Firebase environment variables in Vercel, then redeploy.
          </div>
        )}

        {errorMessage && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-gray-700">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>

          <label className="block text-sm font-medium text-gray-700">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              placeholder="Password"
              autoComplete={authMode === 'create' ? 'new-password' : 'current-password'}
              minLength={6}
              required
            />
          </label>

          {authMode === 'create' && (
            <>
              <label className="block text-sm font-medium text-gray-700">
                Confirm password
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="Confirm password"
                  autoComplete="new-password"
                  minLength={6}
                  required
                />
              </label>

              <label className="block text-sm font-medium text-gray-700">
                Signup code
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(event) => setInviteCode(event.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="Enter invite code"
                  autoComplete="off"
                  required
                />
              </label>
            </>
          )}

          <button
            type="submit"
            disabled={!authConfigured || isSubmitting}
            className="w-full rounded-md bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting
              ? authMode === 'create'
                ? 'Creating account...'
                : 'Signing in...'
              : authMode === 'create'
                ? 'Create Account'
                : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};
