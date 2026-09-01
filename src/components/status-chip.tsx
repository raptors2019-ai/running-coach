const TONES = {
  green: "text-green-700 bg-green-50 border-green-200",
  amber: "text-amber-700 bg-amber-50 border-amber-200",
  blue: "text-blue-700 bg-blue-50 border-blue-200",
  gray: "text-muted-foreground bg-muted border-border",
} as const;

interface StatusChipProps {
  tone: keyof typeof TONES;
  children: React.ReactNode;
  className?: string;
}

/** Tiny inline status label: Missed, Extra, Done Mon 31, +1 extra run. */
export function StatusChip({ tone, children, className }: StatusChipProps) {
  return (
    <span
      className={`inline-flex items-center rounded border px-1 text-[10px] font-medium leading-4 whitespace-nowrap ${TONES[tone]} ${className ?? ""}`}
    >
      {children}
    </span>
  );
}
