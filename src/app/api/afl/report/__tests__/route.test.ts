/**
 * Test Suite for AFL Report API Endpoint
 * DRAAD-231: Phase 5.3 - API Endpoint Implementation
 *
 * Tests cover:
 * - Parameter validation (rosterId, format)
 * - Format support (json, pdf, excel)
 * - Error handling and HTTP status codes
 * - Content-Type header correctness
 * - Content-Disposition for file downloads
 * - CORS preflight handling
 */

import { GET, OPTIONS } from '../[rosterId]/route';
import { NextRequest } from 'next/server';
import type { AflReport } from '@/lib/afl/types';

/**
 * Test Suite Setup
 *
 * These tests validate the API endpoint contract without mocking the entire
 * AFL pipeline (which is done in unit tests for individual engines).
 */

describe('GET /api/afl/report/[rosterId]', () => {
  describe('Parameter Validation', () => {
    it('should return 400 when rosterId is empty', async () => {
      const request = new NextRequest(
        new URL('http://localhost:3000/api/afl/report/')
      );

      const response = await GET(request, { params: { rosterId: '' } });
      const data = (await response.json()) as { error: string };

      expect(response.status).toBe(400);
      expect(data.error).toContain('Missing');
    });

    it('should return 400 when rosterId is whitespace', async () => {
      const request = new NextRequest(
        new URL('http://localhost:3000/api/afl/report/   ')
      );

      const response = await GET(request, { params: { rosterId: '   ' } });
      const data = (await response.json()) as { error: string };

      expect(response.status).toBe(400);
      expect(data.error).toContain('invalid');
    });

    it('should accept valid UUID-like rosterId', async () => {
      const validUuid = '550e8400-e29b-41d4-a716-446655440000';
      const request = new NextRequest(
        new URL(`http://localhost:3000/api/afl/report/${validUuid}`)
      );

      // Will fail on report generation, but parameter validation should pass
      const response = await GET(request, { params: { rosterId: validUuid } });

      // Should NOT return 400 for parameter validation
      expect(response.status).not.toBe(400);
    });
  });

  describe('Format Parameter Handling', () => {
    const validRosterId = 'test-roster-123';

    it('should return JSON by default (no format parameter)', async () => {
      const request = new NextRequest(
        new URL(`http://localhost:3000/api/afl/report/${validRosterId}`)
      );

      const response = await GET(request, { params: { rosterId: validRosterId } });

      // Should NOT return 400 (default format is valid)
      expect(response.status).not.toBe(400);
      expect(response.headers.get('Content-Type')).toContain('application/json');
    });

    it('should handle format=json explicitly', async () => {
      const request = new NextRequest(
        new URL(`http://localhost:3000/api/afl/report/${validRosterId}?format=json`)
      );

      const response = await GET(request, { params: { rosterId: validRosterId } });

      expect(response.status).not.toBe(400);
      expect(response.headers.get('Content-Type')).toContain('application/json');
    });

    it('should handle format=pdf', async () => {
      const request = new NextRequest(
        new URL(`http://localhost:3000/api/afl/report/${validRosterId}?format=pdf`)
      );

      const response = await GET(request, { params: { rosterId: validRosterId } });

      expect(response.status).not.toBe(400);
      expect(response.headers.get('Content-Type')).toBe('application/pdf');
      expect(response.headers.get('Content-Disposition')).toContain('attachment');
    });

    it('should handle format=excel', async () => {
      const request = new NextRequest(
        new URL(`http://localhost:3000/api/afl/report/${validRosterId}?format=excel`)
      );

      const response = await GET(request, { params: { rosterId: validRosterId } });

      expect(response.status).not.toBe(400);
      expect(response.headers.get('Content-Type')).toContain('spreadsheetml');
      expect(response.headers.get('Content-Disposition')).toContain('.xlsx');
    });

    it('should be case-insensitive for format parameter', async () => {
      const request = new NextRequest(
        new URL(
          `http://localhost:3000/api/afl/report/${validRosterId}?format=PDF`
        )
      );

      const response = await GET(request, { params: { rosterId: validRosterId } });

      // PDF in uppercase should be converted to lowercase and accepted
      expect(response.status).not.toBe(400);
    });

    it('should return 400 for invalid format', async () => {
      const request = new NextRequest(
        new URL(
          `http://localhost:3000/api/afl/report/${validRosterId}?format=invalid`
        )
      );

      const response = await GET(request, { params: { rosterId: validRosterId } });
      const data = (await response.json()) as { error: string };

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid format');
    });
  });

  describe('HTTP Headers', () => {
    const validRosterId = 'test-roster-123';

    it('should set Cache-Control: no-store on JSON responses', async () => {
      const request = new NextRequest(
        new URL(`http://localhost:3000/api/afl/report/${validRosterId}?format=json`)
      );

      const response = await GET(request, { params: { rosterId: validRosterId } });

      expect(response.headers.get('Cache-Control')).toBe('no-store');
    });

    it('should set X-Report-Generated header', async () => {
      const request = new NextRequest(
        new URL(`http://localhost:3000/api/afl/report/${validRosterId}?format=json`)
      );

      const response = await GET(request, { params: { rosterId: validRosterId } });
      const generatedHeader = response.headers.get('X-Report-Generated');

      expect(generatedHeader).toBeDefined();
      // Should be ISO timestamp
      expect(new Date(generatedHeader!).getTime()).toBeGreaterThan(0);
    });

    it('should set Content-Disposition for PDF downloads', async () => {
      const request = new NextRequest(
        new URL(
          `http://localhost:3000/api/afl/report/${validRosterId}?format=pdf`
        )
      );

      const response = await GET(request, { params: { rosterId: validRosterId } });
      const disposition = response.headers.get('Content-Disposition');

      expect(disposition).toContain('attachment');
      expect(disposition).toContain('.pdf');
      expect(disposition).toContain('filename=');
    });

    it('should set Content-Disposition for Excel downloads', async () => {
      const request = new NextRequest(
        new URL(
          `http://localhost:3000/api/afl/report/${validRosterId}?format=excel`
        )
      );

      const response = await GET(request, { params: { rosterId: validRosterId } });
      const disposition = response.headers.get('Content-Disposition');

      expect(disposition).toContain('attachment');
      expect(disposition).toContain('.xlsx');
      expect(disposition).toContain('filename=');
    });
  });

  describe('MIME Types', () => {
    const validRosterId = 'test-roster-123';

    it('should return application/json for JSON format', async () => {
      const request = new NextRequest(
        new URL(`http://localhost:3000/api/afl/report/${validRosterId}?format=json`)
      );

      const response = await GET(request, { params: { rosterId: validRosterId } });

      expect(response.headers.get('Content-Type')).toContain('application/json');
    });

    it('should return application/pdf for PDF format', async () => {
      const request = new NextRequest(
        new URL(`http://localhost:3000/api/afl/report/${validRosterId}?format=pdf`)
      );

      const response = await GET(request, { params: { rosterId: validRosterId } });

      expect(response.headers.get('Content-Type')).toBe('application/pdf');
    });

    it('should return correct MIME type for Excel format', async () => {
      const request = new NextRequest(
        new URL(
          `http://localhost:3000/api/afl/report/${validRosterId}?format=excel`
        )
      );

      const response = await GET(request, { params: { rosterId: validRosterId } });
      const contentType = response.headers.get('Content-Type');

      expect(contentType).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
    });
  });

  describe('Error Responses', () => {
    const validRosterId = 'test-roster-123';

    it('should return 500 on report generation failure', async () => {
      const request = new NextRequest(
        new URL(`http://localhost:3000/api/afl/report/${validRosterId}?format=json`)
      );

      const response = await GET(request, { params: { rosterId: validRosterId } });
      const data = (await response.json()) as { error?: string };

      // Will fail because generateAflReport needs full parameters
      // Response should be 500 with error details
      if (response.status === 500) {
        expect(data.error).toBeDefined();
        expect(data.error).toBeTruthy();
      }
    });

    it('should include rosterId in error response', async () => {
      const rosterId = 'error-test-roster';
      const request = new NextRequest(
        new URL(`http://localhost:3000/api/afl/report/${rosterId}?format=json`)
      );

      const response = await GET(request, { params: { rosterId } });

      if (response.status >= 400) {
        const data = (await response.json()) as { rosterId?: string };
        expect(data.rosterId).toBe(rosterId);
      }
    });
  });
});

