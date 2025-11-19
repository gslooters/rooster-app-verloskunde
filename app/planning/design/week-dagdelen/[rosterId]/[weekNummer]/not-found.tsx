import Link from 'next/link';
import { FileQuestion, ArrowLeft } from 'lucide-react';

/**
 * 404 page for week dagdelen
 * Displayed when week doesn't exist or is outside roster period
 */
export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        {/* 404 Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <FileQuestion className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Week niet gevonden
        </h1>

        {/* Message */}
        <p className="text-sm text-gray-600 mb-6">
          De gevraagde week bestaat niet of valt buiten de roosterperiode.
          Controleer het weeknummer en probeer het opnieuw.
        </p>

        {/* Back Button */}
        <Link
          href="/planning/design/dagdelen-dashboard"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Terug naar overzicht</span>
        </Link>
      </div>
    </div>
  );
}
