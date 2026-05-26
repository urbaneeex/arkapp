'use client'

import { useCallback, useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import { Bold, Italic, Link2, List, Send, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const EMPTY_DOC = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
}

export function TaskCommentEditor({
  onSubmit,
  disabled,
  submitting,
}: {
  onSubmit: (content: object) => void
  disabled?: boolean
  submitting?: boolean
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-brand underline' },
      }),
    ],
    content: EMPTY_DOC,
    editorProps: {
      attributes: {
        class:
          'prose prose-invert min-h-[72px] max-w-none px-3 py-2 text-sm text-zinc-100 focus:outline-none',
      },
    },
  })

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!disabled && !submitting)
  }, [editor, disabled, submitting])

  const handleSubmit = useCallback(() => {
    if (!editor || disabled || submitting) return
    const json = editor.getJSON()
    onSubmit(json)
    editor.commands.clearContent()
  }, [editor, disabled, submitting, onSubmit])

  const setLink = useCallback(() => {
    if (!editor) return
    const prev = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('URL del enlace', prev ?? 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }, [editor])

  if (!editor) return null

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-950/80">
      <EditorContent editor={editor} />
      <div className="flex items-center justify-between gap-2 border-t border-zinc-800 px-2 py-1.5">
        <div className="flex items-center gap-0.5">
          <ToolbarBtn
            label="Negrita"
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
            disabled={disabled || submitting}
          >
            <Bold className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn
            label="Cursiva"
            active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            disabled={disabled || submitting}
          >
            <Italic className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn
            label="Lista"
            active={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            disabled={disabled || submitting}
          >
            <List className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn
            label="Enlace"
            active={editor.isActive('link')}
            onClick={setLink}
            disabled={disabled || submitting}
          >
            <Link2 className="h-3.5 w-3.5" />
          </ToolbarBtn>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={disabled || submitting}
          className="h-8 gap-1.5 px-3"
          onClick={handleSubmit}
        >
          {submitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Send className="h-3.5 w-3.5" aria-hidden />
          )}
          Enviar
        </Button>
      </div>
    </div>
  )
}

function ToolbarBtn({
  children,
  label,
  active,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  label: string
  active?: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-40',
        active && 'bg-zinc-800 text-brand'
      )}
    >
      {children}
    </button>
  )
}
