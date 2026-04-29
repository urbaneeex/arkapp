export type WidgetSettings = {
  primary_color: string
  email_visible: boolean
  email_required: boolean
  staff_selector_visible: boolean
  notes_visible: boolean
}

export type ParsedPublicBookingSettings = {
  allow_online_booking: boolean
  require_confirmation: boolean
  min_advance_hours: number
  welcome_message: string
  widget: WidgetSettings
}

const DEFAULT_WIDGET: WidgetSettings = {
  primary_color: '#3b82f6',
  email_visible: true,
  email_required: false,
  staff_selector_visible: true,
  notes_visible: false,
}

export function parsePublicBookingSettings(raw: unknown): ParsedPublicBookingSettings {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const w =
    o.widget && typeof o.widget === 'object'
      ? (o.widget as Record<string, unknown>)
      : {}

  return {
    allow_online_booking: Boolean(o.allow_online_booking ?? false),
    require_confirmation: Boolean(o.require_confirmation ?? false),
    min_advance_hours: typeof o.min_advance_hours === 'number' && !Number.isNaN(o.min_advance_hours)
      ? Math.max(0, o.min_advance_hours)
      : 0,
    welcome_message: typeof o.welcome_message === 'string' ? o.welcome_message : '',
    widget: {
      primary_color: typeof w.primary_color === 'string' && w.primary_color.startsWith('#')
        ? w.primary_color
        : DEFAULT_WIDGET.primary_color,
      email_visible: typeof w.email_visible === 'boolean' ? w.email_visible : DEFAULT_WIDGET.email_visible,
      email_required: typeof w.email_required === 'boolean' ? w.email_required : DEFAULT_WIDGET.email_required,
      staff_selector_visible:
        typeof w.staff_selector_visible === 'boolean'
          ? w.staff_selector_visible
          : DEFAULT_WIDGET.staff_selector_visible,
      notes_visible: typeof w.notes_visible === 'boolean' ? w.notes_visible : DEFAULT_WIDGET.notes_visible,
    },
  }
}
