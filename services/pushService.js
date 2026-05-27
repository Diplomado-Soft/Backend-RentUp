const webpush = require('web-push');
const fs = require('fs');
const path = require('path');
const PushSubscriptionModel = require('../models/PushSubscriptionModel');

const VAPID_KEYS_PATH = path.join(__dirname, '..', 'certs', 'vapid-keys.json');

function loadOrGenerateVapidKeys() {
    if (fs.existsSync(VAPID_KEYS_PATH)) {
        try {
            const data = JSON.parse(fs.readFileSync(VAPID_KEYS_PATH, 'utf8'));
            return {
                publicKey: data.publicKey,
                privateKey: data.privateKey,
            };
        } catch (e) {
            console.warn('Error leyendo VAPID keys, generando nuevas:', e.message);
        }
    }

    const vapidKeys = webpush.generateVAPIDKeys();
    try {
        fs.writeFileSync(VAPID_KEYS_PATH, JSON.stringify(vapidKeys, null, 2), 'utf8');
        console.log('✅ Nuevas claves VAPID generadas y guardadas');
    } catch (e) {
        console.error('Error guardando VAPID keys:', e.message);
    }

    return vapidKeys;
}

let vapidKeys = null;

function init() {
    vapidKeys = loadOrGenerateVapidKeys();

    const subjectEmail = process.env.VAPID_SUBJECT_EMAIL || 'mailto:rentup@notifications.com';

    webpush.setVapidDetails(subjectEmail, vapidKeys.publicKey, vapidKeys.privateKey);

    console.log('✅ Servicio de notificaciones push inicializado');
}

function getPublicKey() {
    if (!vapidKeys) init();
    return vapidKeys.publicKey;
}

function buildPayload({ title, body, url, type, referenceId, referenceType }) {
    return JSON.stringify({
        title,
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        vibrate: [200, 100, 200],
        tag: `rentup-${type || 'general'}-${Date.now()}`,
        data: {
            url: url || '/',
            type,
            referenceId,
            referenceType,
            timestamp: Date.now(),
        },
        requireInteraction: true,
        actions: [
            { action: 'open', title: 'Abrir' },
            { action: 'close', title: 'Cerrar' },
        ],
    });
}

async function sendToUser(userId, { title, body, url, type, referenceId, referenceType }) {
    if (!vapidKeys) init();

    const subscriptions = await PushSubscriptionModel.getByUserId(userId);
    if (!subscriptions.length) return { success: false, reason: 'no_subscriptions' };

    const payload = buildPayload({ title, body, url, type, referenceId, referenceType });
    const results = [];

    for (const sub of subscriptions) {
        try {
            const pushSub = {
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.p256dh,
                    auth: sub.auth,
                },
            };
            await webpush.sendNotification(pushSub, payload);
            console.log(`📨 Push enviado a user ${userId}: "${title}"`);
            results.push({ endpoint: sub.endpoint, success: true });
        } catch (err) {
            if (err.statusCode === 410 || err.statusCode === 404) {
                console.log(`Push subscription expirada/inválida, eliminando: ${sub.endpoint.substring(0, 50)}...`);
                await PushSubscriptionModel.removeByEndpoint(sub.endpoint);
            } else {
                console.error('Error enviando push notification:', err.message);
            }
            results.push({ endpoint: sub.endpoint, success: false, error: err.message });
        }
    }

    return { success: results.some(r => r.success), results };
}

async function sendToMultipleUsers(userIds, notification) {
    const results = [];
    for (const userId of userIds) {
        const result = await sendToUser(userId, notification);
        results.push({ userId, ...result });
    }
    return results;
}

module.exports = {
    init,
    getPublicKey,
    sendToUser,
    sendToMultipleUsers,
};
