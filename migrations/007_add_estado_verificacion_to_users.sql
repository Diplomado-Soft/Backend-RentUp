-- Migration: Add estadoVerificacion column to users table
-- Description: Adds verification status field for arrendador users
-- Values: 'pendiente', 'aprobado', 'rechazado' (default: 'pendiente')

ALTER TABLE users 
ADD COLUMN estadoVerificacion ENUM('pendiente', 'aprobado', 'rechazado') 
NOT NULL DEFAULT 'pendiente' 
COMMENT 'Estado de verificación del usuario para arrendadores';