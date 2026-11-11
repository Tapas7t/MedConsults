'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { client } from '@/lib/api/client';
import { tokenStore } from '@/lib/api/tokenStore';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Stethoscope, Lock, Mail, ArrowRight, AlertCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl');

  const { refetchUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLocked(false);
    setLoading(true);

    try {
      const res = await client.post('/auth/login', { email, password });
      const { accessToken, user } = res.data.data;
      tokenStore.set(accessToken);

      await refetchUser();
      toast.success(`Welcome back, ${user.name}!`);

      if (returnUrl) {
        router.push(returnUrl);
      } else if (user.role === 'doctor') {
        router.push('/doctor/dashboard');
      } else if (user.role === 'admin') {
        router.push('/admin/dashboard');
      } else {
        router.push('/patient/appointments');
      }
    } catch (err: any) {
      const errorData = err.response?.data?.error;
      const code = errorData?.code;
      const message = errorData?.message || 'Login failed. Please check your credentials.';

      if (code === 'ACCOUNT_LOCKED') {
        setIsLocked(true);
        setErrorMsg('Account locked due to 5 consecutive failed attempts. Please wait 15 minutes or reset your password.');
      } else if (code === 'INVALID_CREDENTIALS') {
        setErrorMsg('Invalid email or password.');
      } else {
        setErrorMsg(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-8 rounded-3xl bg-surface border border-gray-100 shadow-xl space-y-6">
      <div className="text-center space-y-3">
        <Link href="/" className="inline-block hover:opacity-90 transition">
          <img src="/logo.png" alt="MedConsults - Book Consult Care" className="h-9 w-auto mx-auto object-contain" />
        </Link>
        <div>
          <h1 className="text-xl font-extrabold text-navy-900 tracking-tight">Log in to your account</h1>
          <p className="text-xs text-text-muted mt-1">Enter your verified email and password to continue</p>
        </div>
      </div>

      {errorMsg && (
        <div
          className={`p-4 rounded-xl flex items-start gap-3 text-xs ${
            isLocked ? 'bg-amber-50 text-amber-900 border border-amber-200' : 'bg-red-50 text-danger-600 border border-red-100'
          }`}
        >
          {isLocked ? <Clock className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-main block">Email Address</label>
          <div className="relative">
            <Mail className="w-4 h-4 text-text-muted absolute left-3.5 top-3.5" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="doctor@clinic.com or patient@mail.com"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-text-main placeholder-text-muted focus:border-primary-600 focus:outline-hidden transition"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-text-main block">Password</label>
            <Link href="/forgot-password" className="text-xs font-medium text-primary-600 hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="w-4 h-4 text-text-muted absolute left-3.5 top-3.5" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-text-main placeholder-text-muted focus:border-primary-600 focus:outline-hidden transition"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm shadow-md transition flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <span>Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="pt-4 border-t border-gray-100 text-center space-y-2">
        <p className="text-xs text-text-muted">
          Don&apos;t have an account yet?{' '}
          <Link href="/register" className="font-semibold text-primary-600 hover:underline">
            Create an account
          </Link>
        </p>
        <p className="text-xs text-text-muted">
          Are you a practitioner?{' '}
          <Link href="/register?role=doctor" className="font-semibold text-emerald-600 hover:underline">
            Register as a Doctor / Dentist
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <Navbar />
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <Suspense fallback={<div className="text-sm text-text-muted">Loading sign in...</div>}>
          <LoginForm />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}

