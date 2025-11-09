import dynamic from 'next/dynamic';

// Dynamic import with SSR disabled to avoid useSearchParams prerendering issue
const DashboardClient = dynamic(() => import('./DashboardClient'), { 
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Dashboard wordt geladen...</p>
      </div>
    </div>
  )
});

export default function DashboardPage() {
  return <DashboardClient />;
}
