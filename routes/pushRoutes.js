const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const PushSubscriptionModel = require('../models/PushSubscriptionModel');
const pushService = require('../services/pushService');

router.get('/vapid-public-key', (req, res) => {
    try {
        const publicKey = pushService.getPublicKey();
        res.json({ publicKey });
    } catch (error) {
        console.error('Error obteniendo VAPID public key:', error);
        res.status(500).json({ error: 'Error al obtener clave pública' });
    }
});

router.post('/subscribe', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { endpoint, keys } = req.body;

        if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
            return res.status(400).json({ error: 'Suscripción inválida: endpoint, p256dh y auth son requeridos' });
        }

        await PushSubscriptionModel.subscribe(userId, { endpoint, keys });

        res.json({ success: true, message: 'Suscripción registrada exitosamente' });
    } catch (error) {
        console.error('Error en suscripción push:', error);
        res.status(500).json({ error: 'Error al registrar suscripción' });
    }
});

router.post('/test', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const pushService = require('../services/pushService');
        const result = await pushService.sendToUser(userId, {
            title: '🔔 Notificación de prueba',
            body: 'Esta es una notificación push de prueba desde RentUp',
            url: '/',
            type: 'test',
        });
        res.json({ success: true, result });
    } catch (error) {
        console.error('Error enviando push de prueba:', error);
        res.status(500).json({ error: 'Error al enviar notificación de prueba' });
    }
});

router.post('/unsubscribe', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { endpoint } = req.body;

        if (!endpoint) {
            return res.status(400).json({ error: 'endpoint es requerido' });
        }

        await PushSubscriptionModel.unsubscribe(userId, endpoint);

        res.json({ success: true, message: 'Suscripción eliminada exitosamente' });
    } catch (error) {
        console.error('Error cancelando suscripción push:', error);
        res.status(500).json({ error: 'Error al cancelar suscripción' });
    }
});

module.exports = router;
