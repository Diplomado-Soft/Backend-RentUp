#!/usr/bin/env node
/**
 * RentUP - Sistema de Verificación
 * Diagnostica problemas comunes de configuración
 */

const fs = require('fs');
const path = require('path');
const net = require('net');
const { execSync } = require('child_process');

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

const icons = {
    ok: '✅',
    error: '❌',
    warn: '⚠️',
    info: 'ℹ️',
    arrow: '→'
};

class RentUPDiagnostics {
    constructor() {
        this.projectRoot = path.dirname(__dirname);
        this.results = [];
        this.errors = [];
    }

    log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const prefix = {
            ok: `${icons.ok} `,
            error: `${icons.error} `,
            warn: `${icons.warn} `,
            info: `${icons.info} `,
        }[type] || '';

        const color = {
            ok: colors.green,
            error: colors.red,
            warn: colors.yellow,
            info: colors.blue,
        }[type] || colors.reset;

        console.log(`${color}${prefix}${message}${colors.reset}`);
    }

    section(title) {
        console.log(`\n${colors.cyan}${'═'.repeat(60)}${colors.reset}`);
        console.log(`${colors.cyan}${title}${colors.reset}`);
        console.log(`${colors.cyan}${'═'.repeat(60)}${colors.reset}\n`);
    }

    // ============ Verificaciones ============

    checkFileExists(filePath, name) {
        const fullPath = path.join(this.projectRoot, filePath);
        if (fs.existsSync(fullPath)) {
            this.log(`${name} ${colors.green}existe${colors.reset}`, 'ok');
            return true;
        } else {
            this.log(`${name} ${colors.red}NO existe${colors.reset}`, 'error');
            this.errors.push(`Archivo faltante: ${filePath}`);
            return false;
        }
    }

    checkEnvironmentVariable(envFile, variable) {
        const fullPath = path.join(this.projectRoot, envFile);
        if (!fs.existsSync(fullPath)) {
            this.log(`${envFile} no encontrado`, 'error');
            return false;
        }

        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes(variable)) {
            this.log(`${variable} configurado en ${envFile}`, 'ok');
            return true;
        } else {
            this.log(`${variable} ${colors.yellow}NO configurado${colors.reset} en ${envFile}`, 'warn');
            return false;
        }
    }

    async checkPort(port) {
        return new Promise((resolve) => {
            const server = net.createServer();
            server.once('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    this.log(`Puerto ${port} está en uso`, 'ok');
                    resolve(true);
                } else {
                    this.log(`Puerto ${port} está disponible`, 'warn');
                    resolve(false);
                }
            });
            server.once('listening', () => {
                server.close();
                this.log(`Puerto ${port} está disponible`, 'ok');
                resolve(false);
            });
            server.listen(port);
        });
    }

    checkNodeModules(folder) {
        const fullPath = path.join(this.projectRoot, folder, 'node_modules');
        if (fs.existsSync(fullPath)) {
            this.log(`${folder}/node_modules existe`, 'ok');
            return true;
        } else {
            this.log(`${folder}/node_modules ${colors.yellow}NO existe${colors.reset}`, 'warn');
            this.errors.push(`Falta instalar dependencias en ${folder}`);
            return false;
        }
    }

    checkPackageJSON(folder) {
        const fullPath = path.join(this.projectRoot, folder, 'package.json');
        if (fs.existsSync(fullPath)) {
            try {
                const pkg = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
                this.log(`${folder}/package.json válido`, 'ok');
                return true;
            } catch (e) {
                this.log(`${folder}/package.json ${colors.red}inválido JSON${colors.reset}`, 'error');
                return false;
            }
        } else {
            this.log(`${folder}/package.json no existe`, 'error');
            return false;
        }
    }

    // ============ Análisis ============

    async analyzeBackend() {
        this.section('🔍 Análisis del Backend');

        this.log('Verificando archivos...', 'info');
        this.checkFileExists('server/index.js', 'server/index.js');
        this.checkFileExists('server/.env', 'server/.env');
        this.checkPackageJSON('server');
        this.checkNodeModules('server');

        this.log('\nVerificando variables de entorno...', 'info');
        this.checkEnvironmentVariable('server/.env', 'DB_HOST');
        this.checkEnvironmentVariable('server/.env', 'DB_USER');
        this.checkEnvironmentVariable('server/.env', 'DB_PASSWORD');
        this.checkEnvironmentVariable('server/.env', 'DB_NAME');
        this.checkEnvironmentVariable('server/.env', 'JWT_SECRET');
        this.checkEnvironmentVariable('server/.env', 'ENCRYPTION_KEY');
        this.checkEnvironmentVariable('server/.env', 'PORT');

        this.log('\nVerificando puertos...', 'info');
        const port3001InUse = await this.checkPort(3001);
        if (!port3001InUse) {
            this.log('Puerto 3001 ${colors.yellow}disponible${colors.reset} (servidor no está corriendo)', 'warn');
        }
    }

    async analyzeFrontend() {
        this.section('🔍 Análisis del Frontend');

        this.log('Verificando archivos...', 'info');
        this.checkFileExists('client/package.json', 'client/package.json');
        this.checkFileExists('client/.env', 'client/.env');
        this.checkPackageJSON('client');
        this.checkNodeModules('client');

        this.log('\nVerificando variables de entorno...', 'info');
        this.checkEnvironmentVariable('client/.env', 'REACT_APP_API_URL');
        this.checkEnvironmentVariable('client/.env', 'REACT_APP_GOOGLE_CLIENT_ID');

        this.log('\nVerificando puertos...', 'info');
        const port3000InUse = await this.checkPort(3000);
        if (!port3000InUse) {
            this.log('Puerto 3000 ${colors.yellow}disponible${colors.reset} (servidor no está corriendo)', 'warn');
        }
    }

    analyzeDatabase() {
        this.section('🔍 Análisis de Base de Datos');

        this.log('Verificando archivos SQL...', 'info');
        this.checkFileExists('database/rent.sql', 'database/rent.sql');

        this.log('\nVerificando tablas esperadas...', 'info');
        const expectedTables = [
            'users', 'rol', 'user_rol', 'apartments',
            'apartment_images', 'reviews', 'rental_agreements'
        ];
        this.log(`Esperadas: ${expectedTables.join(', ')}`, 'info');
        this.log('Para verificar conexión, el servidor debe estar corriendo', 'warn');
    }

    analyzeRoutes() {
        this.section('🔍 Análisis de Rutas');

        const expectedRoutes = [
            { file: 'server/routes/userRoutes.js', endpoint: '/users/signup' },
            { file: 'server/routes/apartmentRoutes.js', endpoint: '/apartments' },
            { file: 'server/routes/reviewRoutes.js', endpoint: '/reviews' },
            { file: 'server/routes/auth.js', endpoint: '/auth/google' },
        ];

        for (const route of expectedRoutes) {
            const fullPath = path.join(this.projectRoot, route.file);
            if (fs.existsSync(fullPath)) {
                const content = fs.readFileSync(fullPath, 'utf8');
                if (content.includes(route.endpoint)) {
                    this.log(`Ruta ${route.endpoint} configurada en ${route.file}`, 'ok');
                } else {
                    this.log(`Ruta ${route.endpoint} ${colors.red}NO encontrada${colors.reset} en ${route.file}`, 'error');
                    this.errors.push(`Ruta faltante: ${route.endpoint}`);
                }
            } else {
                this.log(`Archivo ${route.file} no existe`, 'error');
            }
        }
    }

    // ============ Recomendaciones ============

    printRecommendations() {
        this.section('📋 Recomendaciones');

        if (this.errors.length === 0) {
            this.log('✨ Todo parece estar configurado correctamente', 'ok');
            this.log('\nPasos siguientes:', 'info');
            this.log('1. Asegúrate de que MySQL está corriendo', 'info');
            this.log('2. En Terminal 1: cd server && npm start', 'info');
            this.log('3. En Terminal 2: cd client && npm start', 'info');
            this.log('4. Abre http://localhost:3000 en el navegador', 'info');
            this.log('5. Ver database/DEPLOYMENT.md para despliegue en nube', 'info');
        } else {
            this.log(`Se encontraron ${this.errors.length} problema(s):`, 'error');
            this.errors.forEach((error, index) => {
                this.log(`${index + 1}. ${error}`, 'error');
            });

            this.log('\nAcciones recomendadas:', 'info');
            if (this.errors.some(e => e.includes('node_modules'))) {
                this.log('npm install en las carpetas server/ y client/', 'info');
            }
            if (this.errors.some(e => e.includes('Archivo faltante'))) {
                this.log('Ver database/DEPLOYMENT.md para configuración', 'info');
            }
            if (this.errors.some(e => e.includes('Ruta faltante'))) {
                this.log('Revisar archivos de rutas en server/routes/', 'info');
            }
        }
    }

    // ============ Ejecución ============

    async run() {
        console.clear();
        console.log(`${colors.cyan}
╔═══════════════════════════════════════════════════════════╗
║         RentUP - Sistema de Verificación v1.0            ║
║              Diagnóstico de Configuración                 ║
╚═══════════════════════════════════════════════════════════╝
${colors.reset}`);

        await this.analyzeBackend();
        await this.analyzeFrontend();
        this.analyzeDatabase();
        this.analyzeRoutes();
        this.printRecommendations();

        console.log(`\n${colors.cyan}${'═'.repeat(60)}${colors.reset}`);
        this.log('Diagnóstico completado', 'ok');
        console.log(`${colors.cyan}${'═'.repeat(60)}${colors.reset}\n`);

        process.exit(this.errors.length > 0 ? 1 : 0);
    }
}

// Ejecutar diagnósticos
const diagnostics = new RentUPDiagnostics();
diagnostics.run().catch(e => {
    console.error('Error en diagnósticos:', e);
    process.exit(1);
});
