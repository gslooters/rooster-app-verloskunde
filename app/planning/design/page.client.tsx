// ...bovenkant blijft hetzelfde (functies/gebruikersinstructie)...
// Wijzig alleen de router.push hieronder:

// ...binnen de export default function DesignPageClient...
// ...rest van component ongewijzigd, behalve button click...

          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            onClick={() => router.push('/dashboard/ontwerp')}
          >
            Terug naar dashboard
          </button>
// ...rest van de component blijft gelijk...
// N.B. Zorg dat je voor de daadwerkelijke implementatie het exacte pad invult waar 'Dashboard Rooster Ontwerp' zich bevindt. (Gebruik bijv. '/dashboard/ontwerp', '/planning/design/dashboard', of het juiste path uit de routing-structuur.)
