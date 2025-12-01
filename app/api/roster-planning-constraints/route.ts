// API route: GET by roosterid voor rosterplanningconstraints
// Next.js route handler - rooster-specifiek
import { NextApiRequest, NextApiResponse } from 'next';
import { RosterPlanningConstraint } from '@/lib/types/planning-constraint';
import { getRosterPlanningConstraintsByRoosterId } from '@/lib/db/rosterPlanningConstraints';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const { roosterid } = req.query;
    if (!roosterid) {
      res.status(400).json({ error: 'roosterid verplicht' });
      return;
    }
    try {
      const constraints: RosterPlanningConstraint[] = await getRosterPlanningConstraintsByRoosterId(roosterid as string);
      res.status(200).json(constraints);
    } catch (error) {
      res.status(500).json({ error: 'Database error' });
    }
  } else {
    res.status(405).end();
  }
}
