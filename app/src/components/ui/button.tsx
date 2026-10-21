import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-brand text-white shadow-[0_1px_2px_rgba(42,94,254,0.25)] hover:bg-brand-hover',
        secondary: 'border border-line bg-surface text-ink shadow-card hover:bg-subtle hover:border-[#d3dce7]',
        ghost: 'text-body hover:bg-[#eef2f7] hover:text-ink',
        soft: 'bg-brand-soft text-brand hover:bg-[#e2eaff]',
        danger: 'border border-[#f2c9ce] bg-surface text-danger hover:bg-danger-soft',
        link: 'h-auto px-0 text-brand hover:text-brand-hover hover:underline underline-offset-4',
      },
      size: {
        sm: 'h-8 px-3 text-[13px]',
        md: 'h-9 px-3.5 text-[13.5px]',
        lg: 'h-10 px-4 text-sm',
        icon: 'h-8 w-8',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button'
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
})
Button.displayName = 'Button'
