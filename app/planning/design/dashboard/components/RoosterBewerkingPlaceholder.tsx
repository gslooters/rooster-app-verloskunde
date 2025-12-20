'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

interface RoosterBewerkingPlaceholderProps {
  rosterId: string;
  onClose: () => void;
}

export default function RoosterBewerkingPlaceholder({
  rosterId,
  onClose
}: RoosterBewerkingPlaceholderProps) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOK = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      // Update roster status to 'in_progress' in Supabase
      const response = await fetch('/api/roster/update-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          roster_id: rosterId,
          status: 'in_progress'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Kon rooster status niet bijwerken');
      }

      // Navigate to rooster bewerking scherm
      router.push(`/planning/design/preplanning?id=${rosterId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Er is een fout opgetreden');
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Rooster Bewerking</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-blue-100 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-8">
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-dashed border-amber-300 rounded-xl p-8 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
              <span className="text-4xl">🚀</span>
            </div>
            <h3 className="text-2xl font-bold text-amber-900 mb-3">Tijdelijk Scherm</h3>
            <p className="text-amber-800 text-lg mb-6 leading-relaxed">
              Hier gaan we de <strong>auto-fill functionaliteit voor Roosterbewerking</strong> bouwen.
            </p>
            <div className="bg-white rounded-lg p-6 mb-6 border border-amber-200 text-left">
              <p className="text-gray-700 mb-4">
                <strong>📋 Status update:</strong>
              </p>
              <ul className="text-sm text-gray-600 space-y-2 ml-4">
                <li>✅ Alle voorbereiding stappen voltooid</li>
                <li>✅ Rooster status wordt naar 'in_progress' gezet</li>
                <li>✅ U kunt doorgaan naar rooster bewerking</li>
                <li>🔄 Auto-fill feature wordt momenteel gebouwd</li>
              </ul>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Klik OK om door te gaan naar het rooster bewerkingsscherm.
            </p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border-t border-red-200 px-8 py-4">
            <div className="flex items-start gap-3">
              <span className="text-red-600 text-xl">❌</span>
              <div>
                <p className="text-red-800 font-semibold">Fout</p>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="bg-gray-50 border-t border-gray-200 px-8 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium disabled:opacity-50"
          >
            Annuleren
          </button>
          <button
            onClick={handleOK}
            disabled={isProcessing}
            className={`px-6 py-2 rounded-lg font-medium text-white flex items-center gap-2 ${
              isProcessing
                ? 'bg-gray-400 cursor-wait'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
            }`}
          >
            {isProcessing && (
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            )}
            {isProcessing ? 'Bezig met verwerken...' : 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
}
