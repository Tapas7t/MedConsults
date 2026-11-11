'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { client } from '@/lib/api/client';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Lock, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  if (!token) {
    return (
      <div className="w-full max-w-md p-8 rounded-3xl bg-surface border border-gray-100 shadow-xl text-center space-y-5">
        <div className="w-16 h-16 rounded-full bg-red-100 text-danger-600 flex items-center justify-center mx-auto shadow-xs">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-navy-900">Missing Reset Token</h1>
        <p className="text-xs text-text-muted">No password reset token was found in your link.</p>
        <Link
          href="/forgot-password"
          className="w-full py-2.5 rounded-xl bg-primary-600 text-white text-xs font-semibold block"
        >
          Request New Link
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setErrorMsg('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);

    try {
      await client.post('/auth/reset-password', {
        token,
        newPassword,
      });

      setResetSuccess(true);
      toast.success('Password updated successfully! Please log in.');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error?.message || 'Password reset failed or token expired.');
    } finally {
      setLoading(false);
    }
  };

  if (resetSuccess) {
    return (
      <div className="w-full max-w-md p-8 rounded-3xl bg-surface border border-gray-100 shadow-xl text-center space-y-5">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight">Password Reset Complete</h1>
        <p className="text-sm text-text-muted">
          Your password has been changed and all previous sessions have been revoked.
        </p>
        <Link
          href="/login"
          className="w-full py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm shadow-md block transition"
        >
          Continue to Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md p-8 rounded-3xl bg-surface border border-gray-100 shadow-xl space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight">Set new password</h1>
        <p className="text-xs text-text-muted">Choose a strong password with at least 8 characters.</p>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 text-danger-600 border border-red-100 flex items-start gap-3 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-main block">New Password</label>
          <div className="relative">
            <Lock className="w-4 h-4 text-text-muted absolute left-3.5 top-3.5" />
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-text-main placeholder-text-muted focus:border-primary-600 focus:outline-hidden transition"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-main block">Confirm New Password</label>
          <div className="relative">
            <Lock className="w-4 h-4 text-text-muted absolute left-3.5 top-3.5" />
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-text-main placeholder-text-muted focus:border-primary-600 focus:outline-hidden transition"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm shadow-md transition flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <span>Update Password</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <Navbar />
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <Suspense fallback={<div className="text-sm text-text-muted">Loading reset form...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}

