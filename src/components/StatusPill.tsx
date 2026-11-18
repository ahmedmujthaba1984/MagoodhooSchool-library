import React from 'react';

export type CirculationStatusType =
  | 'available'
  | 'checked_out'
  | 'overdue'
  | 'reserved'
  | 'reference';

interface StatusPillProps {
  status: CirculationStatusType;
  label?: string;
  countPrefix?: string;
  compact?: boolean;
  className?: string;
}

const STATUS_STYLES: Record<
  CirculationStatusType,
  { container: string; dot: string; defaultLabel: string }
> = {
  available: {
    container:
      'bg-[#F0FDF4] dark:bg-[#0F4C45]/35 text-[#15803D] dark:text-[#6EE7B7] border-[#BBF7D0] dark:border-[#16655B]',
    dot: 'bg-[#15803D] dark:bg-[#34D399]',
    defaultLabel: 'Available',
  },
  checked_out: {
    container:
      'bg-[#EFF6FF] dark:bg-[#1E3A8A]/30 text-[#1D4ED8] dark:text-[#93C5FD] border-[#BFDBFE] dark:border-[#1D4ED8]/60',
    dot: 'bg-[#1D4ED8] dark:bg-[#60A5FA]',
    defaultLabel: 'Checked Out',
  },
  overdue: {
    container:
      'bg-[#FEF2F2] dark:bg-[#7F1D1D]/35 text-[#B91C1C] dark:text-[#FCA5A5] border-[#FECACA] dark:border-[#B91C1C]/60',
    dot: 'bg-[#B91C1C] dark:bg-[#F87171]',
    defaultLabel: 'Overdue',
  },
  reserved: {
    container:
      'bg-[#FFFBEB] dark:bg-[#78350F]/35 text-[#B45309] dark:text-[#FCD34D] border-[#FDE68A] dark:border-[#B45309]/60',
    dot: 'bg-[#B45309] dark:bg-[#FBBF24]',
    defaultLabel: 'Reserved',
  },
  reference: {
    container:
      'bg-[#ECFDF5] dark:bg-[#0F4C45]/45 text-[#0F4C45] dark:text-[#A7F3D0] border-[#A7F3D0] dark:border-[#16655B]',
    dot: 'bg-[#0F4C45] dark:bg-[#6EE7B7]',
    defaultLabel: 'Reference',
  },
};

export const StatusPill: React.FC<StatusPillProps> = ({
  status,
  label,
  countPrefix,
  compact = false,
  className = '',
}) => {
  const style = STATUS_STYLES[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-bold whitespace-nowrap shrink-0 ${
        compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-[11px]'
      } ${style.container} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} aria-hidden="true" />
      {countPrefix && (
        <bdi dir="ltr" className="font-mono tabular-nums">
          {countPrefix}
        </bdi>
      )}
      <span>{label || style.defaultLabel}</span>
    </span>
  );
};
