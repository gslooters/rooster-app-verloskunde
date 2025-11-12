'use client';

import DashboardClient from './dashboard/DashboardClient';

/**
 * FIXED: Next.js dynamic() verwacht een default export
 * Deze file werd dynamisch geïmporteerd in wrapper.tsx maar had geen component export
 * Nu exporteert het DashboardClient als default export
 */
export default function DesignPageClient() {
  return <DashboardClient />;
}
