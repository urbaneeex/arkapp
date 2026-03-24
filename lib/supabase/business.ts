import { createClient } from '@/lib/supabase/server'

export type BusinessAccess = {
  businessId: string
  accessLevel: string | null
  isOwner: boolean
}

/**
 * Obtiene el business_id y access_level para un usuario.
 * Lógica exacta según especificación:
 * 1. Primero: SELECT * FROM businesses WHERE owner_uid = user.id (Si hay resultado, es Jefe. Fin)
 * 2. Segundo: Si no es jefe, SELECT business_id, access_level FROM staff WHERE id = user.id
 * 3. Tercero: Si está en staff, SELECT * FROM businesses WHERE id = staff.business_id
 */
export async function getBusinessAccess(userId: string): Promise<BusinessAccess | null> {
  const supabase = await createClient()

  // Verificar que el usuario autenticado coincide con el userId pasado
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser || authUser.id !== userId) {
    console.error('[getBusinessAccess] Usuario autenticado no coincide:', {
      authUserId: authUser?.id,
      requestedUserId: userId,
    })
    return null
  }

  // PASO 1: Verificar si es owner (Jefe)
  const { data: ownerBusiness, error: ownerError } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_uid', userId)
    .maybeSingle()

  // Si hay resultado, es owner. Fin.
  if (ownerBusiness && !ownerError) {
    return {
      businessId: ownerBusiness.id,
      accessLevel: 'propietario',
      isOwner: true,
    }
  }

  if (ownerError) {
    console.log('[getBusinessAccess] Owner check error (expected if not owner):', ownerError.message || ownerError)
  }

  // PASO 2: Si no es owner, buscar en staff
  // Intentar primero con una consulta simple para verificar RLS
  console.log('[getBusinessAccess] Intentando leer staff para userId:', userId)
  const { data: staffMember, error: staffError } = await supabase
    .from('staff')
    .select('business_id, access_level')
    .eq('id', userId)
    .is('deleted_at', null)
    .maybeSingle()

  // Manejar errores de forma más robusta
  if (staffError) {
    // Intentar obtener más información del error
    const errorInfo = {
      message: staffError.message || 'Error sin mensaje',
      code: staffError.code || 'Sin código',
      details: staffError.details || 'Sin detalles',
      hint: staffError.hint || 'Sin hint',
      userId,
      authUserId: authUser?.id,
    }
    
    // Si el error está vacío o es un objeto sin propiedades, podría ser RLS
    const errorKeys = Object.keys(staffError || {})
    if (errorKeys.length === 0 || (!staffError.message && !staffError.code)) {
      console.error('[getBusinessAccess] Error vacío detectado - posible bloqueo RLS:', {
        userId,
        authUserId: authUser?.id,
        errorObject: staffError,
        errorStringified: JSON.stringify(staffError),
        errorKeys,
      })
      
      // Intentar verificar si el problema es RLS probando con una consulta diferente
      const { count, error: countError } = await supabase
        .from('staff')
        .select('*', { count: 'exact', head: true })
        .eq('id', userId)
      
      console.error('[getBusinessAccess] Resultado de count para diagnóstico:', {
        count,
        countError: countError ? {
          message: countError.message,
          code: countError.code,
        } : null,
      })
    } else {
      console.error('[getBusinessAccess] Error al buscar staff:', errorInfo)
    }
    return null
  }

  // Si no hay error pero tampoco hay datos
  if (!staffMember) {
    console.warn('[getBusinessAccess] No se encontró staff para userId:', userId)
    console.warn('[getBusinessAccess] Auth user ID:', authUser?.id)
    console.warn('[getBusinessAccess] Esto podría indicar: 1) Usuario no está en staff, 2) Bloqueo RLS, 3) ID no coincide')
    
    // Verificar si el problema es RLS con una consulta de count
    const { count, error: countError } = await supabase
      .from('staff')
      .select('*', { count: 'exact', head: true })
      .eq('id', userId)
    
    console.warn('[getBusinessAccess] Count result:', { count, countError: countError?.message })
    return null
  }
  
  console.log('[getBusinessAccess] Staff encontrado:', {
    userId,
    businessId: staffMember.business_id,
    accessLevel: staffMember.access_level,
  })

  if (!staffMember.business_id) {
    console.log('[getBusinessAccess] Staff encontrado pero sin business_id:', staffMember)
    return null
  }

  // PASO 3: Si está en staff, verificar que la empresa existe
  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', staffMember.business_id)
    .maybeSingle()

  if (businessError) {
    console.error('Error al buscar business del staff:', businessError)
    return null
  }

  if (business) {
    return {
      businessId: staffMember.business_id,
      accessLevel: staffMember.access_level || 'basico',
      isOwner: false,
    }
  }

  return null
}

/**
 * Obtiene el objeto business completo para un usuario.
 * Sigue la misma lógica que getBusinessAccess pero devuelve el objeto completo.
 */
export async function getBusinessForUser(userId: string) {
  const supabase = await createClient()

  // PASO 1: Verificar si es owner (Jefe)
  const { data: ownerBusiness, error: ownerError } = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_uid', userId)
    .maybeSingle()

  if (ownerBusiness && !ownerError) {
    return { business: ownerBusiness, isOwner: true }
  }

  // PASO 2: Si no es owner, buscar en staff
  const { data: staffMember, error: staffError } = await supabase
    .from('staff')
    .select('business_id')
    .eq('id', userId)
    .is('deleted_at', null)
    .maybeSingle()

  if (staffError) {
    console.error('[getBusinessForUser] Error al buscar staff:', {
      error: staffError,
      message: staffError?.message,
      details: staffError?.details,
      hint: staffError?.hint,
      code: staffError?.code,
      userId,
      errorString: JSON.stringify(staffError),
    })
    return null
  }

  if (!staffMember) {
    console.log('[getBusinessForUser] No se encontró staff para userId:', userId)
    return null
  }

  if (!staffMember.business_id) {
    console.log('[getBusinessForUser] Staff encontrado pero sin business_id:', staffMember)
    return null
  }

  // PASO 3: Si está en staff, obtener el business completo
  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', staffMember.business_id)
    .maybeSingle()

  if (businessError) {
    console.error('Error al buscar business del staff:', businessError)
    return null
  }

  if (business) {
    return { business, isOwner: false }
  }

  return null
}

/**
 * Obtiene solo el business_id para un usuario (más eficiente cuando solo necesitas el ID)
 */
export async function getBusinessIdForUser(userId: string): Promise<string | null> {
  const access = await getBusinessAccess(userId)
  return access?.businessId || null
}
