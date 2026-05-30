const Apartment = require('../models/ApartmentModel');
const UserModel = require('../models/userModel');
const { CreateApartmentDTO, UpdateApartmentDTO, ApartmentDTO } = require('../dtos');

/**
 * POST /apartments/addApartment - Crear nuevo apartamento con imágenes
 */
exports.addApartment = async (req, res) => {
    try {
        console.log('🔍 DEBUG addApartment - Inicio');
        console.log('🔍 req.user:', req.user);
        console.log('🔍 req.body:', req.body);
        console.log('🔍 req.files:', req.files?.length || 0, 'archivos');
        console.log('🔍 req.processedFiles:', req.processedFiles?.length || 0, 'procesados');
        
        // Obtener ID del usuario autenticado desde el token
        const userId = req.user?.id;

        if (!userId) {
            console.log('❌ Usuario no autenticado');
            return res.status(401).json({
                error: 'Usuario no autenticado. No se pudo obtener el ID del usuario.'
            });
        }

        // ✅ NUEVA VALIDACIÓN: Verificar estado de verificación para arrendadores
        const userData = await UserModel.getUserData(userId);
        if (userData && userData.rol_id === 2) { // rol_id 2 = arrendador
            if (userData.estadoVerificacion !== 'aprobado') {
                console.log(`⛔ Usuario ${userId} intenta publicar pero su estado de verificación es: ${userData.estadoVerificacion}`);
                return res.status(403).json({
                    error: 'Tu cuenta aún no ha sido verificada. Debes esperar la aprobación del administrador para publicar.'
                });
            }
        }

        console.log(`📝 Creando apartamento para usuario: ${userId}`);

        // Usar CreateApartmentDTO para validación
        const apartmentDTO = new CreateApartmentDTO({
            ...req.body,
            userId
        });

        const validation = apartmentDTO.validate();
        if (!validation.isValid) {
            console.error('❌ Validación DTO falló:', validation.errors);
            console.error('📦 req.body recibido:', req.body);
            return res.status(400).json({
                error: 'Datos de apartamento inválidos',
                errors: validation.errors
            });
        }

        // Validar cantidad de imágenes
        const imageCount = req.processedFiles?.length || 0;
        if (imageCount < 5) {
            return res.status(400).json({ error: 'Debe cargar al menos 5 fotos' });
        }
        if (imageCount > 15) {
            return res.status(400).json({ error: 'Máximo 15 fotos permitidas' });
        }

        const dtoData = apartmentDTO.toDatabaseFormat();

        console.log(`📍 Datos del apartamento:`, dtoData);

        const uploadedImageKeys = req.processedFiles?.map(f => f.s3_key) || [];

        const apartmentResult = await Apartment.addApartment(dtoData, uploadedImageKeys);

        const apartmentId = apartmentResult.insertId;

        if (!apartmentId) {
            throw new Error('No se pudo obtener el ID del apartamento creado');
        }

        console.log(`✅ Apartamento creado con ID: ${apartmentId}`);

        // Procesar imágenes si existen
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
                console.log(`✅ ${req.processedFiles.length} imagen(es) agregada(s)`);
            } catch (imgError) {
                console.error('❌ Error agregando imágenes:', imgError.message);
                await Apartment.deleteApartment(apartmentId, userId);
                throw imgError;
            }
        } else {
            console.log('⚠️ No hay imágenes para procesar');
        }

        res.status(201).json({
            success: true,
            message: 'Apartamento creado exitosamente',
            data: {
                apartmentId,
                images: req.processedFiles?.map(file => ({
                    s3_key: file.s3_key,
                    url: file.signed_url
                })) || []
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
        const failed     = results.filter(r => r.status === 'rejected');

        res.status(failed.length ? 207 : 200).json({
            message: `${successful.length} imagen(es) subida(s) correctamente`,
            uploadedImages: successful.map((r, i) => ({
                index: i,
                s3_key: req.processedFiles[i].s3_key,
                url: req.processedFiles[i].signed_url
            })),
            failed: failed.length,
            ...(failed.length > 0 && { errors: failed.map(f => f.reason.message) })
        });
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
        const newImages = req.processedFiles || [];

        // Verificar que el apartamento sea editable (en revisión + no arrendado)
        const [aptRows] = await Apartment.getBasicInfo(id_apt);
        if (!aptRows || aptRows.length === 0) {
            return res.status(404).json({ error: 'Apartamento no encontrado' });
        }
        const apt = aptRows[0];
        if (apt.status === 'rented' || await Apartment.hasActiveContracts(id_apt)) {
            return res.status(403).json({ error: 'No se puede editar un apartamento con contratos activos' });
        }

        // Procesar existing_images
        let existingImagesArray = [];
        if (req.body.existing_images) {
            try {
                existingImagesArray = JSON.parse(req.body.existing_images);
                if (!Array.isArray(existingImagesArray)) throw new Error('No es array');
            } catch (e) {
                return res.status(400).json({ error: 'Formato de existing_images inválido' });
            }
        }

        // Usar UpdateApartmentDTO
        const updateDTO = new UpdateApartmentDTO({
            ...req.body,
            existing_images: existingImagesArray
        });

        const validation = updateDTO.validate();
        if (!validation.isValid) {
            return res.status(400).json({
                error: 'Datos de actualización inválidos',
                errors: validation.errors
            });
        }

        // Validar cantidad de imágenes (existentes + nuevas)
        const totalImages = existingImagesArray.length + newImages.length;
        if (totalImages < 5) {
            return res.status(400).json({ error: 'Debe haber al menos 5 fotos' });
        }
        if (totalImages > 15) {
            return res.status(400).json({ error: 'Máximo 15 fotos permitidas' });
        }

        const dtoData = updateDTO.toDatabaseFormat();

        const updateResult = await Apartment.updateApartment(id_apt, dtoData);

        if (newImages.length > 0) {
            await Promise.allSettled(newImages.map(file =>
                Apartment.addImage(id_apt, file.s3_key, file.signed_url, file.expires_at)
            ));
        }

        res.json({
            message: 'Apartamento actualizado exitosamente',
            updatedFields: updateResult.affectedRows,
            newImagesAdded: newImages.length
        });
    } catch (error) {
        console.error('Error actualizando apartamento:', error);
        res.status(500).json({ error: 'Error al actualizar apartamento', ...(process.env.NODE_ENV === 'development' && { details: error.message }) });
    }
};

exports.getApartmentsByLessor = async (req, res) => {
    try {
        const { id } = req.user;
        const results = await Apartment.getApartmentsByLessor(id);
        // Usar ApartmentDTO para formatear respuesta
        const formattedResults = ApartmentDTO.fromDatabaseList(results);
        res.json(formattedResults);
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
            return res.status(500).json({ error: 'Error al obtener apartamentos', data: [] });
        }
        // Usar ApartmentDTO para formatear respuesta
        const formattedResults = ApartmentDTO.fromDatabaseList(results);
        res.json(formattedResults);
    } catch (error) {
        console.error('Error obteniendo apartamentos:', error);
        res.status(500).json({ error: 'Error al obtener los apartamentos' });
    }
};

