// server/index.js
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const https = require('https');
const http = require('http');
const path = require('path');
const helmet = require('helmet');
const { Server } = require('socket.io');
// 💡 Nueva funcionalidad: Importación de base de datos
const importDatabase = require('./utils/importaDatabase');
// 💡 Migraciones automáticas
const { runMigrations } = require('./utils/migrationService');
// 💡 Nueva funcionalidad: Servicio de renovación de URLs para IDrive e2
const { startUrlRefreshService } = require('./services/urlRefreshService');
// 💡 Nueva funcionalidad: Verificación de conexión a IDrive e2
const idriveService = require('./utils/idriveService');
// 💡 Nueva funcionalidad (requerida para verificar puertos en el arranque avanzado)
const net = require('net');
require('dotenv').config();

const app = express();

// === Configuración de CORS ===
// Se mantiene la lógica del primer archivo para manejar ALLOWED_ORIGINS de forma más flexible,
// pero se usa el formato del segundo archivo (FRONTEND_URL) para el socket.io
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : [process.env.FRONTEND_URL || '*']; // Se usa FRONTEND_URL como fallback para *

app.use(cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Disposition'],
    credentials: true
}));

// === Configuración de Helmet (sin COOP restrictivo para permitir popups de OAuth) ===
app.use(helmet({
    crossOriginOpenerPolicy: false, // Desactiva COOP restrictivo que bloquea popups OAuth
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://apis.google.com"],
            frameSrc: ["'self'", "https://accounts.google.com"],
            connectSrc: ["'self'", "https://accounts.google.com", "https://identitytoolkit.googleapis.com"]
        }
    }
}));

