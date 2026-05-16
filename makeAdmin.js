/**
 * Script para promover un usuario a Administrador (rol_id = 3)
 * Uso: node makeAdmin.js email_del_usuario
 */

const db = require('./config/db');

const promoteToAdmin = async (email) => {
  try {
    // Buscar usuario por email
    const [users] = await db.query(
      'SELECT user_id, user_email, user_name FROM users WHERE user_email = ?',
      [email]
    );

    if (users.length === 0) {
      console.log(`❌ No se encontró usuario con email: ${email}`);
      process.exit(1);
    }

    const userId = users[0].user_id;
    console.log(`👤 Usuario encontrado: ${users[0].user_name} (${users[0].user_email})`);

    // Verificar rol actual
    const [roles] = await db.query(
      'SELECT rol_id FROM user_rol WHERE user_id = ?',
      [userId]
    );

    if (roles.length > 0 && roles[0].rol_id === 3) {
      console.log(`✅ El usuario ya es administrador`);
      process.exit(0);
    }

    // Actualizar rol a 3 (admin)
    await db.query(
      'UPDATE user_rol SET rol_id = 3 WHERE user_id = ?',
      [userId]
    );

    console.log(`✅ Usuario promovido a Administrador (rol_id = 3)`);
    console.log(`🔑 Ahora puedes iniciar sesión con: ${email}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

// Obtener email de los argumentos
const email = process.argv[2];

if (!email) {
  console.log('Uso: node makeAdmin.js email_del_usuario');
  console.log('Ejemplo: node makeAdmin.js admin@rentup.com');
  process.exit(1);
}

promoteToAdmin(email);
