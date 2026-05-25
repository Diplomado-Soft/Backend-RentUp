// server/chat/chatModel.js
const db = require("../config/db");

const ChatModel = {
  async init() {
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS mensajes (
          id INT AUTO_INCREMENT PRIMARY KEY,
          emisor_id INT NOT NULL,
          receptor_id INT NOT NULL,
          contenido TEXT NOT NULL,
          fecha_envio DATETIME DEFAULT CURRENT_TIMESTAMP,
          leido BOOLEAN DEFAULT FALSE,
          FOREIGN KEY (emisor_id) REFERENCES users(user_id) ON DELETE CASCADE,
          FOREIGN KEY (receptor_id) REFERENCES users(user_id) ON DELETE CASCADE
        );
      `);
    } catch (err) {
      console.warn('Advertencia al crear tabla mensajes:', err.message);
    }
  },
  async guardarMensaje(emisor_id, receptor_id, contenido) {
    const sql = `INSERT INTO mensajes (emisor_id, receptor_id, contenido) VALUES (?, ?, ?)`;
    const [result] = await db.query(sql, [emisor_id, receptor_id, contenido]);
    return result.insertId;
  },

  async obtenerConversacion(emisor_id, receptor_id) {
    const sql = `
      SELECT * FROM mensajes 
      WHERE (emisor_id = ? AND receptor_id = ?) 
        OR (emisor_id = ? AND receptor_id = ?)
      ORDER BY fecha_envio ASC
    `;
    const [rows] = await db.query(sql, [emisor_id, receptor_id, receptor_id, emisor_id]);
    return rows;
  },

  async obtenerConversacionesInquilino(inquilino_id) {
    const sql = `
      SELECT DISTINCT
        u.user_id AS usuario_id,
        u.user_name AS usuario_nombre,
        u.user_lastname AS usuario_apellido,
        u.user_email AS usuario_email,
        (
          SELECT contenido FROM mensajes 
          WHERE (emisor_id = u.user_id AND receptor_id = ?) OR (emisor_id = ? AND receptor_id = u.user_id)
          ORDER BY fecha_envio DESC LIMIT 1
        ) AS ultimo_mensaje,
        (
          SELECT MAX(fecha_envio) FROM mensajes 
          WHERE (emisor_id = u.user_id AND receptor_id = ?) OR (emisor_id = ? AND receptor_id = u.user_id)
        ) AS ultimo_mensaje_fecha,
        (
          SELECT COUNT(*) FROM mensajes m3
          WHERE m3.emisor_id = u.user_id
            AND m3.receptor_id = ?
            AND m3.leido = FALSE
        ) AS mensajes_no_leidos,
        (
          SELECT GROUP_CONCAT(a.direccion_apt SEPARATOR ' | ')
          FROM rental_agreements ra
          JOIN apartments a ON ra.property_id = a.id_apt
          WHERE ra.tenant_id = ? AND ra.landlord_id = u.user_id AND ra.status = 'active'
        ) AS propiedades_asociadas
      FROM users u
      LEFT JOIN mensajes m ON (m.emisor_id = u.user_id AND m.receptor_id = ?) OR (m.emisor_id = ? AND m.receptor_id = u.user_id)
      WHERE (
        m.id IS NOT NULL
        OR EXISTS (
          SELECT 1 FROM rental_agreements ra2
          WHERE ra2.tenant_id = ? AND ra2.landlord_id = u.user_id AND ra2.status = 'active'
        )
      )
      AND u.user_id != ?
      ORDER BY ultimo_mensaje_fecha DESC
    `;
    const [rows] = await db.query(sql, [
      inquilino_id, inquilino_id,
      inquilino_id, inquilino_id,
      inquilino_id,
      inquilino_id,
      inquilino_id, inquilino_id,
      inquilino_id,
      inquilino_id
    ]);
    return rows;
  },

  async obtenerConversacionesArrendador(arrendador_id) {
    const sql = `
      SELECT DISTINCT
        u.user_id AS usuario_id,
        u.user_name AS usuario_nombre,
        u.user_lastname AS usuario_apellido,
        u.user_email AS usuario_email,
        (
          SELECT contenido FROM mensajes 
          WHERE (emisor_id = u.user_id AND receptor_id = ?) OR (emisor_id = ? AND receptor_id = u.user_id)
          ORDER BY fecha_envio DESC LIMIT 1
        ) AS ultimo_mensaje,
        (
          SELECT MAX(fecha_envio) FROM mensajes 
          WHERE (emisor_id = u.user_id AND receptor_id = ?) OR (emisor_id = ? AND receptor_id = u.user_id)
        ) AS ultimo_mensaje_fecha,
        (
          SELECT COUNT(*) FROM mensajes m3
          WHERE m3.emisor_id = u.user_id
            AND m3.receptor_id = ?
            AND m3.leido = FALSE
        ) AS mensajes_no_leidos,
        (
          SELECT GROUP_CONCAT(a.direccion_apt SEPARATOR ' | ')
          FROM rental_agreements ra
          JOIN apartments a ON ra.property_id = a.id_apt
          WHERE ra.landlord_id = ? AND ra.tenant_id = u.user_id AND ra.status = 'active'
        ) AS propiedades_asociadas
      FROM users u
      LEFT JOIN mensajes m ON (m.emisor_id = u.user_id AND m.receptor_id = ?) OR (m.emisor_id = ? AND m.receptor_id = u.user_id)
      WHERE (
        m.id IS NOT NULL
        OR EXISTS (
          SELECT 1 FROM rental_agreements ra2
          WHERE ra2.landlord_id = ? AND ra2.tenant_id = u.user_id AND ra2.status = 'active'
        )
      )
      AND u.user_id != ?
      ORDER BY ultimo_mensaje_fecha DESC
    `;
    const [rows] = await db.query(sql, [
      arrendador_id, arrendador_id,
      arrendador_id, arrendador_id,
      arrendador_id,
      arrendador_id,
      arrendador_id, arrendador_id,
      arrendador_id,
      arrendador_id
    ]);
    return rows;
  }
};

module.exports = { ChatModel };