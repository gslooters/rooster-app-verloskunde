// ...in DashboardClient component rond regel 187
// Vervang:
// <button onClick={()=>router.push(`/planning/design?rosterId=${rosterId}`)} ...>
// door:
<button onClick={()=>router.push(`/planning/design/unavailability?rosterId=${rosterId}`)} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium whitespace-nowrap">Openen →</button>