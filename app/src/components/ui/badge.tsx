import type { HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badge = cva('inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[12px] font-medium leading-4 [&_svg]:size-3', {
  variants: {
    tone: {
      neutral: 'border-line bg-subtle text-body',
      blue: 'border-brand-line bg-brand-soft text-brand',
      teal: 'border-[#bfeef3] bg-teal-soft text-teal-ink',
      success: 'border-[#c6e8d8] bg-success-soft text-success',
      warning: 'border-[#f1dcb2] bg-warning-soft text-warning',
      danger: 'border-[#f2c9ce] bg-danger-soft text-danger',
      outline: 'border-line bg-surface text-body',
    },
  },
  defaultVariants: { tone: 'neutral' },
})

export function Badge({ className, tone, ...p }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>) {
  return <span className={cn(badge({ tone }), className)} {...p} />
}
