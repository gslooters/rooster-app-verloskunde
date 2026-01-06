/**
 * DRAAD 406: PDF DOWNLOAD HANDLER HOOK
 * 
 * Custom hook to handle PDF download trigger
 * Integrates with /api/reports/[afl_run_id]/pdf endpoint
 * 
 * FEATURES:
 * - Blob response handling
 * - Browser download trigger
 * - Error handling with toast notifications
 * - Loading state management
 * - Filename generation
 * 
 * FIX: Removed React.FC component wrapper (was returning object, not JSX)
 * - Kept only the usePDFDownload hook which is architecturally correct
 * - Hook returns { downloadPDF, isLoading, error } for consumer components
 */

import React, { useState } from 'react';

/**
 * Hook: usePDFDownload
 * 
 * Manages PDF download state and trigger logic
 * 
 * @param afl_run_id - AFL Run ID (UUID format)
 * @returns Object with downloadPDF function and state
 * 
 * @example
 * const { downloadPDF, isLoading, error } = usePDFDownload(afl_run_id);
 * 
 * return (
 *   <button onClick={downloadPDF} disabled={isLoading}>
 *     {isLoading ? 'Downloaden...' : 'PDF Download'}
 *   </button>
 * );
 */
export const usePDFDownload = (afl_run_id: string) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const downloadPDF = React.useCallback(async () => {
    if (!afl_run_id) {
      setError('AFL Run ID niet beschikbaar');
      console.warn('[usePDFDownload] AFL Run ID is missing');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log(`[usePDFDownload] Initiating PDF download for afl_run_id: ${afl_run_id}`);

      // Call PDF API endpoint
      const response = await fetch(`/api/reports/${afl_run_id}/pdf`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[usePDFDownload] API error: ${response.status}`, errorText);

        let errorMsg = `Fout ${response.status}`;
        try {
          const errorData = JSON.parse(errorText);
          errorMsg = errorData.error || errorMsg;
        } catch {
          // Parsing failed, use default error message
          errorMsg = `PDF generatie mislukt (HTTP ${response.status})`;
        }

        throw new Error(errorMsg);
      }

      // Get response as blob
      const blob = await response.blob();
      console.log(`[usePDFDownload] Received PDF blob: ${blob.size} bytes`);

      if (blob.size === 0) {
        throw new Error('PDF is leeg');
      }

      // Extract filename from Content-Disposition header or generate default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `rapport-${afl_run_id.substring(0, 8)}.pdf`;

      if (contentDisposition) {
        const matches = contentDisposition.match(/filename="(.+?)"/);
        if (matches?.[1]) {
          filename = matches[1];
        }
      }

      // Create blob URL and trigger download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';

      // Append to body, click, and cleanup
      document.body.appendChild(link);
      link.click();

      // Cleanup: Remove link and revoke URL after brief delay
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);
      }, 100);

      console.log(`[usePDFDownload] ✅ PDF downloaded successfully: ${filename}`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Onbekende fout bij PDF download';
      console.error('[usePDFDownload] ❌ Download failed:', err);
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [afl_run_id]);

  return { downloadPDF, isLoading, error };
};

export default usePDFDownload;
