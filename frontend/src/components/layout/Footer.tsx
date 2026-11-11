'use client';

import React from 'react';
import Link from 'next/link';
import { Stethoscope, ShieldCheck, HeartHandshake } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-navy-900 text-white mt-auto border-t border-navy-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="space-y-4 md:col-span-1">
            <Link href="/" className="inline-block bg-white px-2.5 py-1.5 rounded-xl shadow-xs hover:opacity-95 transition">
              <img src="/logo.png" alt="MedConsults - Book Consult Care" className="h-7 w-auto object-contain" />
            </Link>
            <p className="text-sm text-gray-300 leading-relaxed">
              Dedicated practice management & direct booking for verified independent doctors and dentists.
            </p>
          </div>

          {/* For Patients */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-primary-100 mb-4">
              For Patients
            </h4>
            <ul className="space-y-2.5 text-sm text-gray-300">
              <li>
                <Link href="/doctors" className="hover:text-white transition">
                  Find Doctors & Specialists
                </Link>
              </li>
              <li>
                <Link href="/patient/appointments" className="hover:text-white transition">
                  Manage Appointments
                </Link>
              </li>
              <li>
                <Link href="/patient/dependents" className="hover:text-white transition">
                  Family Booking
                </Link>
              </li>
            </ul>
          </div>

          {/* For Doctors */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-primary-100 mb-4">
              For Doctors & Clinics
            </h4>
            <ul className="space-y-2.5 text-sm text-gray-300">
              <li>
                <Link href="/register?role=doctor" className="hover:text-white transition">
                  Claim Practice Booking Page
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-white transition">
                  Doctor Login
                </Link>
              </li>
              <li>
                <Link href="/doctor/dashboard" className="hover:text-white transition">
                  Today&apos;s Queue Dashboard
                </Link>
              </li>
            </ul>
          </div>

          {/* Trust & Guarantees */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-primary-100 mb-4">
              Security & Privacy
            </h4>
            <div className="flex items-center gap-2 text-xs text-gray-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>AES-256-GCM Encrypted Consultation Notes</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-300">
              <HeartHandshake className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Zero Overlap Database Guarantee</span>
            </div>
          </div>
        </div>

        {/* Emergency Medical Disclaimer per PRD §4.10 */}
        <div className="pt-8 border-t border-navy-800 text-xs text-gray-400 space-y-2 text-center md:text-left">
          <p className="bg-navy-800/60 p-3 rounded-lg border border-navy-700/60 text-amber-200">
            ⚠️ <strong>Medical Notice:</strong> Medconsults is an appointment booking and practice-management tool. We do not provide emergency medical services. In a medical emergency, please contact your local emergency services or visit the nearest emergency room immediately.
          </p>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-3">
            <p>© 2026 Medconsults. All rights reserved.</p>
            <div className="flex gap-6">
              <span className="hover:text-white cursor-pointer transition">Privacy Policy</span>
              <span className="hover:text-white cursor-pointer transition">Terms of Service</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
