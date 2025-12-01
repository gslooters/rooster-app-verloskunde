'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlanningConstraint } from '@/lib/types/planning-constraint';
import { RuleCard } from './components/RuleCard';
import { ArrowLeft, Loader2, CheckCircle, XCircle } from 'lucide-react';

interface PlanningRulesClientProps {
  initialConstraints: PlanningConstraint[];
}

export default function PlanningRulesClient({ initialConstraints }: PlanningRulesClientProps) {
  const router = useRouter();
  const [constraints, setConstraints] = useState(initialConstraints);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Groepeer regels: vaste vs aanpasbare
  const vasteRegels = constraints.filter(c => c.isfixed);
  const standaardRegels = constraints.filter(c => !c.isfixed);

  // Statistieken
  const totalActief = constraints.filter(c => c.actief).length;
  const totalAanpasbaar = standaardRegels.length;
  const aanpasbaareActief = standaardRegels.filter(c => c.actief).length;

  const handleToggle = async (id: string, newValue: boolean) => {
    try {
      const response = await fetch(`/api/planning-constraints/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actief: newValue }),
      });

      if (!response.ok) {
        throw new Error('Update failed');
      }

      // Update lokale state
      setConstraints(prev =>
        prev.map(c => (c.id === id ? { ...c, actief: newValue } : c))
      );

      // Toon success toast
      setToast({
        type: 'success',
        message: newValue ? 'Regel geactiveerd' : 'Regel uitgeschakeld',
      });

      // Verberg toast na 3 seconden
      setTimeout(() => setToast(null), 3000);
    } catch (error) {
      console.error('Toggle error:', error);
      setToast({
        type: 'error',
        message: 'Er ging iets mis bij het opslaan',
      });
      setTimeout(() => setToast(null), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 md:p-8 mb-6">
          <div className="flex items-center mb-6">
            <button
              onClick={() => router.push('/services')}
              className="mr-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex items-center">
              <div className="w-14 h-14 mr-4 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center ring-1 ring-purple-200">
                <span className="text-2xl">📋</span>
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
                  Planregels Beheren
                </h1>
                <p className="text-gray-600 mt-1">
                  Algemene regels die gelden voor alle nieuwe roosters
                </p>
              </div>
            </div>
          </div>

          {/* Statistieken */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
              <div className="text-3xl font-bold text-green-900">{totalActief}</div>
              <div className="text-sm text-green-700">Actieve regels totaal</div>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
              <div className="text-3xl font-bold text-blue-900">{vasteRegels.length}</div>
              <div className="text-sm text-blue-700">Vaste regels (altijd actief)</div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
              <div className="text-3xl font-bold text-purple-900">
                {aanpasbaareActief}/{totalAanpasbaar}
              </div>
              <div className="text-sm text-purple-700">Aanpasbare regels actief</div>
            </div>
          </div>
        </div>

        {/* Vaste Regels */}
        <div className="mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                <span className="text-xl">🔒</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Vaste Regels</h2>
                <p className="text-sm text-gray-600">
                  Deze regels zijn altijd actief en kunnen niet worden uitgeschakeld
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {vasteRegels.map(constraint => (
                <RuleCard
                  key={constraint.id}
                  constraint={constraint}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Standaard Regels */}
        <div>
          <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-purple-200 flex items-center justify-center">
                <span className="text-xl">⚙️</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Aanpasbare Regels</h2>
                <p className="text-sm text-gray-600">
                  Deze regels kunnen aan- of uitgezet worden voor nieuwe roosters
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {standaardRegels.map(constraint => (
                <RuleCard
                  key={constraint.id}
                  constraint={constraint}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Info banner onderaan */}
        <div className="mt-6 bg-blue-50 rounded-xl p-6 border border-blue-200">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center flex-shrink-0">
              <span className="text-xl">💡</span>
            </div>
            <div>
              <h3 className="font-bold text-blue-900 mb-2">Belangrijk</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Wijzigingen gelden alleen voor <strong>nieuwe roosters</strong></li>
                <li>• Bestaande roosters behouden hun oorspronkelijke regels</li>
                <li>• Vaste regels kunnen niet worden uitgeschakeld (kritiek voor correctheid)</li>
                <li>• Per rooster kunnen regels later nog aangepast worden (overrides)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Toast notificaties */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5">
          <div
            className={`
              flex items-center gap-3 px-6 py-4 rounded-lg shadow-lg
              ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}
              text-white
            `}
          >
            {toast.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <XCircle className="w-5 h-5" />
            )}
            <span className="font-medium">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
