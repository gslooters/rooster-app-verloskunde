// app/api/test-db/route.ts
// ============================================================================
// DATABASE TEST ENDPOINT - AP42 Verificatie
// ============================================================================
// Test endpoint om service_types database structuur te verifiëren
// Bereikbaar via: /api/test-db
// ============================================================================

import { NextResponse } from 'next/server';
import { getAllServiceTypes } from '@/lib/services/service-types-storage';
import { getTeamScope, getTeamScopeLabel } from '@/lib/types/service';

export async function GET() {
  try {
    console.log('📡 Test DB endpoint called');
    
    // Haal alle service types op
    const services = await getAllServiceTypes();
    
    // UUID validatie regex
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    // Analyseer de data
    const analysis = {
      timestamp: new Date().toISOString(),
      status: 'success',
      
      // Basis stats
      totaal_diensten: services.length,
      actieve_diensten: services.filter(s => s.actief).length,
      
      // UUID validatie
      valid_uuids: services.filter(s => uuidRegex.test(s.id)).length,
      invalid_uuids: services.filter(s => !uuidRegex.test(s.id)).map(s => ({
        code: s.code,
        id: s.id
      })),
      
      // Team regels stats
      met_totaal_regels: services.filter(s => !!s.team_totaal_regels).length,
      met_groen_regels: services.filter(s => !!s.team_groen_regels).length,
      met_oranje_regels: services.filter(s => !!s.team_oranje_regels).length,
      
      // Blokkeert volgende dag
      blokkeert_volgdag: services.filter(s => s.blokkeert_volgdag).length,
      blokkeert_codes: services.filter(s => s.blokkeert_volgdag).map(s => s.code),
      
      // Code validatie (2-3 chars, UPPERCASE)
      invalid_codes: services.filter(s => {
        return s.code.length < 2 || s.code.length > 3 || s.code !== s.code.toUpperCase();
      }).map(s => s.code),
      
      // Per dienst detail
      diensten: services.map(s => ({
        code: s.code,
        naam: s.naam,
        id: s.id.substring(0, 8) + '...', // Verkort voor leesbaarheid
        tijden: `${s.begintijd}-${s.eindtijd}`,
        duur: s.duur,
        blokkeert: s.blokkeert_volgdag,
        actief: s.actief,
        team_scope: getTeamScope(s),
        team_scope_label: getTeamScopeLabel(s),
        heeft_totaal: !!s.team_totaal_regels,
        heeft_groen: !!s.team_groen_regels,
        heeft_oranje: !!s.team_oranje_regels
      })),
      
      // Sample JSONB data (eerste dienst met regels)
      sample_jsonb: (() => {
        const withRegels = services.find(s => s.team_totaal_regels || s.team_groen_regels);
        if (!withRegels) return null;
        
        return {
          code: withRegels.code,
          team_totaal_regels: withRegels.team_totaal_regels,
          team_groen_regels: withRegels.team_groen_regels,
          team_oranje_regels: withRegels.team_oranje_regels
        };
      })()
    };
    
    // Voeg waarschuwingen toe
    const warnings: string[] = [];
    
    if (analysis.invalid_uuids.length > 0) {
      warnings.push(`⚠️ ${analysis.invalid_uuids.length} diensten met ongeldige UUIDs`);
    }
    
    if (analysis.invalid_codes.length > 0) {
      warnings.push(`⚠️ ${analysis.invalid_codes.length} diensten met ongeldige codes`);
    }
    
    if (services.length === 0) {
      warnings.push('⚠️ Geen diensten gevonden in database!');
    }
    
    if (services.length < 10) {
      warnings.push(`⚠️ Verwacht 10 diensten, gevonden: ${services.length}`);
    }
    
    const response = {
      ...analysis,
      warnings: warnings.length > 0 ? warnings : ['✅ Alles ziet er goed uit!'],
      
      // Verwachte diensten check
      expected_services: ['D24', 'DAG', 'ECH', 'GRB', 'MSP', 'OSP', 'SPR', 'T24', 'WDA', 'WDO'],
      found_services: services.map(s => s.code),
      missing_services: ['D24', 'DAG', 'ECH', 'GRB', 'MSP', 'OSP', 'SPR', 'T24', 'WDA', 'WDO']
        .filter(code => !services.find(s => s.code === code))
    };
    
    console.log('✅ Test DB complete:', {
      totaal: response.totaal_diensten,
      warnings: response.warnings.length
    });
    
    return NextResponse.json(response, { status: 200 });
    
  } catch (error: any) {
    console.error('❌ Test DB failed:', error);
    
    return NextResponse.json({
      status: 'error',
      error: error.message || 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
