/** Misma pila que el `<h2>` del encabezado de columna. */
export const KANBAN_COLUMN_TITLE_TYPO =
  'font-sans text-sm font-semibold leading-tight text-zinc-200' as const

/** Texto secundario (contador, filas de menú). */
export const KANBAN_QUICK_ADD_ROW_MUTED =
  'text-sm font-medium text-zinc-500' as const

/**
 * Fila interactiva del quick-add (asignar, fecha, prioridad).
 * Sin márgenes negativos: el fondo coincide con el área clicable y respeta el `gap` del bloque.
 */
export const KANBAN_QUICK_ADD_ROW_TAP =
  'w-full rounded-md px-2 transition-[background-color,color] duration-150 hover:bg-zinc-800/85 hover:text-zinc-200 data-[state=open]:bg-zinc-800/70 data-[state=open]:text-zinc-100' as const
