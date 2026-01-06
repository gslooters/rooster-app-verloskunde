/**
 * DRAAD 406: PDF DOWNLOAD HANDLER COMPONENT
 * 
 * Utility component to handle PDF download trigger
 * Integrates with /api/reports/[afl_run_id]/pdf endpoint
 * 
 * FEATURES:
 * - Blob response handling
 * - Browser download trigger
 * - Error handling with toast notifications
 * - Loading state management
 * - Filename generation
 */

import React, { useState } from 'react';

interface PDFDownloadHandlerProps {
  afl_run_id: string;
  disabled?: boolean;
  onDownloadStart?: () => void;
  onDownloadComplete?: (filename: string) => void;
  onError?: (error: string) => void;
}

const PDFDownloadHandler: React.FC<PDFDownloadHandlerProps> = ({
  afl_run_id,
  disabled = false,
  onDownloadStart,
  onDownloadComplete,
  onError
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const triggerDownload = async () => {
    if (!afl_run_id) {
      const errorMsg = 'AFL Run ID niet beschikbaar';
      setError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    setIsLoading(true);
    setError(null);
    onDownloadStart?.();

    try {
      console.log(`[PDFDownloadHandler] Initiating PDF download for afl_run_id: ${afl_run_id}`);

      // Call PDF API endpoint
      const response = await fetch(`/api/reports/${afl_run_id}/pdf`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[PDFDownloadHandler] API error: ${response.status}`, errorText);

        let errorMsg = `Error ${response.status}`;
        try {
          const errorData = JSON.parse(errorText);
          errorMsg = errorData.error || errorMsg;
        } catch {}

        throw new Error(errorMsg);
      }

      // Get response as blob
      const blob = await response.blob();
      console.log(`[PDFDownloadHandler] Received PDF blob: ${blob.size} bytes`);

      if (blob.size === 0) {
        throw new Error('PDF is empty');
      }

      // Extract filename from header or generate
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'rapport.pdf';

      if (contentDisposition) {
        const matches = contentDisposition.match(/filename="(.+?)"/);;
        if (matches?.[1]) {
          filename = matches[1];
        }
      }

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';

      // Trigger download
      document.body.appendChild(link);
      link.click();

      // Cleanup
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);
      }, 100);

      console.log(`[PDFDownloadHandler] PDF downloaded successfully: ${filename}`);
      onDownloadComplete?.(filename);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Onbekende fout';
      console.error('[PDFDownloadHandler] Download failed:', err);
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    error,
    triggerDownload
  };
};

/**
 * Hook wrapper for easy integration
 */
export const usePDFDownload = (afl_run_id: string) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const downloadPDF = React.useCallback(async () => {
    if (!afl_run_id) {
      setError('AFL Run ID niet beschikbaar');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/reports/${afl_run_id}/pdf`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error(`PDF generatie mislukt (${response.status})`);
      }

      const blob = await response.blob();

      if (blob.size === 0) {
        throw new Error('PDF is leeg');
      }

      // Extract filename
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `rapport-${afl_run_id.substring(0, 8)}.pdf`;

      if (contentDisposition) {
        const matches = contentDisposition.match(/filename="(.+?)"/);;
        if (matches?.[1]) {
          filename = matches[1];
        }
      }

      // Trigger download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();

      // Cleanup
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);
      }, 100);

      console.log(`✅ PDF downloaded: ${filename}`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Onbekende fout';
      setError(errorMsg);
      console.error('❌ PDF download error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [afl_run_id]);

  return { downloadPDF, isLoading, error };
};

export default PDFDownloadHandler;
