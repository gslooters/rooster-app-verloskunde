// API route: PATCH update & DELETE planning constraint by id
// Next.js route handler - services/planning-rules/[id]
import { NextApiRequest, NextApiResponse } from 'next';
import { updatePlanningConstraint, deletePlanningConstraint } from '@/lib/db/planningConstraints';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const {
    query: { id },
    method
  } = req;

  if (method === 'PATCH') {
    try {
      const updated = await updatePlanningConstraint(id as string, req.body);
      res.status(200).json(updated);
    } catch (error) {
      res.status(500).json({ error: 'Database error' });
    }
  } else if (method === 'DELETE') {
    try {
      await deletePlanningConstraint(id as string);
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ error: 'Database error' });
    }
  } else {
    res.status(405).end();
  }
}
