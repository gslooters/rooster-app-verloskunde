import PlanningGrid from '../_components/PlanningGrid';

export const dynamic = 'force-dynamic';

export default function RosterDetail({ params }: { params: { id: string } }) {
  return <PlanningGrid rosterId={params.id} />;
}
