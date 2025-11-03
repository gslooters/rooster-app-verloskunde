'use client';

export default function ServicesHubPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
          <div className="mb-8">
            <div className="flex items-center mb-4">
              <a href="/dashboard" className="text-blue-600 hover:text-blue-800 flex items-center mr-4">
                <span className="mr-1">←</span>
                Dashboard
              </a>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 flex items-center">
              <span className="text-2xl mr-3">💼</span>
              Diensten Beheren
            </h1>
            <p className="text-gray-600">Kies hieronder wat je wil doen.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <a href="/services/types" className="bg-purple-50 p-6 rounded-xl hover:bg-purple-100 transition shadow-sm hover:shadow-md">
              <div className="flex items-center mb-2">
                <span className="text-2xl mr-3">⚙️</span>
                <h3 className="font-bold text-purple-900 text-lg">Diensten beheren</h3>
              </div>
              <p className="text-purple-700">Huidige functie voor toevoegen/bewerken/verwijderen.</p>
            </a>

            <a href="/services/assignments" className="bg-green-50 p-6 rounded-xl hover:bg-green-100 transition shadow-sm hover:shadow-md">
              <div className="flex items-center mb-2">
                <span className="text-2xl mr-3">🧩</span>
                <h3 className="font-bold text-green-900 text-lg">Diensten Toewijzing</h3>
              </div>
              <p className="text-green-700">Koppel diensten aan medewerkers.</p>
            </a>

            <a href="/services/schedule-rules" className="bg-blue-50 p-6 rounded-xl hover:bg-blue-100 transition shadow-sm hover:shadow-md">
              <div className="flex items-center mb-2">
                <span className="text-2xl mr-3">📅</span>
                <h3 className="font-bold text-blue-900 text-lg">Diensten per dagsoort</h3>
              </div>
              <p className="text-blue-700">In ontwikkeling — later invullen.</p>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}