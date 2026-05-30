-- Agregar columnas de visibilidad para soft-delete por usuario
-- vistainquilino: cuando 'inactivo', el inquilino no ve el registro
-- vistaarrendador: cuando 'inactivo', el arrendador no ve el registro

ALTER TABLE rental_agreements
    ADD COLUMN vistainquilino ENUM('activo','inactivo') NOT NULL DEFAULT 'activo',
    ADD COLUMN vistaarrendador ENUM('activo','inactivo') NOT NULL DEFAULT 'activo';

ALTER TABLE payments
    ADD COLUMN vistainquilino ENUM('activo','inactivo') NOT NULL DEFAULT 'activo',
    ADD COLUMN vistaarrendador ENUM('activo','inactivo') NOT NULL DEFAULT 'activo';

ALTER TABLE visits
    ADD COLUMN vistainquilino ENUM('activo','inactivo') NOT NULL DEFAULT 'activo',
    ADD COLUMN vistaarrendador ENUM('activo','inactivo') NOT NULL DEFAULT 'activo';

ALTER TABLE maintenance_reports
    ADD COLUMN vistainquilino ENUM('activo','inactivo') NOT NULL DEFAULT 'activo',
    ADD COLUMN vistaarrendador ENUM('activo','inactivo') NOT NULL DEFAULT 'activo';

ALTER TABLE reviews
    ADD COLUMN vistainquilino ENUM('activo','inactivo') NOT NULL DEFAULT 'activo',
    ADD COLUMN vistaarrendador ENUM('activo','inactivo') NOT NULL DEFAULT 'activo';
