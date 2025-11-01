'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Employee {
  id: string
  naam: string
  initialen: string
  actief: boolean
  created_at: string
}

export default function DatabaseTest() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    testDatabase()
  }, [])

  async function testDatabase() {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
      
      if (error) throw error
      setEmployees(data || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-3xl font-bold mb-6">🧪 Database Connection Test</h1>
          
          {loading && (
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
              <p className="text-blue-800">Testing database connection...</p>
            </div>
          )}
          
          {error && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
              <h3 className="font-bold text-red-800">Connection Error:</h3>
              <p className="text-red-700">{error}</p>
            </div>
          )}
          
          {!loading && !error && (
            <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-6">
              <h3 className="font-bold text-green-800">✅ Database Connected Successfully!</h3>
              <p className="text-green-700">Found {employees.length} employees in database</p>
            </div>
          )}
          
          <div className="grid gap-4 mt-6">
            <h2 className="text-xl font-semibold">Employee Data:</h2>
            {employees.map((emp) => (
              <div key={emp.id} className="border rounded-lg p-4 bg-gray-50">
                <h3 className="font-semibold text-lg">{emp.naam}</h3>
                <p className="text-gray-600">Initialen: {emp.initialen}</p>
                <p className="text-sm text-gray-500">ID: {emp.id}</p>
              </div>
            ))}
          </div>
          
          <div className="mt-8 flex gap-4">
            <a href="/dashboard" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
              ← Dashboard
            </a>
            <button 
              onClick={testDatabase}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              🔄 Test Again
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
