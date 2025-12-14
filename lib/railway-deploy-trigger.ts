// Railway deploy trigger - DRAAD179-FASE1: Backend Storage Denormalization Fix
// Forces Railway to restart both services (rooster-app and solver)
export const DEPLOY_TRIGGER = 1734200427; // DRAAD179 FASE1 roster-period-staffing denormalization deployment
export const DRAAD179_DEPLOYED = '2025-12-14T19:20:27Z';
export const DESCRIPTION = 'FASE1: Fix getRosterPeriodStaffing, updateRosterPeriodStaffing, bulkUpdateRosterPeriodStaffing - use denormalized table';
