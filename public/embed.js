/**
 * Arkapp — widget de reservas públicas (Web Component + Shadow DOM).
 *
 * <div id="arkapp-booking"></div>
 * <script src="https://TU_DOMINIO/embed.js" data-business="slug-negocio" data-color="#3b82f6" defer></script>
 */
;(function () {
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;')
  }

  function todayISO() {
    var d = new Date()
    var y = d.getFullYear()
    var m = String(d.getMonth() + 1).padStart(2, '0')
    var day = String(d.getDate()).padStart(2, '0')
    return y + '-' + m + '-' + day
  }

  function formatMoney(n) {
    try {
      return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
    } catch (_) {
      return String(n) + ' €'
    }
  }

  class ArkappBooking extends HTMLElement {
    constructor() {
      super()
      this._ro = null
      this._root = null
      this._accent = '#3b82f6'
      this._slug = ''
      this._origin = ''
      this._state = {}
    }

    connectedCallback() {
      if (this.hasAttribute('data-ar-mounted')) return
      this.setAttribute('data-ar-mounted', '1')

      this._accent = this.getAttribute('accent') || '#3b82f6'
      this._slug = (this.getAttribute('business') || '').trim()
      this._origin = (this.getAttribute('origin') || window.location.origin).replace(/\/$/, '')

      var sr = this.attachShadow({ mode: 'open' })
      sr.innerHTML =
        '<style>' +
        ':host{display:block;font-family:system-ui,-apple-system,sans-serif;color:#18181b;}' +
        '.wrap{max-width:28rem;margin:0 auto;padding:1rem;background:#fff;border-radius:1rem;' +
        'border:1px solid #e4e4e7;box-shadow:0 10px 15px -3px rgba(0,0,0,.08);}' +
        'h1{font-size:1.25rem;font-weight:700;margin:0 0 .25rem;text-align:center;}' +
        '.sub{font-size:.875rem;color:#71717a;text-align:center;margin:0 0 1rem;}' +
        '.logo{width:3.5rem;height:3.5rem;border-radius:.75rem;object-fit:cover;margin:0 auto .75rem;display:block;}' +
        'button.btn{display:inline-flex;align-items:center;justify-content:center;' +
        'padding:.5rem .75rem;border-radius:.75rem;border:1px solid #e4e4e7;background:#fafafa;' +
        'cursor:pointer;font:inherit;width:100%;margin-bottom:.5rem;text-align:left;}' +
        'button.btn-sel{border-width:2px;}' +
        'button.primary{border:none;color:#fff;font-weight:600;width:100%;padding:.65rem;border-radius:.75rem;cursor:pointer;margin-top:.25rem;}' +
        'button.secondary{width:auto;flex:1;border:1px solid #e4e4e7;background:#fff;border-radius:.75rem;padding:.65rem;cursor:pointer;}' +
        '.row{display:flex;gap:.5rem;}' +
        'label{display:block;font-size:.8rem;font-weight:500;margin-bottom:.25rem;color:#27272a;}' +
        'input,textarea{width:100%;box-sizing:border-box;padding:.5rem;border:1px solid #e4e4e7;border-radius:.5rem;font:inherit;}' +
        '.slots{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.35rem;max-height:14rem;overflow:auto;}' +
        'button.slot{padding:.4rem;border-radius:.5rem;border:1px solid #e4e4e7;background:#fff;cursor:pointer;font-size:.85rem;}' +
        'button.slot-on{color:#fff;border:none;}' +
        '.err{color:#dc2626;font-size:.875rem;margin:.25rem 0;}' +
        'dl{margin:0;padding:.75rem;background:#fafafa;border-radius:.75rem;font-size:.875rem;}' +
        'dl div{display:flex;justify-content:space-between;gap:.5rem;margin-bottom:.35rem;}' +
        'dt{color:#71717a;margin:0;}dd{margin:0;text-align:right;font-weight:500;}' +
        '.ok{text-align:center;padding:.5rem 0}' +
        '</style>' +
        '<div class="wrap"><div id="ar-root"></div></div>'

      this._root = sr.getElementById('ar-root')

      this._state = {
        step: 'service',
        meta: null,
        services: [],
        staff: [],
        serviceId: null,
        staffId: null,
        dateStr: todayISO(),
        slots: [],
        timeStr: null,
        fullName: '',
        phone: '',
        email: '',
        notes: '',
        error: null,
        loadingMeta: true,
        loadingLists: false,
        loadingSlots: false,
        submitting: false,
        bookingStatus: null,
      }

      try {
        var self = this
        this._ro = new ResizeObserver(function () {
          var w = sr.querySelector('.wrap')
          if (w && window.parent !== window) {
            window.parent.postMessage({ type: 'arkapp-booking-resize', height: w.offsetHeight }, '*')
          }
        })
        this._ro.observe(this)
      } catch (_) {}

      if (!this._slug) {
        this._root.innerHTML =
          '<p class="err">Falta el identificador del negocio (data-business).</p>'
        return
      }

      void this._bootstrap()
    }

    disconnectedCallback() {
      if (this._ro) {
        try {
          this._ro.disconnect()
        } catch (_) {}
      }
    }

    _api(path) {
      return (
        this._origin + '/api/public/booking/' + encodeURIComponent(this._slug) + path
      )
    }

    _showStaff() {
      var st = this._state
      return (
        st.meta &&
        st.meta.widget.staff_selector_visible &&
        st.staff.length > 0
      )
    }

    async _bootstrap() {
      try {
        var metaRes = await fetch(this._api('/meta'), { cache: 'no-store' })
        var metaJson = await metaRes.json().catch(function () {
          return null
        })
        if (!metaRes.ok) {
          this._state.loadingMeta = false
          this._render(metaJson && metaJson.error ? metaJson.error : 'No disponible')
          return
        }
        this._state.meta = {
          businessName: metaJson.businessName,
          logoUrl: metaJson.logoUrl,
          welcomeMessage: metaJson.welcomeMessage || '',
          widget: metaJson.widget,
          requireConfirmation: !!metaJson.requireConfirmation,
        }
        this._state.loadingMeta = false
        this._state.loadingLists = true
        this._render()

        var svRes = await fetch(this._api('/services'), { cache: 'no-store' })
        var stRes = await fetch(this._api('/staff'), { cache: 'no-store' })
        var sv = await svRes.json().catch(function () {
          return {}
        })
        var stData = await stRes.json().catch(function () {
          return {}
        })
        this._state.services = Array.isArray(sv.services) ? sv.services : []
        this._state.staff = Array.isArray(stData.staff) ? stData.staff : []
        this._state.loadingLists = false

        if (!this._state.services.length) {
          this._render('No hay servicios disponibles.')
          return
        }
        if (
          this._state.meta.widget.staff_selector_visible &&
          !this._state.staff.length
        ) {
          this._render('No hay profesionales disponibles.')
          return
        }

        this._render()
      } catch (e) {
        this._state.loadingMeta = false
        this._render('No se pudo cargar el widget.')
      }
    }

    async _loadSlots() {
      var st = this._state
      if (!st.serviceId) return
      st.loadingSlots = true
      st.slots = []
      st.timeStr = null
      this._render()
      try {
        var q =
          '?date=' +
          encodeURIComponent(st.dateStr) +
          '&serviceId=' +
          encodeURIComponent(st.serviceId)
        if (st.staffId && st.meta.widget.staff_selector_visible) {
          q += '&employeeId=' + encodeURIComponent(st.staffId)
        }
        var res = await fetch(this._api('/slots') + q, { cache: 'no-store' })
        var data = await res.json().catch(function () {
          return {}
        })
        st.slots = res.ok && Array.isArray(data.slots) ? data.slots : []
      } finally {
        st.loadingSlots = false
        this._render()
      }
    }

    async _submit() {
      var st = this._state
      if (!st.meta || !st.serviceId || !st.timeStr) return
      st.submitting = true
      st.error = null
      this._render()
      try {
        var body = {
          serviceId: st.serviceId,
          date: st.dateStr,
          time: st.timeStr,
          fullName: st.fullName.trim(),
          phone: st.phone.trim(),
        }
        if (st.meta.widget.email_visible && st.email.trim()) body.email = st.email.trim()
        if (st.staffId && st.meta.widget.staff_selector_visible)
          body.employeeId = st.staffId
        if (st.meta.widget.notes_visible && st.notes.trim()) body.notes = st.notes.trim()

        var res = await fetch(this._api('/reserve'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        var data = await res.json().catch(function () {
          return {}
        })
        if (!res.ok) {
          st.error = data.error || 'No se pudo completar la reserva'
          st.submitting = false
          this._render()
          return
        }
        st.bookingStatus = typeof data.status === 'string' ? data.status : null
        st.step = 'success'
        st.submitting = false
        this._render()
      } catch (e) {
        st.error = 'Error de red'
        st.submitting = false
        this._render()
      }
    }

    _render(fatalMsg) {
      var st = this._state
      var accent = this._accent
      var root = this._root
      var self = this

      if (fatalMsg) {
        root.innerHTML =
          '<p class="err" style="text-align:center;padding:1rem;">' + esc(fatalMsg) + '</p>'
        return
      }
      if (st.loadingMeta) {
        root.innerHTML = '<p class="sub">Cargando…</p>'
        return
      }
      if (!st.meta) return

      var html = ''
      var logo = st.meta.logoUrl
        ? '<img class="logo" src="' +
          esc(st.meta.logoUrl) +
          '" alt="" crossorigin="anonymous"/>'
        : ''
      html +=
        logo +
        '<h1>' +
        esc(st.meta.businessName) +
        '</h1>' +
        '<p class="sub">' +
        esc(st.meta.welcomeMessage || 'Reserva tu cita online') +
        '</p>'

      if (st.step === 'service') {
        html += '<div>'
        for (var i = 0; i < st.services.length; i++) {
          var s = st.services[i]
          var sel = st.serviceId === s.id ? ' btn-sel' : ''
          var bor = st.serviceId === s.id ? 'border-color:' + esc(accent) + ';' : ''
          html +=
            '<button type="button" class="btn' +
            sel +
            '" data-act="pick-svc" data-id="' +
            esc(s.id) +
            '" style="' +
            bor +
            '">' +
            '<strong>' +
            esc(s.name) +
            '</strong><br/><span style="color:#71717a;font-size:.8rem;">' +
            esc(String(s.duration)) +
            ' min · ' +
            esc(formatMoney(s.price)) +
            '</span></button>'
        }
        html +=
          '<button type="button" class="primary" data-act="next-svc" style="background:' +
          esc(accent) +
          '"' +
          (st.serviceId ? '' : ' disabled') +
          '>Continuar</button></div>'
      } else if (st.step === 'staff' && this._showStaff()) {
        html += '<div>'
        for (var j = 0; j < st.staff.length; j++) {
          var u = st.staff[j]
          var sel2 = st.staffId === u.id ? ' btn-sel' : ''
          var bor2 = st.staffId === u.id ? 'border-color:' + esc(accent) + ';' : ''
          html +=
            '<button type="button" class="btn' +
            sel2 +
            '" data-act="pick-st" data-id="' +
            esc(u.id) +
            '" style="' +
            bor2 +
            '">' +
            esc(u.name) +
            '</button>'
        }
        html +=
          '<div class="row"><button type="button" class="secondary" data-act="back">Atrás</button>' +
          '<button type="button" class="primary" data-act="next-st" style="background:' +
          esc(accent) +
          ';flex:2"' +
          (st.staffId ? '' : ' disabled') +
          '>Continuar</button></div></div>'
      } else if (st.step === 'datetime') {
        html +=
          '<div><label>Fecha</label><input type="date" data-act="date" min="' +
          esc(todayISO()) +
          '" value="' +
          esc(st.dateStr) +
          '"/>'
        html += '<p style="font-size:.875rem;font-weight:500;margin:.75rem 0 .35rem;">Hora</p>'
        if (st.loadingSlots) html += '<p class="sub">Cargando horarios…</p>'
        else if (!st.slots.length) html += '<p class="sub">No hay huecos ese día.</p>'
        else {
          html += '<div class="slots">'
          for (var k = 0; k < st.slots.length; k++) {
            var t = st.slots[k]
            var on = st.timeStr === t
            html +=
              '<button type="button" class="slot' +
              (on ? ' slot-on' : '') +
              '" data-act="pick-time" data-t="' +
              esc(t) +
              '" style="' +
              (on ? 'background:' + esc(accent) : '') +
              '">' +
              esc(t) +
              '</button>'
          }
          html += '</div>'
        }
        if (st.error) html += '<p class="err">' + esc(st.error) + '</p>'
        html +=
          '<div class="row" style="margin-top:.75rem">' +
          '<button type="button" class="secondary" data-act="back">Atrás</button>' +
          '<button type="button" class="primary" data-act="next-slot" style="background:' +
          esc(accent) +
          ';flex:2">Continuar</button></div></div>'
      } else if (st.step === 'contact') {
        html +=
          '<div><label>Nombre completo</label><input data-act="fld" data-f="fullName" value="' +
          esc(st.fullName) +
          '"/>'
        html +=
          '<label style="margin-top:.5rem;">Teléfono</label><input data-act="fld" data-f="phone" value="' +
          esc(st.phone) +
          '"/>'
        if (st.meta.widget.email_visible) {
          html +=
            '<label style="margin-top:.5rem;">Email' +
            (st.meta.widget.email_required ? ' (obligatorio)' : ' (opcional)') +
            '</label><input type="email" data-act="fld" data-f="email" value="' +
            esc(st.email) +
            '"/>'
        }
        if (st.meta.widget.notes_visible) {
          html +=
            '<label style="margin-top:.5rem;">Notas</label><textarea rows="3" data-act="fld" data-f="notes">' +
            esc(st.notes) +
            '</textarea>'
        }
        if (st.error) html += '<p class="err">' + esc(st.error) + '</p>'
        html +=
          '<div class="row" style="margin-top:.75rem">' +
          '<button type="button" class="secondary" data-act="back">Atrás</button>' +
          '<button type="button" class="primary" data-act="to-review" style="background:' +
          esc(accent) +
          ';flex:2">Revisar</button></div></div>'
      } else if (st.step === 'review') {
        var svc = null
        for (var a = 0; a < st.services.length; a++) {
          if (st.services[a].id === st.serviceId) svc = st.services[a]
        }
        var stf = null
        for (var b = 0; b < st.staff.length; b++) {
          if (st.staff[b].id === st.staffId) stf = st.staff[b]
        }
        html += '<p style="font-size:.875rem;font-weight:600;margin-bottom:.5rem;">Resumen</p><dl>'
        html +=
          '<div><dt>Servicio</dt><dd>' +
          esc(svc ? svc.name : '') +
          '</dd></div>' +
          '<div><dt>Fecha y hora</dt><dd>' +
          esc(st.dateStr + ' · ' + st.timeStr) +
          '</dd></div>'
        if (stf)
          html += '<div><dt>Profesional</dt><dd>' + esc(stf.name) + '</dd></div>'
        html +=
          '<div><dt>Precio</dt><dd>' +
          esc(svc ? formatMoney(svc.price) : '') +
          '</dd></div>' +
          '<div><dt>Contacto</dt><dd>' +
          esc(st.fullName) +
          '<br/>' +
          esc(st.phone) +
          (st.meta.widget.email_visible && st.email.trim()
            ? '<br/>' + esc(st.email.trim())
            : '') +
          '</dd></div></dl>'
        if (st.error) html += '<p class="err">' + esc(st.error) + '</p>'
        html +=
          '<div class="row" style="margin-top:.75rem">' +
          '<button type="button" class="secondary" data-act="back">Atrás</button>' +
          '<button type="button" class="primary" data-act="submit" style="background:' +
          esc(accent) +
          ';flex:2"' +
          (st.submitting ? ' disabled' : '') +
          '>' +
          (st.submitting ? 'Enviando…' : 'Confirmar reserva') +
          '</button></div>'
      } else if (st.step === 'success') {
        html +=
          '<div class="ok"><div style="width:3rem;height:3rem;border-radius:999px;margin:0 auto .75rem;' +
          'background:' +
          esc(accent) +
          ';color:#fff;display:flex;align-items:center;justify-content:center;font-size:1.5rem;">✓</div>' +
          '<p style="font-weight:600;font-size:1.1rem;margin:0 0 .5rem;">Reserva registrada</p>' +
          '<p class="sub">' +
          (st.meta.requireConfirmation || st.bookingStatus === 'pending'
            ? 'Recibirás confirmación cuando el negocio valide la cita.'
            : 'Tu cita está confirmada.') +
          '</p></div>'
      }

      root.innerHTML = html

      root.querySelectorAll('[data-act]').forEach(function (el) {
        el.addEventListener('click', function () {
          var act = el.getAttribute('data-act')
          if (act === 'pick-svc') {
            st.serviceId = el.getAttribute('data-id')
            self._render()
          } else           if (act === 'next-svc') {
            if (!st.serviceId) return
            st.error = null
            if (self._showStaff()) {
              st.step = 'staff'
              self._render()
            } else {
              st.staffId = null
              st.step = 'datetime'
              void self._loadSlots()
            }
          } else if (act === 'pick-st') {
            st.staffId = el.getAttribute('data-id')
            self._render()
          } else if (act === 'next-st') {
            if (!st.staffId) return
            st.step = 'datetime'
            void self._loadSlots()
          } else if (act === 'pick-time') {
            st.timeStr = el.getAttribute('data-t')
            self._render()
          } else if (act === 'next-slot') {
            if (!st.timeStr) {
              st.error = 'Elige una hora'
              self._render()
              return
            }
            st.error = null
            st.step = 'contact'
            self._render()
          } else if (act === 'to-review') {
            var err = null
            if (st.fullName.trim().length < 2) err = 'Indica tu nombre'
            else if (st.phone.trim().length < 6) err = 'Indica un teléfono válido'
            else if (st.meta.widget.email_required && !st.email.trim())
              err = 'El email es obligatorio'
            else if (
              st.email.trim() &&
              !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(st.email.trim())
            )
              err = 'Email no válido'
            if (err) {
              st.error = err
              self._render()
              return
            }
            st.error = null
            st.step = 'review'
            self._render()
          } else if (act === 'submit') {
            void self._submit()
          } else if (act === 'back') {
            st.error = null
            if (st.step === 'staff') st.step = 'service'
            else if (st.step === 'datetime') {
              if (self._showStaff()) st.step = 'staff'
              else st.step = 'service'
            } else if (st.step === 'contact') {
              st.step = 'datetime'
              void self._loadSlots()
            } else if (st.step === 'review') st.step = 'contact'
            self._render()
          }
        })
      })

      root.querySelectorAll('[data-act="fld"]').forEach(function (el) {
        el.addEventListener('input', function () {
          var f = el.getAttribute('data-f')
          if (f === 'fullName') st.fullName = el.value
          else if (f === 'phone') st.phone = el.value
          else if (f === 'email') st.email = el.value
          else if (f === 'notes') st.notes = el.value
        })
      })

      var dateEl = root.querySelector('[data-act="date"]')
      if (dateEl) {
        dateEl.addEventListener('change', function () {
          st.dateStr = dateEl.value
          void self._loadSlots()
        })
      }
    }
  }

  customElements.define('arkapp-booking', ArkappBooking)

  var cur = document.currentScript || document.querySelector('script[data-business]')
  var slug = cur && cur.getAttribute('data-business')
  var color = (cur && cur.getAttribute('data-color')) || '#3b82f6'
  var origin = cur ? new URL(cur.src).origin : window.location.origin
  var mount = document.getElementById('arkapp-booking')

  if (!slug || !String(slug).trim()) {
    console.warn('[Arkapp booking] Falta data-business en el script.')
    return
  }

  if (!window.customElements) {
    var link = document.createElement('a')
    link.href = origin.replace(/\/$/, '') + '/book/' + encodeURIComponent(String(slug).trim())
    link.textContent = 'Reservar cita'
    link.rel = 'noopener noreferrer'
    if (mount) mount.appendChild(link)
    else document.body.appendChild(link)
    console.warn('[Arkapp booking] Custom Elements no disponibles; mostrando enlace.')
    return
  }

  var node = document.createElement('arkapp-booking')
  node.setAttribute('business', String(slug).trim())
  node.setAttribute('accent', color)
  node.setAttribute('origin', origin.replace(/\/$/, ''))

  if (mount && mount.parentNode) mount.parentNode.replaceChild(node, mount)
  else document.body.appendChild(node)
})()
