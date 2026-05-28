import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildNameContextFromRows,
  describeAppointmentAuditChangePhrases,
  formatAppointmentAuditLine,
} from './describeAppointmentAuditChanges'
import { buildAppointmentActivityFeed } from './buildAppointmentActivityFeed'

const ctx = buildNameContextFromRows({
  staffNames: new Map([['user-1', 'Alex']]),
  stages: [{ id: 'stage-1', label: 'Pendiente' }],
  clients: [{ id: 'client-1', name: 'María' }],
})

describe('describeAppointmentAuditChangePhrases', () => {
  it('fecha inicio cambia → frase concreta', () => {
    const phrases = describeAppointmentAuditChangePhrases(
      {
        actor_id: 'user-1',
        action: 'update',
        old_record: { title: 'Tarea', start_time: '2026-05-01T10:00:00.000Z' },
        new_record: { title: 'Tarea', start_time: '2026-05-02T14:00:00.000Z' },
      },
      ctx
    )
    assert.equal(phrases.length, 1)
    assert.match(phrases[0], /cambió la fecha de inicio a/)
  })

  it('actor_id null → vacío', () => {
    const line = formatAppointmentAuditLine(
      {
        actor_id: null,
        action: 'update',
        old_record: { title: 'A' },
        new_record: { title: 'B' },
      },
      ctx
    )
    assert.equal(line, null)
  })

  it('sin cambios detectables → vacío', () => {
    const record = { title: 'Igual', start_time: null, staff_id: null, metadata: {} }
    const phrases = describeAppointmentAuditChangePhrases(
      {
        actor_id: 'user-1',
        action: 'update',
        old_record: record,
        new_record: { ...record },
      },
      ctx
    )
    assert.equal(phrases.length, 0)
  })

  it('insert → creó la tarea', () => {
    const phrases = describeAppointmentAuditChangePhrases(
      {
        actor_id: 'user-1',
        action: 'insert',
        old_record: null,
        new_record: { title: 'Nueva' },
      },
      ctx
    )
    assert.deepEqual(phrases, ['creó la tarea «Nueva»'])
  })
})

describe('buildAppointmentActivityFeed agrupación', () => {
  it('dos updates mismo actor ≤5s → una línea con dos frases', () => {
    const t0 = '2026-05-19T12:00:00.000Z'
    const t1 = '2026-05-19T12:00:02.000Z'
    const items = buildAppointmentActivityFeed(
      [
        {
          id: 'a1',
          actor_id: 'user-1',
          action: 'update',
          old_record: { title: 'Tarea' },
          new_record: { title: 'Renombrada' },
          created_at: t0,
        },
        {
          id: 'a2',
          actor_id: 'user-1',
          action: 'update',
          old_record: { title: 'Renombrada', pipeline_stage_id: 'old' },
          new_record: { title: 'Renombrada', pipeline_stage_id: 'stage-1' },
          created_at: t1,
        },
      ],
      [],
      ctx
    )
    assert.equal(items.length, 1)
    assert.match(items[0].text, /Alex/)
    assert.match(items[0].text, /renombró la tarea/)
    assert.match(items[0].text, /movió a la columna «Pendiente»/)
    assert.equal(items[0].created_at, t1)
  })

  it('descarta filas audit sin actor', () => {
    const items = buildAppointmentActivityFeed(
      [
        {
          id: 'a1',
          actor_id: null,
          action: 'update',
          old_record: { title: 'A' },
          new_record: { title: 'B' },
          created_at: '2026-05-19T12:00:00.000Z',
        },
      ],
      [],
      ctx
    )
    assert.equal(items.length, 0)
  })
})
