# DRAAD 229 – AFL Phase 5: Report Generation & Dashboard Integration – Opdracht voor Nieuwe Draad

**Versie:** 1.0  
**Status:** 🎯 Ready for Implementation  
**Geschatte Duur:** 3-4 uur implementatie  
**Deploy Target:** Railway (production)  
**Prioriteit:** HIGH – Completes AFL pipeline

---

## 📋 SAMENVATTING

Fase 5 is de **FINALE FASE** van de AFL (Autofill) Planning Engine.

**Wat is al klaar (Fase 1-4):**
- ✅ **Phase 1:** Load Engine (laad rooster data)
- ✅ **Phase 2:** Solve Engine (plan diensten)
- ✅ **Phase 3:** DIO/DDO Chain Engine (valideer ketenlogica)
- ✅ **Phase 4:** Database Writer (schrijf terug naar database)
- 🚀 **Railway Deploy:** Succesvol! (21 december 2025)

**Wat Fase 5 moet doen:**
- 📊 **Report Generation:** Genereer AFL execution rapport (JSON/PDF)
- 🎨 **Dashboard Integration:** Toon resultaten in frontend UI
- 📈 **Statistieken & Visualisatie:** Coverage %, open diensten, bottlenecks
- 📧 **Notifications:** Optioneel: e-mail/toast alerts
- 🔄 **Historical Tracking:** Archiveer AFL runs voor audit trail

---

## 🎯 DOELSTELLINGEN FASE 5

### Primair
1. ✅ Genereer uitgebreide AFL execution report (ALTIJD beschikbaar na run)
2. ✅ Toon rapport in dashboard/UI met visuele feedback
3. ✅ Bied export naar PDF voor archivering/printing
4. ✅ Integreer in orchestrator (`runAflPipeline`) zodat report automatisch beschikbaar is

### Secundair
1. ✅ Implementeer AFL run history (archiveer alle runs)
2. ✅ Voeg toast/notification alerts toe (success/warning/error)
3. ✅ Cache rapport 24 uur (geen herbouwen op herlaad)
4. ✅ Voeg AI insights toe (waarom zijn bepaalde diensten open?)

---

## 📊 FASE 5 SCOPE: Wat Moet Precies Gebouwd Worden?

### 5.1 Report Data Structure (JSON)

De `AflExecutionResult` uit Phase 4 moet worden uitgebreid naar `AflReport`:

```typescript
export interface AflReport {
  // Metadata
  success: boolean;
  afl_run_id: string;        // UUID van deze run
  rosterId: string;
  executed_at: Date;
  execution_time_ms: number;
  error?: string | null;

  // Samenvattingen
  summary: {
    total_required: number;      // Totaal diensten nodig
    total_planned: number;       // Totaal ingepland
    total_open: number;          // Totaal nog open
    coverage_percent: number;    // %
    coverage_rating: 'excellent' | 'good' | 'fair' | 'poor'; // >=95%, >=85%, >=70%, <70%
  };

  // Per dienst breakdown
  planned_by_service: Array<{
    service_code: string;        // DIO, RO, etc
    required: number;
    planned: number;
    open: number;
    completion_percent: number;
    team_breakdown?: {
      team: string;              // GRO, ORA, TOT
      required: number;
      planned: number;
      open: number;
    }[];
  }>;

  // Bottleneck services (niet alle ingepland)
  bottleneck_services: Array<{
    service_code: string;
    required: number;
    planned: number;
    open: number;
    open_slots: Array<{          // Welke datum/dagdeel/team?
      date: string;              // ISO date
      dagdeel: string;           // O/M/A
      team: string;              // GRO/ORA/TOT
      aantal: number;            // Hoeveel nog nodig
      reason: string;            // "Onvoldoende RO-medewerkers", etc
    }>;
  }>;

  // Per medewerker capaciteit
  employee_capacity_remaining: Array<{
    employee_id: string;
    employee_name: string;
    team: string;
    dienstverband: string;       // Maat, Loondienst, ZZP
    total_assignments: number;   // Hoeveel diensten totaal
    capacity_by_service: Array<{
      service_code: string;
      planned: number;
      initial_capacity: number;
      remaining: number;
      utilization_percent: number;
    }>;
  }>;

  // Open diensten (nog niet ingepland)
  open_services: Array<{
    date: string;                // ISO date
    dagdeel: string;             // O/M/A
    team: string;                // GRO/ORA/TOT
    service_code: string;
    aantal: number;              // Hoeveel vacatures
    reason: string;              // Waarom kon AFL dit niet vullen?
  }>;

  // Phase timings breakdown
  phase_breakdown: {
    load_ms: number;
    solve_ms: number;
    dio_chains_ms: number;
    database_write_ms: number;
    report_generation_ms: number;
    total_ms: number;
  };

  // Optioneel: AI insights
  ai_insights?: {
    primary_bottleneck: string;  // "Onvoldoende RO-medewerkers in week 47"
    recommendations: string[];    // ["Oproepkracht RO contracting", ...]
    data_quality_issues?: string[]; // ["Employee capacity incorrect", ...]
  };

  // Optioneel: Historical comparison
  previous_runs?: {
    last_run_date: Date;
    last_run_coverage: number;    // %
    trend: 'improving' | 'stable' | 'declining';
  };
}
```

