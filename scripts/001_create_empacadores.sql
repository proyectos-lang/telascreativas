-- Create empacadores table in telas schema
-- Each empacador is a person who can be assigned to pack orders
CREATE TABLE IF NOT EXISTS telas.empacadores (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL
);

-- Seed empacadores only if the table is empty to avoid duplicates on re-runs
INSERT INTO telas.empacadores (nombre)
SELECT * FROM (
  VALUES
    ('Empacador 1'),
    ('Empacador 2'),
    ('Empacador 3')
) AS seed(nombre)
WHERE NOT EXISTS (SELECT 1 FROM telas.empacadores);

-- Ensure pcs_empacados exists as numeric on detalleorden (safe if already present)
ALTER TABLE telas.detalleorden
  ADD COLUMN IF NOT EXISTS pcs_empacados NUMERIC DEFAULT 0;
