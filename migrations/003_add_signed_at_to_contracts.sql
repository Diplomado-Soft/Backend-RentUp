-- Migración: Agregar columna signed_at a rental_agreements para Firma Digital
-- Ejecutar: mysql -u usuario -p rentup < migrations/003_add_signed_at_to_contracts.sql

ALTER TABLE rental_agreements
ADD COLUMN signed_at DATETIME NULL DEFAULT NULL AFTER status,
ADD INDEX idx_signed_at (signed_at);
