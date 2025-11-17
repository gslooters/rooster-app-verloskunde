'use client';
import React, { useCallback } from 'react';
import {
  DagblokStatus,
  TeamRegels,
  DagCode,
  DagblokCode,
  ALLE_DAGEN,
  ALLE_DAGBLOKKEN,
  DAG_KORT,
  DAGBLOK_NAMEN,
  STATUS_KLEUREN,
  STATUS_EMOJI,
  DEFAULT_TEAM_REGELS
} from '@/lib/types/service';

interface DagblokMatrixProps {
  teamRegels: TeamRegels;
  onChange: (regels: TeamRegels) => void;
  teamNaam: string;
  disabled?: boolean;
}

export default function DagblokMatrix({ 
  teamRegels, 
  onChange, 
  teamNaam, 
  disabled = false 
}: DagblokMatrixProps) {
  
  // Handle individuele dagblok wijziging
  const handleDagblokChange = useCallback((
    dag: DagCode, 
    dagblok: DagblokCode, 
    status: DagblokStatus
  ) => {
    const nieuweRegels = {
      ...teamRegels,
      [dag]: {
        ...teamRegels[dag],
        [dagblok]: status
      }
    };
    onChange(nieuweRegels);
  }, [teamRegels, onChange]);

  // Quick fill functies
  const handleQuickFill = useCallback((
    dagen: DagCode[], 
    dagblokken: DagblokCode[], 
    status: DagblokStatus
  ) => {
    const nieuweRegels = { ...teamRegels };
    
    dagen.forEach(dag => {
      dagblokken.forEach(dagblok => {
        nieuweRegels[dag] = {
          ...nieuweRegels[dag],
          [dagblok]: status
        };
      });
    });
    
    onChange(nieuweRegels);
  }, [teamRegels, onChange]);

  // Reset alle regels naar MAG (default)
  const handleReset = useCallback(() => {
    onChange(DEFAULT_TEAM_REGELS);
  }, [onChange]);

  // Tel aantal MOET dagblokken
  const telVerplichteDagblokken = (): number => {
    let count = 0;
    ALLE_DAGEN.forEach(dag => {
      ALLE_DAGBLOKKEN.forEach(dagblok => {
        if (teamRegels[dag][dagblok] === DagblokStatus.MOET) {
          count++;
        }
      });
    });
    return count;
  };

  const verplichtCount = telVerplichteDagblokken();

  // Vervang weergave naam 'Team totaal' door 'Praktijk totaal'
  const getTeamNaamWeergave = (naam: string) => {
    if (naam.trim().toLowerCase() === 'totaal' || naam.trim().toLowerCase() === 'team totaal') {
      return 'Praktijk totaal';
    }
    return naam;
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Header met team naam en stats */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <span className="text-lg">🎯</span>
            {getTeamNaamWeergave(`Team ${teamNaam}`)}
          </h3>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-600">
              Verplichte dagblokken: <strong>{verplichtCount}</strong>
            </span>
            {!disabled && (
              <button
                type="button"
                onClick={handleReset}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Quick fill buttons */}
      {!disabled && (
        <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="text-gray-600 font-medium">Snel invullen:</span>
            
            {/* Alles MOET */}
            <button
              type="button"
              onClick={() => handleQuickFill(ALLE_DAGEN, ALLE_DAGBLOKKEN, DagblokStatus.MOET)}
              className="px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
            >
              Alles MOET
            </button>
            {/* Alles MAG */}
            <button
              type="button"
              onClick={() => handleQuickFill(ALLE_DAGEN, ALLE_DAGBLOKKEN, DagblokStatus.MAG)}
              className="px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
            >
              Alles MAG
            </button>
            {/* Alles MAG_NIET */}
            <button
              type="button"
              onClick={() => handleQuickFill(ALLE_DAGEN, ALLE_DAGBLOKKEN, DagblokStatus.MAG_NIET)}
              className="px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-300 border border-gray-400"
            >
              Alles MAG_NIET
            </button>
            {/* Weekdagen O/M MOET */}
            <button
              type="button"
              onClick={() => handleQuickFill(['ma', 'di', 'wo', 'do', 'vr'], ['O', 'M'], DagblokStatus.MOET)}
              className="px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
            >
              Weekdagen O/M MOET
            </button>
            {/* Weekend MAG_NIET */}
            <button
              type="button"
              onClick={() => handleQuickFill(['za', 'zo'], ALLE_DAGBLOKKEN, DagblokStatus.MAG_NIET)}
              className="px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              Weekend MAG_NIET
            </button>
          </div>
        </div>
      )}

      {/* Matrix grid */}
      <div className="p-4">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 pb-2 w-20">Dag</th>
                {ALLE_DAGBLOKKEN.map(dagblok => (
                  <th key={dagblok} className="text-center text-xs font-medium text-gray-500 pb-2 px-2">
                    <div className="flex flex-col items-center">
                      <span className="text-lg mb-1">
                        {dagblok === 'O' ? '🌅' : dagblok === 'M' ? '☀️' : '🌙'}
                      </span>
                      <span>{DAGBLOK_NAMEN[dagblok]}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ALLE_DAGEN.map((dag, dagIndex) => (
                <tr 
                  key={dag} 
                  className={dagIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                >
                  <td className="py-2 px-2">
                    <span className="font-medium text-sm text-gray-700">
                      {DAG_KORT[dag]}
                    </span>
                  </td>
                  {ALLE_DAGBLOKKEN.map(dagblok => {
                    const currentStatus = teamRegels[dag][dagblok];
                    
                    return (
                      <td key={`${dag}-${dagblok}`} className="py-2 px-2">
                        {disabled ? (
                          // Read-only weergave
                          <div 
                            className="w-full text-center py-1 px-2 rounded border text-sm font-medium"
                            style={{
                              backgroundColor: `${STATUS_KLEUREN[currentStatus]}15`,
                              borderColor: STATUS_KLEUREN[currentStatus],
                              color: STATUS_KLEUREN[currentStatus]
                            }}
                          >
                            <span className="mr-1">{STATUS_EMOJI[currentStatus]}</span>
                            {currentStatus}
                          </div>
                        ) : (
                          // Editable dropdown
                          <select
                            value={currentStatus}
                            onChange={(e) => handleDagblokChange(
                              dag, 
                              dagblok, 
                              e.target.value as DagblokStatus
                            )}
                            className="w-full py-1 px-2 text-sm border rounded cursor-pointer transition-colors"
                            style={{
                              backgroundColor: `${STATUS_KLEUREN[currentStatus]}15`,
                              borderColor: STATUS_KLEUREN[currentStatus],
                              color: STATUS_KLEUREN[currentStatus]
                            }}
                          >
                            <option value={DagblokStatus.MOET}>
                              ✓ MOET
                            </option>
                            <option value={DagblokStatus.MAG}>
                              ○ MAG
                            </option>
                            <option value={DagblokStatus.MAG_NIET}>
                              ✗ MAG_NIET
                            </option>
                          </select>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legenda */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center gap-4 text-xs">
            <span className="text-gray-500 font-medium">Legenda:</span>
            <div className="flex items-center gap-1">
              <span className="w-4 h-4 bg-red-100 border border-red-400 rounded"></span>
              <span className="text-gray-600">MOET = Verplicht</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-4 h-4 bg-green-100 border border-green-400 rounded"></span>
              <span className="text-gray-600">MAG = Optioneel</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-4 h-4 bg-gray-100 border border-gray-400 rounded"></span>
              <span className="text-gray-600">MAG_NIET = Niet toegestaan</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
