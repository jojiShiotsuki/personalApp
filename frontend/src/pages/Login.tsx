import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { LogIn, UserPlus, Eye, EyeOff, Loader2 } from 'lucide-react';

const inputClasses = cn(
  "w-full px-4 py-3 rounded-lg",
  "bg-stone-800/50 border border-stone-600/40",
  "text-[--exec-text] placeholder:text-[--exec-text-muted]",
  "focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/30 focus:border-[--exec-accent]/50",
  "transition-all text-sm"
);

export default function Login() {
  const { login, setup, needsSetup } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const isSetupMode = needsSetup;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;

    setError('');
    setIsLoading(true);

    try {
      if (isSetupMode) {
        if (password.length < 6) {
          setError('Password must be at least 6 characters');
          setIsLoading(false);
          return;
        }
        await setup(username.trim(), password);
      } else {
        await login(username.trim(), password);
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (isSetupMode) {
        setError(detail || 'Failed to create account');
      } else {
        setError(detail || 'Invalid username or password');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[--exec-bg] grain flex items-center justify-center p-4">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-br from-[--exec-accent]/5 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-to-tl from-[--exec-accent]/3 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[--exec-accent] to-[--exec-accent-dark] shadow-lg shadow-[--exec-accent]/20 mb-4">
            <span className="text-white text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>V</span>
          </div>
          <h1 className="text-2xl font-bold text-[--exec-text] tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            {isSetupMode ? 'Set Up Your Account' : 'Welcome Back'}
          </h1>
          <p className="text-sm text-[--exec-text-muted] mt-1.5">
            {isSetupMode
              ? 'Create your admin account to get started'
              : 'Sign in to your workspace'}
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-[--exec-surface] rounded-2xl border border-stone-600/40 shadow-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={inputClasses}
                placeholder="Enter your username"
                autoFocus
                autoComplete="username"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={cn(inputClasses, 'pr-10')}
                  placeholder={isSetupMode ? 'Create a password (min 6 chars)' : 'Enter your password'}
                  autoComplete={isSetupMode ? 'new-password' : 'current-password'}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[--exec-text-muted] hover:text-[--exec-text] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !username.trim() || !password.trim()}
              className={cn(
                "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold text-sm",
                "bg-gradient-to-r from-[--exec-accent] to-[--exec-accent-dark] text-white",
                "hover:shadow-lg hover:shadow-[--exec-accent]/25 transition-all duration-200",
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
              )}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isSetupMode ? (
                <UserPlus className="w-4 h-4" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              {isLoading
                ? (isSetupMode ? 'Creating Account...' : 'Signing In...')
                : (isSetupMode ? 'Create Account' : 'Sign In')}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-[--exec-text-muted] mt-6">
          Vertex CRM
        </p>
      </div>
    </div>
  );
}
