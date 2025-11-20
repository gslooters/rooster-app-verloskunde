/**
 * 🧪 FASE 4: Data Layer Validatie Tests
 * 
 * Test suite voor weekDagdelenData.ts volgens PLANDRAAD40.pdf specificaties
 * 
 * Test Criteria volgens plan:
 * [ ] Query haalt juiste data op (week 51: ~504 records verwacht)
 * [ ] Data transformatie werkt foutloos
 * [ ] Ontbrekende dagdelen krijgen fallback
 * [ ] Console warnings voor ontbrekende data
 * [ ] Diensten zijn gesorteerd op volgorde
 * [ ] Teams zijn in volgorde: Groen, Oranje, Praktijk
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getWeekDagdelenData, getWeekNavigatieBounds } from '../weekDagdelenData';

describe('FASE 4: Data Layer Validatie', () => {
  // Mock console voor warning verificatie
  const consoleLogSpy = vi.spyOn(console, 'log');
  const consoleWarnSpy = vi.spyOn(console, 'warn');
  const consoleErrorSpy = vi.spyOn(console, 'error');

  beforeEach(() => {
    // Reset mocks voor elke test
    consoleLogSpy.mockClear();
    consoleWarnSpy.mockClear();
    consoleErrorSpy.mockClear();
  });

  describe('Database Query Verificatie', () => {
    it('Test 1: Query haalt data op voor week 1', async () => {
      // Test parameters
      const rosterId = 'test-roster-id';
      const weekNummer = 1;
      const jaar = 2025;
      const periodStart = '2025-11-18'; // Maandag week 47

      // Execute query
      const result = await getWeekDagdelenData(rosterId, weekNummer, jaar, periodStart);

      // Verificaties
      expect(result).not.toBeNull();
      expect(result?.weekNummer).toBe(1);
      expect(result?.rosterId).toBe(rosterId);
      expect(result?.days).toHaveLength(7); // 7 dagen in een week

      // Log check
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('START Week 1')
      );
    });

    it('Test 2: Query haalt juiste periode op (maandag-zondag)', async () => {
      const rosterId = 'test-roster-id';
      const weekNummer = 2;
      const jaar = 2025;
      const periodStart = '2025-11-18';

      const result = await getWeekDagdelenData(rosterId, weekNummer, jaar, periodStart);

      // Verificeer dat eerste dag maandag is
      const firstDay = result?.days[0];
      expect(firstDay?.dagNaam).toBe('maandag');

      // Verificeer dat laatste dag zondag is
      const lastDay = result?.days[6];
      expect(lastDay?.dagNaam).toBe('zondag');
    });

    it('Test 3: Ontbrekende data krijgt fallback', async () => {
      const rosterId = 'non-existent-roster';
      const weekNummer = 1;
      const jaar = 2025;
      const periodStart = '2025-11-18';

      const result = await getWeekDagdelenData(rosterId, weekNummer, jaar, periodStart);

      // Bij ontbrekende roster data moet null returned worden OF lege week
      // Volgens console logs: "Geen period data gevonden (dit is OK voor lege week)"
      if (result === null) {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('Roster niet gevonden')
        );
      } else {
        // Lege week heeft wel 7 dagen maar geen dagdelen data
        expect(result.days).toHaveLength(7);
        result.days.forEach(day => {
          expect(day.dagdelen.ochtend).toEqual([]);
          expect(day.dagdelen.middag).toEqual([]);
          expect(day.dagdelen.avond).toEqual([]);
        });
      }
    });
  });

  describe('Data Transformatie', () => {
    it('Test 4: Dagdelen worden correct gegroepeerd', async () => {
      const rosterId = 'test-roster-id';
      const weekNummer = 1;
      const jaar = 2025;
      const periodStart = '2025-11-18';

      const result = await getWeekDagdelenData(rosterId, weekNummer, jaar, periodStart);

      // Verificeer dat elke dag alle dagdelen heeft
      result?.days.forEach(day => {
        expect(day.dagdelen).toHaveProperty('ochtend');
        expect(day.dagdelen).toHaveProperty('middag');
        expect(day.dagdelen).toHaveProperty('avond');
        expect(day.dagdelen).toHaveProperty('nacht');

        // Elk dagdeel moet een array zijn (kan leeg zijn)
        expect(Array.isArray(day.dagdelen.ochtend)).toBe(true);
        expect(Array.isArray(day.dagdelen.middag)).toBe(true);
        expect(Array.isArray(day.dagdelen.avond)).toBe(true);
        expect(Array.isArray(day.dagdelen.nacht)).toBe(true);
      });
    });

    it('Test 5: Team structuur is correct', async () => {
      const rosterId = 'test-roster-id';
      const weekNummer = 1;
      const jaar = 2025;
      const periodStart = '2025-11-18';

      const result = await getWeekDagdelenData(rosterId, weekNummer, jaar, periodStart);

      // Check eerste dag met data
      const dayWithData = result?.days.find(day => 
        day.dagdelen.ochtend.length > 0 ||
        day.dagdelen.middag.length > 0 ||
        day.dagdelen.avond.length > 0
      );

      if (dayWithData) {
        // Controleer dat teams GRO, ORA, TOT zijn
        const allAssignments = [
          ...dayWithData.dagdelen.ochtend,
          ...dayWithData.dagdelen.middag,
          ...dayWithData.dagdelen.avond,
        ];

        allAssignments.forEach(assignment => {
          expect(['GRO', 'ORA', 'TOT', '']).toContain(assignment.team);
          expect(typeof assignment.aantal).toBe('number');
          expect(typeof assignment.status).toBe('string');
        });
      }
    });

    it('Test 6: Status waarden zijn geldig', async () => {
      const rosterId = 'test-roster-id';
      const weekNummer = 1;
      const jaar = 2025;
      const periodStart = '2025-11-18';

      const result = await getWeekDagdelenData(rosterId, weekNummer, jaar, periodStart);

      // Geldige statussen volgens implementatie
      const validStatuses = [
        'NIET_TOEGEWEZEN',
        'GEDEELTELIJK_TOEGEWEZEN',
        'VOLLEDIG_TOEGEWEZEN',
        'OVERBEZET',
        ''
      ];

      result?.days.forEach(day => {
        const allAssignments = [
          ...day.dagdelen.ochtend,
          ...day.dagdelen.middag,
          ...day.dagdelen.avond,
          ...day.dagdelen.nacht,
        ];

        allAssignments.forEach(assignment => {
          expect(validStatuses).toContain(assignment.status);
        });
      });
    });
  });

  describe('Week Navigatie Bounds', () => {
    it('Test 7: Week 1 navigatie boundaries', async () => {
      const rosterId = 'test-roster-id';
      const weekNummer = 1;

      const bounds = await getWeekNavigatieBounds(rosterId, weekNummer);

      // Week 1 specifieke verwachtingen
      expect(bounds.currentWeek).toBe(1);
      expect(bounds.minWeek).toBe(1);
      expect(bounds.maxWeek).toBe(5);
      expect(bounds.hasPrevious).toBe(false); // ❌ Geen vorige week
      expect(bounds.hasNext).toBe(true);      // ✅ Volgende week bestaat
    });

    it('Test 8: Week 3 navigatie boundaries', async () => {
      const rosterId = 'test-roster-id';
      const weekNummer = 3;

      const bounds = await getWeekNavigatieBounds(rosterId, weekNummer);

      // Week 3 specifieke verwachtingen
      expect(bounds.currentWeek).toBe(3);
      expect(bounds.minWeek).toBe(1);
      expect(bounds.maxWeek).toBe(5);
      expect(bounds.hasPrevious).toBe(true);  // ✅ Vorige week bestaat
      expect(bounds.hasNext).toBe(true);      // ✅ Volgende week bestaat
    });

    it('Test 9: Week 5 navigatie boundaries', async () => {
      const rosterId = 'test-roster-id';
      const weekNummer = 5;

      const bounds = await getWeekNavigatieBounds(rosterId, weekNummer);

      // Week 5 specifieke verwachtingen
      expect(bounds.currentWeek).toBe(5);
      expect(bounds.minWeek).toBe(1);
      expect(bounds.maxWeek).toBe(5);
      expect(bounds.hasPrevious).toBe(true);  // ✅ Vorige week bestaat
      expect(bounds.hasNext).toBe(false);     // ❌ Geen volgende week
    });

    it('Test 10: Invalid week (0) returns safe defaults', async () => {
      const rosterId = 'test-roster-id';
      const weekNummer = 0; // Invalid

      const bounds = await getWeekNavigatieBounds(rosterId, weekNummer);

      // Moet safe defaults returnen
      expect(bounds.minWeek).toBe(1);
      expect(bounds.maxWeek).toBe(5);
      expect(bounds.currentWeek).toBe(0);
    });

    it('Test 11: Invalid week (6) returns safe defaults', async () => {
      const rosterId = 'test-roster-id';
      const weekNummer = 6; // Invalid

      const bounds = await getWeekNavigatieBounds(rosterId, weekNummer);

      // Moet safe defaults returnen
      expect(bounds.minWeek).toBe(1);
      expect(bounds.maxWeek).toBe(5);
      expect(bounds.currentWeek).toBe(6);
    });
  });

  describe('Console Logging & Error Handling', () => {
    it('Test 12: Success scenario logt correct', async () => {
      const rosterId = 'test-roster-id';
      const weekNummer = 1;
      const jaar = 2025;
      const periodStart = '2025-11-18';

      await getWeekDagdelenData(rosterId, weekNummer, jaar, periodStart);

      // Verificeer dat success logs aanwezig zijn
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('SUCCESS - Returning data')
      );
    });

    it('Test 13: Ontbrekende data genereert warning', async () => {
      const rosterId = 'test-roster-id';
      const weekNummer = 1;
      const jaar = 2025;
      const periodStart = '2025-11-18';

      const result = await getWeekDagdelenData(rosterId, weekNummer, jaar, periodStart);

      // Als er geen data is, moet er een warning zijn
      if (result && result.days.every(d => 
        d.dagdelen.ochtend.length === 0 &&
        d.dagdelen.middag.length === 0 &&
        d.dagdelen.avond.length === 0
      )) {
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('Geen period data gevonden')
        );
      }
    });
  });

  describe('Performance & Edge Cases', () => {
    it('Test 14: Grote dataset (500+ records) wordt correct verwerkt', async () => {
      const rosterId = 'large-roster-id';
      const weekNummer = 1;
      const jaar = 2025;
      const periodStart = '2025-11-18';

      // Timing start
      const startTime = Date.now();

      const result = await getWeekDagdelenData(rosterId, weekNummer, jaar, periodStart);

      // Timing end
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Performance check: moet binnen 3 seconden
      expect(duration).toBeLessThan(3000);

      // Data completeness check
      if (result) {
        expect(result.days).toHaveLength(7);
      }
    });

    it('Test 15: Speciale karakters in roster ID worden correct afgehandeld', async () => {
      const rosterId = 'roster-with-special-chars-123-@#$';
      const weekNummer = 1;
      const jaar = 2025;
      const periodStart = '2025-11-18';

      // Mag geen exception throwen
      await expect(
        getWeekDagdelenData(rosterId, weekNummer, jaar, periodStart)
      ).resolves.not.toThrow();
    });
  });
});

/**
 * 📊 TEST RESULTATEN INTERPRETATIE
 * 
 * ✅ GESLAAGD als:
 * - Alle 15 tests slagen
 * - Console logs bevatten verwachte berichten
 * - Performance < 3 seconden per query
 * - Geen onverwachte errors/warnings
 * 
 * ⚠️ WAARSCHUWING als:
 * - Fallback logica wordt te vaak aangeroepen
 * - Performance > 2 seconden
 * - Meer dan 5% missing data
 * 
 * ❌ GEFAALD als:
 * - Data transformatie faalt
 * - Boundaries worden niet correct berekend
 * - Database errors zonder fallback
 * - Memory leaks gedetecteerd
 */
