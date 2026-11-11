'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { client } from '@/lib/api/client';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('Invalid or expired verification token.');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMsg('No verification token provided in the URL.');
      return;
    }

    let isMounted = true;

    async function verify() {
      try {
        await client.post('/auth/verify-email', { token });
        if (isMounted) setStatus('success');
      } catch (err: any) {
        if (isMounted) {
          setStatus('error');
          setErrorMsg(err.response?.data?.error?.message || 'Verification token is invalid or has expired.');
        }
      }
    }

    verify();

    return () => {
      isMounted = false;
    };
  }, [token]);

  return (
    <div className="w-full max-w-md p-8 rounded-3xl bg-surface border border-gray-100 shadow-xl text-center space-y-6">
      {status === 'loading' && (
        <div className="space-y-4">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto" />
          <h1 className="text-xl font-bold text-navy-900">Verifying your email...</h1>
          <p className="text-xs text-text-muted">Please wait while we confirm your account security credentials.</p>
        </div>
      )}

      {status === 'success' && (
        <div className="space-y-5">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight">Email Verified!</h1>
            <p className="text-sm text-text-muted">
              Your email address has been verified. You can now log in and access your consultations and bookings.
            </p>
          </div>
          <Link
            href="/login"
            className="w-full py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm shadow-md transition flex items-center justify-center gap-2"
          >
            <span>Continue to Sign In</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-5">
          <div className="w-16 h-16 rounded-full bg-red-100 text-danger-600 flex items-center justify-center mx-auto shadow-xs">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight">Verification Failed</h1>
            <p className="text-sm text-text-muted">{errorMsg}</p>
          </div>
          <Link
            href="/login"
            className="w-full py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-text-main font-semibold text-sm block transition"
          >
            Return to Login
          </Link>
        </div>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <Navbar />
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <Suspense fallback={<div className="text-sm text-text-muted">Loading verification...</div>}>
          <VerifyEmailContent />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}

