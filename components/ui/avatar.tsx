import * as React from 'react'
import { cn } from '@/lib/utils'

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((s) => s[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

const Avatar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    name?: string
    src?: string | null
    size?: 'sm' | 'md' | 'lg'
  }
>(({ className, name = '', src, size = 'md', ...props }, ref) => {
  const sizeClass =
    size === 'sm' ? 'h-8 w-8 text-xs' : size === 'lg' ? 'h-12 w-12 text-lg' : 'h-10 w-10 text-sm'
  return (
    <div
      ref={ref}
      className={cn(
        'relative flex shrink-0 items-center justify-center rounded-full bg-[#3B82F6] font-medium text-white overflow-hidden',
        sizeClass,
        className
      )}
      {...props}
    >
      {src ? (
        <img src={src} alt={name || ''} className="h-full w-full object-cover" />
      ) : (
        getInitials(name || '?')
      )}
    </div>
  )
})
Avatar.displayName = 'Avatar'

export { Avatar, getInitials }
