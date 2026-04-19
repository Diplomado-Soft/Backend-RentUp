const Apartment = require('../models/ApartmentModel');

/**
 * POST /apartments - Crear nuevo apartamento con imágenes
 * Sprint 3 - T-17: Endpoint POST /properties
 */
exports.addApartment = async (req, res) => {
    try {
        // Obtener ID del usuario autenticado desde el token
        const userId = req.user?.id || req.user?.user_id;
        
        if (!userId) {
            return res.status(401).json({
                error: 'Usuario no autenticado. No se pudo obtener el ID del usuario.'
            });
        }

        console.log(`📝 Creando apartamento para usuario: ${userId}`);
        
        const { 
            barrio, 
            direccion, 
            latitud, 
            longitud, 
            addInfo,
            price,
            bedrooms,
            bathrooms,
            area_m2,
            amenities
        } = req.body;
        
        // Log de los datos recibidos (antes de procesarlos)
        console.log(`📋 Datos recibidos (raw):`, {
            barrio,
            direccion,
            latitud,
            longitud,
            addInfo,
            price,
            bedrooms,
            bathrooms,
            area_m2,
            amenities
        });
        
        // Validación de campos requeridos
        if (!barrio || !direccion) {
            return res.status(400).json({
                error: 'Barrio y dirección son campos requeridos'
            });
        }

        if (!price || parseFloat(price) <= 0) {
            return res.status(400).json({
                error: 'Debe proporcionar un precio válido'
            });
        }

        if (!addInfo || addInfo.trim() === '') {
            return res.status(400).json({
                error: 'Información adicional es requerida. Describe tu apartamento.'
            });
        }

        console.log(`📍 Datos del apartamento:`, {
            barrio,
            direccion,
            latitud: latitud || 'vacío',
            longitud: longitud || 'vacío',
            price: parseFloat(price),
            bedrooms,
            bathrooms,
            area_m2
        });

        // Crear apartamento asociado al usuario
        const apartmentResult = await Apartment.addApartment({
            barrio,
            direccion,
            latitud: latitud || null,
            longitud: longitud || null,
            addInfo: addInfo || null,
            price: parseFloat(price),
            bedrooms: bedrooms ? parseInt(bedrooms) : null,
            bathrooms: bathrooms ? parseInt(bathrooms) : null,
            area_m2: area_m2 ? parseInt(area_m2) : null,
            userId
        });
        
        // Obtener el ID del apartamento (mysql2 retorna el resultado directamente)
        const apartmentId = apartmentResult.insertId;

        if (!apartmentId) {
            throw new Error('No se pudo obtener el ID del apartamento creado');
        }

        console.log(`✅ Apartamento creado con ID: ${apartmentId}`);

        // Procesar imágenes subidas a IDrive e2, si existen
        if (req.processedFiles && req.processedFiles.length > 0) {
            try {
                console.log(`🖼️ Procesando ${req.processedFiles.length} imagen(es)...`);
                await Promise.all(
                    req.processedFiles.map(file => {
                        console.log(`  📁 Guardando referencia: ${file.s3_key}`);
                        return Apartment.addImage(
                            apartmentId, 
                            file.s3_key,
                            file.signed_url,
                            file.expires_at
                        );
                    })
                );
                console.log(`✅ ${req.processedFiles.length} imagen(es) agregada(s) exitosamente`);
            } catch (error) {
                console.error('❌ Error agregando imágenes:', error.message);
                await Apartment.deleteApartment(apartmentId, userId);
                throw error;
            }
        } else {
            console.log('⚠️ No hay imágenes para procesar');
        }

        console.log(`✅ Apartamento ${apartmentId} publicado exitosamente`);

        res.status(201).json({
            success: true,
            message: 'Apartamento creado exitosamente',
            data: {
                apartmentId,
                images: req.processedFiles?.map(file => ({
                    s3_key: file.s3_key,
                    url: file.signed_url
                })) || [],
                amenities: amenities ? amenities.split(',').map(a => a.trim()) : []
            }
        });
    } catch (error) {
        console.error('❌ Error agregando apartamento:', error.message);
        res.status(500).json({
            error: 'Error al crear apartamento',
            message: error.message || 'Error desconocido',
            ...(process.env.NODE_ENV === 'development' && { 
                details: error.message,
                stack: error.stack
            })
        });
    }
};

exports.uploadImage = async (req, res) => {
    try {
        const { id_apt } = req.params;
        if (!req.processedFiles?.length) {
            return res.status(400).json({ error: 'No se han subido archivos' });
        }

        // Agregar imágenes a la BD con referencias a IDrive e2
        const results = await Promise.allSettled(
            req.processedFiles.map(file => {
                console.log('Guardando referencia de imagen:', file.s3_key);
                return Apartment.addImage(
                    id_apt, 
                    file.s3_key,
                    file.signed_url,
                    file.expires_at
                );
            })
        );

        const successful = results.filter(r => r.status === 'fulfilled');
        const failed = results.filter(r => r.status === 'rejected');

        const response = {
            message: `${successful.length} imagen(es) subida(s) correctamente a IDrive e2`,
            uploadedImages: successful.map((r, i) => ({
                index: i,
                s3_key: req.processedFiles[i].s3_key,
                url: req.processedFiles[i].signed_url
            })),
            failed: failed.length,
            ...(failed.length > 0 && { errors: failed.map(f => f.reason.message) })
        };

        res.status(failed.length ? 207 : 200).json(response);
    } catch (error) {
        res.status(500).json({ 
            error: 'Error en el servidor',
            ...(process.env.NODE_ENV === 'development' && { details: error.message })
        });
    }
};


