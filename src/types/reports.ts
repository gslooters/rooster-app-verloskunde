/**
 * DRAAD 406: PDF RAPPORT EXPORT TYPE DEFINITIONS
 * 
 * Type-safe interfaces voor:
 * - AFL execution reports (database)
 * - Rooster context (dates, status)
 * - PDF response handling
 * - Report data structure
 */

export interface AFLExecutionReport {
  id: string;
  roster_id: string;
  afl_run_id: string;
  report_data: ReportData;
  created_at: string;
}

export interface ReportData {
  bezettingsgraad: number;        // %
  uitvoeringsduur: string;        // "29.15s"
  diensten_ingepland: number;     // absolute count
  diensten_totaal: number;        // absolute count
  afl_run_id?: string;
  [key: string]: any;             // flexible for future fields
}

export interface RosterContext {
  id: string;
  start_date: string;             // ISO date
  end_date: string;               // ISO date
  status: string;                 // "active", "completed", etc
  created_at: string;
  updated_at: string;
}

export interface PDFGenerationRequest {
  afl_run_id: string;
}

export interface PDFGenerationResponse {
  success: boolean;
  message?: string;
  filename?: string;
  timestamp?: string;
}

export interface PDFReportContent {
  title: string;
  roosterPeriod: {
    startDate: string;
    endDate: string;
    duration: string;
  };
  metrics: {
    bezettingsgraad: number;
    dienstenIngepland: number;
    dienstenTotaal: number;
    uitvoeringsduur: string;
  };
  aflRunId: string;
  generatedAt: string;
}
