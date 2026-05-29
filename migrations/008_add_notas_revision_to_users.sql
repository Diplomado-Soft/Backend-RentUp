-- Migration: Add notasRevision column to users table
-- Description: Stores admin review notes for user verification

ALTER TABLE users 
ADD COLUMN notasRevision TEXT DEFAULT NULL COMMENT 'Notas de revisión del administrador sobre la verificación';
