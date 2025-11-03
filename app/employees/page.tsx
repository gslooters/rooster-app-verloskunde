'use client'

import { useState, useMemo, useCallback } from 'react'
import * as XLSX from 'xlsx'

// 🏗️ Enhanced Employee Interface
interface Employee {
  id: string
  voornaam: string        // VERPLICHT
  achternaam: string      // VERPLICHT  
  email?: string          // OPTIONEEL
  telefoon?: string       // OPTIONEEL
  functie: string         // Dropdown values
  startdatum: string      // ISO date
  status: 'active' | 'inactive'  // CRUCIAAL voor roosters
  competencies: string[]
  avatar?: string
  services: string[]      // Voor diensten toewijzing
  afdeling: string        // Department
}

// 🎯 Service Types voor Diensten Toewijzing
interface ServiceType {
  id: string
  name: string
  code: string
  color: string
  description: string
  requiredCompetencies: string[]
}

// 📊 Statistics Interface
interface Statistics {
  total: number
  active: number
  inactive: number
  byDepartment: Array<{
    name: string
    count: number
    active: number
  }>
  byFunction: Array<{
    name: string
    count: number
  }>
  competencyStats: Array<{
    name: string
    count: number
  }>
}

// 🧪 Mock Data - Enhanced
const MOCK_EMPLOYEES: Employee[] = [
  {
    id: '1',
    voornaam: 'Sarah',
    achternaam: 'van der Berg',
    email: 'sarah@verloskunde.nl',
    telefoon: '+31 6 1234 5678',
    functie: 'Verloskundige',
    afdeling: 'Verloskunde',
    status: 'active',
    competencies: ['Echoscopie', 'Kraamzorg', 'Bevalling'],
    startdatum: '2020-03-15',
    services: ['s', 'd', 'echo']
  },
  {
    id: '2',
    voornaam: 'Lisa',
    achternaam: 'de Jong',
    email: 'lisa@verloskunde.nl',
    telefoon: '+31 6 2345 6789',
    functie: 'Kraamverzorgster',
    afdeling: 'Kraamzorg',
    status: 'active',
    competencies: ['Kraamzorg', 'Borstvoeding'],
    startdatum: '2021-01-10',
    services: ['s', 'd']
  },
  {
    id: '3',
    voornaam: 'Emma',
    achternaam: 'Bakker',
    email: 'emma@verloskunde.nl',
    telefoon: '+31 6 3456 7890',
    functie: 'Verloskundige',
    afdeling: 'Verloskunde',
    status: 'inactive',
    competencies: ['Bevalling', 'Prenatale zorg'],
    startdatum: '2019-09-01',
    services: ['d', 'nd']
  },
  {
    id: '4',
    voornaam: 'Anna',
    achternaam: 'Jansen',
    email: 'anna@verloskunde.nl',
    telefoon: '+31 6 4567 8901',
    functie: 'Echoscopist',
    afdeling: 'Echoscopie',
    status: 'active',
    competencies: ['Echoscopie', 'Prenatale zorg'],
    startdatum: '2022-06-01',
    services: ['echo']
  },
  {
    id: '5',
    voornaam: 'Bram',
    achternaam: 'Peters',
    email: 'bram@verloskunde.nl',
    telefoon: '+31 6 5678 9012',
    functie: 'Verloskundige',
    afdeling: 'Verloskunde',
    status: 'active',
    competencies: ['Bevalling', 'Nachtdienst', 'Spoedzorg'],
    startdatum: '2021-11-15',
    services: ['s', 'd', 'nd', 'ss']
  },
  {
    id: '6',
    voornaam: 'Carla',
    achternaam: 'Smit',
    email: 'carla@verloskunde.nl',
    telefoon: '+31 6 6789 0123',
    functie: 'Assistent',
    afdeling: 'Administratie',
    status: 'active',
    competencies: ['Administratie', 'Planning'],
    startdatum: '2023-02-01',
    services: ['s']
  }
]

const COMPETENCIES_LIST = [
  'Echoscopie', 'Kraamzorg', 'Bevalling', 'Prenatale zorg', 
  'Postnatale zorg', 'Borstvoeding', 'Neonatologie', 'Pijnbestrijding',
  'Nachtdienst', 'Spoedzorg', 'Weekend dienst', 'Administratie', 'Planning'
]

const FUNCTIES_LIST = [
  'Verloskundige', 'Kraamverzorgster', 'Echoscopist', 
  'Administratief Medewerker', 'Assistent', 'Coördinator'
]

const AFDELINGEN_LIST = [
  'Verloskunde', 'Kraamzorg', 'Echoscopie', 'Administratie'
]

const SERVICE_TYPES: ServiceType[] = [
  { id: 's', name: 'Shift', code: 's', color: 'bg-blue-500', description: 'Reguliere shift dienst', requiredCompetencies: [] },
  { id: 'd', name: 'Dagdienst', code: 'd', color: 'bg-green-500', description: 'Dagdienst verloskunde', requiredCompetencies: ['Bevalling'] },
  { id: 'nd', name: 'Nachtdienst', code: 'nd', color: 'bg-gray-800', description: 'Nachtdienst 20:00-08:00', requiredCompetencies: ['Nachtdienst'] },
  { id: 'echo', name: 'Echo', code: 'echo', color: 'bg-orange-500', description: 'Echoscopie diensten', requiredCompetencies: ['Echoscopie'] },
  { id: 'sp', name: 'Speciaal', code: 'sp', color: 'bg-purple-500', description: 'Speciale diensten', requiredCompetencies: [] },
  { id: 'ss', name: 'Weekend', code: 'ss', color: 'bg-red-500', description: 'Weekend diensten', requiredCompetencies: ['Weekend dienst'] }
]

