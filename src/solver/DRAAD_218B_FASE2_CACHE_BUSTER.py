"""DRAAD 218B FASE 2 - Cache Buster

Dit bestand triggert een Railway deployment.

FASE 2 VOLTOOID:
- Team-selectie helper methode (_get_team_candidates) toegevoegd
- Team-prioriteit logica geïmplementeerd:
  * TOT: Alle medewerkers (GRO + ORA + OVERIG)
  * GRO: Eerst GRO team, fallback naar OVERIG
  * ORA: Eerst ORA team, fallback naar OVERIG
- _allocate_greedy aangepast om _get_team_candidates te gebruiken
- Extra logging toegevoegd voor debugging

Veranderingen:
1. Nieuwe methode _get_team_candidates(required_team: str) -> List[str]
2. _allocate_greedy gebruikt nu team-gebaseerde kandidatenlijst
3. Debug logging voor team assignments

Timestamp: 2025-12-20 11:08 CET
Commit: 7f4283e7391d94af7a2ef2f199ba372fb6acc0e9
"""

import sys

print("DRAAD 218B FASE 2 - Team-selectie helper methode geïmplementeerd")
print("Deployment getriggerd op Railway.com")
print("SHA: 7f4283e7391d94af7a2ef2f199ba372fb6acc0e9")

sys.exit(0)
