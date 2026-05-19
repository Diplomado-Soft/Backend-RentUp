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
// 💡 Servicio de renovación de URLs para IDrive e2
const { startUrlRefreshService } = require('./services/urlRefreshService');
// 💡 Nueva funcionalidad: Verificación de conexión a IDrive e2
const idriveService = require('./utils/idriveService');
// 💡 Nueva funcionalidad (requerida para verificar puertos en el arranque avanzado)
const net = require('net');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// === Configuración de CORS ===
// Se mantiene la lógica del primer archivo para manejar ALLOWED_ORIGINS de forma más flexible,
// pero se usa el formato del segundo archivo (FRONTEND_URL) para el socket.io
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : process.env.FRONTEND_URL
        ? [process.env.FRONTEND_URL]
        : ['*'];

const corsOptions = {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Disposition'],
};

if (!allowedOrigins.includes('*')) {
    corsOptions.credentials = true;
}

app.use(cors(corsOptions));

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

// === Rate Limiting ===
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'Demasiados intentos. Intenta de nuevo en 15 minutos' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/users/login', authLimiter);
app.use('/auth/firebase-login', authLimiter);
app.use('/auth/login', authLimiter);
app.use('/auth/register', authLimiter);
app.use('/auth/forgot-password', authLimiter);

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
const adminUserRoutes = require('./routes/adminUserRoutes');
const contractRoutes = require('./routes/contractRoutes');
const reportRoutes = require('./routes/reportRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const geolocationRoutes = require('./routes/geolocationRoutes');
const kycRoutes = require('./routes/kycRoutes');
const maintenanceRoutes = require('./routes/maintenanceRoutes');
const KycModel = require('./models/KycModel');
const MaintenanceModel = require('./models/MaintenanceModel');
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
app.use('/admin/users', adminUserRoutes);
app.use('/geolocation', geolocationRoutes);
app.use('/kyc', kycRoutes);
app.use('/maintenance', maintenanceRoutes);

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
        console.warn('⚠️ ADVERTENCIA: SSL no disponible. La aplicación funciona en HTTP. Si estás en producción, ' +
            'asegúrate de que los certificados existan en ./certs/key.pem y ./certs/cert.pem');
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
        for (const [userId, sId] of userSockets.entries()) {
            if (sId === socket.id) userSockets.delete(userId);
        }
    });

    // Evento de notificaciones admin: el frontend se une a sala admin
    socket.on("register_admin", () => {
        socket.join("admins");
        console.log("🔔 Admin registrado para notificaciones:", socket.id);
    });
});

// Función para emitir notificaciones en tiempo real a admins
function emitAdminNotification(notification) {
    io.to("admins").emit("admin_notification", notification);
}

module.exports.io = io;
module.exports.emitAdminNotification = emitAdminNotification;

(async () => {
    try {
        // 2c. Inicializar modelos
        try {
            await ChatModel.init();
            await KycModel.init();
            await MaintenanceModel.init();
            console.log('✅ Modelos inicializados');
        } catch (modelErr) {
            console.warn('⚠️ Advertencia inicializando modelos:', modelErr.message);
        }

        // 2d. Cargar configuración de geolocalización
        try {
            console.log('Cargando configuración de geolocalización...');
            const { ensureConfig } = require('./config/locationConfig');
            await ensureConfig();
            console.log('Configuración de geolocalización cargada');
        } catch (geoErr) {
            console.warn('Usando configuración de geolocalización por defecto:', geoErr.message);
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

        // 5b. Analizar reseñas pendientes con IA (transformers.js)
        try {
            console.log('Verificando reseñas pendientes para análisis con IA...');
            const { analyzePendingReviews } = require('./services/sentimentAnalysis');
            const result = await analyzePendingReviews({ batchSize: 30, delay: 800 });
            
            if (result.success && result.analyzed > 0) {
                console.log(`Se analizaron ${result.analyzed} reseñas con IA`);
            } else if (!result.serviceAvailable) {
                console.log('El modelo de IA se cargará en el primer análisis.');
            }
        } catch (analysisErr) {
            console.warn('Advertencia en análisis automático de reseñas:', analysisErr.message);
        }

        // 6. Iniciar servidor
        server.listen(HTTP_PORT, () => {
            console.log(`✅ Servidor activo en http://localhost:${HTTP_PORT}`);
            console.log(`📡 Socket.io escuchando en ws://localhost:${HTTP_PORT}`);
            console.log(`🌍 CORS habilitado para: ${FRONTEND_URL}`);
        });

        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.error(`❌ El puerto ${HTTP_PORT} ya está en uso.`);
                console.error('   Cierra el otro proceso o usa un puerto diferente.');
            } else {
                console.error('❌ Error del servidor:', err.message);
            }
            process.exit(1);
        });

    } catch (err) {
        console.error('❌ Error iniciando servidor:', err.message);
        process.exit(1);
    }
})();