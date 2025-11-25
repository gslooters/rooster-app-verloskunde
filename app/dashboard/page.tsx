'use client';
import Link from 'next/link';

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
          {/* Header with emoji logo matching site look&feel (teal/green) */}
          <div className="mb-6 flex items-center">
            <div className="w-16 h-16 mr-4 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center ring-1 ring-emerald-200">
              <span className="text-2xl">✨</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
              Rooster Dashboard Verloskundigen Arnhem
            </h1>
          </div>
          
          {/* Snelkoppeling Bovenaan - PDF Export voor Diensten per Dagdeel */}
          <div className="bg-gradient-to-r from-blue-100 to-indigo-100 rounded-lg p-4 mb-6 border border-blue-200">
            <Link href="/planning/service-allocation" className="flex items-center justify-between hover:bg-blue-50 rounded-lg p-2 transition-colors">
              <div className="flex items-center">
                <span className="text-2xl mr-3">📄</span>
                <div>
                  <h3 className="font-bold text-blue-900 text-lg">Diensten per Dagdeel Aanpassen</h3>
                  <p className="text-blue-700 text-sm">PDF exporteren van het volledige rooster (5 weken)</p>
                </div>
              </div>
              <span className="text-blue-600 text-xl">→</span>
            </Link>
          </div>
          
          {/* Snelkoppeling Huidig Rooster */}
          <div className="bg-gradient-to-r from-red-100 to-orange-100 rounded-lg p-4 mb-6 border border-red-200">
            <Link href="/current-roster" className="flex items-center justify-between hover:bg-red-50 rounded-lg p-2 transition-colors">
              <div className="flex items-center">
                <span className="text-2xl mr-3">🔥</span>
                <div>
                  <h3 className="font-bold text-red-900 text-lg">Huidig Rooster</h3>
                  <p className="text-red-700 text-sm">Ga direct naar het actuele rooster</p>
                </div>
              </div>
              <span className="text-red-600 text-xl">→</span>
            </Link>
          </div>

          {/* Main Navigation Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <Link href="/planning/edit" className="bg-indigo-50 p-6 rounded-xl hover:bg-indigo-100 transition-all duration-300 cursor-pointer block shadow-sm hover:shadow-md">
              <div className="flex items-center mb-3">
                <span className="text-2xl mr-3">📝</span>
                <h3 className="font-bold text-indigo-900 text-lg">Rooster Bewerken</h3>
              </div>
              <p className="text-indigo-700 font-medium">Bestaande aanpassen</p>
            </Link>
            
            <Link href="/planning" className="bg-blue-50 p-6 rounded-xl hover:bg-blue-100 transition-all duration-300 cursor-pointer block shadow-sm hover:shadow-md">
              <div className="flex items-center mb-3">
                <span className="text-2xl mr-3">📋</span>
                <h3 className="font-bold text-blue-900 text-lg">Rooster Ontwerpen</h3>
              </div>
              <p className="text-blue-700 font-medium">Nieuwe planning starten</p>
            </Link>
            
            <Link href="/employees" className="bg-green-50 p-6 rounded-xl hover:bg-green-100 transition-all duration-300 cursor-pointer block shadow-sm hover:shadow-md">
              <div className="flex items-center mb-3">
                <span className="text-2xl mr-3">👥</span>
                <h3 className="font-bold text-green-900 text-lg">Medewerkers Beheer</h3>
              </div>
              <p className="text-green-700 font-medium">Personeel + diensten</p>
            </Link>
            
            <Link href="/reports" className="bg-orange-50 p-6 rounded-xl hover:bg-orange-100 transition-all duration-300 cursor-pointer block shadow-sm hover:shadow-md">
              <div className="flex items-center mb-3">
                <span className="text-2xl mr-3">📊</span>
                <h3 className="font-bold text-orange-900 text-lg">Rooster Rapporten</h3>
              </div>
              <p className="text-orange-700 font-medium">Statistieken</p>
            </Link>
            
            <Link href="/archived" className="bg-gray-50 p-6 rounded-xl hover:bg-gray-100 transition-all duration-300 cursor-pointer block shadow-sm hover:shadow-md">
              <div className="flex items-center mb-3">
                <span className="text-2xl mr-3">🔒</span>
                <h3 className="font-bold text-gray-900 text-lg">Archief Raadplegen</h3>
              </div>
              <p className="text-gray-700 font-medium">Afgesloten roosters</p>
            </Link>
            
            <Link href="/services" className="bg-purple-50 p-6 rounded-xl hover:bg-purple-100 transition-all duration-300 cursor-pointer block shadow-sm hover:shadow-md">
              <div className="flex items-center mb-3">
                <span className="text-2xl mr-3">💼</span>
                <h3 className="font-bold text-purple-900 text-lg">Diensten Beheren</h3>
              </div>
              <p className="text-purple-700 font-medium">Types, medewerkers en regels</p>
            </Link>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-200">
            <Link href="/settings" className="text-gray-600 hover:text-gray-800 text-sm flex items-center">
              <span className="mr-1">⚙️</span>Instellingen
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
