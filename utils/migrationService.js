/**
 * Servicio de migraciones automáticas
 * Lee todos los archivos .sql de /database/migrations y los ejecuta
 * en orden, llevando registro en la tabla `migrations_log` para no
 * repetir migraciones ya aplicadas.
 */
const fs   = require('fs').promises;
const path = require('path');
const db   = require('../config/db');

const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'database', 'migrations');

async function ensureMigrationsTable() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS migrations_log (
            id         INT AUTO_INCREMENT PRIMARY KEY,
            filename   VARCHAR(255) NOT NULL UNIQUE,
            applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
}

async function getAppliedMigrations() {
    try {
        const [rows] = await db.execute('SELECT filename FROM migrations_log');
        return new Set(rows.map(r => r.filename));
    } catch {
        return new Set();
    }
}

async function runMigrations() {
    try {
        await ensureMigrationsTable();
        const applied = await getAppliedMigrations();

        // Listar archivos ordenados
        const files = (await fs.readdir(MIGRATIONS_DIR))
            .filter(f => f.endsWith('.sql'))
            .sort();

        let ran = 0;
        for (const file of files) {
            if (applied.has(file)) continue;

            const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf8');

            // Separar sentencias (las migraciones pueden tener varias)
            const statements = sql
                .split(';')
                .map(s => s.trim())
                .filter(s => s.length > 0 && !s.startsWith('--'));

            for (const stmt of statements) {
                try {
                    await db.execute(stmt);
                } catch (err) {
                    // Ignorar errores de "ya existe" (columnas/tablas duplicadas)
                    if (!err.message.includes('Duplicate') &&
                        !err.message.includes('already exists') &&
                        !err.code?.includes('ER_DUP')) {
                        console.warn(`⚠️ [Migrations] Error en ${file}: ${err.message}`);
                    }
                }
            }

            await db.execute(
                'INSERT IGNORE INTO migrations_log (filename) VALUES (?)',
                [file]
            );
            console.log(`✅ [Migrations] Aplicada: ${file}`);
            ran++;
        }

        if (ran === 0) {
            console.log('✅ [Migrations] No hay migraciones pendientes.');
        } else {
            console.log(`✅ [Migrations] ${ran} migración(es) aplicada(s).`);
        }
    } catch (error) {
        console.error('❌ [Migrations] Error ejecutando migraciones:', error.message);
        // No lanzar — el servidor debe arrancar aunque fallen las migraciones
    }
}

module.exports = { runMigrations };
