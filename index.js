// server/index.js
const express = require('express');
const cors = require('cors');
const http = require('http');
const helmet = require('helmet');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : [process.env.FRONTEND_URL || '*'];

app.use(cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Disposition'],
    credentials: true
}));

app.use(helmet({
    crossOriginOpenerPolicy: false,
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://apis.google.com"],
            frameSrc: ["'self'", "https://accounts.google.com"],
            connectSrc: ["'self'", "https://accounts.google.com", "https://identitytoolkit.googleapis.com"]
        }
    }
}));

app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, _, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
});

// === Rutas ===
const userRoutes = require('./routes/userRoutes');
const apartmentRoutes = require('./routes/apartmentRoutes');
const chatRoutes = require('./chat/chatRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const reportRoutes = require('./routes/reportRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { ChatModel } = require('./chat/chatModel');

app.use('/users', userRoutes);
app.use('/apartments', apartmentRoutes);
app.use('/api/chat', chatRoutes);
app.use('/reviews', reviewRoutes);
app.use('/admin/reports', reportRoutes);
app.use('/admin', adminRoutes);

// === Manejo de errores ===
app.use((_, res) => res.status(404).json({ error: 'Endpoint no encontrado' }));
app.use((err, _, res, __) => {
    console.error('Error global:', err);
    res.status(500).json({
        error: 'Error interno del servidor',
        ...(process.env.NODE_ENV === 'development' && { details: err.message })
    });
});

// === Servidor ===
const HTTP_PORT = process.env.PORT || process.env.SERVER_PORT || 8080;
const FRONTEND_URL = process.env.FRONTEND_URL || '*';

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: FRONTEND_URL,
        methods: ["GET", "POST"]
    }
});

const userSockets = new Map();

io.on("connection", (socket) => {
    console.log("Usuario conectado al chat:", socket.id);

    socket.on("register", (userId) => {
        if (!userId) return;
        console.log(`Registrando socket ${socket.id} para user ${userId}`);
        userSockets.set(String(userId), socket.id);
        socket.join(`user_${userId}`);
    });

    socket.on("enviar_mensaje", async (data) => {
        const { emisor_id, receptor_id, contenido } = data;
        try {
            console.log("Mensaje recibido:", data);
            const insertId = await ChatModel.guardarMensaje(emisor_id, receptor_id, contenido);
            const nuevoMensaje = { id: insertId, emisor_id, receptor_id, contenido, fecha_envio: new Date() };

            socket.emit("mensaje_guardado", { success: true, id: insertId });

            const receptorSocketId = userSockets.get(String(receptor_id));
            if (receptorSocketId) {
                io.to(receptorSocketId).emit("nuevo_mensaje", nuevoMensaje);
            }

            const emisorSocketId = userSockets.get(String(emisor_id));
            if (emisorSocketId) {
                io.to(emisorSocketId).emit("nuevo_mensaje", nuevoMensaje);
            }
        } catch (err) {
            console.error("Error guardando mensaje:", err);
            socket.emit("mensaje_guardado", { success: false, error: err.message });
        }
    });

    socket.on("disconnect", () => {
        console.log("Usuario desconectado:", socket.id);
        for (const [userId, sId] of userSockets.entries()) {
            if (sId === socket.id) userSockets.delete(userId);
        }
    });
});

// === Iniciar servidor ===
server.listen(HTTP_PORT, () => {
    console.log(`Servidor activo en http://localhost:${HTTP_PORT}`);
    console.log(`Socket.io escuchando en ws://localhost:${HTTP_PORT}`);
    console.log(`CORS habilitado para: ${FRONTEND_URL}`);
});