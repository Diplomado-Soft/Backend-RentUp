const db = require('../config/db');
const NotificationModel = require('./NotificationModel');
const idriveService = require('../utils/idriveService');

class Apartment {
    static async addApartment(data) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // 1. Insertar (o asegurarse de que exista) el barrio
            await connection.query(
                `INSERT INTO barrio (barrio)
                    SELECT ? 
                    WHERE NOT EXISTS (SELECT 1 FROM barrio WHERE barrio = ?)`,
                [data.barrio, data.barrio]
            );

            // 2. Obtener el ID del barrio
            const [barrioResults] = await connection.query(
                'SELECT id_barrio FROM barrio WHERE barrio = ?',
                [data.barrio]
            );

            if (!barrioResults || barrioResults.length === 0) {
                throw new Error(`No se pudo obtener el ID del barrio: ${data.barrio}`);
            }

            const barrioId = barrioResults[0].id_barrio;
            console.log(`📍 Barrio obtenido: ${data.barrio} (ID: ${barrioId})`);

            // 3. Insertar apartamento usando el ID del usuario (viene del middleware de autenticación)
            const [apartmentResult] = await connection.query(
                `INSERT INTO apartments 
                    (id_barrio, direccion_apt, latitud_apt, longitud_apt, info_add_apt, user_id, price, bedrooms, bathrooms, area_m2, status, created_date)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                [
                    barrioId,
                    data.direccion,
                    data.latitud || null,
                    data.longitud || null,
                    data.addInfo || null,
                    data.userId,
                    data.price || null,
                    data.bedrooms || null,
                    data.bathrooms || null,
                    data.area_m2 || null,
                    'pending'
                ]
            );

            if (!apartmentResult || !apartmentResult.insertId) {
                throw new Error('No se pudo obtener el ID del apartamento creado');
            }

            console.log(`✅ Apartamento creado exitosamente - ID: ${apartmentResult.insertId}, Usuario: ${data.userId}`);

            await connection.commit();
            return apartmentResult;
        } catch (error) {
            await connection.rollback();
            console.error('❌ Error en addApartment:', error.message);
            throw error;
        } finally {
            connection.release();
        }
    }

    static async addImage(id_apt, s3_key, signed_url, expires_at) {
        const connection = await db.getConnection();
        try {
            console.log(`📁 Guardando referencia de imagen en BD:`, {
                id_apt,
                s3_key,
                expires_at
            });

            const [result] = await connection.query(
                'INSERT INTO apartment_images (id_apt, s3_key, signed_url, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
                [id_apt, s3_key, signed_url, expires_at]
            );

            console.log(`✅ Imagen guardada con ID: ${result.insertId}`);
            return result;
        } catch (error) {
            console.error('❌ Error guardando imagen:', error.message);
            throw error;
        } finally {
            connection.release();
        }
    }

    static async updateApartment(id_apt, data) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // 1. Actualizar (o insertar) el barrio
            await connection.query(
                `INSERT INTO barrio (barrio)
                    SELECT ?
                    WHERE NOT EXISTS (SELECT 1 FROM barrio WHERE barrio = ?)`,
                [data.barrio, data.barrio]
            );

            const [barrioResults] = await connection.query(
                'SELECT id_barrio FROM barrio WHERE barrio = ?',
                [data.barrio]
            );

            // 2. Actualizar los datos del apartamento
            const [updateResult] = await connection.query(
                `UPDATE apartments 
                    SET direccion_apt = ?, 
                        id_barrio = ?, 
                        latitud_apt = ?, 
                        longitud_apt = ?, 
                        info_add_apt = ?
                    WHERE id_apt = ?`,
                [
                    data.direccion_apt,
                    barrioResults[0].id_barrio,
                    data.latitud_apt,
                    data.longitud_apt,
                    data.info_add_apt || null,
                    id_apt
                ]
            );

            // 3. Manejo de imágenes existentes
            if (data.existing_images) {
                // Obtener las imágenes actuales de la BD
                const [currentRows] = await connection.query(
                    'SELECT id_image, s3_key FROM apartment_images WHERE id_apt = ?',
                    [id_apt]
                );
                const currentImageKeys = new Map(currentRows.map(row => [row.s3_key, row.id_image]));

                // Normalizar las claves recibidas
                const imagesToKeep = new Set(data.existing_images.map(img => img.trim()));
                
                // Determinar qué imágenes deben eliminarse
                const imagesToDelete = Array.from(currentImageKeys.keys()).filter(key => !imagesToKeep.has(key));

                if (imagesToDelete.length > 0) {
                    // Eliminar de IDrive e2
                    for (const s3_key of imagesToDelete) {
                        try {
                            await idriveService.deleteImage(s3_key);
                        } catch (error) {
                            console.error(`Error eliminando imagen de IDrive: ${s3_key}`, error.message);
                        }
                    }
                    
                    // Eliminar registros de la BD
                    await connection.query(
                        'DELETE FROM apartment_images WHERE id_apt = ? AND s3_key IN (?)',
                        [id_apt, imagesToDelete]
                    );
                }
            }

            await connection.commit();
            return updateResult;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async getApartmentImages(id_apt) {
        const connection = await db.getConnection();
        try {
            const [rows] = await connection.query(
                'SELECT id_image, s3_key, signed_url, expires_at FROM apartment_images WHERE id_apt = ? ORDER BY created_at ASC',
                [id_apt]
            );
            return rows;
        } catch (error) {
            throw error;
        } finally {
            connection.release();
        }
    }


    static async getApartmentsByLessor(user_id) {
        const { getValidSignedUrl } = require('../services/urlRefreshService');
        const [results] = await db.query(
            `SELECT 
                a.*, 
                b.barrio,
                GROUP_CONCAT(CONCAT(ai.id_image, ':', ai.s3_key)) AS image_data
            FROM apartments AS a
            LEFT JOIN barrio AS b ON a.id_barrio = b.id_barrio
            LEFT JOIN apartment_images AS ai ON a.id_apt = ai.id_apt
            WHERE a.user_id = ?
            GROUP BY a.id_apt`,
            [user_id]
        );

        // Renovar URLs de imágenes si es necesario
        const processedResults = await Promise.all(
            results.map(async apartment => {
                if (apartment.image_data) {
                    const imagePairs = apartment.image_data.split(',');
                    const images = await Promise.all(
                        imagePairs.map(async pair => {
                            try {
                                const [id, s3_key] = pair.split(':');
                                const { signedUrl, expiresAt } = await getValidSignedUrl(parseInt(id));
                                return {
                                    id,
                                    s3_key,
                                    url: signedUrl,
                                    expiresAt
                                };
                            } catch (error) {
                                console.error(`Error renovando URL para imagen:`, error.message);
                                return null;
                            }
                        })
                    );
                    apartment.images = images.filter(img => img !== null);
                }
                delete apartment.image_data;
                
                // Agregar info de publicación para que el landlord vea el estado
                apartment.publicationInfo = {
                    status: apartment.status || 'pending',
                    notes: apartment.admin_notes,
                    publishedDate: apartment.published_date,
                    createdDate: apartment.created_date
                };
                
                return apartment;
            })
        );

        return processedResults;
    }

    static async deleteApartment(id_apt, userId) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
    
            // 1. Obtener las imágenes asociadas al apartamento
            const [rows] = await connection.query(
                'SELECT s3_key FROM apartment_images WHERE id_apt = ?',
                [id_apt]
            );
            const s3_keys = rows.map(row => row.s3_key);
    
            // 2. Eliminar el registro del apartamento sólo si pertenece al usuario autenticado
            const [result] = await connection.query(
                'DELETE FROM apartments WHERE id_apt = ? AND user_id = ?',
                [id_apt, userId]
            );
    
            // Si no se eliminó ningún registro, el apartamento no existe o no pertenece al usuario
            if (result.affectedRows === 0) {
                await connection.rollback();
                return result;
            }
    
            // 3. Eliminar imágenes de IDrive e2
            for (const s3_key of s3_keys) {
                try {
                    await idriveService.deleteImage(s3_key);
                    console.log(`✅ Imagen eliminada de IDrive e2: ${s3_key}`);
                } catch (error) {
                    console.error(`Error eliminando imagen de IDrive e2: ${s3_key}`, error.message);
                }
            }
    
            await connection.commit();
            return result;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async getAllApartments() {
        const { getValidSignedUrl } = require('../services/urlRefreshService');
        try {
            const [results] = await db.query(
                `SELECT
                    a.id_apt,
                    a.direccion_apt,
                    a.latitud_apt,
                    a.longitud_apt,
                    a.info_add_apt,
                    a.price AS precio_apt,
                    a.bedrooms AS habitaciones,
                    a.bathrooms AS banos,
                    a.area_m2 AS metros_apt,
                    a.status as publication_status,
                    b.barrio,
                    u.user_id,
                    u.user_name,
                    u.user_lastname,
                    u.user_email,
                    u.user_phonenumber,
                    IF(u.phone_confirmed = 1, u.whatsapp, NULL) AS whatsapp,
                    GROUP_CONCAT(CONCAT(ai.id_image, ':', ai.s3_key)) AS image_data
                FROM apartments AS a
                LEFT JOIN barrio AS b ON a.id_barrio = b.id_barrio
                LEFT JOIN users AS u ON a.user_id = u.user_id
                LEFT JOIN apartment_images AS ai ON a.id_apt = ai.id_apt
                WHERE (a.status = 'available' OR a.status IS NULL) AND a.status = 'available'
                AND NOT EXISTS (
                    SELECT 1 FROM rental_agreements r 
                    WHERE r.property_id = a.id_apt AND r.status = 'active'
                )
                GROUP BY a.id_apt`
            );

            if (!results || !Array.isArray(results)) {
                console.warn('No se encontraron apartamentos o formato incorrecto');
                return [];
            }

            const processedResults = await Promise.all(
                results.map(async apartment => {
                    try {
                        if (apartment.image_data) {
                            const imagePairs = apartment.image_data.split(',');
                            const images = await Promise.all(
                                imagePairs.map(async pair => {
                                    try {
                                        const [id, s3_key] = pair.split(':');
                                        const { signedUrl, expiresAt } = await getValidSignedUrl(parseInt(id));
                                        return {
                                            id,
                                            s3_key,
                                            url: signedUrl,
                                            expiresAt
                                        };
                                    } catch (error) {
                                        console.error(`Error processing image:`, error.message);
                                        return null;
                                    }
                                })
                            );
                            apartment.images = images.filter(img => img !== null);
                        } else {
                            apartment.images = [];
                        }
                    } catch (error) {
                        console.error(`Error processing apartment ${apartment.id_apt}:`, error.message);
                        apartment.images = [];
                    }
                    delete apartment.image_data;
                    return apartment;
                })
            );

            return processedResults;
        } catch (error) {
            console.error('Error en getAllApartments:', error.message);
            throw error;
        }
    }

    static async getApartmentById(id_apt) {
        const { getValidSignedUrl } = require('../services/urlRefreshService');
        try {
            const [results] = await db.query(
                `SELECT
                    a.id_apt,
                    a.direccion_apt,
                    a.latitud_apt,
                    a.longitud_apt,
                    a.info_add_apt,
                    a.price,
                    a.bedrooms,
                    a.bathrooms,
                    a.area_m2,
                    a.status as publication_status,
                    b.barrio,
                    u.user_id,
                    u.user_name,
                    u.user_lastname,
                    u.user_email,
                    u.user_phonenumber,
                    IF(u.phone_confirmed = 1, u.whatsapp, NULL) AS whatsapp,
                    GROUP_CONCAT(CONCAT(ai.id_image, ':', ai.s3_key)) AS image_data
                FROM apartments AS a
                LEFT JOIN barrio AS b ON a.id_barrio = b.id_barrio
                LEFT JOIN users AS u ON a.user_id = u.user_id
                LEFT JOIN apartment_images AS ai ON a.id_apt = ai.id_apt
                WHERE a.id_apt = ?
                GROUP BY a.id_apt`,
                [id_apt]
            );

            if (!results || results.length === 0) {
                return null;
            }

            const apartment = results[0];
            if (apartment.image_data) {
                const imagePairs = apartment.image_data.split(',');
                const images = await Promise.all(
                    imagePairs.map(async pair => {
                        try {
                            const [id, s3_key] = pair.split(':');
                            const { signedUrl, expiresAt } = await getValidSignedUrl(parseInt(id));
                            return { id, s3_key, url: signedUrl, expiresAt };
                        } catch (error) {
                            console.error(`Error processing image for apartment ${id_apt}:`, error.message);
                            return null;
                        }
                    })
                );
                apartment.images = images.filter(img => img !== null);
            } else {
                apartment.images = [];
            }
            delete apartment.image_data;

            return apartment;
        } catch (error) {
            console.error('Error en getApartmentById:', error.message);
            throw error;
        }
    }

    static async getMarkersInfo() {
        const [results] = await db.query(
            `SELECT
                a.id_apt AS id_apartamento,
                a.direccion_apt AS direccion_apartamento,
                b.barrio AS barrio_apartamento,
                a.latitud_apt AS latitud_apartamento,
                a.longitud_apt AS longitud_apartamento,
                a.info_add_apt AS info_adicional_apartamento
            FROM apartments AS a
            LEFT JOIN barrio AS b ON a.id_barrio = b.id_barrio`
        );
        return results;
    }

    // ===== MÉTODOS PARA FLUJO DE APROBACIÓN (T-19) =====

    static async getPendingApartments(limit = 50, offset = 0) {
        const connection = await db.getConnection();
        try {
            const [results] = await connection.query(
                `SELECT
                    a.*,
                    b.barrio,
                    u.user_name,
                    u.user_lastname,
                    u.user_email,
                    u.user_phonenumber,
                    COUNT(ai.id_image) as image_count
                FROM apartments a
                LEFT JOIN barrio b ON a.id_barrio = b.id_barrio
                LEFT JOIN users u ON a.user_id = u.user_id
                LEFT JOIN apartment_images ai ON a.id_apt = ai.id_apt
                WHERE a.status = 'pending'
                GROUP BY a.id_apt
                ORDER BY a.created_date ASC
                LIMIT ? OFFSET ?`,
                [limit, offset]
            );

            // Obtener las imágenes para cada apartamento
            for (let apt of results) {
                const [images] = await connection.query(
                    'SELECT signed_url FROM apartment_images WHERE id_apt = ? ORDER BY id_image ASC',
                    [apt.id_apt]
                );
                apt.images = images.map(img => ({ url: img.signed_url }));
            }

            const [countResult] = await connection.query(
                'SELECT COUNT(*) as total FROM apartments WHERE status = \'pending\''
            );

            return {
                apartments: results,
                total: countResult[0].total,
                limit,
                offset
            };
        } finally {
            connection.release();
        }
    }

    static async approveApartment(id_apt, adminId, notes = '') {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Obtener información del apartamento para la notificación
            const [aptInfo] = await connection.query(
                'SELECT user_id, direccion_apt FROM apartments WHERE id_apt = ?',
                [id_apt]
            );
            const landlordId = aptInfo[0]?.user_id;

            // Actualizar estado del apartamento
            const [updateResult] = await connection.query(
                `UPDATE apartments 
                SET status = 'available', 
                    admin_notes = ?, 
                    published_date = NOW(),
                    updated_date = NOW()
                WHERE id_apt = ?`,
                [notes, id_apt]
            );

            if (updateResult.affectedRows === 0) {
                throw new Error('Apartamento no encontrado');
            }

            // Registrar en historial
            await connection.query(
                `INSERT INTO apartment_approval_history (id_apt, admin_id, old_status, new_status, notes, action_date)
                VALUES (?, ?, 'pending', 'approved', ?, NOW())`,
                [id_apt, adminId, notes]
            );

            await connection.commit();

            // Notificar al arrendador
            if (landlordId) {
                try {
                    await NotificationModel.createForUser(landlordId, {
                        type: 'apartment_approved',
                        title: 'Apartamento aprobado',
                        message: `Tu apartamento en ${aptInfo[0].direccion_apt} ha sido aprobado y publicado`,
                        reference_id: id_apt,
                        reference_type: 'apartment'
                    });
                } catch (notifError) {
                    console.error('Error creando notificación:', notifError);
                }
            }

            return { success: true, message: 'Apartamento aprobado correctamente' };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async rejectApartment(id_apt, adminId, notes = '') {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Obtener información del apartamento para la notificación
            const [aptInfo] = await connection.query(
                'SELECT user_id, direccion_apt FROM apartments WHERE id_apt = ?',
                [id_apt]
            );
            const landlordId = aptInfo[0]?.user_id;

            // Actualizar estado del apartamento
            const [updateResult] = await connection.query(
                `UPDATE apartments 
                SET status = 'rented', 
                    admin_notes = ?, 
                    updated_date = NOW()
                WHERE id_apt = ?`,
                [notes, id_apt]
            );

            if (updateResult.affectedRows === 0) {
                throw new Error('Apartamento no encontrado');
            }

            // Registrar en historial
            await connection.query(
                `INSERT INTO apartment_approval_history (id_apt, admin_id, old_status, new_status, notes, action_date)
                VALUES (?, ?, 'pending', 'rejected', ?, NOW())`,
                [id_apt, adminId, notes]
            );

            await connection.commit();

            // Notificar al arrendador
            if (landlordId) {
                try {
                    await NotificationModel.createForUser(landlordId, {
                        type: 'apartment_rejected',
                        title: 'Apartamento rechazado',
                        message: `Tu apartamento en ${aptInfo[0].direccion_apt} ha sido rechazado. Razón: ${notes || 'Sin especificar'}`,
                        reference_id: id_apt,
                        reference_type: 'apartment'
                    });
                } catch (notifError) {
                    console.error('Error creando notificación:', notifError);
                }
            }

            return { success: true, message: 'Apartamento rechazado correctamente' };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async getApprovalHistory(id_apt) {
        const connection = await db.getConnection();
        try {
            const [history] = await connection.query(
                `SELECT 
                    h.*,
                    u.user_name as admin_name,
                    u.user_email as admin_email
                FROM apartment_approval_history h
                LEFT JOIN users u ON h.admin_id = u.user_id
                WHERE h.id_apt = ?
                ORDER BY h.action_date DESC`,
                [id_apt]
            );
            return history;
        } finally {
            connection.release();
        }
    }

    static async getApartmentPublicationStatus(id_apt) {
        const connection = await db.getConnection();
        try {
            const [result] = await connection.query(
                `SELECT id_apt, status as publication_status, admin_notes, published_date, created_date 
                FROM apartments 
                WHERE id_apt = ?`,
                [id_apt]
            );
            return result[0] || null;
        } finally {
            connection.release();
        }
    }

    static async getApartmentsWithFilter(filters = {}) {
        const { getValidSignedUrl } = require('../services/urlRefreshService');
        const { calculateDistance, UNIPUTUMAYO_CONFIG } = require('../utils/geolocationUtils');
        
        let whereClause = "WHERE (a.status = 'available' OR a.status IS NULL) AND a.status = 'available' AND NOT EXISTS (SELECT 1 FROM rental_agreements r WHERE r.property_id = a.id_apt AND r.status = 'active')";
        const params = [];

        if (filters.nearUniversity) {
            const radius = filters.radiusKm || UNIPUTUMAYO_CONFIG.radiusKm;
            whereClause += ` AND a.latitud_apt IS NOT NULL AND a.longitud_apt IS NOT NULL`;
        }

        if (filters.priceMin) {
            whereClause += ` AND a.price >= ?`;
            params.push(parseFloat(filters.priceMin));
        }

        if (filters.priceMax) {
            whereClause += ` AND a.price <= ?`;
            params.push(parseFloat(filters.priceMax));
        }

        if (filters.bedrooms) {
            whereClause += ` AND a.bedrooms >= ?`;
            params.push(parseInt(filters.bedrooms));
        }

        const [results] = await db.query(
            `SELECT
                a.id_apt,
                a.direccion_apt,
                a.latitud_apt,
                a.longitud_apt,
                a.info_add_apt,
                a.price,
                a.bedrooms,
                a.bathrooms,
                a.area_m2,
                a.status as publication_status,
                b.barrio,
                u.user_id,
                u.user_name,
                u.user_lastname,
                u.user_email,
                u.user_phonenumber,
                IF(u.phone_confirmed = 1, u.whatsapp, NULL) AS whatsapp,
                GROUP_CONCAT(CONCAT(ai.id_image, ':', ai.s3_key)) AS image_data
            FROM apartments AS a
            LEFT JOIN barrio AS b ON a.id_barrio = b.id_barrio
            LEFT JOIN users AS u ON a.user_id = u.user_id
            LEFT JOIN apartment_images AS ai ON a.id_apt = ai.id_apt
            ${whereClause}
            GROUP BY a.id_apt`,
            params
        );

        let processedResults = await Promise.all(
            results.map(async apartment => {
                if (apartment.image_data) {
                    const imagePairs = apartment.image_data.split(',');
                    const images = await Promise.all(
                        imagePairs.map(async pair => {
                            try {
                                const [id, s3_key] = pair.split(':');
                                const { signedUrl, expiresAt } = await getValidSignedUrl(parseInt(id));
                                return { id, s3_key, url: signedUrl, expiresAt };
                            } catch (error) {
                                return null;
                            }
                        })
                    );
                    apartment.images = images.filter(img => img !== null);
                } else {
                    apartment.images = [];
                }
                delete apartment.image_data;
                
                if (apartment.latitud_apt && apartment.longitud_apt) {
                    apartment.distance_km = parseFloat(
                        calculateDistance(
                            UNIPUTUMAYO_CONFIG.latitude,
                            UNIPUTUMAYO_CONFIG.longitude,
                            apartment.latitud_apt,
                            apartment.longitud_apt
                        ).toFixed(2)
                    );
                }
                
                return apartment;
            })
        );

        if (filters.nearUniversity) {
            const radius = filters.radiusKm || UNIPUTUMAYO_CONFIG.radiusKm;
            processedResults = processedResults.filter(apt => 
                apt.distance_km <= radius
            );
            processedResults.sort((a, b) => a.distance_km - b.distance_km);
        }

        return processedResults;
    }
}

module.exports = Apartment;
