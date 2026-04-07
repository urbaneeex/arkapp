import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { format, parseISO, differenceInMinutes } from 'date-fns'
import { es } from 'date-fns/locale'

function escapeCsv(value: string | null | undefined): string {
  if (value == null) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function row(cells: (string | null | undefined)[]): string {
  return cells.map(escapeCsv).join(',')
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const business_id = searchParams.get('business_id')
    const staff_id = searchParams.get('staff_id')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    if (!business_id) {
      return NextResponse.json({ error: 'Falta business_id' }, { status: 400 })
    }

    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    // Determine if owner or employee requesting own data
    const { data: ownerBusiness } = await supabase
      .from('businesses')
      .select('id, name')
      .eq('id', business_id)
      .eq('owner_uid', user.id)
      .maybeSingle()

    const isOwner = !!ownerBusiness

    // If not owner, can only export own entries
    let effectiveStaffId = staff_id
    if (!isOwner) {
      const { data: myStaff } = await supabase
        .from('staff')
        .select('id')
        .eq('business_id', business_id)
        .or(`id.eq.${user.id},email.eq.${user.email ?? ''}`)
        .is('deleted_at', null)
        .maybeSingle()
      if (!myStaff) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
      effectiveStaffId = myStaff.id
    }

    let query = supabase
      .from('time_entries')
      .select('*, staff:staff_id(id, name, dni)')
      .eq('business_id', business_id)
      .order('clock_in', { ascending: true })

    if (effectiveStaffId) query = query.eq('staff_id', effectiveStaffId)
    if (from) query = query.gte('clock_in', from)
    if (to) query = query.lte('clock_in', to)

    const { data: entries, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const businessName = ownerBusiness?.name ?? 'Empresa'
    const fromLabel = from ? format(parseISO(from), 'dd/MM/yyyy', { locale: es }) : ''
    const toLabel = to ? format(parseISO(to), 'dd/MM/yyyy', { locale: es }) : ''

    const lines: string[] = []

    // Header info
    lines.push(row(['Empresa', businessName]))
    lines.push(row(['Período', `${fromLabel} - ${toLabel}`]))
    lines.push(row(['Generado', format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })]))
    lines.push('')

    // Column headers
    lines.push(row([
      'Empleado',
      'DNI/NIE',
      'Fecha',
      'Entrada',
      'Salida',
      'Horas trabajadas',
      'Pausa (min)',
      'Método',
      'Notas',
    ]))

    // Data rows
    for (const entry of entries ?? []) {
      const staffData = entry.staff as { id: string; name: string; dni: string | null } | null
      const clockIn = parseISO(entry.clock_in)
      const clockOut = entry.clock_out ? parseISO(entry.clock_out) : null
      const mins = clockOut ? differenceInMinutes(clockOut, clockIn) : null
      const hoursWorked = mins != null
        ? `${Math.floor(mins / 60)}h ${mins % 60}m`
        : 'En curso'

      // Break duration in minutes
      const breakMins = (entry.break_start && entry.break_end)
        ? String(differenceInMinutes(parseISO(entry.break_end), parseISO(entry.break_start)))
        : ''

      lines.push(row([
        staffData?.name ?? '',
        staffData?.dni ?? '',
        format(clockIn, 'dd/MM/yyyy', { locale: es }),
        format(clockIn, 'HH:mm'),
        clockOut ? format(clockOut, 'HH:mm') : '',
        hoursWorked,
        breakMins,
        entry.source ?? 'manual',
        entry.notes ?? '',
      ]))
    }

    // Summary
    const completedEntries = (entries ?? []).filter(e => e.clock_out)
    const totalMins = completedEntries.reduce((acc, e) => {
      if (!e.clock_out) return acc
      return acc + differenceInMinutes(parseISO(e.clock_out), parseISO(e.clock_in))
    }, 0)

    lines.push('')
    lines.push(row(['Total registros', String((entries ?? []).length)]))
    lines.push(row(['Total horas', `${Math.floor(totalMins / 60)}h ${totalMins % 60}m`]))

    const csv = lines.join('\n')
    const filenameParts = ['fichajes', businessName.replace(/[^a-zA-Z0-9]/g, '_')]
    if (fromLabel) filenameParts.push(fromLabel.replace(/\//g, '-'))
    if (toLabel) filenameParts.push(toLabel.replace(/\//g, '-'))
    const filename = `${filenameParts.join('_')}.csv`

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('[time-entries export]', err)
    return NextResponse.json({ error: 'Error inesperado' }, { status: 500 })
  }
}
