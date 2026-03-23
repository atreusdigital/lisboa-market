-- ================================================
-- SEED MANUAL — Ejecutar DESPUÉS de crear usuarios en Supabase Auth
-- Reemplazá los UUIDs con los IDs reales de cada usuario creado en Auth
-- ================================================

-- DIRECTORES (acceso a todas las sucursales)
-- INSERT INTO profiles (id, full_name, role, branch_id) VALUES
--   ('UUID_SEBASTIAN', 'Sebastián', 'director', NULL),
--   ('UUID_LUCIANA',   'Luciana',   'director', NULL),
--   ('UUID_CLAUDIO',   'Claudio',   'director', NULL),
--   ('UUID_MARCELA',   'Marcela',   'director', NULL);

-- ENCARGADOS
-- INSERT INTO profiles (id, full_name, role, branch_id) VALUES
--   ('UUID_NICOLAS', 'Nicolás',  'admin', 'b1000000-0000-0000-0000-000000000001'),  -- Caballito
--   ('UUID_LUCILA',  'Lucila',   'admin', 'b2000000-0000-0000-0000-000000000002');  -- Villa Luro

-- EMPLEADOS CABALLITO
-- INSERT INTO profiles (id, full_name, role, branch_id) VALUES
--   ('UUID_MARTIN',  'Martín',  'empleado', 'b1000000-0000-0000-0000-000000000001'),
--   ('UUID_LUCAS',   'Lucas',   'empleado', 'b1000000-0000-0000-0000-000000000001'),
--   ('UUID_GABRIEL', 'Gabriel', 'empleado', 'b1000000-0000-0000-0000-000000000001');

-- EMPLEADOS VILLA LURO
-- INSERT INTO profiles (id, full_name, role, branch_id) VALUES
--   ('UUID_LOURDES',  'Lourdes',  'empleado', 'b2000000-0000-0000-0000-000000000002'),
--   ('UUID_MARTINA',  'Martina',  'empleado', 'b2000000-0000-0000-0000-000000000002'),
--   ('UUID_SOFIA',    'Sofía',    'empleado', 'b2000000-0000-0000-0000-000000000002');

-- ================================================
-- TRIGGER: auto-crear perfil al registrar usuario en Auth
-- ================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'empleado')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();
