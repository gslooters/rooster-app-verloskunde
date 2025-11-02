'use client';

export default function ComingSoonPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
      <div className="max-w-lg mx-auto bg-white rounded-xl shadow-lg p-8 text-center">
        {/* Illustration */}
        <div className="mb-6">
          <div className="w-32 h-32 mx-auto bg-gradient-to-br from-blue-100 to-green-100 rounded-full flex items-center justify-center">
            <span className="text-6xl">🛠️</span>
          </div>
        </div>
        
        {/* Content */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
        <p className="text-gray-600 mb-6">{description}</p>
        
        <div className="bg-blue-50 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2">Nog in Ontwerp</h3>
          <p className="text-blue-700 text-sm">
            Deze functionaliteit wordt binnenkort toegevoegd. <br/>
            Keer terug naar het dashboard voor beschikbare opties.
          </p>
        </div>
        
        {/* Back Button */}
        <a 
          href="/dashboard" 
          className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <span className="mr-2">←</span>
          Terug naar Dashboard
        </a>
      </div>
    </div>
  );
}
