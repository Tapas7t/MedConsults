import React from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import {
  Search,
  CalendarCheck,
  ShieldCheck,
  MapPin,
  Clock,
  Sparkles,
  ArrowRight,
  QrCode,
  CheckCircle2,
} from 'lucide-react';

const POPULAR_SPECIALTIES = [
  'General Physician',
  'Dentist',
  'Dermatologist',
  'Cardiologist',
  'Pediatrician',
  'Orthopedic',
  'ENT Specialist',
  'Gynecologist',
];

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-canvas">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary-50/70 via-canvas to-canvas py-16 sm:py-24 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary-100/80 text-primary-800 text-xs font-semibold shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-primary-600" />
              <span>Direct In-Clinic Appointments • Pay at Clinic</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-navy-900 tracking-tight leading-[1.15]">
              Book verified doctors & dentists{' '}
              <span className="text-primary-600">in under 2 minutes.</span>
            </h1>

            <p className="text-lg sm:text-xl text-text-muted leading-relaxed font-normal max-w-2xl mx-auto">
              Skip the phone queues and crowded waiting rooms. Pick a time directly on your doctor&apos;s real-time calendar and get instant clinic confirmation.
            </p>

            {/* Direct Search Bar */}
            <form
              action="/doctors"
              method="GET"
              className="mt-8 p-2 sm:p-2.5 rounded-2xl bg-surface shadow-lg border border-gray-100 flex flex-col sm:flex-row gap-2"
            >
              <div className="flex-1 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-gray-50/70 border border-transparent focus-within:border-primary-500 focus-within:bg-white transition">
                <Search className="w-5 h-5 text-text-muted shrink-0" />
                <input
                  type="text"
                  name="q"
                  placeholder="Doctor name, specialty, or condition..."
                  className="w-full bg-transparent text-sm text-text-main placeholder-text-muted focus:outline-hidden"
                />
              </div>

              <div className="flex-1 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-gray-50/70 border border-transparent focus-within:border-primary-500 focus-within:bg-white transition">
                <MapPin className="w-5 h-5 text-text-muted shrink-0" />
                <input
                  type="text"
                  name="city"
                  placeholder="City or clinic locality (e.g. Mumbai)..."
                  className="w-full bg-transparent text-sm text-text-main placeholder-text-muted focus:outline-hidden"
                />
              </div>

              <button
                type="submit"
                className="px-6 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 shrink-0"
              >
                Find Doctors
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* Popular Specialties */}
            <div className="pt-4 flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs font-semibold text-text-muted mr-1">Popular:</span>
              {POPULAR_SPECIALTIES.map((spec) => (
                <Link
                  key={spec}
                  href={`/doctors?specialty=${encodeURIComponent(spec)}`}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg bg-surface border border-gray-200 hover:border-primary-500 hover:text-primary-700 transition shadow-2xs"
                >
                  {spec}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Core Value Props */}
      <section className="py-16 sm:py-20 bg-surface border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold text-navy-900 tracking-tight">
              Designed for in-clinic care, built for simplicity.
            </h2>
            <p className="text-sm sm:text-base text-text-muted mt-2">
              Everything you need to visit your doctor with confidence and zero hassle.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-canvas border border-gray-100 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <CalendarCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-navy-900">Guaranteed Real-Time Slots</h3>
              <p className="text-sm text-text-muted leading-relaxed">
                Our database overlap guards prevent double bookings. If a slot shows as available, it belongs to you the moment you book.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-canvas border border-gray-100 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-primary-100 text-primary-800 flex items-center justify-center">
                <MapPin className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-navy-900">Direct Directions & Reminders</h3>
              <p className="text-sm text-text-muted leading-relaxed">
                Receive clinic address details, map links, and timely email reminders 24 hours and 2 hours before your appointment.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-canvas border border-gray-100 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-navy-900">Encrypted Consultation Notes</h3>
              <p className="text-sm text-text-muted leading-relaxed">
                Doctor notes and visit reasons are encrypted at rest with military-grade AES-256-GCM. Private to you and your treating doctor.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Doctor Call-To-Action Banner */}
      <section className="py-16 bg-navy-900 text-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="bg-gradient-to-r from-primary-700/80 to-navy-800 rounded-3xl p-8 sm:p-12 border border-primary-500/20 shadow-xl flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="space-y-4 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-primary-100 text-xs font-semibold">
                <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                <span>For Independent Doctors & Dentists</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
                Run your clinic queue smoothly with your own booking link.
              </h2>
              <p className="text-gray-200 text-sm sm:text-base leading-relaxed">
                Get a dedicated booking page (<code className="text-emerald-300">medconsults.com/dr/your-name</code>), printable desk QR code, weekly schedule manager, and patient CRM. Zero marketplace commission.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-200 pt-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>One doctor = One clinic setup</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Patients pay directly at clinic</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Instant walk-in slot blocker</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Encrypted clinical patient notes</span>
                </div>
              </div>
            </div>

            <div className="shrink-0 flex flex-col sm:flex-row lg:flex-col gap-3 w-full sm:w-auto">
              <Link
                href="/register?role=doctor"
                className="px-6 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-center text-sm shadow-md transition"
              >
                Claim Your Practice Link
              </Link>
              <Link
                href="/login"
                className="px-6 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-center text-sm transition"
              >
                Doctor Sign In
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
