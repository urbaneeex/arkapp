import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-zinc-700 text-zinc-200',
        secondary: 'bg-zinc-800 text-zinc-400',
        pending: 'bg-amber-900/50 text-amber-300',
        confirmed: 'bg-brand/25 text-brand/90',
        in_progress: 'bg-violet-900/50 text-violet-300',
        completed: 'bg-emerald-900/50 text-emerald-300',
        cancelled: 'bg-zinc-700 text-zinc-400',
        no_show: 'bg-red-900/50 text-red-300',
        unpaid: 'bg-amber-900/50 text-amber-300',
        partial: 'bg-brand/25 text-brand/90',
        paid: 'bg-emerald-900/50 text-emerald-300',
        refunded: 'bg-zinc-700 text-zinc-400',
        success: 'bg-emerald-900/50 text-emerald-300',
        warning: 'bg-amber-900/50 text-amber-300',
        error: 'bg-red-900/50 text-red-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
