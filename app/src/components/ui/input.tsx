import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const base = 'w-full rounded-lg border border-line bg-surface text-[13.5px] text-ink placeholder:text-[#9aa6b6] transition-colors focus-visible:border-brand focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand/15 disabled:bg-subtle disabled:opacity-70'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(({ className, invalid, ...p }, ref) => (
  <input ref={ref} aria-invalid={invalid || undefined} className={cn(base, 'h-9 px-3', invalid && 'border-danger focus-visible:border-danger focus-visible:ring-danger/15', className)} {...p} />
))
Input.displayName = 'Input'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(({ className, invalid, ...p }, ref) => (
  <textarea ref={ref} aria-invalid={invalid || undefined} className={cn(base, 'min-h-[84px] px-3 py-2 leading-relaxed', invalid && 'border-danger', className)} {...p} />
))
Textarea.displayName = 'Textarea'

export function Select({ className, children, invalid, ...p }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <div className={cn('relative', className)}>
      <select aria-invalid={invalid || undefined} className={cn(base, 'h-9 cursor-pointer appearance-none pl-3 pr-8', invalid && 'border-danger')} {...p}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
    </div>
  )
}

export function Label({ children, htmlFor, hint }: { children: React.ReactNode; htmlFor?: string; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between text-[13px] font-medium text-ink">
      {children}
      {hint && <span className="text-[12px] font-normal text-muted">{hint}</span>}
    </label>
  )
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null
  return <p className="mt-1.5 text-[12.5px] text-danger" role="alert">{children}</p>
}
