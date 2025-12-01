// Server Component voor Planning Rules pagina
// DRAAD95B - Fase 2 UI Implementatie
import { getAllPlanningConstraints } from '@/lib/db/planningConstraints';
import PlanningRulesClient from './PlanningRulesClient';

export const dynamic = 'force-dynamic';

export default async function PlanningRulesPage() {
  // Haal alle constraints op via database helper
  const constraints = await getAllPlanningConstraints();

  return <PlanningRulesClient initialConstraints={constraints} />;
}
