/** Tablero: iconos solo en viewport móvil/tablet (< lg). Ver `app/globals.css`. */
export const workBoardHeaderLabelClass = 'wb-header-label'

export const workBoardHeaderIconButtonClass = 'wb-header-icon-btn'

export const workBoardHeaderToolbarBtnClass = 'wb-header-toolbar-btn'

export const workBoardHeaderRowClass = 'wb-header-row'

export const workBoardHeaderViewsClass = 'wb-header-views'

export const workBoardHeaderActionsClass = 'wb-header-actions'

/** Título «Tablero»: compacto; gap al toolbar lo da el stack. */
export const workBoardPageHeaderClass =
  'mb-0 [&_h1]:leading-none max-lg:[&_h1]:leading-tight' as const

/** Título «Nueva tarea» (flujo móvil): separado del campo nombre. */
export const workBoardNewTaskPageHeaderClass = 'mb-5 lg:mb-6 [&_h1]:leading-tight' as const

/** Fila Kanban / acciones bajo el título. */
export const workBoardHeaderControlsWrapClass = '' as const

/** Separación móvil: acciones tablero → barra calendario (Hoy, fechas). */
export const workBoardCalendarNavRowClass = 'shrink-0 max-lg:pt-2 lg:pt-0' as const

/** Bloque título + toolbar/acciones (Kanban y calendario). */
export const workBoardHeaderStackClass =
  'mb-2 flex shrink-0 flex-col gap-2 lg:mb-4 lg:gap-1.5' as const
