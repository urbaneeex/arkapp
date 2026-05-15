---
name: Eliminar tasks_view_all
overview: Quitar el permiso tasks_view_all en tipos, matriz, UI de permisos, bootstrap del tablero y filtro Kanban; eliminar la clave en JSON permission_matrix vía migración SQL. El ámbito Mis/Equipo/Todo desaparece (solo existía con ese permiso); el Kanban muestra solo lo que devuelve RLS.
todos:
  - id: grep-permissions
    content: "Quitar tasks_view_all de lib/permissions.ts (tipo, baseKeys, matrices, PERMISSION_ROWS, mergeWithDefault)"
    status: pending
  - id: bootstrap-kanban
    content: "loadWorkBoardBootstrap + API bootstrap + WorkBoardQueryBridge + workBoardQueryKeys sin scope/canTasksViewAll"
    status: pending
  - id: page-client-filters
    content: "WorkBoardPageClient + KanbanFiltersPanel sin picker; eliminar o vaciar kanbanScopeFilter"
    status: pending
  - id: db-migration-jsonb
    content: "Migración SQL quitar tasks_view_all de cada nivel en businesses.permission_matrix"
    status: pending
  - id: cleanup-old-migration
    content: "Revisar 20260513140000 (solo propietario): sustituir o documentar obsoleto respecto a nueva migración"
    status: pending
  - id: verify-grep
    content: "rg tasks_view_all y canTasksViewAll = 0 tras cambios"
    status: pending
isProject: false
---

# Eliminar por completo `tasks_view_all`

## Análisis — referencias encontradas (globales)

| Área | Archivo |
|------|---------|
| Permisos | [lib/permissions.ts](lib/permissions.ts) — `PermissionKey`, `baseKeys`, `DEFAULT_MATRIX` (alto/propietario), `PERMISSION_ROWS`, bloque `mergeWithDefault` para propietario |
| Bootstrap | [lib/work-board/loadWorkBoardBootstrap.ts](lib/work-board/loadWorkBoardBootstrap.ts) — `canTasksViewAll`, `hasServerPermission(..., 'tasks_view_all')`, `initialKanbanScope`, tipo payload, `parseKanbanScope` / `sp.scope` |
| API | [app/api/work-board/bootstrap/route.ts](app/api/work-board/bootstrap/route.ts) — `scope` en searchParams |
| Cliente tablero | [components/work-board/WorkBoardQueryBridge.tsx](components/work-board/WorkBoardQueryBridge.tsx), [components/work-board/WorkBoardPageClient.tsx](components/work-board/WorkBoardPageClient.tsx) |
| Filtros UI | [components/work-board/KanbanFiltersPanel.tsx](components/work-board/KanbanFiltersPanel.tsx) — `showKanbanScopePicker`, `KanbanScopePicker` |
| Filtro lógica | [lib/work-board/kanbanScopeFilter.ts](lib/work-board/kanbanScopeFilter.ts) |
| Picker (opcional tras limpieza) | [components/work-board/KanbanScopePicker.tsx](components/work-board/KanbanScopePicker.tsx), [lib/work-board/kanbanScope.ts](lib/work-board/kanbanScope.ts) — solo si quedan imports; si nada importa, eliminar archivos |
| Query keys | [lib/work-board/workBoardQueryKeys.ts](lib/work-board/workBoardQueryKeys.ts) — segmento `sp.scope` |
| Supabase repo | [supabase/migrations/20260513140000_businesses_propietario_tasks_view_all_false.sql](supabase/migrations/20260513140000_businesses_propietario_tasks_view_all_false.sql) |

**No aparecen** en grep: `PermissionsContext.tsx`, `usePermissions`, tests, `hasServerPermission` con esa clave fuera de `loadWorkBoardBootstrap`.

**Dependencias**: `tasks_view_own` es independiente; no hay otro permiso que requiera `tasks_view_all`.

**BD real**: no hay tabla `permission_key`; los flags viven en **`public.businesses.permission_matrix`** (jsonb por nivel). Hay que **borrar la clave** `tasks_view_all` dentro de cada objeto de nivel (basico, bajo, …), no un `DELETE FROM` fila suelta.

---

## Cambios por bloque

### 1) [lib/permissions.ts](lib/permissions.ts)

- Quitar `tasks_view_all` del union `PermissionKey`, de `baseKeys`, de todas las entradas de `DEFAULT_MATRIX`, de `PERMISSION_ROWS`.
- Quitar el `if (level === 'propietario') { ... tasks_view_all }` en `mergeWithDefault` (ya no existe la key).

