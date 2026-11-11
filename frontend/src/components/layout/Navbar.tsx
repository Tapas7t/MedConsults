'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Stethoscope, Calendar, Users, LogOut, Menu, X, Shield, Clock } from 'lucide-react';

export function Navbar() {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur-md border-b border-gray-100 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center group py-1">
            <img
              src="/logo.png"
              alt="MedConsults - Book • Consult • Care"
              className="h-8 sm:h-10 w-auto object-contain group-hover:opacity-90 transition"
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/doctors"
              className="text-sm font-medium text-text-muted hover:text-primary-600 transition"
            >
              Find Doctors & Dentists
            </Link>

            {user?.role === 'patient' && (
              <>
                <Link
                  href="/patient/appointments"
                  className="text-sm font-medium text-text-muted hover:text-primary-600 transition flex items-center gap-1.5"
                >
                  <Calendar className="w-4 h-4" />
                  My Appointments
                </Link>
                <Link
                  href="/patient/dependents"
                  className="text-sm font-medium text-text-muted hover:text-primary-600 transition flex items-center gap-1.5"
                >
                  <Users className="w-4 h-4" />
                  Family Dependents
                </Link>
              </>
            )}

            {user?.role === 'doctor' && (
              <>
                <Link
                  href="/doctor/dashboard"
                  className="text-sm font-medium text-text-muted hover:text-primary-600 transition flex items-center gap-1.5"
                >
                  <Clock className="w-4 h-4" />
                  Today&apos;s Queue
                </Link>
                <Link
                  href="/doctor/schedule"
                  className="text-sm font-medium text-text-muted hover:text-primary-600 transition flex items-center gap-1.5"
                >
                  <Calendar className="w-4 h-4" />
                  Schedule & Blocks
                </Link>
                <Link
                  href="/doctor/patients"
                  className="text-sm font-medium text-text-muted hover:text-primary-600 transition flex items-center gap-1.5"
                >
                  <Users className="w-4 h-4" />
                  Patient CRM
                </Link>
              </>
            )}

            {user?.role === 'admin' && (
              <>
                <Link
                  href="/admin/dashboard"
                  className="text-sm font-medium text-text-muted hover:text-primary-600 transition flex items-center gap-1.5"
                >
                  <Shield className="w-4 h-4" />
                  Admin Stats
                </Link>
                <Link
                  href="/admin/doctors"
                  className="text-sm font-medium text-text-muted hover:text-primary-600 transition"
                >
                  Doctor Approvals
                </Link>
              </>
            )}
          </nav>

          {/* User Auth Actions */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <Link
                  href={
                    user.role === 'doctor'
                      ? '/doctor/profile'
                      : user.role === 'admin'
                      ? '/admin/dashboard'
                      : '/patient/profile'
                  }
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary-50 text-primary-700 hover:bg-primary-100 transition text-sm font-medium"
                >
                  <div className="w-6 h-6 rounded-full bg-primary-600 text-white text-xs flex items-center justify-center font-bold">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span>{user.name}</span>
                  <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full bg-white/80 text-primary-700">
                    {user.role}
                  </span>
                </Link>
                <button
                  onClick={logout}
                  className="p-2 text-text-muted hover:text-danger-600 hover:bg-red-50 rounded-lg transition"
                  title="Log out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/register?role=doctor"
                  className="text-xs font-semibold text-primary-700 px-3 py-2 rounded-lg hover:bg-primary-50 transition"
                >
                  Doctor Portal
                </Link>
                <Link
                  href="/login"
                  className="text-sm font-medium text-text-main px-3.5 py-2 rounded-lg hover:bg-gray-100 transition"
                >
                  Log In
                </Link>
                <Link
                  href="/register"
                  className="text-sm font-semibold bg-primary-600 text-white px-4 py-2 rounded-xl hover:bg-primary-700 shadow-xs transition"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-text-muted hover:text-text-main hover:bg-gray-100 focus:outline-hidden"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-surface px-4 pt-3 pb-6 space-y-3">
          <Link
            href="/doctors"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-base font-medium text-text-main hover:text-primary-600"
          >
            Find Doctors
          </Link>

          {user?.role === 'patient' && (
            <>
              <Link
                href="/patient/appointments"
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2 text-base font-medium text-text-muted hover:text-primary-600"
              >
                My Appointments
              </Link>
              <Link
                href="/patient/dependents"
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2 text-base font-medium text-text-muted hover:text-primary-600"
              >
                Family Dependents
              </Link>
            </>
          )}

          {user?.role === 'doctor' && (
            <>
              <Link
                href="/doctor/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2 text-base font-medium text-text-muted hover:text-primary-600"
              >
                Today&apos;s Queue
              </Link>
              <Link
                href="/doctor/schedule"
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2 text-base font-medium text-text-muted hover:text-primary-600"
              >
                Schedule & Blocks
              </Link>
              <Link
                href="/doctor/patients"
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2 text-base font-medium text-text-muted hover:text-primary-600"
              >
                Patient CRM
              </Link>
              <Link
                href="/doctor/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2 text-base font-medium text-text-muted hover:text-primary-600"
              >
                Clinic Settings & QR
              </Link>
            </>
          )}

          {user?.role === 'admin' && (
            <>
              <Link
                href="/admin/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2 text-base font-medium text-text-muted hover:text-primary-600"
              >
                Admin Stats
              </Link>
              <Link
                href="/admin/doctors"
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2 text-base font-medium text-text-muted hover:text-primary-600"
              >
                Doctor Approvals
              </Link>
            </>
          )}

          <div className="pt-4 border-t border-gray-100 flex flex-col gap-2">
            {user ? (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-danger-600 hover:bg-red-50"
              >
                <LogOut className="w-4 h-4" />
                Sign Out ({user.name})
              </button>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-text-main"
                >
                  Log In
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2.5 rounded-xl bg-primary-600 text-sm font-semibold text-white shadow-xs"
                >
                  Sign Up (Patient)
                </Link>
                <Link
                  href="/register?role=doctor"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2 rounded-xl text-xs font-semibold text-primary-700 bg-primary-50"
                >
                  Doctor Onboarding Portal
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
