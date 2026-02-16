import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-gray-100 text-gray-800',
        secondary: 'bg-gray-200 text-gray-600',
        pending: 'bg-amber-100 text-amber-800',
        confirmed: 'bg-blue-100 text-blue-800',
        in_progress: 'bg-violet-100 text-violet-800',
        completed: 'bg-emerald-100 text-emerald-800',
        cancelled: 'bg-gray-100 text-gray-600',
        no_show: 'bg-red-100 text-red-800',
        unpaid: 'bg-amber-100 text-amber-800',
        partial: 'bg-blue-100 text-blue-800',
        paid: 'bg-emerald-100 text-emerald-800',
        refunded: 'bg-gray-100 text-gray-600',
        success: 'bg-emerald-100 text-emerald-800',
        warning: 'bg-amber-100 text-amber-800',
        error: 'bg-red-100 text-red-800',
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