type TabType = 'employees' | 'services' | 'reports'
type SortField = 'voornaam' | 'achternaam' | 'functie' | 'startdatum' | 'status'
type SortDirection = 'asc' | 'desc'

export default function OptimizedEmployeesPage() {
  // 🏗️ State Management
  const [employees, setEmployees] = useState<Employee[]>(MOCK_EMPLOYEES)
  const [activeTab, setActiveTab] = useState<TabType>('employees')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null)
  
  // 🔍 Search & Filter State
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [filterAfdeling, setFilterAfdeling] = useState<string>('all')
  const [filterFunctie, setFilterFunctie] = useState<string>('all')
  const [sortField, setSortField] = useState<SortField>('voornaam')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  
  const [newEmployee, setNewEmployee] = useState<Omit<Employee, 'id'>>({
    voornaam: '',
    achternaam: '',
    email: '',
    telefoon: '',
    functie: 'Verloskundige',
    afdeling: 'Verloskunde',  
    status: 'active',
    competencies: [],
    startdatum: new Date().toISOString().split('T')[0],
    services: []
  })

  // 🧮 Computed Values
  const afdelingen = useMemo(() => AFDELINGEN_LIST, [])
  const functies = useMemo(() => FUNCTIES_LIST, [])

  const filteredAndSortedEmployees = useMemo(() => {
    let filtered = employees.filter(emp => {
      const fullName = `${emp.voornaam} ${emp.achternaam}`.toLowerCase()
      const matchesSearch = fullName.includes(searchTerm.toLowerCase()) ||
                           (emp.email?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
                           emp.functie.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = filterStatus === 'all' || emp.status === filterStatus
      const matchesAfdeling = filterAfdeling === 'all' || emp.afdeling === filterAfdeling
      const matchesFunctie = filterFunctie === 'all' || emp.functie === filterFunctie
      return matchesSearch && matchesStatus && matchesAfdeling && matchesFunctie
    })

    // Sorting
    filtered.sort((a, b) => {
      let aValue: string | number = ''
      let bValue: string | number = ''
      
      switch (sortField) {
        case 'voornaam':
          aValue = a.voornaam.toLowerCase()
          bValue = b.voornaam.toLowerCase()
          break
        case 'achternaam':
          aValue = a.achternaam.toLowerCase()
          bValue = b.achternaam.toLowerCase()
          break
        case 'functie':
          aValue = a.functie.toLowerCase()
          bValue = b.functie.toLowerCase()
          break
        case 'startdatum':
          aValue = new Date(a.startdatum).getTime()
          bValue = new Date(b.startdatum).getTime()
          break
        case 'status':
          aValue = a.status
          bValue = b.status
          break
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    return filtered
  }, [employees, searchTerm, filterStatus, filterAfdeling, filterFunctie, sortField, sortDirection])

  // 📊 Statistics
  const statistics = useMemo<Statistics>(() => {
    const total = employees.length
    const active = employees.filter(emp => emp.status === 'active').length
    const inactive = total - active

    const byDepartment = afdelingen.map(afd => ({
      name: afd,
      count: employees.filter(emp => emp.afdeling === afd).length,
      active: employees.filter(emp => emp.afdeling === afd && emp.status === 'active').length
    }))

    const byFunction = functies.map(func => ({
      name: func,
      count: employees.filter(emp => emp.functie === func).length
    }))

    const competencyStats = COMPETENCIES_LIST.map(comp => ({
      name: comp,
      count: employees.filter(emp => emp.competencies.includes(comp) && emp.status === 'active').length
    })).sort((a, b) => b.count - a.count)
    
    return { total, active, inactive, byDepartment, byFunction, competencyStats }
  }, [employees, afdelingen, functies])

  // ⚡ Helper Functions
  const showNotification = useCallback((type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 4000)
  }, [])

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }, [sortField, sortDirection])

  const resetForm = useCallback(() => {
    setNewEmployee({
      voornaam: '',
      achternaam: '',
      email: '',
      telefoon: '',
      functie: 'Verloskundige',
      afdeling: 'Verloskunde',
      status: 'active',
      competencies: [],
      startdatum: new Date().toISOString().split('T')[0],
      services: []
    })
  }, [])

  const handleAddEmployee = useCallback(() => {
    if (!newEmployee.voornaam.trim() || !newEmployee.achternaam.trim()) {
      showNotification('error', 'Voornaam en achternaam zijn verplicht')
      return
    }
    
    const employee: Employee = {
      ...newEmployee,
      id: `emp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
    
    setEmployees(prev => [...prev, employee])
    resetForm()
    setShowAddForm(false)
    showNotification('success', `${employee.voornaam} ${employee.achternaam} is toegevoegd`)
  }, [newEmployee, resetForm, showNotification])

  const handleUpdateEmployee = useCallback(() => {
    if (!editingEmployee) return
    
    if (!editingEmployee.voornaam.trim() || !editingEmployee.achternaam.trim()) {
      showNotification('error', 'Voornaam en achternaam zijn verplicht')
      return
    }
    
    setEmployees(prev => prev.map(emp => 
      emp.id === editingEmployee.id ? editingEmployee : emp
    ))
    setEditingEmployee(null)
    showNotification('success', `${editingEmployee.voornaam} ${editingEmployee.achternaam} is bijgewerkt`)
  }, [editingEmployee, showNotification])

  const toggleEmployeeStatus = useCallback((id: string) => {
    setEmployees(prev => prev.map(emp => {
      if (emp.id === id) {
        const newStatus = emp.status === 'active' ? 'inactive' : 'active'
        showNotification('success', `${emp.voornaam} ${emp.achternaam} is ${newStatus === 'active' ? 'geactiveerd' : 'gedeactiveerd'}`)
        return { ...emp, status: newStatus }
      }
      return emp
    }))
  }, [showNotification])

  const deleteEmployee = useCallback((id: string) => {
    const employee = employees.find(emp => emp.id === id)
    if (employee && confirm(`Weet je zeker dat je ${employee.voornaam} ${employee.achternaam} wilt verwijderen?`)) {
      setEmployees(prev => prev.filter(emp => emp.id !== id))
      showNotification('success', `${employee.voornaam} ${employee.achternaam} is verwijderd`)
    }
  }, [employees, showNotification])

  const duplicateEmployee = useCallback((id: string) => {
    const employee = employees.find(emp => emp.id === id)
    if (employee) {
      const duplicate: Employee = {
        ...employee,
        id: `emp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        voornaam: `${employee.voornaam} (Kopie)`,
        email: employee.email ? `kopie_${employee.email}` : '',
      }
      setEmployees(prev => [...prev, duplicate])
      showNotification('success', `${employee.voornaam} ${employee.achternaam} is gedupliceerd`)
    }
  }, [employees, showNotification])

  const handleBulkStatusChange = useCallback((status: 'active' | 'inactive') => {
    setEmployees(prev => prev.map(emp => 
      selectedEmployees.includes(emp.id) ? { ...emp, status } : emp
    ))
    setSelectedEmployees([])
    showNotification('success', `${selectedEmployees.length} medewerker(s) ${status === 'active' ? 'geactiveerd' : 'gedeactiveerd'}`)
  }, [selectedEmployees, showNotification])

  const handleSelectEmployee = useCallback((id: string) => {
    setSelectedEmployees(prev => 
      prev.includes(id) 
        ? prev.filter(empId => empId !== id)
        : [...prev, id]
    )
  }, [])

  const handleSelectAll = useCallback(() => {
    if (selectedEmployees.length === filteredAndSortedEmployees.length) {
      setSelectedEmployees([])
    } else {
      setSelectedEmployees(filteredAndSortedEmployees.map(emp => emp.id))
    }
  }, [selectedEmployees.length, filteredAndSortedEmployees])

  // 📤 Export Functions
  const exportToExcel = useCallback(() => {
    setLoading(true)
    try {
      const exportData = employees.map(emp => ({
        'Voornaam': emp.voornaam,
        'Achternaam': emp.achternaam,
        'Email': emp.email || '',
        'Telefoon': emp.telefoon || '',
        'Functie': emp.functie,
        'Afdeling': emp.afdeling,
        'Status': emp.status === 'active' ? 'Actief' : 'Inactief',
        'Startdatum': emp.startdatum,
        'Competenties': emp.competencies.join(', '),
        'Diensten': emp.services.join(', ')
      }))

      const ws = XLSX.utils.json_to_sheet(exportData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Medewerkers')
      
      // Auto-width columns
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
      const colWidths = []
      for (let C = range.s.c; C <= range.e.c; ++C) {
        let maxWidth = 10
        for (let R = range.s.r; R <= range.e.r; ++R) {
          const cell = ws[XLSX.utils.encode_cell({r: R, c: C})]
          if (cell && cell.v) {
            maxWidth = Math.max(maxWidth, cell.v.toString().length)
          }
        }
        colWidths.push({ width: Math.min(maxWidth + 2, 50) })
      }
      ws['!cols'] = colWidths

      XLSX.writeFile(wb, `medewerkers_${new Date().toISOString().split('T')[0]}.xlsx`)
      showNotification('success', 'Excel bestand gedownload')
    } catch (error) {
      showNotification('error', 'Fout bij Excel export: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }, [employees, showNotification])

  const exportToCSV = useCallback(() => {
    setLoading(true)
    try {
      const exportData = employees.map(emp => ({
        'Voornaam': emp.voornaam,
        'Achternaam': emp.achternaam,
        'Email': emp.email || '',
        'Telefoon': emp.telefoon || '',
        'Functie': emp.functie,
        'Afdeling': emp.afdeling,
        'Status': emp.status === 'active' ? 'Actief' : 'Inactief',
        'Startdatum': emp.startdatum,
        'Competenties': emp.competencies.join('; '),
        'Diensten': emp.services.join('; ')
      }))

      const ws = XLSX.utils.json_to_sheet(exportData)
      const csv = XLSX.utils.sheet_to_csv(ws)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `medewerkers_${new Date().toISOString().split('T')[0]}.csv`
      link.click()
      showNotification('success', 'CSV bestand gedownload')
    } catch (error) {
      showNotification('error', 'Fout bij CSV export: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }, [employees, showNotification])

  // 📥 Import Function
  const handleImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setLoading(true)
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const worksheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json(worksheet)

        const importedEmployees: Employee[] = []
        let errors: string[] = []

        jsonData.forEach((row: any, index: number) => {
          const rowNum = index + 2 // Excel row number
          
          // Validation
          if (!row.Voornaam || !row.Achternaam) {
            errors.push(`Rij ${rowNum}: Voornaam en Achternaam zijn verplicht`)
            return
          }

          const employee: Employee = {
            id: `imp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            voornaam: row.Voornaam,
            achternaam: row.Achternaam,
            email: row.Email || '',
            telefoon: row.Telefoon || '',
            functie: FUNCTIES_LIST.includes(row.Functie) ? row.Functie : 'Verloskundige',
            afdeling: AFDELINGEN_LIST.includes(row.Afdeling) ? row.Afdeling : 'Verloskunde',
            status: row.Status === 'Inactief' ? 'inactive' : 'active',
            startdatum: row.Startdatum || new Date().toISOString().split('T')[0],
            competencies: row.Competenties ? row.Competenties.split(/[,;]/).map((c: string) => c.trim()).filter((c: string) => c) : [],
            services: row.Diensten ? row.Diensten.split(/[,;]/).map((s: string) => s.trim()).filter((s: string) => s) : []
          }

          importedEmployees.push(employee)
        })

        if (errors.length > 0) {
          showNotification('error', `Import fouten:\n${errors.join('\n')}`)
        } else {
          setEmployees(prev => [...prev, ...importedEmployees])
          showNotification('success', `${importedEmployees.length} medewerker(s) geïmporteerd`)
        }

      } catch (error) {
        showNotification('error', 'Fout bij import: ' + (error as Error).message)
      } finally {
        setLoading(false)
        event.target.value = '' // Reset file input
      }
    }

    reader.readAsArrayBuffer(file)
  }, [showNotification])

  const downloadTemplate = useCallback(() => {
    const templateData = [{
      'Voornaam': 'Voorbeeld',
      'Achternaam': 'Medewerker',
      'Email': 'voorbeeld@verloskunde.nl',
      'Telefoon': '+31 6 1234 5678',
      'Functie': 'Verloskundige',
      'Afdeling': 'Verloskunde',
      'Status': 'Actief',
      'Startdatum': '2024-01-01',
      'Competenties': 'Bevalling, Kraamzorg',
      'Diensten': 's, d'
    }]

    const ws = XLSX.utils.json_to_sheet(templateData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Template')
    XLSX.writeFile(wb, 'medewerkers_template.xlsx')
    showNotification('success', 'Template gedownload')
  }, [showNotification])

  const toggleCompetency = useCallback((competency: string) => {
    const current = editingEmployee || newEmployee
    const competencies = current.competencies.includes(competency)
      ? current.competencies.filter(c => c !== competency)
      : [...current.competencies, competency]
    
    if (editingEmployee) {
      setEditingEmployee({ ...editingEmployee, competencies })
    } else {
      setNewEmployee({ ...newEmployee, competencies })
    }
  }, [editingEmployee, newEmployee])

  const toggleService = useCallback((serviceId: string, employeeId: string) => {
    setEmployees(prev => prev.map(emp => {
      if (emp.id === employeeId) {
        const services = emp.services.includes(serviceId)
          ? emp.services.filter(s => s !== serviceId)
          : [...emp.services, serviceId]
        return { ...emp, services }
      }
      return emp
    }))
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* 🔔 Notification */}
        {notification && (
          <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
            notification.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'
          }`}>
            <div className="flex items-center">
              <span className="mr-2">{notification.type === 'success' ? '✅' : '❌'}</span>
              {notification.message}
            </div>
          </div>
        )}

        {/* 🏷️ Header */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <span className="mr-3">👥</span>
                Medewerkers Beheer
              </h1>
              <p className="text-gray-600 mt-1">
                Volledig personeelsmanagement systeem met diensten toewijzing
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <input
                type="file"
                id="import-file"
                className="hidden"
                accept=".xlsx,.xls,.csv"
                onChange={handleImport}
              />
              <button
                onClick={downloadTemplate}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center text-sm"
              >
                <span className="mr-2">📄</span>
                Template
              </button>
              <label
                htmlFor="import-file"
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center text-sm cursor-pointer"
              >
                <span className="mr-2">📥</span>
                Import
              </label>
              <button
                onClick={exportToCSV}
                disabled={loading}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center text-sm disabled:opacity-50"
              >
                <span className="mr-2">📄</span>
                CSV Export
              </button>
              <button
                onClick={exportToExcel}
                disabled={loading}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center text-sm disabled:opacity-50"
              >
                <span className="mr-2">📊</span>
                Excel Export
              </button>
              <button
                onClick={() => setShowAddForm(true)}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
              >
                <span className="mr-2">+</span>
                Nieuwe Medewerker
              </button>
            </div>
          </div>
        </div>

        {/* 🗂️ Tabs */}
        <div className="bg-white rounded-xl shadow-sm mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {[
                { id: 'employees', label: 'Medewerkers', icon: '👥', count: statistics.total },
                { id: 'services', label: 'Diensten Toewijzing', icon: '⚕️', count: SERVICE_TYPES.length },
                { id: 'reports', label: 'Overzichten', icon: '📊', count: statistics.active }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors flex items-center ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                  <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
                    activeTab === tab.id ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* 👥 Tab 1: Medewerkers */}
            {activeTab === 'employees' && (
              <div className="space-y-6">
                {/* Filters & Search */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      🔍 Zoeken
                    </label>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Naam, email of functie..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      📊 Status
                    </label>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value as any)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="all">Alle statussen</option>
                      <option value="active">Alleen actief</option>
                      <option value="inactive">Alleen inactief</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      🏢 Afdeling
                    </label>
                    <select
                      value={filterAfdeling}
                      onChange={(e) => setFilterAfdeling(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="all">Alle afdelingen</option>
                      {afdelingen.map(afd => (
                        <option key={afd} value={afd}>{afd}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      👨‍💼 Functie
                    </label>
                    <select
                      value={filterFunctie}
                      onChange={(e) => setFilterFunctie(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="all">Alle functies</option>
                      {functies.map(func => (
                        <option key={func} value={func}>{func}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <div className="text-sm text-gray-600 bg-gray-100 px-3 py-2 rounded-lg w-full text-center">
                      <strong>{filteredAndSortedEmployees.length}</strong> van <strong>{employees.length}</strong> medewerkers
                    </div>
                  </div>
                </div>

                {/* Bulk Actions */}
                {selectedEmployees.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-blue-800 font-medium">
                        {selectedEmployees.length} medewerker(s) geselecteerd
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleBulkStatusChange('active')}
                          className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors"
                        >
                          ✅ Activeren
                        </button>
                        <button
                          onClick={() => handleBulkStatusChange('inactive')}
                          className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors"
                        >
                          ❌ Deactiveren
                        </button>
                        <button
                          onClick={() => setSelectedEmployees([])}
                          className="bg-gray-500 text-white px-3 py-1 rounded text-sm hover:bg-gray-600 transition-colors"
                        >
                          Annuleren
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Table */}
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left">
                            <input
                              type="checkbox"
                              checked={selectedEmployees.length === filteredAndSortedEmployees.length && filteredAndSortedEmployees.length > 0}
                              onChange={handleSelectAll}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            <button
                              onClick={() => handleSort('voornaam')}
                              className="flex items-center hover:text-gray-700 group"
                            >
                              Naam
                              {sortField === 'voornaam' && (
                                <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                              )}
                              <span className="ml-1 opacity-0 group-hover:opacity-50">↕</span>
                            </button>
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Contact
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            <button
                              onClick={() => handleSort('functie')}
                              className="flex items-center hover:text-gray-700 group"
                            >
                              Functie
                              {sortField === 'functie' && (
                                <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                              )}
                              <span className="ml-1 opacity-0 group-hover:opacity-50">↕</span>
                            </button>
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            <button
                              onClick={() => handleSort('startdatum')}
                              className="flex items-center hover:text-gray-700 group"
                            >
                              Startdatum
                              {sortField === 'startdatum' && (
                                <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                              )}
                              <span className="ml-1 opacity-0 group-hover:opacity-50">↕</span>
                            </button>
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            <button
                              onClick={() => handleSort('status')}
                              className="flex items-center hover:text-gray-700 group"
                            >
                              Status
                              {sortField === 'status' && (
                                <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                              )}
                              <span className="ml-1 opacity-0 group-hover:opacity-50">↕</span>
                            </button>
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Competenties
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Acties
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredAndSortedEmployees.map((employee) => (
                          <tr key={employee.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4">
                              <input
                                type="checkbox"
                                checked={selectedEmployees.includes(employee.id)}
                                onChange={() => handleSelectEmployee(employee.id)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                                  <span className="text-blue-600 font-semibold text-sm">
                                    {employee.voornaam[0]}{employee.achternaam[0]}
                                  </span>
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {employee.voornaam} {employee.achternaam}
                                  </div>
                                  <div className="text-sm text-gray-500">{employee.afdeling}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <div>{employee.email || '-'}</div>
                              <div className="text-gray-500">{employee.telefoon || '-'}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs">
                                {employee.functie}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {new Date(employee.startdatum).toLocaleDateString('nl-NL')}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                employee.status === 'active' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {employee.status === 'active' ? 'Actief' : 'Inactief'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-wrap gap-1">
                                {employee.competencies.slice(0, 2).map((comp, index) => (
                                  <span 
                                    key={index}
                                    className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                                  >
                                    {comp}
                                  </span>
                                ))}
                                {employee.competencies.length > 2 && (
                                  <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">
                                    +{employee.competencies.length - 2}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex gap-2 justify-end">
                                <button
                                  onClick={() => setEditingEmployee(employee)}
                                  className="text-blue-600 hover:text-blue-900 text-sm p-1 rounded hover:bg-blue-50"
                                  title="Bewerken"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => duplicateEmployee(employee.id)}
                                  className="text-purple-600 hover:text-purple-900 text-sm p-1 rounded hover:bg-purple-50"
                                  title="Dupliceren"
                                >
                                  📋
                                </button>
                                <button
                                  onClick={() => toggleEmployeeStatus(employee.id)}
                                  className={`text-sm p-1 rounded ${
                                    employee.status === 'active'
                                      ? 'text-red-600 hover:text-red-900 hover:bg-red-50'
                                      : 'text-green-600 hover:text-green-900 hover:bg-green-50'
                                  }`}
                                  title={employee.status === 'active' ? 'Deactiveren' : 'Activeren'}
                                >
                                  {employee.status === 'active' ? '🔴' : '🟢'}
                                </button>
                                <button
                                  onClick={() => deleteEmployee(employee.id)}
                                  className="text-red-600 hover:text-red-900 text-sm p-1 rounded hover:bg-red-50"
                                  title="Verwijderen"
                                >
                                  🗑️
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {filteredAndSortedEmployees.length === 0 && (
                          <tr>
                            <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                              <div className="flex flex-col items-center">
                                <span className="text-4xl mb-2">🔍</span>
                                <span>Geen medewerkers gevonden</span>
                                {searchTerm && (
                                  <button
                                    onClick={() => setSearchTerm('')}
                                    className="mt-2 text-blue-600 hover:text-blue-800 underline"
                                  >
                                    Zoekfilter wissen
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ⚕️ Tab 2: Diensten Toewijzing */}
            {activeTab === 'services' && (
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-blue-900 mb-2 flex items-center">
                    <span className="mr-2">🔧</span>
                    Diensten Toewijzing
                  </h3>
                  <p className="text-blue-700 mb-4">
                    Configureer welke diensten elke medewerker kan uitvoeren voor gerichte roosterplanning.
                    Klik op de knoppen om diensten toe te wijzen of te verwijderen.
                  </p>
                </div>

                {/* Service Types Legend */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h4 className="font-semibold text-gray-900 mb-4">Diensten Overzicht</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {SERVICE_TYPES.map((service) => (
                      <div key={service.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                        <div className={`w-6 h-6 rounded-full ${service.color} flex items-center justify-center text-white text-xs font-bold`}>
                          {service.code.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">
                            {service.code} - {service.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {employees.filter(emp => emp.services.includes(service.id) && emp.status === 'active').length} actieve medewerkers
                          </div>
                          {service.requiredCompetencies.length > 0 && (
                            <div className="text-xs text-gray-400 mt-1">
                              Vereist: {service.requiredCompetencies.join(', ')}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Services Assignment Table */}
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Medewerker
                          </th>
                          {SERVICE_TYPES.map((service) => (
                            <th key={service.id} className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              <div className="flex flex-col items-center">
                                <div className={`w-4 h-4 rounded-full ${service.color} mb-1`}></div>
                                <span>{service.code}</span>
                              </div>
                            </th>
                          ))}
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Totaal Diensten
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {employees.filter(emp => emp.status === 'active').map((employee) => (
                          <tr key={employee.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                                  <span className="text-blue-600 font-semibold text-xs">
                                    {employee.voornaam[0]}{employee.achternaam[0]}
                                  </span>
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {employee.voornaam} {employee.achternaam}
                                  </div>
                                  <div className="text-xs text-gray-500">{employee.functie}</div>
                                </div>
                              </div>
                            </td>
                            {SERVICE_TYPES.map((service) => {
                              const canPerform = service.requiredCompetencies.length === 0 || 
                                               service.requiredCompetencies.every(comp => 
                                                 employee.competencies.includes(comp)
                                               )
                              const isAssigned = employee.services.includes(service.id)
                              
                              return (
                                <td key={service.id} className="px-3 py-4 text-center">
                                  <button
                                    onClick={() => canPerform ? toggleService(service.id, employee.id) : null}
                                    disabled={!canPerform}
                                    className={`w-8 h-8 rounded-full border-2 transition-all text-xs font-bold ${
                                      !canPerform
                                        ? 'bg-gray-100 border-gray-300 cursor-not-allowed text-gray-400'
                                        : isAssigned
                                        ? `${service.color} border-gray-700 text-white shadow-lg`
                                        : 'bg-white border-gray-300 hover:border-gray-400 text-gray-500 hover:text-gray-700'
                                    }`}
                                    title={
                                      !canPerform 
                                        ? `Vereiste competenties ontbreken: ${service.requiredCompetencies.join(', ')}` 
                                        : `${service.description} - Klik om ${isAssigned ? 'uit te schakelen' : 'in te schakelen'}`
                                    }
                                  >
                                    {isAssigned ? '✓' : service.code.charAt(0).toUpperCase()}
                                  </button>
                                </td>
                              )
                            })}
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <div className="flex items-center justify-center">
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                  employee.services.length === 0 
                                    ? 'bg-red-100 text-red-800'
                                    : employee.services.length <= 2
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-green-100 text-green-800'
                                }`}>
                                  {employee.services.length} diensten
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Service Statistics */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h4 className="font-semibold text-gray-900 mb-4">Diensten Verdeling</h4>
                    <div className="space-y-3">
                      {SERVICE_TYPES.map((service) => {
                        const assignedCount = employees.filter(emp => 
                          emp.services.includes(service.id) && emp.status === 'active'
                        ).length
                        const totalActiveEmployees = employees.filter(emp => emp.status === 'active').length
                        const percentage = totalActiveEmployees > 0 ? (assignedCount / totalActiveEmployees) * 100 : 0
                        
                        return (
                          <div key={service.id}>
                            <div className="flex justify-between items-center mb-1">
                              <div className="flex items-center">
                                <div className={`w-3 h-3 rounded-full ${service.color} mr-2`}></div>
                                <span className="text-sm font-medium text-gray-700">
                                  {service.name} ({service.code})
                                </span>
                              </div>
                              <span className="text-sm text-gray-500">
                                {assignedCount}/{totalActiveEmployees} ({Math.round(percentage)}%)
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full ${service.color} transition-all`}
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h4 className="font-semibold text-gray-900 mb-4">Medewerkers Capaciteit</h4>
                    <div className="space-y-3">
                      {[
                        { label: 'Geen diensten', count: employees.filter(emp => emp.services.length === 0 && emp.status === 'active').length, color: 'bg-red-500' },
                        { label: '1-2 diensten', count: employees.filter(emp => emp.services.length >= 1 && emp.services.length <= 2 && emp.status === 'active').length, color: 'bg-yellow-500' },
                        { label: '3-4 diensten', count: employees.filter(emp => emp.services.length >= 3 && emp.services.length <= 4 && emp.status === 'active').length, color: 'bg-blue-500' },
                        { label: '5+ diensten', count: employees.filter(emp => emp.services.length >= 5 && emp.status === 'active').length, color: 'bg-green-500' }
                      ].map((item, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className={`w-3 h-3 rounded-full ${item.color} mr-2`}></div>
                            <span className="text-sm text-gray-700">{item.label}</span>
                          </div>
                          <span className="text-sm font-medium text-gray-900">{item.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 📊 Tab 3: Overzichten */}
            {activeTab === 'reports' && (
              <div className="space-y-6">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-purple-900 mb-2 flex items-center">
                    <span className="mr-2">📊</span>
                    Medewerkers Overzichten & Analytics
                  </h3>
                  <p className="text-purple-700">
                    Uitgebreide statistieken en analyses van het personeelsbestand voor betere planning en management.
                  </p>
                </div>

                {/* Key Statistics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                        <span className="text-blue-600 text-xl">👥</span>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-gray-900">{statistics.total}</p>
                        <p className="text-gray-600">Totaal Medewerkers</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4">
                        <span className="text-green-600 text-xl">✅</span>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-gray-900">{statistics.active}</p>
                        <p className="text-gray-600">Actieve Medewerkers</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mr-4">
                        <span className="text-red-600 text-xl">❌</span>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-gray-900">{statistics.inactive}</p>
                        <p className="text-gray-600">Inactieve Medewerkers</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mr-4">
                        <span className="text-purple-600 text-xl">📈</span>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-gray-900">
                          {statistics.total > 0 ? Math.round((statistics.active / statistics.total) * 100) : 0}%
                        </p>
                        <p className="text-gray-600">Activiteit Ratio</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Department & Function Analysis */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Department Breakdown */}
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <span className="mr-2">🏢</span>
                      Verdeling per Afdeling
                    </h4>
                    <div className="space-y-4">
                      {statistics.byDepartment.map((dept) => (
                        <div key={dept.name}>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-gray-700">{dept.name}</span>
                            <div className="text-sm text-gray-500">
                              <span className="font-medium text-green-600">{dept.active}</span>
                              /
                              <span className="font-medium">{dept.count}</span>
                              {dept.count > 0 && (
                                <span className="ml-1 text-gray-400">
                                  ({Math.round((dept.active / dept.count) * 100)}%)
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full transition-all"
                              style={{ width: `${dept.count > 0 ? (dept.active / dept.count) * 100 : 0}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Function Distribution */}
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <span className="mr-2">👨‍💼</span>
                      Verdeling per Functie
                    </h4>
                    <div className="space-y-4">
                      {statistics.byFunction.map((func) => (
                        <div key={func.name}>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-gray-700">{func.name}</span>
                            <div className="text-sm text-gray-500">
                              <span className="font-medium">{func.count}</span>
                              {statistics.total > 0 && (
                                <span className="ml-1 text-gray-400">
                                  ({Math.round((func.count / statistics.total) * 100)}%)
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-green-600 h-2 rounded-full transition-all"
                              style={{ width: `${statistics.total > 0 ? (func.count / statistics.total) * 100 : 0}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Competencies Analysis */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <span className="mr-2">🎯</span>
                    Top Competenties (Actieve Medewerkers)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {statistics.competencyStats.slice(0, 9).map((comp) => (
                      <div key={comp.name} className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <div className="text-sm font-medium text-gray-900">{comp.name}</div>
                          <div className="text-sm text-gray-500">{comp.count}</div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-purple-600 h-2 rounded-full transition-all"
                            style={{ width: `${statistics.active > 0 ? (comp.count / statistics.active) * 100 : 0}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {statistics.active > 0 ? Math.round((comp.count / statistics.active) * 100) : 0}% van actieve medewerkers
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Activity & Trends */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <span className="mr-2">📅</span>
                      Nieuwe Medewerkers (Laatste 12 Maanden)
                    </h4>
                    <div className="space-y-3">
                      {employees
                        .filter(emp => {
                          const startDate = new Date(emp.startdatum)
                          const oneYearAgo = new Date()
                          oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
                          return startDate >= oneYearAgo
                        })
                        .sort((a, b) => new Date(b.startdatum).getTime() - new Date(a.startdatum).getTime())
                        .slice(0, 5)
                        .map((emp) => (
                          <div key={emp.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center">
                              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                                <span className="text-blue-600 font-semibold text-xs">
                                  {emp.voornaam[0]}{emp.achternaam[0]}
                                </span>
                              </div>
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {emp.voornaam} {emp.achternaam}
                                </div>
                                <div className="text-xs text-gray-500">{emp.functie}</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-gray-900">
                                {new Date(emp.startdatum).toLocaleDateString('nl-NL')}
                              </div>
                              <div className={`text-xs ${emp.status === 'active' ? 'text-green-600' : 'text-red-600'}`}>
                                {emp.status === 'active' ? 'Actief' : 'Inactief'}
                              </div>
                            </div>
                          </div>
                        ))}
                      {employees.filter(emp => {
                        const startDate = new Date(emp.startdatum)
                        const oneYearAgo = new Date()
                        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
                        return startDate >= oneYearAgo
                      }).length === 0 && (
                        <div className="text-center text-gray-500 py-4">
                          Geen nieuwe medewerkers in de laatste 12 maanden
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <span className="mr-2">⚠️</span>
                      Aandachtspunten
                    </h4>
                    <div className="space-y-3">
                      {/* Employees without services */}
                      {(() => {
                        const withoutServices = employees.filter(emp => emp.services.length === 0 && emp.status === 'active').length
                        return withoutServices > 0 && (
                          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <div className="text-sm font-medium text-yellow-800">
                              {withoutServices} medewerker(s) zonder diensten
                            </div>
                            <div className="text-xs text-yellow-600">
                              Deze medewerkers kunnen niet ingeroosterd worden
                            </div>
                          </div>
                        )
                      })()}
                      
                      {/* Departments with low activity */}
                      {statistics.byDepartment
                        .filter(dept => dept.count > 0 && (dept.active / dept.count) < 0.8)
                        .map(dept => (
                          <div key={dept.name} className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                            <div className="text-sm font-medium text-orange-800">
                              {dept.name}: Lage activiteit
                            </div>
                            <div className="text-xs text-orange-600">
                              {Math.round((dept.active / dept.count) * 100)}% actief ({dept.active}/{dept.count})
                            </div>
                          </div>
                        ))}

                      {/* Missing critical competencies */}
                      {(() => {
                        const criticalCompetencies = ['Bevalling', 'Nachtdienst', 'Echoscopie']
                        const warnings = criticalCompetencies.filter(comp => {
                          const count = employees.filter(emp => emp.competencies.includes(comp) && emp.status === 'active').length
                          return count < 2
                        })
                        
                        return warnings.map(comp => (
                          <div key={comp} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                            <div className="text-sm font-medium text-red-800">
                              Kritieke competentie: {comp}
                            </div>
                            <div className="text-xs text-red-600">
                              Minder dan 2 actieve medewerkers beschikbaar
                            </div>
                          </div>
                        ))
                      })()}

                      {/* No issues */}
                      {(() => {
                        const withoutServices = employees.filter(emp => emp.services.length === 0 && emp.status === 'active').length
                        const lowActivityDepts = statistics.byDepartment.filter(dept => dept.count > 0 && (dept.active / dept.count) < 0.8).length
                        const criticalCompetencies = ['Bevalling', 'Nachtdienst', 'Echoscopie'].filter(comp => {
                          const count = employees.filter(emp => emp.competencies.includes(comp) && emp.status === 'active').length
                          return count < 2
                        }).length
                        
                        return (withoutServices === 0 && lowActivityDepts === 0 && criticalCompetencies === 0) && (
                          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                            <div className="text-sm font-medium text-green-800">
                              ✅ Alles ziet er goed uit!
                            </div>
                            <div className="text-xs text-green-600">
                              Geen kritieke aandachtspunten gevonden
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 📝 Add/Edit Employee Modal */}
        {(showAddForm || editingEmployee) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[95vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {editingEmployee ? `${editingEmployee.voornaam} ${editingEmployee.achternaam} Bewerken` : 'Nieuwe Medewerker Toevoegen'}
                  </h2>
                  <button
                    onClick={() => {
                      setShowAddForm(false)
                      setEditingEmployee(null)
                      resetForm()
                    }}
                    className="text-gray-500 hover:text-gray-700 text-xl"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Voornaam *
                    </label>
                    <input
                      type="text"
                      value={editingEmployee ? editingEmployee.voornaam : newEmployee.voornaam}
                      onChange={(e) => editingEmployee 
                        ? setEditingEmployee({...editingEmployee, voornaam: e.target.value})
                        : setNewEmployee({...newEmployee, voornaam: e.target.value})
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Voornaam"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Achternaam *
                    </label>
                    <input
                      type="text"
                      value={editingEmployee ? editingEmployee.achternaam : newEmployee.achternaam}
                      onChange={(e) => editingEmployee 
                        ? setEditingEmployee({...editingEmployee, achternaam: e.target.value})
                        : setNewEmployee({...newEmployee, achternaam: e.target.value})
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Achternaam"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      E-mailadres
                    </label>
                    <input
                      type="email"
                      value={editingEmployee ? editingEmployee.email || '' : newEmployee.email || ''}
                      onChange={(e) => editingEmployee 
                        ? setEditingEmployee({...editingEmployee, email: e.target.value})
                        : setNewEmployee({...newEmployee, email: e.target.value})
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="email@verloskunde.nl"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Telefoonnummer
                    </label>
                    <input
                      type="tel"
                      value={editingEmployee ? editingEmployee.telefoon || '' : newEmployee.telefoon || ''}
                      onChange={(e) => editingEmployee 
                        ? setEditingEmployee({...editingEmployee, telefoon: e.target.value})
                        : setNewEmployee({...newEmployee, telefoon: e.target.value})
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="+31 6 1234 5678"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Functie/Rol
                    </label>
                    <select
                      value={editingEmployee ? editingEmployee.functie : newEmployee.functie}
                      onChange={(e) => editingEmployee 
                        ? setEditingEmployee({...editingEmployee, functie: e.target.value})
                        : setNewEmployee({...newEmployee, functie: e.target.value})
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {FUNCTIES_LIST.map(functie => (
                        <option key={functie} value={functie}>{functie}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Startdatum
                    </label>
                    <input
                      type="date"
                      value={editingEmployee ? editingEmployee.startdatum : newEmployee.startdatum}
                      onChange={(e) => editingEmployee 
                        ? setEditingEmployee({...editingEmployee, startdatum: e.target.value})
                        : setNewEmployee({...newEmployee, startdatum: e.target.value})
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Afdeling
                    </label>
                    <select
                      value={editingEmployee ? editingEmployee.afdeling : newEmployee.afdeling}
                      onChange={(e) => editingEmployee 
                        ? setEditingEmployee({...editingEmployee, afdeling: e.target.value})
                        : setNewEmployee({...newEmployee, afdeling: e.target.value})
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {AFDELINGEN_LIST.map(afdeling => (
                        <option key={afdeling} value={afdeling}>{afdeling}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <select
                      value={editingEmployee ? editingEmployee.status : newEmployee.status}
                      onChange={(e) => editingEmployee 
                        ? setEditingEmployee({...editingEmployee, status: e.target.value as 'active' | 'inactive'})
                        : setNewEmployee({...newEmployee, status: e.target.value as 'active' | 'inactive'})
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="active">Actief</option>
                      <option value="inactive">Inactief</option>
                    </select>
                  </div>
                </div>

                {/* Competencies */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Competenties
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {COMPETENCIES_LIST.map((comp) => (
                      <label key={comp} className="flex items-center p-2 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(editingEmployee ? editingEmployee.competencies : newEmployee.competencies).includes(comp)}
                          onChange={() => toggleCompetency(comp)}
                          className="mr-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{comp}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-4 justify-end pt-6 border-t border-gray-200">
                  <button
                    onClick={() => {
                      setShowAddForm(false)
                      setEditingEmployee(null)
                      resetForm()
                    }}
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Annuleren
                  </button>
                  <button
                    onClick={editingEmployee ? handleUpdateEmployee : handleAddEmployee}
                    disabled={loading}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Bezig...' : (editingEmployee ? 'Bijwerken' : 'Toevoegen')}
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