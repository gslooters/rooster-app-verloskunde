'use client'

import { useState } from 'react'

// Types
interface Employee {
  id: string
  name: string
  email: string
  phone: string
  position: string
  department: string
  status: 'active' | 'inactive'
  competencies: string[]
  startDate: string
  avatar?: string
}

const MOCK_EMPLOYEES: Employee[] = [
  {
    id: '1',
    name: 'Dr. Sarah van der Berg',
    email: 'sarah@verloskunde.nl',
    phone: '+31 6 1234 5678',
    position: 'Verloskundige',
    department: 'Verloskunde',
    status: 'active',
    competencies: ['Echoscopie', 'Kraamzorg', 'Bevalling'],
    startDate: '2020-03-15'
  },
  {
    id: '2',
    name: 'Lisa de Jong',
    email: 'lisa@verloskunde.nl',
    phone: '+31 6 2345 6789',
    position: 'Kraamverzorgster',
    department: 'Kraamzorg',
    status: 'active',
    competencies: ['Kraamzorg', 'Borstvoeding'],
    startDate: '2021-01-10'
  },
  {
    id: '3',
    name: 'Emma Bakker',
    email: 'emma@verloskunde.nl',
    phone: '+31 6 3456 7890',
    position: 'Verloskundige',
    department: 'Verloskunde',
    status: 'inactive',
    competencies: ['Bevalling', 'Prenatale zorg'],
    startDate: '2019-09-01'
  }
]

