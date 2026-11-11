'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export function DoctorStatusGuard({ children }: { children: React.ReactNode }) {
  const { doctorProfile, loading, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && user?.role === 'doctor') {
      if (!doctorProfile || doctorProfile.status === 'draft') {
        if (pathname !== '/doctor/onboarding') {
          router.replace('/doctor/onboarding');
        }
      } else if (doctorProfile.status === 'pending_approval') {
        if (pathname !== '/doctor/pending') {
          router.replace('/doctor/pending');
        }
      }
    }
  }, [doctorProfile, loading, user, pathname, router]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium text-text-muted">Loading practice status...</p>
      </div>
    );
  }

  return <>{children}</>;
}

