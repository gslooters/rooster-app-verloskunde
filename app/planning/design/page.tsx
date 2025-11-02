'use client';
import { useState, useEffect } from 'react';

interface DraftRoster {
  id: string;
  title: string;
  period: string;
  status: 'draft' | 'in-progress' | 'ready-for-review';
  lastEdited: string;
  weekNumbers: string;
}

export default function RoosterOntwerpenPage() {
  const [draftRosters, setDraftRosters] = useState<DraftRoster[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading draft rosters from localStorage or API
    // Set to empty array to test empty state, or add many items to test scrolling
    const mockDrafts: DraftRoster[] = [
      {
        id: '1',
        title: 'Rooster Week 45-49 (Ontwerp)',
        period: '24-11-2025 t/m 28-12-2025',
        status: 'in-progress',
        lastEdited: '2 dagen geleden',
        weekNumbers: 'Week 45-49'
      },
      {
        id: '2', 
        title: 'Rooster Week 50-52 (Ontwerp)',
        period: '29-12-2025 t/m 18-01-2026',
        status: 'draft',
        lastEdited: '1 week geleden',
        weekNumbers: 'Week 50-52'
      },
      {
        id: '3',
        title: 'Rooster Week 53-04 (Ontwerp)',
        period: '19-01-2026 t/m 22-02-2026',
        status: 'ready-for-review',
        lastEdited: '3 dagen geleden',
        weekNumbers: 'Week 53-04'
      },
      {
        id: '4',
        title: 'Rooster Week 05-09 (Ontwerp)',
        period: '23-02-2026 t/m 29-03-2026',
        status: 'draft',
        lastEdited: '5 dagen geleden',
        weekNumbers: 'Week 05-09'
      },
      {
        id: '5',
        title: 'Rooster Week 10-14 (Ontwerp)',
        period: '30-03-2026 t/m 03-05-2026',
        status: 'in-progress',
        lastEdited: '1 dag geleden',
        weekNumbers: 'Week 10-14'
      }
    ];
    
    setTimeout(() => {
      setDraftRosters(mockDrafts);
      setIsLoading(false);
    }, 500);
  }, []);

  const getStatusBadge = (status: string) => {
    const badges = {
      'draft': 'bg-gray-100 text-gray-700 border-gray-200',
      'in-progress': 'bg-blue-100 text-blue-700 border-blue-200', 
      'ready-for-review': 'bg-green-100 text-green-700 border-green-200'
    };
    
    const labels = {
      'draft': 'Nieuw',
      'in-progress': 'Bezig', 
      'ready-for-review': 'Gereed'
    };

    return (
      <span className={`px-3 py-1 text-xs font-medium rounded-full border ${badges[status as keyof typeof badges]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Roosters laden...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6 md:p-8 flex flex-col min-h-[85vh]">
          
          {/* Header - Fixed */}
          <div className="mb-6 flex-shrink-0">
            <div className="flex items-center mb-4">
              <a href="/dashboard" className="text-blue-600 hover:text-blue-800 flex items-center mr-4">
                <span className="mr-1">←</span>
                Dashboard
              </a>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 flex items-center">
              <span className="text-2xl mr-3">📋</span>
              Roosters Ontwerpen
            </h1>
            <p className="text-gray-600">
              Kies een bestaand ontwerp om verder te werken, of start een nieuwe roosterplanning.
            </p>
          </div>

          {/* Draft Rosters Section with Scrolling - Flexible */}
          <div className="flex-1 flex flex-col min-h-0 mb-6">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <h2 className="text-xl font-semibold text-gray-900">Roosters in ontwerp</h2>
              {draftRosters.length > 0 && (
                <span className="text-sm text-gray-500">
                  {draftRosters.length} in ontwerp
                </span>
              )}
            </div>
            
            {draftRosters.length === 0 ? (
              <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-8 text-center flex-1 flex items-center justify-center">
                <div>
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-200 rounded-full flex items-center justify-center">
                    <span className="text-2xl">📋</span>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Geen roosters in ontwerp</h3>
                  <p className="text-gray-600 mb-4">
                    Er zijn momenteel geen roosters in ontwikkeling.
                  </p>
                  <a
                    href="/planning/new"
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <span className="mr-2">✨</span>
                    Start je eerste rooster
                  </a>
                </div>
              </div>
            ) : (
              <div 
                className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400 pr-2 max-h-[40vh]"
                style={{ scrollBehavior: 'smooth' }}
              >
                <div className="space-y-4">
                  {draftRosters.map((roster) => (
                    <div 
                      key={roster.id}
                      className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow flex-shrink-0"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {roster.title}
                            </h3>
                            {getStatusBadge(roster.status)}
                          </div>
                          
                          <div className="text-sm text-gray-600 space-y-1">
                            <p><span className="font-medium">Periode:</span> {roster.period}</p>
                            <p><span className="font-medium">Laatst bewerkt:</span> {roster.lastEdited}</p>
                          </div>
                        </div>
                        
                        <div className="ml-4">
                          <a
                            href={`/planning/${roster.id}`}
                            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            Bewerken
                            <span className="ml-2">→</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* New Roster Section - Fixed at bottom, Always Visible */}
          <div className="border-t border-gray-200 pt-6 flex-shrink-0">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-blue-900 mb-2 flex items-center">
                    <span className="text-xl mr-2">✨</span>
                    Nieuw Rooster Maken
                  </h3>
                  <p className="text-blue-700">
                    Start een nieuwe roosterplanning met de stap-voor-stap wizard
                  </p>
                </div>
                <a
                  href="/planning/new"
                  className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg"
                >
                  <span className="mr-2">+</span>
                  Nieuwe Planning
                </a>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}