### 2) Kanban / bootstrap

- [loadWorkBoardBootstrap.ts](lib/work-board/loadWorkBoardBootstrap.ts): eliminar `canTasksViewAll`, lógica `hasServerPermission('tasks_view_all')`, `initialKanbanScope` y `parseKanbanScope` si dejan de usarse; opcional quitar `scope` de `WorkBoardSearchParams` y del payload.
- [bootstrap/route.ts](app/api/work-board/bootstrap/route.ts): dejar de leer `scope` si se elimina del contrato.
- [WorkBoardQueryBridge.tsx](components/work-board/WorkBoardQueryBridge.tsx): quitar props `canTasksViewAll`, `initialKanbanScope`; quitar `scope` de la URL del fetch si aplica.
- [workBoardQueryKeys.ts](lib/work-board/workBoardQueryKeys.ts): quitar `sp.scope` de la queryKey.

### 3) [WorkBoardPageClient.tsx](components/work-board/WorkBoardPageClient.tsx)

- Eliminar estado `kanbanScope`, `syncKanbanScopeUrl`, `handleKanbanScopeChange`, props relacionadas.
- `kanbanDisplayItems` = `initialItems` filtrado solo por filtros de archivo/archivado (sin `filterKanbanItemsByScope`), o sustituir el `useMemo` por lista directa según la lógica actual de archivados.
- No pasar `showKanbanScopePicker` / `kanbanScope` a `KanbanFiltersPanel`.

### 4) [KanbanFiltersPanel.tsx](components/work-board/KanbanFiltersPanel.tsx)

- Eliminar props y bloque UI de `KanbanScopePicker` (o el panel entero de ámbito si solo servía para eso).

### 5) [kanbanScopeFilter.ts](lib/work-board/kanbanScopeFilter.ts)

- Eliminar el archivo y todas las importaciones, **o** dejar una función trivial `export function filterKanbanItemsByScope(items) { return items }` solo si reduce diff; preferido **borrar archivo** y usar `initialItems` directamente.

### 6) [KanbanScopePicker.tsx](components/work-board/KanbanScopePicker.tsx) y [kanbanScope.ts](lib/work-board/kanbanScope.ts)

- Si ningún import queda tras limpieza, **eliminar** ambos. Si algo ajeno al tablero importa `KanbanScope`, grep global antes de borrar.

### 7) Migración Supabase (datos)

Nueva migración (nombre con timestamp coherente) que actualice `permission_matrix` eliminando la clave en cada nivel:

```sql
UPDATE public.businesses AS b
SET permission_matrix = sub.new_matrix
FROM (
  SELECT
    b2.id,
    coalesce(
      (
        SELECT jsonb_object_agg(lvl_key, coalesce(lvl_val, '{}'::jsonb) - 'tasks_view_all')
        FROM jsonb_each(coalesce(b2.permission_matrix, '{}'::jsonb)) AS e(lvl_key, lvl_val)
      ),
      '{}'::jsonb
    ) AS new_matrix
  FROM public.businesses AS b2
) AS sub
WHERE b.id = sub.id;
```

(Validar en entorno de desarrollo: si `lvl_val` no es objeto, `coalesce` evita error.)

La migración [20260513140000](supabase/migrations/20260513140000_businesses_propietario_tasks_view_all_false.sql) queda **redundante/obsoleta** frente a la nueva: opción A) nueva migración que hace el strip global; opción B) editar 20260513140000 solo si aún no se ha aplicado en ningún entorno. Si ya está aplicada, **solo** añadir la nueva migración strip-all-levels.

### 8) Verificación final

- `rg tasks_view_all` y `rg canTasksViewAll` en el repo → cero resultados (salvo comentarios históricos en migraciones ya merged si se conservan; ideal eliminar o sustituir comentarios).

---

## Impacto de producto (explícito)

- Desaparece el selector **Mis / Equipo / Todo** del tablero (antes solo visible con `tasks_view_all`). Todos los usuarios ven en Kanban **solo** filas que devuelve la consulta bajo RLS (regla ya acordada).

---

## Prueba manual (post-implementación)

1. Empleado crea tarea sin asignar al propietario → propietario **no** la ve.
2. Propietario crea tarea → **sí** la ve.
3. Empleado asigna al propietario → **sí** la ve.
4. Pestaña Equipo → permisos: **no** existe fila “Ver todas las tareas del negocio”.
