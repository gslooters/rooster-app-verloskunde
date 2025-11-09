// ...overige imports...
import TeamSelector from '@/app/_components/TeamSelector';

// ...in PeriodStaffingClient render ...
<TeamSelector
  currentScope={dienstData[0]?.teamScope || 'TEAM_A'}
  onChange={(newScope) => handleTeamScopeChange(dienst.id, newScope)}
  disabled={readOnly}
/>
// ...