### 5.2 Report Generation Functions

Nieuwe module: `src/lib/afl/report-generator.ts`

```typescript
/**
 * Generate comprehensive AFL report from Phase 4 write results
 */
export async function generateAflReport(
  rosterId: string,
  afl_run_id: string,
  loadResult: AflLoadResult,
  solveResult: SolveResult,
  chainResult: ChainResult,
  writeResult: WriteEngineResult,
  timings: PhaseTimings
): Promise<AflReport>;

/**
 * Export report to PDF
 */
export async function exportReportToPdf(
  report: AflReport
): Promise<Buffer>;

/**
 * Save report to database (archive)
 */
export async function saveReportToDatabase(
  report: AflReport,
  rosterId: string
): Promise<void>;

/**
 * Retrieve previous reports (for comparison)
 */
export async function getPreviousReports(
  rosterId: string,
  limit: number = 5
): Promise<AflReport[]>;
```

### 5.3 Database Schema voor Report Storage

**Optioneel tabel voor archivering:**

```sql
CREATE TABLE afl_execution_reports (
  id UUID PRIMARY KEY,
  afl_run_id UUID NOT NULL,
  roster_id UUID NOT NULL,
  report_data JSONB NOT NULL,        -- Volledige AflReport
  coverage_percent NUMERIC(5,2),     -- For quick filtering
  executed_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (roster_id) REFERENCES roosters(id),
  INDEX (roster_id, executed_at DESC),
  INDEX (afl_run_id)
);
```

### 5.4 Frontend UI Components (React)

**Nieuwe componenten:**

1. **`<AflReportCard />`** – Summary card met coverage %
   - Shows: ✅ 225/260 diensten (86.5% coverage)
   - Color coded: green (>95%), yellow (85-95%), orange (70-85%), red (<70%)
   - Quick action button: "Details"

2. **`<AflReportModal />`** – Expanded report modal
   - Tabbed interface:
     - **Summary:** Coverage, timing, key metrics
     - **By Service:** Table met per dienst breakdown
     - **Bottlenecks:** Services met open slots
     - **Employee Utilization:** Medewerker capacity
     - **Open Slots:** Welke datum/dagdeel/team nog open
     - **History:** Vorige AFL runs (trend)
   - Export button (PDF)

3. **`<AflExecutionIndicator />`** – Real-time status during run
   - Phase indicator: "Loading... → Solving... → Validating chains... → Writing DB..."
   - Progress bar
   - Current timing display

4. **`<AflToastNotifications />`** – Notifications
   - Success: "✅ AFL complete! 225/260 slots filled (86.5%)"
   - Warning: "⚠️ AFL complete but 3 bottleneck services remain open"
   - Error: "❌ AFL failed: Database write error"

### 5.5 Orchestrator Integration

Update `runAflPipeline()` function:

