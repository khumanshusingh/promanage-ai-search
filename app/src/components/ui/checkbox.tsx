import * as C from '@radix-ui/react-checkbox'
import { Check, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Checkbox({ checked, onCheckedChange, className, ...p }: { checked: boolean | 'indeterminate'; onCheckedChange: (v: boolean) => void; className?: string; id?: string; disabled?: boolean; 'aria-label'?: string }) {
  return (
    <C.Root
      checked={checked}
      onCheckedChange={(v) => onCheckedChange(v === true)}
      className={cn(
        'grid size-4 shrink-0 place-items-center rounded-[5px] border border-[#c5cfdb] bg-white transition-colors data-[state=checked]:border-brand data-[state=checked]:bg-brand data-[state=indeterminate]:border-brand data-[state=indeterminate]:bg-brand disabled:opacity-50',
        className,
      )}
      {...p}
    >
      <C.Indicator className="text-white">{checked === 'indeterminate' ? <Minus className="size-3" strokeWidth={3} /> : <Check className="size-3" strokeWidth={3} />}</C.Indicator>
    </C.Root>
  )
}
