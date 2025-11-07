'use client';

import { useRouter } from 'next/navigation';
import { Calendar } from 'lucide-react';

interface PeriodStaffingButtonProps {
  rosterId: string;
  disabled?: boolean;
}

/**
 * Knop voor navigatie naar "Diensten per dag" scherm
 * Wordt getoond in het Rooster Ontwerp scherm
 */
export default function PeriodStaffingButton({ rosterId, disabled = false }: PeriodStaffingButtonProps) {
  const router = useRouter();

  const handleClick = () => {
    if (!disabled) {
      router.push(`/planning/design/period-staffing?id=${rosterId}`);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`
        px-4 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 font-medium shadow-sm
        ${
          disabled
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md active:scale-95'
        }
      `}
      title="Open diensten per dag scherm voor deze periode"
    >
      <Calendar className="w-4 h-4" />
      <span>📅 Diensten per dag</span>
    </button>
  );
}