const COMPETENCIES_LIST = [
  'Echoscopie', 'Kraamzorg', 'Bevalling', 'Prenatale zorg', 
  'Postnatale zorg', 'Borstvoeding', 'Neonatologie', 'Pijnbestrijding'
]

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>(MOCK_EMPLOYEES)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all')
  
  const [newEmployee, setNewEmployee] = useState<Omit<Employee, 'id'>>({
    name: '',
    email: '',
    phone: '',
    position: 'Verloskundige',
    department: 'Verloskunde',
    status: 'active',
    competencies: [],
    startDate: new Date().toISOString().split('T')[0]
  })

  // Filter employees
  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         emp.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = filterStatus === 'all' || emp.status === filterStatus
    return matchesSearch && matchesStatus
  })

  // Add new employee
  const handleAddEmployee = () => {
    if (!newEmployee.name || !newEmployee.email) {
      alert('Naam en email zijn verplicht')
      return
    }
    
    const employee: Employee = {
      ...newEmployee,
      id: Date.now().toString()
    }
    
    setEmployees([...employees, employee])
    setNewEmployee({
      name: '',
      email: '',
      phone: '',
      position: 'Verloskundige',
      department: 'Verloskunde',
      status: 'active',
      competencies: [],
      startDate: new Date().toISOString().split('T')[0]
    })
    setShowAddForm(false)
  }

  // Toggle employee status
  const toggleEmployeeStatus = (id: string) => {
    setEmployees(employees.map(emp => 
      emp.id === id 
        ? { ...emp, status: emp.status === 'active' ? 'inactive' : 'active' }
        : emp
    ))
  }

  // Delete employee
  const deleteEmployee = (id: string) => {
    if (confirm('Weet je zeker dat je deze medewerker wilt verwijderen?')) {
      setEmployees(employees.filter(emp => emp.id !== id))
    }
  }

  // Toggle competency
  const toggleCompetency = (competency: string) => {
    const current = editingEmployee || newEmployee
    const competencies = current.competencies.includes(competency)
      ? current.competencies.filter(c => c !== competency)
      : [...current.competencies, competency]
    
    if (editingEmployee) {
      setEditingEmployee({ ...editingEmployee, competencies })
    } else {
      setNewEmployee({ ...newEmployee, competencies })
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <span className="mr-3">👥</span>
                Medewerkers Beheer
              </h1>
              <p className="text-gray-600 mt-1">
                Beheer personeelsgegevens en competenties
              </p>
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center"
            >
              <span className="mr-2">+</span>
              Nieuwe Medewerker
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Zoeken
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Zoek op naam of email..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status Filter
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="all">Alle medewerkers</option>
                <option value="active">Alleen actief</option>
                <option value="inactive">Alleen inactief</option>
              </select>
            </div>
            <div className="flex items-end">
              <div className="text-sm text-gray-600">
                <strong>{filteredEmployees.length}</strong> van <strong>{employees.length}</strong> medewerkers
              </div>
            </div>
          </div>
        </div>

        {/* Employee Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEmployees.map((employee) => (
            <div key={employee.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
              <div className="p-6">
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-3">
                      <span className="text-green-600 font-semibold text-lg">
                        {employee.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{employee.name}</h3>
                      <p className="text-sm text-gray-600">{employee.position}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    employee.status === 'active' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {employee.status === 'active' ? 'Actief' : 'Inactief'}
                  </span>
                </div>

                {/* Contact Info */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <span className="mr-2">📧</span>
                    {employee.email}
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <span className="mr-2">📱</span>
                    {employee.phone}
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <span className="mr-2">🏢</span>
                    {employee.department}
                  </div>
                </div>

                {/* Competencies */}
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Competenties:</p>
                  <div className="flex flex-wrap gap-1">
                    {employee.competencies.map((comp, index) => (
                      <span 
                        key={index}
                        className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                      >
                        {comp}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleEmployeeStatus(employee.id)}
                    className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                      employee.status === 'active'
                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {employee.status === 'active' ? 'Deactiveren' : 'Activeren'}
                  </button>
                  <button
                    onClick={() => deleteEmployee(employee.id)}
                    className="px-3 py-2 bg-gray-100 text-gray-700 rounded text-sm font-medium hover:bg-gray-200 transition-colors"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add Employee Modal */}
        {showAddForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Nieuwe Medewerker Toevoegen</h2>
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Naam *
                    </label>
                    <input
                      type="text"
                      value={newEmployee.name}
                      onChange={(e) => setNewEmployee({...newEmployee, name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="Volledige naam"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={newEmployee.email}
                      onChange={(e) => setNewEmployee({...newEmployee, email: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="email@verloskunde.nl"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Telefoon
                    </label>
                    <input
                      type="tel"
                      value={newEmployee.phone}
                      onChange={(e) => setNewEmployee({...newEmployee, phone: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="+31 6 1234 5678"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Positie
                    </label>
                    <select
                      value={newEmployee.position}
                      onChange={(e) => setNewEmployee({...newEmployee, position: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    >
                      <option value="Verloskundige">Verloskundige</option>
                      <option value="Kraamverzorgster">Kraamverzorgster</option>
                      <option value="Echoscopist">Echoscopist</option>
                      <option value="Administratief">Administratief</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Afdeling
                    </label>
                    <select
                      value={newEmployee.department}
                      onChange={(e) => setNewEmployee({...newEmployee, department: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    >
                      <option value="Verloskunde">Verloskunde</option>
                      <option value="Kraamzorg">Kraamzorg</option>
                      <option value="Echoscopie">Echoscopie</option>
                      <option value="Administratie">Administratie</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Startdatum
                    </label>
                    <input
                      type="date"
                      value={newEmployee.startDate}
                      onChange={(e) => setNewEmployee({...newEmployee, startDate: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>

                {/* Competencies */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Competenties
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {COMPETENCIES_LIST.map((comp) => (
                      <label key={comp} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={newEmployee.competencies.includes(comp)}
                          onChange={() => toggleCompetency(comp)}
                          className="mr-2 rounded border-gray-300 text-green-600 focus:ring-green-500"
                        />
                        <span className="text-sm text-gray-700">{comp}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-4 justify-end">
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Annuleren
                  </button>
                  <button
                    onClick={handleAddEmployee}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Medewerker Toevoegen
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 text-center">
          <a 
            href="/dashboard" 
            className="text-blue-600 hover:text-blue-800 underline flex items-center justify-center"
          >
            <span className="mr-1">←</span>
            Terug naar Dashboard
          </a>
        </div>
      </div>
    </div>
  )
}