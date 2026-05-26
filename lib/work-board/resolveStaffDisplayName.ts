import type { SupabaseClient } from '@supabase/supabase-js'

export async function resolveStaffDisplayName(
  supabase: SupabaseClient,
  businessId: string,
  userId: string
): Promise<string> {
  const { data: staff } = await supabase
    .from('staff')
    .select('name')
    .eq('id', userId)
    .maybeSingle()
  if (staff?.name?.trim()) return staff.name.trim()

  const { data: biz } = await supabase
    .from('businesses')
    .select('owner_uid, owner_name')
    .eq('id', businessId)
    .maybeSingle()
  if (biz?.owner_uid === userId && biz.owner_name?.trim()) {
    return biz.owner_name.trim()
  }
  return 'Usuario'
}