```typescript
export async function runAflPipeline(rosterId: string): Promise<AflExecutionResult> {
  const pipelineStartTime = performance.now();
  const afl_run_id = randomUUID();

  try {
    // Phase 1: Load
    const loadResult = await runPhase1Load(rosterId);
    const load_ms = loadResult.load_duration_ms;

    // Phase 2: Solve
    const solveResult = await runPhase2Solve(loadResult);
    const solve_ms = solveResult.solve_duration_ms;

    // Phase 3: DIO/DDO Chains
    const chainResult = await runPhase3Chains(loadResult, solveResult);
    const dio_chains_ms = chainResult.processing_duration_ms;

    // Phase 4: Database Write
    const writeResult = await runPhase4Write(rosterId, loadResult, afl_run_id);
    const database_write_ms = writeResult.database_write_ms;

    // Phase 5: Report Generation (NEW)
    const reportStartTime = performance.now();
    const report = await generateAflReport(
      rosterId,
      afl_run_id,
      loadResult,
      solveResult,
      chainResult,
      writeResult,
      { load_ms, solve_ms, dio_chains_ms, database_write_ms }
    );
    const report_generation_ms = performance.now() - reportStartTime;

    // Phase 5b: Archive report (NEW)
    await saveReportToDatabase(report, rosterId);

    const execution_time_ms = performance.now() - pipelineStartTime;

    return {
      success: true,
      afl_run_id,
      rosterId,
      execution_time_ms,
      report,  // <-- NEW: Include full report
      phase_timings: {
        load_ms,
        solve_ms,
        dio_chains_ms,
        database_write_ms,
        report_generation_ms
      }
    };
  } catch (error) {
    // Generate error report
    const error_message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      afl_run_id,
      rosterId,
      execution_time_ms: performance.now() - pipelineStartTime,
      error: error_message,
      report: null
    };
  }
}
```

---

## 🏗️ IMPLEMENTATIE STAPPEN

### Stap 1: Repo Setup (5 min)
- [ ] Clone repo / checkout main branch
- [ ] Verify Phase 1-4 code is present and working
- [ ] Check Railway deployment is live

### Stap 2: Report Generator Module (45 min)
- [ ] Create `src/lib/afl/report-generator.ts`
- [ ] Implement `generateAflReport()` function
- [ ] Implement report calculations (coverage %, bottlenecks, etc)
- [ ] Add TypeScript types for AflReport
- [ ] **Verify:** No TypeScript errors

### Stap 3: PDF Export (30 min)
- [ ] Install dependency: `npm install jspdf html2canvas`
- [ ] Implement `exportReportToPdf()` using jsPDF
- [ ] Create report layout (A4 friendly)
- [ ] Add header/footer, charts, tables
- [ ] **Verify:** PDF export works

### Stap 4: Database Report Storage (30 min)
- [ ] Create migration: `afl_execution_reports` table
- [ ] Implement `saveReportToDatabase()`
- [ ] Implement `getPreviousReports()`
- [ ] Add caching layer (24hr cache)
- [ ] **Verify:** Reports are archived

### Stap 5: Frontend UI Components (60 min)
- [ ] Create `<AflReportCard />` component
- [ ] Create `<AflReportModal />` component
- [ ] Create `<AflExecutionIndicator />` component
- [ ] Create `<AflToastNotifications />` component
- [ ] Style with Tailwind CSS (per design system)
- [ ] **Verify:** Components render correctly

### Stap 6: Page Integration (45 min)
- [ ] Create/update rooster planning page
- [ ] Add "Run AFL" button → triggers orchestrator
- [ ] Show loading indicator during execution
- [ ] Display report card upon completion
- [ ] Add error handling
- [ ] **Verify:** Full workflow works end-to-end

### Stap 7: Orchestrator Integration (30 min)
- [ ] Update `runAflPipeline()` with Phase 5 call
- [ ] Include report in AflExecutionResult
- [ ] Add error handling for report generation
- [ ] Ensure timings are accurate
- [ ] **Verify:** Orchestrator returns full report

