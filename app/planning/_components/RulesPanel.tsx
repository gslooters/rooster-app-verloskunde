'use client';
import { defaultPlanRules, getRuleFor, PlanRules, ServiceCode, DayOfWeek } from '@/lib/planning/rules.alias';
import React, { useMemo, useState } from 'react';

const DAYS: { key: DayOfWeek; label: string }[] = [
  { key: 1, label: 'Maandag' },
  { key: 2, label: 'Dinsdag' },
  { key: 3, label: 'Woensdag' },
  { key: 4, label: 'Donderdag' },
  { key: 5, label: 'Vrijdag' },
  { key: 6, label: 'Zaterdag' },
  { key: 7, label: 'Zondag' }
];

const SERVICES: { code: ServiceCode; label: string }[] = [
  { code: 's', label: 'Shift (24u)' },
  { code: 'd', label: 'Dag' },
  { code: 'sp', label: 'Spreekuur' },
  { code: 'echo', label: 'Echoscopie' }
];

type Props = {
  value?: PlanRules;
  onChange?: (rules: PlanRules) => void;
};

export default function RulesPanel({ value, onChange }: Props) {
  const [rules, setRules] = useState<PlanRules>(value ?? defaultPlanRules());
  const map = useMemo(() => rules, [rules]);

  function updateRule(day: DayOfWeek, service: ServiceCode, field: 'min'|'max', val: number) {
    setRules(prev => {
      const copy = [...prev];
      const idx = copy.findIndex(r => r.day_of_week === day && r.service_code === service);
      if (idx >= 0) {
        if (field === 'min') copy[idx] = { ...copy[idx], min_count: val };
        else copy[idx] = { ...copy[idx], max_count: val };
      } else {
        copy.push({
          day_of_week: day, service_code: service,
          min_count: field === 'min' ? val : 0,
          max_count: field === 'max' ? val : 0,
          required: service === 's'
        });
      }
      onChange?.(copy);
      return copy;
    });
  }

  return (
    <section className="p-4 border rounded bg-white">
      <h2 className="text-lg font-semibold mb-3">Planregels</h2>
      <p className="text-sm text-gray-600 mb-4">Stel per dag min/max per diensttype in. "s" is verplicht elke dag (min=1).</p>
      <div className="overflow-auto">
        <table className="min-w-[900px] border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="border px-3 py-2 sticky left-0 bg-gray-50">Dag</th>
              {SERVICES.map(s => (
                <th key={s.code} className="border px-3 py-2">{s.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map(d => (
              <tr key={d.key}>
                <td className="border px-3 py-2 sticky left-0 bg-white">{d.label}</td>
                {SERVICES.map(s => {
                  const r = getRuleFor(map, d.key, s.code) ?? { min_count: s.code === 's' ? 1 : 0, max_count: s.code === 's' ? 1 : 0, required: s.code === 's', day_of_week: d.key, service_code: s.code };
                  return (
                    <td key={s.code} className="border px-3 py-2">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-500">min</label>
                        <input type="number" className="w-14 border rounded px-2 py-1 text-sm"
                          value={r.min_count}
                          onChange={(e) => updateRule(d.key, s.code, 'min', Number(e.target.value))}
                        />
                        <label className="text-xs text-gray-500">max</label>
                        <input type="number" className="w-14 border rounded px-2 py-1 text-sm"
                          value={r.max_count}
                          onChange={(e) => updateRule(d.key, s.code, 'max', Number(e.target.value))}
                        />
                        {s.code === 's' && <span className="text-[10px] text-purple-700 border border-purple-300 rounded px-1">verplicht</span>}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
