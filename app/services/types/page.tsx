{activeTab === 'teams' ? (
  <div className="p-6">
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Team Groen */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <strong className="text-green-700">Team Groen</strong>
        <DagblokMatrix
          teamRegels={formData.team_groen_regels}
          onChange={(regels) => handleTeamRegelsChange('groen', regels)}
          teamNaam="Groen"
          disabled={editingDienst?.system || submitting}
        />
      </div>
      {/* Team Oranje */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
        <strong className="text-orange-700">Team Oranje</strong>
        <DagblokMatrix
          teamRegels={formData.team_oranje_regels}
          onChange={(regels) => handleTeamRegelsChange('oranje', regels)}
          teamNaam="Oranje"
          disabled={editingDienst?.system || submitting}
        />
      </div>
      {/* Praktijk totaal */}
      <div className="bg-gray-50 border border-blue-200 rounded-lg p-4">
        <strong className="text-blue-700">Praktijk totaal</strong>
        <DagblokMatrix
          teamRegels={formData.team_totaal_regels}
          onChange={(regels) => handleTeamRegelsChange('totaal', regels)}
          teamNaam="Totaal"
          disabled={editingDienst?.system || submitting}
        />
      </div>
    </div>
  </div>
) : (
  /* bestaande basis-tab zoals nu */
)}