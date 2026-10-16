import { Check, Leaf, Mountain, Zap, type LucideProps } from "lucide-react";
import type { SlotIcon as SlotIconName } from "./slot-style";

const ICONS = { mountain: Mountain, bolt: Zap, leaf: Leaf, check: Check } as const;

export function SlotIcon({ name, ...props }: { name: SlotIconName } & LucideProps) {
  const Icon = ICONS[name];
  return <Icon aria-hidden="true" {...props} />;
}