exports.updateApartment = async (req, res) => {
    try {
        const { id_apt } = req.params;
        let { direccion_apt, barrio, latitud_apt, longitud_apt, info_add_apt, existing_images } = req.body;
        const newImages = req.processedFiles || [];

        console.log('Datos recibidos en updateApartment:', req.body);

        // Validación de campos requeridos
        const requiredFields = ['direccion_apt', 'barrio', 'latitud_apt', 'longitud_apt'];
        const missingFields = requiredFields.filter(field => !req.body[field]);
        if (missingFields.length > 0) {
            return res.status(400).json({
                error: 'Campos requeridos faltantes',
                missing: missingFields
            });
        }

        // Convertir existing_images en un array válido
        let existingImagesArray = [];
        if (existing_images) {
            try {
                existingImagesArray = JSON.parse(existing_images);
                if (!Array.isArray(existingImagesArray)) {
                    throw new Error('existing_images no es un array');
                }
                console.log('Imágenes existentes parseadas:', existingImagesArray);
            } catch (error) {
                console.error('Error al parsear existing_images:', error);
                return res.status(400).json({ error: 'Formato de existing_images inválido' });
            }
        }

        // Actualizar datos del apartamento (con manejo de imágenes para eliminar)
        const updateResult = await Apartment.updateApartment(id_apt, { 
            direccion_apt, 
            barrio, 
            latitud_apt, 
            longitud_apt, 
            info_add_apt, 
            existing_images: existingImagesArray
        });

        // Agregar nuevas imágenes si existen
        if (newImages.length > 0) {
            console.log(`🖼️ Agregando ${newImages.length} nueva(s) imagen(es)...`);
            await Promise.allSettled(newImages.map(file => {
                console.log('Agregando nueva imagen:', file.s3_key);
                return Apartment.addImage(
                    id_apt, 
                    file.s3_key,
                    file.signed_url,
                    file.expires_at
                );
            }));
        }

        res.json({
            message: 'Apartamento actualizado exitosamente',
            updatedFields: updateResult.affectedRows,
            newImagesAdded: newImages.length
        });

    } catch (error) {
        console.error('Error actualizando apartamento:', error);
        res.status(500).json({ 
            error: 'Error al actualizar apartamento',
            ...(process.env.NODE_ENV === 'development' && { details: error.message })
        });
    }
};

exports.getApartmentsByLessor = async (req, res) => {
    try {
        // Obtenemos el id del usuario autenticado desde req.user
        const { id } = req.user;
        const results = await Apartment.getApartmentsByLessor(id);
        res.json(results);
    } catch (error) {
        console.error('Error obteniendo apartamentos:', error);
        res.status(500).json({ error: 'Error al obtener los apartamentos' });
    }
};

exports.deleteApartment = async (req, res) => {
    try {
        const { id_apt } = req.params;
        const userId = req.user.id;
        
        const result = await Apartment.deleteApartment(id_apt, userId);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Apartamento no encontrado o no autorizado' });
        }
        res.json({ message: 'Apartamento eliminado exitosamente' });
    } catch (error) {
        console.error('Error eliminando apartamento:', error);
        res.status(500).json({ error: 'Error al eliminar el apartamento' });
    }
};


exports.getAllApartments = async (req, res) => {
    try {
        const results = await Apartment.getAllApartments();
        if (!Array.isArray(results)) {
            console.error('getAllApartments no devolvió un array:', results);
            return res.status(500).json({ error: 'Error al obtener apartamentos', data: [] });
        }
        res.json(results);
    } catch (error) {
        console.error('Error obteniendo apartamentos:', error);
        res.status(500).json({ error: 'Error al obtener los apartamentos' });
    }
};

exports.getMarkersInfo = async (req, res) => {
    try {
        const results = await Apartment.getMarkersInfo();
        res.json(results);
    } catch (error) {
        console.error('Error obteniendo marcadores:', error);
        res.status(500).json({ error: 'Error al obtener los marcadores' });
    }
};

exports.getApartmentsFiltered = async (req, res) => {
    try {
        const {
            nearUniversity,
            radiusKm,
            priceMin,
            priceMax,
            bedrooms
        } = req.query;

        const filters = {
            nearUniversity: nearUniversity === 'true',
            radiusKm: radiusKm ? parseFloat(radiusKm) : null,
            priceMin: priceMin || null,
            priceMax: priceMax || null,
            bedrooms: bedrooms ? parseInt(bedrooms) : null
        };

        console.log('📍 Filtros de búsqueda:', filters);

        const results = await Apartment.getApartmentsWithFilter(filters);
        res.json(results);
    } catch (error) {
        console.error('Error obteniendo apartamentos filtrados:', error);
        res.status(500).json({ error: 'Error al filtrar apartamentos' });
    }
};
