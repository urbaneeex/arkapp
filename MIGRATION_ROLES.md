# Migración: Crear tabla de Roles

## Problema
El error `Could not find the table 'public.roles' in the schema cache` indica que la tabla `roles` no existe en la base de datos.

## Solución

### Opción 1: Ejecutar desde el Dashboard de Supabase (Recomendado)

1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Navega a **SQL Editor**
3. Copia y pega el contenido del archivo `supabase/migrations/create_roles_table.sql`
4. Haz clic en **Run** para ejecutar la migración

### Opción 2: Usar Supabase CLI

Si tienes Supabase CLI instalado:

```bash
supabase db push
```

O ejecuta directamente:

```bash
supabase db execute -f supabase/migrations/create_roles_table.sql
```

### Opción 3: Ejecutar manualmente el SQL

Copia el siguiente SQL y ejecútalo en el SQL Editor de Supabase:

```sql
-- Crear tabla de roles
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  permissions JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, name)
);

-- Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_roles_business_id ON roles(business_id);

-- Habilitar RLS
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- Política: Solo el owner del negocio puede ver/crear/editar/eliminar roles de su negocio
CREATE POLICY "Users can view roles of their business"
  ON roles FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_uid = auth.uid()
    )
  );

CREATE POLICY "Users can create roles for their business"
  ON roles FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE owner_uid = auth.uid()
    )
  );

CREATE POLICY "Users can update roles of their business"
  ON roles FOR UPDATE
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_uid = auth.uid()
    )
  );

CREATE POLICY "Users can delete roles of their business"
  ON roles FOR DELETE
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_uid = auth.uid()
    )
  );
```

## Verificación

Después de ejecutar la migración, verifica que la tabla existe:

```sql
SELECT * FROM roles LIMIT 1;
```

Si no hay errores, la tabla se ha creado correctamente.
