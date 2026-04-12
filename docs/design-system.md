# Arkapp — guía de diseño (resumen)

Esta guía resume tokens y patrones de UI. La regla que Cursor inyecta automáticamente en archivos de UI está en [`.cursor/rules/arkapp-design-system.mdc`](../.cursor/rules/arkapp-design-system.mdc).

## Tokens (Tailwind v4)

Definidos en [`app/globals.css`](../app/globals.css):

| Token / utilidad | Uso |
|------------------|-----|
| `font-sans` | **Space Grotesk** (`next/font` en `app/layout.tsx`): texto general del SaaS |
| `font-display` | **Clash Display** (Fontshare en `<head>`): marca “Arkapp” en cabecera, tooltips del menú, titulares de sección donde se use la clase |
| `text-brand`, `bg-brand`, `border-brand`, `ring-brand` | Acento de marca (`#3b82f6`) |
| `bg-brand-hover`, `hover:bg-brand-hover`, etc. | Hover de marca (`#2563eb`) |

En el código se sustituyeron los `blue-*` de Tailwind y los hex `#3B82F6` / `#2563eb` en UI por estas utilidades donde aplicaba el acento de producto. Los **emails HTML** y algunos **estilos inline** pueden seguir usando el mismo hex alineado con `--brand` / `--brand-hover`.

## Tipografía en la práctica

El `body` usa **`font-sans`** (Grotesk). **Clash** se aplica con **`font-display`** en titulares (`h1` de sección), en la palabra “Arkapp” del [`GlobalHeader`](../../components/layout/GlobalHeader.tsx) y en las etiquetas del componente [`Tooltip`](../../components/ui/tooltip.tsx).

## Patrón de sección con pestañas

Referencia canónica: [`components/staff/StaffClient.tsx`](../components/staff/StaffClient.tsx).

1. Cabecera con `mb-6`, título `text-2xl font-bold` (Clash ya viene del body; opcional `font-display` por claridad).
2. `TabsList` estilo fila con wrap, fondo `bg-zinc-800`.
3. `TabsContent` con `mt-6`.

## Layout

No repetir padding horizontal que ya aplica [`components/layout/DashboardMain.tsx`](../components/layout/DashboardMain.tsx).
