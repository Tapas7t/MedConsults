'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { client } from '@/lib/api/client';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Stethoscope, User, Mail, Phone, Lock, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRole = searchParams.get('role') === 'doctor' ? 'doctor' : 'patient';

  const [role, setRole] = useState<'patient' | 'doctor'>(initialRole);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [registeredSuccess, setRegisteredSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!consent) {
      setErrorMsg('You must agree to the Terms of Service and Privacy Policy to create an account.');
      return;
    }

    setLoading(true);

    try {
      await client.post('/auth/register', {
        name,
        email,
        phone,
        password,
        role,
      });

      setRegisteredSuccess(true);
      toast.success('Registration successful! Verification email sent.');
    } catch (err: any) {
      const errorData = err.response?.data?.error;
      const code = errorData?.code;
      const message = errorData?.message || 'Registration failed.';

      if (code === 'EMAIL_ALREADY_EXISTS') {
        setErrorMsg('An account with this email address already exists. Please log in.');
      } else {
        setErrorMsg(message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (registeredSuccess) {
    return (
      <div className="w-full max-w-md p-8 rounded-3xl bg-surface border border-gray-100 shadow-xl text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold text-navy-900 tracking-tight">Check your email</h2>
          <p className="text-sm text-text-muted leading-relaxed">
            We sent a verification link to <strong className="text-text-main">{email}</strong>. Please click the link to activate your account and start {role === 'doctor' ? 'setting up your clinic' : 'booking consultations'}.
          </p>
        </div>
        <div className="p-4 rounded-xl bg-primary-50 text-primary-900 text-xs text-left">
          💡 <strong>Tip for local testing:</strong> Check your server terminal or development logs for the generated Ethereal verification URL.
        </div>
        <Link
          href="/login"
          className="w-full py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm shadow-md block transition"
        >
          Proceed to Log In
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md p-8 rounded-3xl bg-surface border border-gray-100 shadow-xl space-y-6">
      <div className="text-center space-y-3">
        <Link href="/" className="inline-block hover:opacity-90 transition">
          <img src="/logo.png" alt="MedConsults - Book Consult Care" className="h-9 w-auto mx-auto object-contain" />
        </Link>
        <div>
          <h1 className="text-xl font-extrabold text-navy-900 tracking-tight">Create your account</h1>
          <p className="text-xs text-text-muted mt-1">Direct in-clinic appointments with zero commission</p>
        </div>
      </div>

      {/* Role Switcher */}
      <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-gray-100/80">
        <button
          type="button"
          onClick={() => setRole('patient')}
          className={`py-2 text-xs font-bold rounded-xl transition ${
            role === 'patient' ? 'bg-white text-navy-900 shadow-xs' : 'text-text-muted hover:text-text-main'
          }`}
        >
          Patient Account
        </button>
        <button
          type="button"
          onClick={() => setRole('doctor')}
          className={`py-2 text-xs font-bold rounded-xl transition ${
            role === 'doctor' ? 'bg-white text-emerald-800 shadow-xs' : 'text-text-muted hover:text-text-main'
          }`}
        >
          Doctor / Dentist
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 text-danger-600 border border-red-100 flex items-start gap-3 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-main block">
            {role === 'doctor' ? 'Dr. Full Name' : 'Full Name'}
          </label>
          <div className="relative">
            <User className="w-4 h-4 text-text-muted absolute left-3.5 top-3.5" />
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={role === 'doctor' ? 'Dr. Sarah Jenkins' : 'John Doe'}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-text-main placeholder-text-muted focus:border-primary-600 focus:outline-hidden transition"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-main block">Email Address</label>
          <div className="relative">
            <Mail className="w-4 h-4 text-text-muted absolute left-3.5 top-3.5" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-text-main placeholder-text-muted focus:border-primary-600 focus:outline-hidden transition"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-main block">Phone Number</label>
          <div className="relative">
            <Phone className="w-4 h-4 text-text-muted absolute left-3.5 top-3.5" />
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 9876543210"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-text-main placeholder-text-muted focus:border-primary-600 focus:outline-hidden transition"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-main block">Password (min 8 characters)</label>
          <div className="relative">
            <Lock className="w-4 h-4 text-text-muted absolute left-3.5 top-3.5" />
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-text-main placeholder-text-muted focus:border-primary-600 focus:outline-hidden transition"
            />
          </div>
        </div>

        <div className="flex items-start gap-2.5 pt-1">
          <input
            type="checkbox"
            id="consent"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 border-gray-300 mt-0.5 cursor-pointer"
          />
          <label htmlFor="consent" className="text-xs text-text-muted leading-relaxed cursor-pointer select-none">
            I agree to the <span className="text-primary-600 font-medium">Terms of Service</span> and{' '}
            <span className="text-primary-600 font-medium">Privacy Policy</span>. I acknowledge Medconsults does not provide emergency medical care.
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-3 rounded-xl text-white font-semibold text-sm shadow-md transition flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer ${
            role === 'doctor' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-primary-600 hover:bg-primary-700'
          }`}
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <span>{role === 'doctor' ? 'Register Practice' : 'Create Patient Account'}</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="pt-4 border-t border-gray-100 text-center">
        <p className="text-xs text-text-muted">
          Already registered?{' '}
          <Link href="/login" className="font-semibold text-primary-600 hover:underline">
            Log in to your account
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <Navbar />
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <Suspense fallback={<div className="text-sm text-text-muted">Loading register...</div>}>
          <RegisterForm />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}

