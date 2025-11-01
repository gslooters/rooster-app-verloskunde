'use client'

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            Rooster Dashboard
          </h1>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-900">Rooster Planning</h3>
              <p className="text-blue-700">Bekijk en bewerk roosters</p>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-semibold text-green-900">Medewerkers</h3>
              <p className="text-green-700">Beheer personeelsgegevens</p>
            </div>
            
            <div className="bg-purple-50 p-4 rounded-lg">
              <h3 className="font-semibold text-purple-900">Diensten</h3>
              <p className="text-purple-700">Configureer diensttypen</p>
            </div>
          </div>
          
          <div className="mt-8 p-4 bg-yellow-50 rounded-lg">
            <h3 className="font-medium text-yellow-800">Status</h3>
            <p className="text-yellow-700">
              ✅ App werkt lokaal - Database connectie uitgeschakeld voor testing
            </p>
          </div>
          
          <div className="mt-4">
            <a 
              href="/" 
              className="text-blue-600 hover:text-blue-800 underline"
            >
              ← Terug naar homepage
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