exports.getApartmentById = async (req, res) => {
    try {
        const { id } = req.params;
        const apartment = await Apartment.getApartmentById(id);
        if (!apartment) return res.status(404).json({ error: 'Apartamento no encontrado' });
        // Usar ApartmentDTO para formatear respuesta
        const formattedApartment = ApartmentDTO.fromDatabase(apartment);
        res.json(formattedApartment);
    } catch (error) {
        console.error('Error obteniendo apartamento por ID:', error);
        res.status(500).json({ error: 'Error al obtener el apartamento' });
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
        const { nearUniversity, radiusKm, priceMin, priceMax, bedrooms, q } = req.query;
        const filters = {
            nearUniversity: nearUniversity === 'true',
            radiusKm:  radiusKm   ? parseFloat(radiusKm)  : null,
            priceMin:  priceMin   || null,
            priceMax:  priceMax   || null,
            bedrooms:  bedrooms   ? parseInt(bedrooms)    : null,
            search:    q          || null
        };
        console.log('📍 Filtros de búsqueda:', filters);
        const results = await Apartment.getApartmentsWithFilter(filters);
        res.json(results);
    } catch (error) {
        console.error('Error obteniendo apartamentos filtrados:', error);
        res.status(500).json({ error: 'Error al filtrar apartamentos' });
    }
};