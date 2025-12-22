'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  getAllEmployees,
  createEmployee,
  updateEmployee,
  removeEmployee,
  canDeleteEmployee,
  getActiveEmployeeCount,
} from '@/lib/services/employees-storage';
import {
  Employee,
  getFullName,
  getRosterDisplayName,
  DienstverbandType,
  TeamType,
  DIENSTVERBAND_OPTIONS,
  TEAM_OPTIONS,
  DAGEN_VAN_WEEK,
  createEmployeeFromFormData,
  validateAantalWerkdagen,
  normalizeRoostervrijDagen,
} from '@/lib/types/employee';

type FormState = Omit<Employee, 'id' | 'created_at' | 'updated_at'> & { aantalWerkdagen: number };

const INITIAL_FORM: FormState = {
  voornaam: '',
  achternaam: '',
  email: '',
  telefoon: '',
  actief: true,
  dienstverband: DienstverbandType.LOONDIENST,
  team: TeamType.GROEN,
  aantalWerkdagen: 24,
  roostervrijdagen: [],
  structureel_nbh: undefined,
};

interface EmployeeCardProps {
  employee: Employee;
  onEdit: (emp: Employee) => void;
  onDelete: (id: string) => Promise<void>;
}

function EmployeeCard({ employee, onEdit, onDelete }: EmployeeCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (confirm(`Weet je zeker dat je ${getFullName(employee)} wilt verwijderen?`)) {
      setIsDeleting(true);
      await onDelete(employee.id);
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="font-bold text-gray-900 text-lg">{getFullName(employee)}</h3>
          <p className="text-gray-500 text-sm">({getRosterDisplayName(employee)})</p>
        </div>
        {employee.actief && <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">ACTIEF</span>}
      </div>
      {employee.email && <p className="text-gray-600 text-sm mb-1">{employee.email}</p>}
      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-4">
        <div>Team: <span className="font-medium text-gray-900">{employee.team}</span></div>
        <div>Dienst: <span className="font-medium text-gray-900">{employee.dienstverband}</span></div>
        <div>Werkdagen: <span className="font-medium text-gray-900">{employee.aantalwerkdagen}</span></div>
        {employee.roostervrijdagen && employee.roostervrijdagen.length > 0 && <div>Vrij: <span className="font-medium text-gray-900">{employee.roostervrijdagen.map(d => d.toUpperCase()).join(', ')}</span></div>}
      </div>
      <div className="flex gap-2">
        <button onClick={() => onEdit(employee)} className="flex-1 px-3 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600">Wijzigen</button>
        <button onClick={handleDelete} disabled={isDeleting} className="flex-1 px-3 py-2 bg-red-500 text-white text-sm rounded hover:bg-red-600 disabled:opacity-50">{isDeleting ? 'Verwijderen...' : 'Verwijderen'}</button>
      </div>
    </div>
  );
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setEmployees(getAllEmployees());
  }, []);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!form.voornaam.trim()) newErrors.voornaam = 'Voornaam is verplicht';
    if (!form.achternaam.trim()) newErrors.achternaam = 'Achternaam is verplicht';
    if (!validateAantalWerkdagen(form.aantalWerkdagen)) newErrors.aantalWerkdagen = 'Werkdagen moet tussen 0 en 35 zijn';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setIsSaving(true);
    try {
      const normalized = normalizeRoostervrijDagen(form.roostervrijdagen || []);
      const data = createEmployeeFromFormData({
        ...form,
        roostervrijDagen: normalized,
      });

      if (editingId) {
        const updated = updateEmployee(editingId, data);
        if (updated) {
          setEmployees((prev) => prev.map((e) => (e.id === editingId ? updated : e)));
        }
      } else {
        const created = createEmployee(data);
        setEmployees((prev) => [...prev, created]);
      }

      setForm(INITIAL_FORM);
      setEditingId(null);
      setShowForm(false);
    } catch (err) {
      console.error('Error saving employee:', err);
      setErrors({ submit: 'Fout bij opslaan' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (emp: Employee) => {
    setForm({ ...emp, aantalWerkdagen: emp.aantalwerkdagen });
    setEditingId(emp.id);
    setShowForm(true);
    setErrors({});
  };

  const handleDelete = async (id: string) => {
    const check = await canDeleteEmployee(id);
    if (!check.canDelete) {
      alert(`Kan niet verwijderen: ${check.reason}`);
      return;
    }
    const success = await removeEmployee(id);
    if (success) {
      setEmployees((prev) => prev.filter((e) => e.id !== id));
    }
  };

  const handleCancel = () => {
    setForm(INITIAL_FORM);
    setEditingId(null);
    setShowForm(false);
    setErrors({});
  };

  const toggleRoosterdag = (dag: string) => {
    setForm((prev) => ({
      ...prev,
      roostervrijdagen: prev.roostervrijdagen?.includes(dag)
        ? prev.roostervrijdagen.filter((d) => d !== dag)
        : [...(prev.roostervrijdagen || []), dag],
    }));
  };

  return (
    <main className="p-6 max-w-7xl mx-auto">
      <nav className="text-sm text-gray-500 mb-4">
        <Link href="/dashboard" className="hover:text-blue-700">Dashboard</Link>
        <span className="mx-2">›</span>
        <span>Medewerkers</span>
      </nav>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Medewerkers</h1>
        <p className="text-gray-600">{getActiveEmployeeCount()} actieve medewerkers</p>
      </div>

      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="mb-8 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          + Nieuwe medewerker
        </button>
      ) : (
        <div className="bg-white border border-gray-300 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">{editingId ? 'Medewerker wijzigen' : 'Nieuwe medewerker'}</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Voornaam</label>
              <input
                type="text"
                value={form.voornaam}
                onChange={(e) => setForm({ ...form, voornaam: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded"
              />
              {errors.voornaam && <p className="text-red-600 text-sm mt-1">{errors.voornaam}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Achternaam</label>
              <input
                type="text"
                value={form.achternaam}
                onChange={(e) => setForm({ ...form, achternaam: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded"
              />
              {errors.achternaam && <p className="text-red-600 text-sm mt-1">{errors.achternaam}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={form.email || ''}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefoon</label>
              <input
                type="tel"
                value={form.telefoon || ''}
                onChange={(e) => setForm({ ...form, telefoon: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dienstverband</label>
              <select
                value={form.dienstverband}
                onChange={(e) => setForm({ ...form, dienstverband: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded"
              >
                {DIENSTVERBAND_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Team</label>
              <select
                value={form.team}
                onChange={(e) => setForm({ ...form, team: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded"
              >
                {TEAM_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Werkdagen (0-35)</label>
              <input
                type="number"
                min="0"
                max="35"
                value={form.aantalWerkdagen}
                onChange={(e) => setForm({ ...form, aantalWerkdagen: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded"
              />
              {errors.aantalWerkdagen && <p className="text-red-600 text-sm mt-1">{errors.aantalWerkdagen}</p>}
            </div>
            <div>
              <label className="flex items-center mt-6">
                <input
                  type="checkbox"
                  checked={form.actief}
                  onChange={(e) => setForm({ ...form, actief: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="ml-2 text-sm font-medium text-gray-700">Actief</span>
              </label>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Roostervrijdagen</label>
            <div className="flex flex-wrap gap-2">
              {DAGEN_VAN_WEEK.map((dag) => (
                <button
                  key={dag.code}
                  onClick={() => toggleRoosterdag(dag.code)}
                  className={`px-3 py-2 rounded text-sm font-medium ${
                    form.roostervrijdagen?.includes(dag.code)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {dag.label.substring(0, 3)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {isSaving ? 'Opslaan...' : editingId ? 'Bijwerken' : 'Toevoegen'}
            </button>
            <button
              onClick={handleCancel}
              className="px-6 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
            >
              Annuleren
            </button>
          </div>
          {errors.submit && <p className="text-red-600 text-sm mt-2">{errors.submit}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {employees.map((emp) => (
          <EmployeeCard key={emp.id} employee={emp} onEdit={handleEdit} onDelete={handleDelete} />
        ))}
      </div>
    </main>
  );
}