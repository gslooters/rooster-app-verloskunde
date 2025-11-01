'use client';
import React, { useMemo, useState } from 'react';
import { defaultPlanRules, getRuleFor, type PlanRules, type ServiceCode, type DayOfWeek } from '@/lib/planning/rules.alias';

const DAYS: { key: DayOfWeek; label: string }[] = [
  { key: 1, label: 'Maandag' },
  { key: 2, label: 'Dinsdag' },
  { key: 3, label: 'Woensdag' },
  { key: 4, label: 'Donderdag' },
  { key: 5, label: 'Vrijdag' },
  { key: 6, label: 'Zaterdag' },
  { key: 0, label: 'Zondag' } // 0=zo
];

const SERVICES: { code: ServiceCode; label: string }[] = [
  { code: 'd', label: 'Dag' },
  { code: 'sp', label: 'Spreekuur' },
  { code: 'echo', label: 'Echoscopie' },
  { code: 's', label: 'Shift (24u)' },
  { code: 'nd', label: 'Nacht' },
];

export default function RulesPanel() {
  const [rules, setRules] = useState<PlanRules>(() => defaultPlanRules());

  const byDay = useMemo(() => {
    const map = new Map<DayOfWeek, PlanRules>();
    for (const d of DAYS.map(x => x.key)) map.set(d, []);
    for (const r of rules) {
      const list = map.get(r.day_of_week);
      if (list) list.push(r);
    }
    return map;
  }, [rules]);

  function updateRule(
    day: DayOfWeek,
    code: ServiceCode,
    patch: Partial<{ min_count: number; max_count: number; required: boolean }>
  ) {
    setRules((prev: PlanRules) => {
      const next = prev.map(r =>
        (r.day_of_week === day && r.service_code === code) ? { ...r, ...patch } : r
      );
      // als er geen bestaande regel is en patch waarden bevat, voeg toe
      const has = next.some(r => r.day_of_week === day && r.service_code === code);
      if (!has && (patch.min_count !== undefined || patch.max_count !== undefined || patch.required !== undefined)) {
        next.push({
          day_of_week: day,
          service_code: code,
          min_count: patch.min_count ?? 0,
          max_count: patch.max_count ?? 0,
          required: patch.required ?? false
        });
      }
      return next;
    });
  }

  return (
    <section className="p-3 border rounded bg-white">
      <h3 className="font-semibold mb-2">Regels per dag</h3>
      <div className="overflow-auto">
        <table className="min-w-[900px] border-separate border-spacing-0 text-[12px]">
          <thead>
            <tr>
              <th className="border px-2 py-1 sticky left-0 bg-gray-50">Dag</th>
              {SERVICES.map(s => (
                <th key={s.code} className="border px-2 py-1 text-xs">{s.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map(d => (
              <tr key={d.key}>
                <td className="border px-2 py-1 sticky left-0 bg-white font-medium">{d.label}</td>
                {SERVICES.map(s => {
                  const r = getRuleFor(rules, d.key, s.code);
                  return (
                    <td key={s.code} className="border p-1">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          className="w-14 border rounded px-1 py-[2px]"
                          defaultValue={r?.min_count ?? 0}
                          onChange={e => updateRule(d.key, s.code, { min_count: Number(e.target.value) })}
                        />
                        <span>-</span>
                        <input
                          type="number"
                          className="w-14 border rounded px-1 py-[2px]"
                          defaultValue={r?.max_count ?? 0}
                          onChange={e => updateRule(d.key, s.code, { max_count: Number(e.target.value) })}
                        />
                        <label className="ml-2 text-xs flex items-center gap-1">
                          <input
                            type="checkbox"
                            defaultChecked={r?.required ?? false}
                            onChange={e => updateRule(d.key, s.code, { required: e.target.checked })}
                          />
                          vereist
                        </label>
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
