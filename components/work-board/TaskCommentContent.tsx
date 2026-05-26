'use client'

import { cn } from '@/lib/utils'

type TipTapNode = {
  type?: string
  text?: string
  marks?: { type: string; attrs?: Record<string, unknown> }[]
  content?: TipTapNode[]
  attrs?: Record<string, unknown>
}

function renderMarks(text: string, marks?: TipTapNode['marks']) {
  if (!marks?.length) return text
  let node: React.ReactNode = text
  for (const m of marks) {
    if (m.type === 'bold') node = <strong>{node}</strong>
    if (m.type === 'italic') node = <em>{node}</em>
    if (m.type === 'link' && typeof m.attrs?.href === 'string') {
      node = (
        <a
          href={m.attrs.href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand underline underline-offset-2"
        >
          {node}
        </a>
      )
    }
  }
  return node
}

function renderNode(node: TipTapNode, key: number): React.ReactNode {
  if (node.type === 'text' && typeof node.text === 'string') {
    return <span key={key}>{renderMarks(node.text, node.marks)}</span>
  }
  const children = (node.content ?? []).map((c, i) => renderNode(c, i))
  switch (node.type) {
    case 'paragraph':
      return (
        <p key={key} className="mb-1.5 last:mb-0 text-sm leading-snug text-zinc-200">
          {children}
        </p>
      )
    case 'bulletList':
      return (
        <ul key={key} className="mb-1.5 list-disc space-y-0.5 pl-4 text-sm text-zinc-200">
          {children}
        </ul>
      )
    case 'orderedList':
      return (
        <ol key={key} className="mb-1.5 list-decimal space-y-0.5 pl-4 text-sm text-zinc-200">
          {children}
        </ol>
      )
    case 'listItem':
      return <li key={key}>{children}</li>
    case 'doc':
      return <div key={key}>{children}</div>
    default:
      return <div key={key}>{children}</div>
  }
}

export function TaskCommentContent({
  content,
  className,
}: {
  content: unknown
  className?: string
}) {
  if (!content || typeof content !== 'object') return null
  const doc = content as TipTapNode
  return (
    <div className={cn('min-w-0 break-words', className)}>
      {renderNode(doc, 0)}
    </div>
  )
}