// === Headers adicionales para OAuth popup ===
app.use((req, res, next) => {
    // Esto permite que los popups de Google se comuniquen correctamente
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// === Logging simple ===
app.use((req, _, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
});

// === Rutas ===
const userRoutes = require('./routes/userRoutes');
const apartmentRoutes = require('./routes/apartmentRoutes');
const DocumentRoutes = require('./routes/DocumentRoutes');
const authRoutes = require('./routes/auth');
const statsRoutes = require('./routes/statsRoutes');
const chatRoutes = require('./chat/chatRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const adminApartmentRoutes = require('./routes/adminApartmentRoutes');
const contractRoutes = require('./routes/contractRoutes');
const reportRoutes = require('./routes/reportRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const geolocationRoutes = require('./routes/geolocationRoutes');
const { ChatModel } = require('./chat/chatModel');

app.use('/users', userRoutes);
app.use('/apartments', apartmentRoutes);
app.use('/properties', apartmentRoutes);
app.use('/admin/apartments', adminApartmentRoutes);
app.use('/documents', DocumentRoutes);
app.use('/auth', authRoutes);
app.use('/stats', statsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/reviews', reviewRoutes);
app.use('/contracts', contractRoutes);
app.use('/admin/reports', reportRoutes);
app.use('/admin/notifications', notificationRoutes);
app.use('/geolocation', geolocationRoutes);

// === Manejo de errores ===
app.use((_, res) => res.status(404).json({ error: 'Endpoint no encontrado' }));
app.use((err, _, res, __) => {
    console.error('Error global:', err);
    res.status(500).json({
        error: 'Error interno del servidor',
        ...(process.env.NODE_ENV === 'development' && { details: err.message })
    });
});

// === Variables de entorno y Puertos ===
const NODE_ENV = process.env.NODE_ENV || 'development';
const SSL_PORT = process.env.SSL_PORT || 3443;
const HTTP_PORT = process.env.PORT || process.env.SERVER_PORT || 8080;
const FRONTEND_URL = process.env.FRONTEND_URL || '*'; // Usado para socket.io

// === Configuración HTTP/HTTPS y Servidor ===
let server;

// En desarrollo, usar HTTP simple para evitar problemas de certificados
// En producción, usar HTTPS
if (NODE_ENV === 'development') {
    server = http.createServer(app);
    console.log('🟡 Usando HTTP en modo desarrollo');
} else {
    try {
        const privateKey = fs.readFileSync(path.join(__dirname, 'certs/key.pem'), 'utf8');
        const certificate = fs.readFileSync(path.join(__dirname, 'certs/cert.pem'), 'utf8');
        const credentials = { key: privateKey, cert: certificate };
        server = https.createServer(credentials, app);
        console.log('🔐 Usando HTTPS en modo producción');
    } catch (err) {
        console.error("⚠️ Error cargando certificados SSL:", err.message);
        console.log('⚠️ Cayendo a HTTP...');
        server = http.createServer(app);
    }
}

// === Configuración de Socket.io (unificada y más limpia) ===
const io = new Server(server, {
    cors: {
        origin: FRONTEND_URL,
        methods: ["GET", "POST"]
    }
});

// map userId -> socketId (para enviar mensajes dirigidos)
const userSockets = new Map();

io.on("connection", (socket) => {
    console.log("🟢 Usuario conectado al chat:", socket.id);

    socket.on("register", (userId) => {
        if (!userId) return;
        console.log(`🔖 Registrando socket ${socket.id} para user ${userId}`);
        userSockets.set(String(userId), socket.id);
        socket.join(`user_${userId}`);
    });

    socket.on("enviar_mensaje", async (data) => {
        const { emisor_id, receptor_id, contenido } = data;
        try {
            console.log("📨 Mensaje recibido:", data);
            const insertId = await ChatModel.guardarMensaje(emisor_id, receptor_id, contenido);
            const nuevoMensaje = { id: insertId, emisor_id, receptor_id, contenido, fecha_envio: new Date() };

            // Confirmación al emisor
            socket.emit("mensaje_guardado", { success: true, id: insertId });

            // Emitir al receptor si está conectado
            const receptorSocketId = userSockets.get(String(receptor_id));
            if (receptorSocketId) {
                io.to(receptorSocketId).emit("nuevo_mensaje", nuevoMensaje);
            }

            // Emitir también al emisor (si tiene otra pestaña/cliente abierta)
            const emisorSocketId = userSockets.get(String(emisor_id));
            if (emisorSocketId) { // No hace falta la comprobación != socket.id ya que el cliente lo recibe en 'mensaje_guardado'
                io.to(emisorSocketId).emit("nuevo_mensaje", nuevoMensaje);
            }
        } catch (err) {
            console.error("❌ Error guardando mensaje:", err);
            socket.emit("mensaje_guardado", { success: false, error: err.message });
        }
    });

    socket.on("disconnect", () => {
        console.log("🔴 Usuario desconectado:", socket.id);
        // Remover del mapa userSockets
        for (const [userId, sId] of userSockets.entries()) {
            if (sId === socket.id) userSockets.delete(userId);
        }
    });
});

// === Redirección HTTP -> HTTPS (solo si estamos en producción y tenemos HTTPS) ===
// No usamos redirección en desarrollo

// === Función para verificar si un puerto está en uso (Nueva funcionalidad) ===
function isPortInUse(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once('error', (err) => {
            if (err.code === 'EADDRINUSE') resolve(true);
            else resolve(false);
        });
        server.once('listening', () => {
            server.close();
            resolve(false);
        });
        server.listen(port);
    });
}

// === Arranque del Servidor ===
(async function start() {
    try {
        // 1. Verificar puerto
        const portInUse = await isPortInUse(HTTP_PORT);
        if (portInUse) {
            throw new Error(`Puerto ${HTTP_PORT} en uso. Detén otros servidores primero.`);
        }

        // 2. Importar base de datos
        try {
            console.log('🔄 Importando base de datos...');
            await importDatabase();
            console.log('✅ Base de datos importada correctamente');
        } catch (dbErr) {
            console.warn('⚠️ Advertencia importando base de datos:', dbErr.message);
            console.log('🚀 Continuando con el inicio del servidor...');
        }

        // 2b. Ejecutar migraciones pendientes
        try {
            console.log('🔄 Verificando migraciones pendientes...');
            await runMigrations();
        } catch (migErr) {
            console.warn('⚠️ Advertencia ejecutando migraciones:', migErr.message);
        }

        // 2c. Inicializar modelos
        try {
            console.log('🔄 Inicializando modelos...');
            const NotificationModel = require('./models/NotificationModel');
            await NotificationModel.init();
            console.log('✅ Modelos inicializados');
        } catch (modelErr) {
            console.warn('⚠️ Advertencia inicializando modelos:', modelErr.message);
        }

        // 3. Verificar conexión a IDrive e2
        try {
            console.log('🔄 Verificando conexión a IDrive e2...');
            const connected = await idriveService.testConnection();
            if (connected) {
                console.log('✅ Conexión a IDrive e2 establecida');
            } else {
                throw new Error('No se pudo conectar a IDrive e2');
            }
        } catch (idriveErr) {
            console.error('❌ Error conectando a IDrive e2:', idriveErr.message);
            console.warn('⚠️ Las imágenes no se podrán subir sin conexión a IDrive e2');
        }

        // 4. Iniciar servicio de renovación de URLs
        try {
            console.log('🔄 Iniciando servicio de renovación de URLs...');
            startUrlRefreshService();
            console.log('✅ Servicio de renovación de URLs activo');
        } catch (urlErr) {
            console.warn('⚠️ Advertencia iniciando renovación de URLs:', urlErr.message);
        }

        // 5. Iniciar programador de reportes automáticos
        try {
            console.log('📊 Iniciando programador de reportes mensuales...');
            const { startReportScheduler } = require('./services/reportScheduler');
            startReportScheduler();
            console.log('✅ Programador de reportes activo');
        } catch (reportErr) {
            console.warn('⚠️ Advertencia iniciando programador de reportes:', reportErr.message);
        }

        // 5b. Analizar reseñas pendientes con Ollama (si está disponible)
        try {
            console.log('🤖 Verificando reseñas pendientes para análisis con IA...');
            const { analyzePendingReviews } = require('./services/ollamaAutoAnalysis');
            const result = await analyzePendingReviews({ batchSize: 30, delay: 800 });
            
            if (result.success && result.analyzed > 0) {
                console.log(`✅ Se analizaron ${result.analyzed} reseñas con Ollama`);
            } else if (!result.ollamaAvailable) {
                console.log('ℹ️ Ollama no está corriendo. Las reseñas se analizarán cuando esté disponible.');
                console.log('   Para analizar: enciende Ollama y llama a POST /reviews/admin/analyze-pending');
            }
        } catch (analysisErr) {
            console.warn('⚠️ Advertencia en análisis automático de reseñas:', analysisErr.message);
        }

        // 6. Iniciar servidor
        server.listen(HTTP_PORT, () => {
            console.log(`✅ Servidor activo en http://localhost:${HTTP_PORT}`);
            console.log(`📡 Socket.io escuchando en ws://localhost:${HTTP_PORT}`);
            console.log(`🌍 CORS habilitado para: ${FRONTEND_URL}`);
        });

    } catch (err) {
        console.error('❌ Error iniciando servidor:', err.message);
        process.exit(1);
    }
})();