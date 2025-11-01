'use client'

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              🏥 Rooster Dashboard Verloskunde
            </h1>
            <p className="text-gray-600">
              Welkom in het personeelsplanning systeem
            </p>
          </div>
          
          {/* Main Navigation Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {/* Rooster Planning Card */}
            <a 
              href="/planning" 
              className="bg-blue-50 p-6 rounded-xl hover:bg-blue-100 transition-all duration-300 cursor-pointer block shadow-sm hover:shadow-md transform hover:-translate-y-1"
            >
              <div className="flex items-center mb-3">
                <span className="text-2xl mr-3">📅</span>
                <h3 className="font-semibold text-blue-900 text-lg">Rooster Planning</h3>
              </div>
              <p className="text-blue-700 mb-2">Bekijk en bewerk roosters</p>
              <div className="text-sm text-blue-600">
                ✓ 5-weken overzicht<br/>
                ✓ Dienstcodering<br/>
                ✓ Export naar PDF/Excel
              </div>
            </a>

            {/* Medewerkers Card - Updated as requested */}
            <a 
              href="/employees" 
              className="bg-green-50 p-6 rounded-xl hover:bg-green-100 transition-all duration-300 cursor-pointer block shadow-sm hover:shadow-md transform hover:-translate-y-1"
            >
              <div className="flex items-center mb-3">
                <span className="text-2xl mr-3">👥</span>
                <h3 className="font-semibold text-green-900 text-lg">Medewerkers</h3>
              </div>
              <p className="text-green-700 mb-2">Beheer personeelsgegevens</p>
              <div className="text-sm text-green-600">
                ✓ Toevoegen/bewerken<br/>
                ✓ Status beheer<br/>
                ✓ Competenties
              </div>
            </a>
            
            {/* Diensten Card */}
            <a 
              href="/services" 
              className="bg-purple-50 p-6 rounded-xl hover:bg-purple-100 transition-all duration-300 cursor-pointer block shadow-sm hover:shadow-md transform hover:-translate-y-1"
            >
              <div className="flex items-center mb-3">
                <span className="text-2xl mr-3">⚕️</span>
                <h3 className="font-semibold text-purple-900 text-lg">Diensten</h3>
              </div>
              <p className="text-purple-700 mb-2">Configureer diensttypen</p>
              <div className="text-sm text-purple-600">
                ✓ Dag/Nacht/Echo diensten<br/>
                ✓ Kleurcodering<br/>
                ✓ Tijdsloten
              </div>
            </a>

            {/* Rapporten Card */}
            <a 
              href="/reports" 
              className="bg-orange-50 p-6 rounded-xl hover:bg-orange-100 transition-all duration-300 cursor-pointer block shadow-sm hover:shadow-md transform hover:-translate-y-1"
            >
              <div className="flex items-center mb-3">
                <span className="text-2xl mr-3">📊</span>
                <h3 className="font-semibold text-orange-900 text-lg">Rapporten</h3>
              </div>
              <p className="text-orange-700 mb-2">Overzichten en statistieken</p>
              <div className="text-sm text-orange-600">
                ✓ Uren per medewerker<br/>
                ✓ Bezettingsgraad<br/>
                ✓ Exporteerbaar
              </div>
            </a>

            {/* Instellingen Card */}
            <a 
              href="/settings" 
              className="bg-gray-50 p-6 rounded-xl hover:bg-gray-100 transition-all duration-300 cursor-pointer block shadow-sm hover:shadow-md transform hover:-translate-y-1"
            >
              <div className="flex items-center mb-3">
                <span className="text-2xl mr-3">⚙️</span>
                <h3 className="font-semibold text-gray-900 text-lg">Instellingen</h3>
              </div>
              <p className="text-gray-700 mb-2">Systeem configuratie</p>
              <div className="text-sm text-gray-600">
                ✓ Gebruikersbeheer<br/>
                ✓ Backup & Restore<br/>
                ✓ Notificaties
              </div>
            </a>

            {/* Nieuwe Rooster Card */}
            <a 
              href="/create-roster" 
              className="bg-indigo-50 p-6 rounded-xl hover:bg-indigo-100 transition-all duration-300 cursor-pointer block shadow-sm hover:shadow-md transform hover:-translate-y-1 border-2 border-indigo-200"
            >
              <div className="flex items-center mb-3">
                <span className="text-2xl mr-3">✨</span>
                <h3 className="font-semibold text-indigo-900 text-lg">Nieuw Rooster</h3>
              </div>
              <p className="text-indigo-700 mb-2">Start nieuwe planning</p>
              <div className="text-sm text-indigo-600">
                ✓ Snelle wizard<br/>
                ✓ Template gebruik<br/>
                ✓ Auto-verdeling
              </div>
            </a>
          </div>

          {/* Quick Actions */}
          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
              <span className="mr-2">⚡</span>
              Snelle Acties
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <button className="bg-white p-3 rounded-lg hover:bg-blue-50 transition-colors text-left shadow-sm">
                <div className="font-medium text-gray-900">📝 Laatste Rooster</div>
                <div className="text-sm text-gray-600">Week 44 - Bewerken</div>
              </button>
              <button className="bg-white p-3 rounded-lg hover:bg-green-50 transition-colors text-left shadow-sm">
                <div className="font-medium text-gray-900">👤 Nieuwe Medewerker</div>
                <div className="text-sm text-gray-600">Snel toevoegen</div>
              </button>
              <button className="bg-white p-3 rounded-lg hover:bg-purple-50 transition-colors text-left shadow-sm">
                <div className="font-medium text-gray-900">📋 Template</div>
                <div className="text-sm text-gray-600">Gebruik sjabloon</div>
              </button>
              <button className="bg-white p-3 rounded-lg hover:bg-orange-50 transition-colors text-left shadow-sm">
                <div className="font-medium text-gray-900">📤 Export</div>
                <div className="text-sm text-gray-600">PDF/Excel</div>
              </button>
            </div>
          </div>

          {/* Status & Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-green-50 rounded-lg p-6 border-l-4 border-green-500">
              <h3 className="font-medium text-green-800 mb-2 flex items-center">
                <span className="mr-2">✅</span>
                Systeem Status
              </h3>
              <div className="text-green-700 space-y-1 text-sm">
                <p>✓ App werkt lokaal</p>
                <p>✓ Database connectie actief</p>
                <p>✓ Alle modules geladen</p>
                <p>✓ Export functies beschikbaar</p>
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-6 border-l-4 border-blue-500">
              <h3 className="font-medium text-blue-800 mb-2 flex items-center">
                <span className="mr-2">ℹ️</span>
                Recente Activiteit
              </h3>
              <div className="text-blue-700 space-y-1 text-sm">
                <p>• Rooster week 44 bijgewerkt</p>
                <p>• 3 nieuwe medewerkers toegevoegd</p>
                <p>• Echo diensten geconfigureerd</p>
                <p>• Maandrapport gegenereerd</p>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="flex flex-wrap gap-4 justify-between items-center pt-6 border-t border-gray-200">
            <div className="flex gap-4">
              <a 
                href="/" 
                className="text-blue-600 hover:text-blue-800 underline flex items-center"
              >
                <span className="mr-1">←</span>
                Terug naar homepage
              </a>
              <a 
                href="/help" 
                className="text-gray-600 hover:text-gray-800 underline flex items-center"
              >
                <span className="mr-1">❓</span>
                Help & Documentatie
              </a>
            </div>
            
            <div className="text-sm text-gray-500">
              Laatste update: {new Date().toLocaleDateString('nl-NL')} | Versie 2.1.0
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}