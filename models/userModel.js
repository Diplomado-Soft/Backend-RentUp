const db = require('../config/db');
const bcrypt = require('bcryptjs');

class User {
    static async getUserData(userId) {
        try {
            const [results] = await db.query(
                `SELECT users.user_id, users.user_name, users.user_lastname, 
                        users.user_email, users.user_phonenumber, users.whatsapp, 
                        user_rol.rol_id
                    FROM users
                    INNER JOIN user_rol ON users.user_id = user_rol.user_id
                    WHERE users.user_id = ?`,
                [userId]
            );
            return results[0] || null;
        } catch (error) {
            console.error("Error en getUserData:", error);
            throw new Error('Error al obtener datos del usuario');
        }
    }

    static async updateUserData(userId, { nombre, apellido, email, telefono, whatsapp, password, rol }) {
        try {
            // Verificar que los datos requeridos no estén vacíos
            if (!nombre || !apellido || !email || !telefono || !rol) {
                throw new Error("Todos los campos deben estar llenos, excepto la contraseña.");
            }

            const [userResult] = await db.execute("SELECT * FROM users WHERE user_id = ? LIMIT 1", [userId]);
            if (userResult.length === 0) return null;

            let passwordHash = userResult[0].user_password;
            if (password) {
                const salt = await bcrypt.genSalt(10);
                passwordHash = await bcrypt.hash(password, salt);
            }

            // CORRECCIÓN: Incluimos el campo 'whatsapp' en el UPDATE
            const [updateUserResult] = await db.execute(
                `UPDATE users 
                    SET user_name=?, user_lastname=?, user_email=?, user_phonenumber=?, whatsapp=?, user_password=? 
                    WHERE user_id=?`,
                [nombre, apellido, email, telefono, whatsapp || null, passwordHash, userId]
            );

            const [updateRolResult] = await db.execute(
                `UPDATE user_rol SET rol_id=? WHERE user_id=?`,
                [rol, userId]
            );         

            return {
                user_id: userId,
                user_name: nombre,
                user_lastname: apellido,
                user_email: email,
                user_phonenumber: telefono,
                whatsapp: whatsapp,
                rol_id: rol
            };
        } catch (error) {
            console.error("Error en User.updateUserData:", error);
            throw error;
        }
    }

    static async signup({ nombre, apellido, email, telefono, password, rolId }) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const hashedPassword = await bcrypt.hash(password, 10);

            // Al registrarse, el whatsapp suele ser el mismo teléfono inicialmente
            const [userResult] = await connection.query(
                `INSERT INTO users 
                (user_name, user_lastname, user_email, user_phonenumber, whatsapp, user_password)
                VALUES (?, ?, ?, ?, ?, ?)`,
                [nombre, apellido, email, telefono, telefono, hashedPassword]
            );

            await connection.query(
                `INSERT INTO user_rol (user_id, rol_id, start_date)
                VALUES (?, ?, ?)`,
                [userResult.insertId, rolId, new Date()]
            );

            await connection.commit();
            return {
                user_id: userResult.insertId,
                user_email: email,
                rol_id: rolId
            };

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async findByEmail(email) {
        try {
            const [results] = await db.query(
                `SELECT users.*, user_rol.rol_id
                    FROM users
                    JOIN user_rol ON users.user_id = user_rol.user_id
                    WHERE users.user_email = ?`,
                [email]
            );
            return results[0] || null;
        } catch (error) {
            throw new Error('Error al buscar usuario por email');
        }
    }
}

module.exports = User;