'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export default function DienstenDashboardPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
          {/* Header met terug knop */}
          <div className="flex items-center mb-6">
            <button
              onClick={() => router.push('/dashboard')}
              className="mr-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex items-center">
              <div className="w-14 h-14 mr-4 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center ring-1 ring-purple-200">
                <span className="text-2xl">💼</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
                Diensten Beheren
              </h1>
            </div>
          </div>

          {/* Beschrijving */}
          <p className="text-gray-600 mb-8">
            Beheer alle aspecten van diensten: types en medewerker-toewijzingen.
          </p>

          {/* Grid met twee opties */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Optie 1: Diensten Types */}
            <Link
              href="/services/types"
              className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl hover:shadow-lg transition-all duration-300 cursor-pointer block border border-blue-200 hover:border-blue-300"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 mb-4 rounded-full bg-blue-200 flex items-center justify-center">
                  <span className="text-3xl">🏷️</span>
                </div>
                <h3 className="font-bold text-blue-900 text-xl mb-2">
                  Diensten Types
                </h3>
                <p className="text-blue-700 text-sm">
                  Beheer dienstsoorten, codes, kleuren en instellingen
                </p>
              </div>
            </Link>

            {/* Optie 2: Diensten Medewerkers */}
            <Link
              href="/services/assignments"
              className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl hover:shadow-lg transition-all duration-300 cursor-pointer block border border-green-200 hover:border-green-300"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 mb-4 rounded-full bg-green-200 flex items-center justify-center">
                  <span className="text-3xl">👥</span>
                </div>
                <h3 className="font-bold text-green-900 text-xl mb-2">
                  Diensten Medewerkers
                </h3>
                <p className="text-green-700 text-sm">
                  Koppel medewerkers aan diensten en stel aantallen in
                </p>
              </div>
            </Link>
          </div>

          {/* Info sectie onderaan */}
          <div className="mt-8 p-4 bg-purple-50 rounded-lg border border-purple-200">
            <p className="text-sm text-purple-800">
              <strong>💡 Tip:</strong> Klik op een van de twee opties hierboven om specifieke dienst-instellingen te beheren.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
