// API route: GET all planning constraints
// Next.js route handler - services/planning-rules
// returns alle constraints gesorteerd
import { NextApiRequest, NextApiResponse } from 'next';
import { PlanningConstraint } from '@/lib/types/planning-constraint';
import { getAllPlanningConstraints } from '@/lib/db/planningConstraints';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const constraints: PlanningConstraint[] = await getAllPlanningConstraints();
      constraints.sort((a, b) => a.priority - b.priority);
      res.status(200).json(constraints);
    } catch (error) {
      res.status(500).json({ error: 'Database error' });
    }
  } else {
    res.status(405).end();
  }
}
