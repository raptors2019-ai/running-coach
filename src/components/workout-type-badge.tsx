import { Badge } from "@/components/ui/badge";
import { WORKOUT_TYPE_COLORS, WORKOUT_TYPE_LABELS } from "@/lib/constants";

interface WorkoutTypeBadgeProps {
  type: string;
  className?: string;
}

export function WorkoutTypeBadge({ type, className }: WorkoutTypeBadgeProps) {
  const colors = WORKOUT_TYPE_COLORS[type] || "bg-gray-100 text-gray-800";
  const label = WORKOUT_TYPE_LABELS[type] || type;

  return (
    <Badge variant="outline" className={`${colors} ${className || ""}`}>
      {label}
    </Badge>
  );
}
