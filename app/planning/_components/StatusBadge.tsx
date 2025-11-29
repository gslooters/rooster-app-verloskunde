// DRAAD 76 - StatusBadge Component
// Display colored badge based on roster status

interface StatusBadgeProps {
  status: 'draft' | 'in_progress' | 'final';
}

const STATUS_CONFIG = {
  draft: {
    label: 'In ontwerp',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-900',
    borderColor: 'border-yellow-300'
  },
  in_progress: {
    label: 'In bewerking',
    bgColor: 'bg-amber-100',
    textColor: 'text-amber-900',
    borderColor: 'border-amber-300'
  },
  final: {
    label: 'Afgesloten',
    bgColor: 'bg-green-100',
    textColor: 'text-green-900',
    borderColor: 'border-green-300'
  }
} as const;

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${config.bgColor} ${config.textColor} ${config.borderColor}`}
    >
      {config.label}
    </span>
  );
}