### Stap 8: Testing (60 min)
- [ ] Unit tests for report calculations
- [ ] Integration test: full pipeline end-to-end
- [ ] Manual test: Run AFL on test rooster
- [ ] PDF export test: verify output
- [ ] UI test: modal, cards, notifications
- [ ] **Verify:** All tests pass

### Stap 9: Documentation (30 min)
- [ ] Add comments to report generator
- [ ] Create user guide (how to read report)
- [ ] Document API endpoints
- [ ] Update README

### Stap 10: Deployment (30 min)
- [ ] Commit to GitHub with clear messages
- [ ] Deploy to Railway
- [ ] Verify production build succeeds
- [ ] Test in production environment
- [ ] Monitor logs for errors

---

## 📋 FUNCTIONELE REQUIREMENTS

### Report Must Include

✅ **Coverage Summary**
- Total required diensten
- Total planned diensten
- Total open diensten
- Coverage percentage + rating (excellent/good/fair/poor)

✅ **Service Breakdown**
- Per service: required, planned, open, completion %
- Team breakdown (GRO/ORA/TOT per service)

✅ **Bottleneck Analysis**
- Which services have open slots?
- Which teams/dagdelen are problematic?
- Why are they open? (Reason: "Insufficient RO-trained staff", etc)

✅ **Employee Utilization**
- Per employee: total assignments, capacity remaining
- Per service per employee: planned, initial capacity, remaining, utilization %

✅ **Open Slots Detail**
- All unfilled slots: date, dagdeel, team, service, number needed, reason

✅ **Phase Timings**
- Each phase execution time
- Total pipeline time

✅ **AI Insights** (Optional)
- Primary bottleneck
- Recommendations for planner
- Data quality issues detected

---

## 🎨 UI/UX REQUIREMENTS

### Report Card (Summary View)
```
┌─────────────────────────────────────────┐
│ 📊 AFL Execution Report                  │
├─────────────────────────────────────────┤
│ ✅ Execution: 21-12-2025 11:45          │
│ ⏱️  Duration: 6.2 seconds               │
│                                         │
│ Coverage: 225/260 (86.5%) ████████░    │
│ Rating: GOOD ✅                        │
│                                         │
│ 📍 Planned: 225 | Open: 35             │
│                                         │
│ ⚠️  3 bottleneck services              │
│                                         │
│ [View Details] [Export PDF] [History]  │
└─────────────────────────────────────────┘
```

