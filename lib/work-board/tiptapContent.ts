import type { Json } from '@/types/database.types'

const MAX_JSON_BYTES = 32_000

export function isNonEmptyTipTapContent(content: unknown): boolean {
  if (!content || typeof content !== 'object') return false
  const doc = content as { type?: string; content?: unknown[] }
  if (doc.type !== 'doc' || !Array.isArray(doc.content)) return false
  return doc.content.some((node) => {
    if (!node || typeof node !== 'object') return false
    const n = node as { type?: string; content?: unknown[] }
    if (n.type === 'paragraph' && Array.isArray(n.content)) {
      return n.content.some((c) => {
        if (!c || typeof c !== 'object') return false
        const leaf = c as { type?: string; text?: string }
        return leaf.type === 'text' && typeof leaf.text === 'string' && leaf.text.trim().length > 0
      })
    }
    return n.type !== 'paragraph'
  })
}

export function validateTipTapContentPayload(content: unknown): content is Json {
  if (content === null || typeof content !== 'object' || Array.isArray(content)) return false
  const serialized = JSON.stringify(content)
  if (serialized.length > MAX_JSON_BYTES) return false
  if (!isNonEmptyTipTapContent(content)) return false
  return true
}

/** Texto plano para vista previa en lista (primer párrafo). */
export function tipTapContentToPlainText(content: unknown, maxLen = 200): string {
  if (!content || typeof content !== 'object') return ''
  const parts: string[] = []
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    const n = node as { type?: string; text?: string; content?: unknown[] }
    if (n.type === 'text' && typeof n.text === 'string') parts.push(n.text)
    if (Array.isArray(n.content)) n.content.forEach(walk)
  }
  walk(content)
  const plain = parts.join(' ').replace(/\s+/g, ' ').trim()
  if (plain.length <= maxLen) return plain
  return `${plain.slice(0, maxLen - 1)}…`
}
