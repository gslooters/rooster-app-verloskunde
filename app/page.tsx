export default function HomePage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Rooster App Verloskunde</h1>
        <p className="text-gray-600">App werkt lokaal! 🎉</p>
        <div className="mt-4">
          <a href="/dashboard" className="text-blue-500 hover:underline">
            → Dashboard
          </a>
        </div>
      </div>
    </div>
  )
}
