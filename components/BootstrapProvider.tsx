'use client';

import { useEffect, useRef } from 'react';
import { bootstrapServices } from '@/lib/bootstrap';
import { registerServiceWorker } from '@/lib/swRegistration';

export function BootstrapProvider({ children }: { children: React.ReactNode }) {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    bootstrapServices();
    registerServiceWorker();
  }, []);

  return <>{children}</>;
}