### Report Modal (Detailed View)
```
┌────────────────────────────────────────────────┐
│ AFL Execution Report - Detailed View     [✕]  │
├─────────────────────────────────────────────────┤
│ [Summary] [By Service] [Bottlenecks] [Emp Cap] │
│ [Open Slots] [History] [AI Insights]          │
├─────────────────────────────────────────────────┤
│                                                 │
│ SUMMARY TAB:                                    │
│                                                 │
│ Execution Time: 21-12-2025 11:45:22            │
│ Duration: 6.2 seconds                          │
│ AFL Run ID: a1b2c3d4-e5f6-...                 │
│                                                 │
│ Coverage Statistics:                            │
│ • Total Required: 260 diensten                  │
│ • Total Planned: 225 diensten (86.5%)          │
│ • Total Open: 35 diensten (13.5%)              │
│ • Rating: GOOD ✅                             │
│                                                 │
│ Phase Breakdown:                                │
│ • Load: 450ms                                   │
│ • Solve: 3800ms                                 │
│ • DIO/DDO Chains: 1200ms                       │
│ • Database Write: 650ms                         │
│ • Report Generation: 102ms                      │
│ • TOTAL: 6.2 seconds                           │
│                                                 │
│ [Export PDF] [Download JSON] [Export Excel]   │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 🔄 INTEGRATION CHECKLIST

### With Existing Code
- [ ] Report generator uses existing `AflLoadResult`, `SolveResult`, `ChainResult`, `WriteEngineResult`
- [ ] Report generator exports via `src/lib/afl/index.ts`
- [ ] Orchestrator (`runAflPipeline`) imports and calls report generator
- [ ] Frontend pages import report UI components
- [ ] Database migration handles afl_execution_reports table

### Backward Compatibility
- [ ] Existing `AflExecutionResult` interface still works (just add `report` field)
- [ ] All Phase 1-4 code unchanged
- [ ] Database schema is additive only (no breaking changes)

---

## 📊 PERFORMANCE TARGETS

| Phase | Target | Acceptable Range |
|-------|--------|------------------|
| Report Generation | <300ms | <500ms |
| PDF Export | <1000ms | <2000ms |
| **Total AFL Pipeline (incl Phase 5)** | **~7 sec** | **<10 sec** |

---

## 🧪 TESTING STRATEGY

### Unit Tests
- [ ] Report calculation logic (coverage %, bottleneck detection)
- [ ] PDF generation
- [ ] Report data structure validation
- [ ] Service breakdown accuracy

### Integration Tests
- [ ] Full AFL pipeline (Phase 1→5)
- [ ] Report generation with real rooster data
- [ ] Database archiving
- [ ] Report retrieval

### Manual Tests
- [ ] Run AFL on test rooster → verify report
- [ ] Export PDF → open and verify layout
- [ ] UI modal interactions → navigation works
- [ ] Historical runs → previous reports load
- [ ] Error scenarios → error report generated

---

## 🚀 DEPLOYMENT CHECKLIST

- [ ] All code committed to main branch
- [ ] TypeScript compilation succeeds (`npm run build`)
- [ ] ESLint passes (`npm run lint`)
- [ ] All tests pass (`npm test`)
- [ ] Database migration applied (if needed)
- [ ] Railway deploy succeeds
- [ ] Production verification:
  - [ ] AFL runs complete
  - [ ] Report displays correctly
  - [ ] PDF export works
  - [ ] No errors in logs

---

## 📈 SUCCESS CRITERIA (Phase 5 COMPLETE)

✅ **Mandatory:**
- [ ] Report generated for every AFL run
- [ ] Report includes all required fields (coverage, bottlenecks, employee utilization)
- [ ] Frontend displays report in card + modal
- [ ] PDF export works
- [ ] Orchestrator returns full report
- [ ] TypeScript compiles without errors
- [ ] Tests passing
- [ ] Railway deployment successful

✅ **Nice-to-Have:**
- [ ] AI insights/recommendations
- [ ] Historical trend analysis
- [ ] Email notifications
- [ ] Report caching
- [ ] Advanced filtering in UI

---

## 📝 DEFINITION OF DONE (Fase 5)

Phase 5 is **COMPLETE** when:

1. ✅ Report generator module fully implemented
2. ✅ All report calculations accurate and tested
3. ✅ PDF export functional
4. ✅ Frontend UI components beautiful and user-friendly
5. ✅ Orchestrator integrated (Phase 1→5 complete)
6. ✅ Database archiving working
7. ✅ Full pipeline tested end-to-end (input rooster → report)
8. ✅ Deployed to Railway production
9. ✅ No TypeScript/ESLint errors
10. ✅ All tests passing
11. ✅ Documentation complete
12. ✅ Logs monitored post-deployment (no errors)

---

## 🎯 OUTCOME

After Phase 5 completion:

🎉 **AFL Planning Engine is PRODUCTION READY**

- ✅ Fully automated rooster planning (Phase 1→5)
- ✅ 85-95% automatic coverage
- ✅ Comprehensive reporting & insights
- ✅ Beautiful UI dashboard
- ✅ PDF export for archiving
- ✅ Historical tracking & trend analysis
- ✅ Deployed on Railway cloud
- ✅ Ready for end-user testing

**Next Steps (Future):**
- Enhancements: Advanced AI insights, email notifications, manual override UI
- Optimization: Performance tuning for larger rosters
- Integrations: Slack notifications, calendar sync

---

**Einde DRAAD 229 – Phase 5 Opdracht**

**Deze beschrijving is bedoeld om in de volgende draad (DRAAD 229 – Phase 5: Report Generation) als startpunt te gebruiken.**
