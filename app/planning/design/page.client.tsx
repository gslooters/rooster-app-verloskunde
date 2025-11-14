// DRAAD27G - FASE 1: Ellipsis fix + Titel correctie
// Wijziging 1: Periode titel
const periodTitle = `Medewerkers per periode : Week ${firstWeek?.number || ''} - Week ${lastWeek?.number || ''} ${startDate.getFullYear()}`;

// Wijziging 2: Breadcrumb
<nav className="text-sm text-gray-500 mb-3">Dashboard &gt; Rooster Planning &gt; Medewerkers per periode</nav>

// Wijziging 3: Informatief overzicht
<div className="bg-blue-50 p-4 rounded-lg mb-6">
  <p className="text-blue-800">
    <strong>Informatief overzicht:</strong> Dit scherm toont alle toegewezen diensten per medewerker voor deze periode. Wijzig de Dst (doelstelling shifts) per medewerker indien nodig.
  </p>
</div>

// Wijziging 4: Medewerker cel met ellipsis
<td 
  className="sticky left-0 bg-inherit border-b px-3 py-1 font-medium text-gray-900 h-8"
  style={{ minWidth: '160px', maxWidth: '160px' }}
>
  <div className="flex items-center gap-2">
    <TeamBadge team={team} />
    <span 
      className="max-w-[12ch] truncate inline-block" 
      title={`${firstName} (${normalizeTeam(team)})`}
    >
      {firstName}
    </span>
  </div>
</td>