/** Tablero: iconos solo en viewport móvil/tablet (< lg). Ver `app/globals.css`. */
export const workBoardHeaderLabelClass = 'wb-header-label'

export const workBoardHeaderIconButtonClass = 'wb-header-icon-btn'

export const workBoardHeaderToolbarBtnClass = 'wb-header-toolbar-btn'

export const workBoardHeaderRowClass = 'wb-header-row'

export const workBoardHeaderViewsClass = 'wb-header-views'

export const workBoardHeaderActionsClass = 'wb-header-actions'

/** Título «Tablero»: compacto en desktop; aire bajo título en móvil/tablet. */
export const workBoardPageHeaderClass =
  'mb-0 max-lg:mb-5 [&_h1]:leading-none max-lg:[&_h1]:leading-tight' as const

/** Título «Nueva tarea» (flujo móvil): separado del campo nombre. */
export const workBoardNewTaskPageHeaderClass = 'mb-5 lg:mb-6 [&_h1]:leading-tight' as const

/** Fila Kanban / acciones: pegada al título solo en desktop. */
export const workBoardHeaderControlsWrapClass = 'max-lg:mt-0 lg:-mt-1.5' as const

/** Bloque título + toolbar/acciones (Kanban y calendario). */
export const workBoardHeaderStackClass =
  'mb-2 flex shrink-0 flex-col gap-0 lg:mb-4' as const
