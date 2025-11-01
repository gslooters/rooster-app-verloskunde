export const dynamic = 'force-static';

export default function PlanningPage() {
  return (
    <main className="p-6">
      <nav className="text-sm text-gray-500 mb-4">Dashboard &gt; Rooster Planning</nav>
      <h1 className="text-2xl font-semibold mb-2">Rooster Planning</h1>
      <p className="text-gray-600 mb-6">Dit is het skelet voor de planning module.</p>
      <a href="/planning/new" className="px-4 py-2 bg-blue-600 text-white rounded">Nieuw rooster</a>
    </main>
  );
}
