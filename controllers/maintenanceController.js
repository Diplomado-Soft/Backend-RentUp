const MaintenanceModel = require('../models/MaintenanceModel');
const Contract = require('../models/ContractModel');
const idriveService = require('../utils/idriveService');
const sharp = require('sharp');
const db = require('../config/db');

exports.createReport = async (req, res) => {
    try {
        const tenant_id = req.user.id;
        const { property_id, title, description, priority } = req.body;

        if (!property_id || !title) {
            return res.status(400).json({ error: 'property_id y title son requeridos' });
        }

        const contract = await Contract.hasUserRentedProperty(tenant_id, property_id);
        if (!contract || contract.status !== 'active') {
            return res.status(403).json({ error: 'No tienes un contrato activo en esta propiedad' });
        }

        let image_url = null;
        if (req.file) {
            const processed = await sharp(req.file.buffer)
                .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
                .webp({ quality: 80 })
                .toBuffer();

            const uploadResult = await idriveService.uploadImage(
                processed, tenant_id, property_id, req.file.originalname
            );
            image_url = uploadResult.signedUrl;
        }

        const insertId = await MaintenanceModel.create({
            property_id, tenant_id, title, description, priority, image_url
        });

        const report = await MaintenanceModel.getById(insertId);

        const [aptInfo] = await db.execute(
            'SELECT user_id FROM apartments WHERE id_apt = ?', [property_id]
        );
        if (aptInfo.length > 0) {
            await MaintenanceModel.notifyLandlord(aptInfo[0].user_id, report);
        }

        res.status(201).json({
            success: true,
            message: 'Reporte de mantenimiento creado',
            data: report
        });
    } catch (error) {
        console.error('Error creando reporte:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.getMyReports = async (req, res) => {
    try {
        const reports = await MaintenanceModel.getByTenant(req.user.id);
        res.json({ success: true, data: reports });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getPropertyReports = async (req, res) => {
    try {
        const { id } = req.params;
        const [apt] = await db.execute(
            'SELECT user_id FROM apartments WHERE id_apt = ?', [id]
        );
        if (apt.length === 0) return res.status(404).json({ error: 'Propiedad no encontrada' });
        if (apt[0].user_id !== req.user.id && req.user.rol !== 3) {
            return res.status(403).json({ error: 'No eres el propietario de esta propiedad' });
        }
        const reports = await MaintenanceModel.getByProperty(id);
        res.json({ success: true, data: reports });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getLandlordReports = async (req, res) => {
    try {
        const reports = await MaintenanceModel.getByLandlord(req.user.id);
        res.json({ success: true, data: reports });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, landlord_notes } = req.body;

        if (!['pending', 'in_progress', 'resolved', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Estado inválido' });
        }

        const report = await MaintenanceModel.getById(id);
        if (!report) return res.status(404).json({ error: 'Reporte no encontrado' });

        const [apt] = await db.execute(
            'SELECT user_id FROM apartments WHERE id_apt = ?', [report.property_id]
        );
        if (apt.length > 0 && apt[0].user_id !== req.user.id && req.user.rol !== 3) {
            return res.status(403).json({ error: 'No autorizado' });
        }

        await MaintenanceModel.updateStatus(id, status, landlord_notes);
        await MaintenanceModel.notifyTenantStatusChange(report.tenant_id, { ...report, status });

        res.json({ success: true, message: 'Estado actualizado' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteReport = async (req, res) => {
    try {
        const { id } = req.params;

        const report = await MaintenanceModel.getById(id);
        if (!report) return res.status(404).json({ error: 'Reporte no encontrado' });

        const [apt] = await db.execute(
            'SELECT user_id FROM apartments WHERE id_apt = ?', [report.property_id]
        );
        const isOwner = apt.length > 0 && apt[0].user_id === req.user.id;
        const isTenant = report.tenant_id === req.user.id;
        if (!isOwner && !isTenant && req.user.rol !== 3) {
            return res.status(403).json({ error: 'No autorizado' });
        }

        if (report.image_url) {
            await idriveService.deleteImageByUrl(report.image_url);
        }

        await MaintenanceModel.delete(id);

        res.json({ success: true, message: 'Reporte eliminado' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getMyProperties = async (req, res) => {
    try {
        const properties = await MaintenanceModel.getTenantActiveProperties(req.user.id);
        res.json({ success: true, data: properties });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
