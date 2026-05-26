/** Tablero: iconos solo en viewport móvil/tablet (< lg). Ver `app/globals.css`. */
export const workBoardHeaderLabelClass = 'wb-header-label'

export const workBoardHeaderIconButtonClass = 'wb-header-icon-btn'

export const workBoardHeaderToolbarBtnClass = 'wb-header-toolbar-btn'

export const workBoardHeaderRowClass = 'wb-header-row'

export const workBoardHeaderViewsClass = 'wb-header-views'

export const workBoardHeaderActionsClass = 'wb-header-actions'

/** Título «Tablero» sin margen inferior extra. */
export const workBoardPageHeaderClass = 'mb-0 [&_h1]:leading-none' as const

/** Fila Kanban / acciones: pegada al título. */
export const workBoardHeaderControlsWrapClass = '-mt-1.5' as const

/** Bloque título + toolbar/acciones (Kanban y calendario). */
export const workBoardHeaderStackClass =
  'mb-2 flex shrink-0 flex-col gap-0 lg:mb-4' as const
