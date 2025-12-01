// API route: PATCH override & DELETE voor ad-hoc roosterconstraint
// Next.js route handler - roster-planning-constraints/[id]
import { NextApiRequest, NextApiResponse } from 'next';
import { updateRosterPlanningConstraint, deleteRosterPlanningConstraint } from '@/lib/db/rosterPlanningConstraints';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const {
    query: { id },
    method
  } = req;

  if (method === 'PATCH') {
    try {
      const updated = await updateRosterPlanningConstraint(id as string, req.body);
      res.status(200).json(updated);
    } catch (error) {
      res.status(500).json({ error: 'Database error' });
    }
  } else if (method === 'DELETE') {
    try {
      await deleteRosterPlanningConstraint(id as string);
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ error: 'Database error' });
    }
  } else {
    res.status(405).end();
  }
}
