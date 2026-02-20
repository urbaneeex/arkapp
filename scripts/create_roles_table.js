/**
 * Script para crear la tabla roles en Supabase
 * Ejecutar con: node scripts/create_roles_table.js
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Se requieren NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en las variables de entorno')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function runMigration() {
  try {
    console.log('📝 Leyendo migración...')
    const migrationPath = path.join(__dirname, '../supabase/migrations/create_roles_table.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    console.log('🚀 Ejecutando migración...')
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL })
    
    if (error) {
      // Si el RPC no existe, intentar ejecutar directamente
      console.log('⚠️  RPC no disponible, intentando método alternativo...')
      console.log('📋 Por favor, ejecuta manualmente el SQL desde el dashboard de Supabase:')
      console.log('\n' + migrationSQL + '\n')
      console.log('O ejecuta este script con permisos de service_role')
      return
    }
    
    console.log('✅ Migración ejecutada correctamente')
  } catch (error) {
    console.error('❌ Error ejecutando migración:', error.message)
    console.log('\n📋 Por favor, ejecuta manualmente el SQL desde el dashboard de Supabase:')
    const migrationPath = path.join(__dirname, '../supabase/migrations/create_roles_table.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    console.log('\n' + migrationSQL + '\n')
  }
}

runMigration()
