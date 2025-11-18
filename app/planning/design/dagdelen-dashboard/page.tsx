import { Suspense } from 'react';
import DagdelenDashboardClient from './DagdelenDashboardClient';

export const metadata = {
  title: 'Diensten per Dagdeel - Dashboard',
  description: 'Overzicht van 5 weken diensten per dagdeel',
};

export default function DagdelenDashboardPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Laden...</div>}>
      <DagdelenDashboardClient />
    </Suspense>
  );
}