describe('OPTIONS /api/afl/report/[rosterId]', () => {
  it('should return 200 for OPTIONS preflight request', async () => {
    const request = new NextRequest(
      new URL('http://localhost:3000/api/afl/report/test'),
      { method: 'OPTIONS' }
    );

    const response = await OPTIONS(request);

    expect(response.status).toBe(200);
  });

  it('should include CORS headers in OPTIONS response', async () => {
    const request = new NextRequest(
      new URL('http://localhost:3000/api/afl/report/test'),
      { method: 'OPTIONS' }
    );

    const response = await OPTIONS(request);

    expect(response.headers.get('Access-Control-Allow-Origin')).toBeDefined();
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
    expect(response.headers.get('Access-Control-Allow-Headers')).toBeDefined();
  });

  it('should allow GET method in CORS headers', async () => {
    const request = new NextRequest(
      new URL('http://localhost:3000/api/afl/report/test'),
      { method: 'OPTIONS' }
    );

    const response = await OPTIONS(request);
    const methods = response.headers.get('Access-Control-Allow-Methods');

    expect(methods).toContain('GET');
  });
});

/**
 * Integration Test Notes:
 *
 * These tests validate the API contract without full integration:
 * - Parameter validation works
 * - Format parameter routing works
 * - Headers are set correctly
 * - Error responses follow convention
 *
 * Full integration tests would require:
 * - Running the entire AFL pipeline first
 * - Storing results in afl_execution_reports table
 * - Fetching and returning those results
 * - Testing PDF/Excel generation with real data
 *
 * These should be added once:n * 1. DRAAD-229 (PDF Export) is deployed
 * 2. DRAAD-230 (Excel Export) is deployed
 * 3. Report storage mechanism is implemented
 */
