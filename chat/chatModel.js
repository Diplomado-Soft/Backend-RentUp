// server/chat/chatModel.js
const db = require("../config/db");

db.query(`
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
`).catch(err => {
  // La creación puede fallar si tabla users no existe todavía; solo logueamos.
  console.warn('Advertencia al crear tabla mensajes (si ya existía todo ok):', err.message);
});

const ChatModel = {
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
        ) AS mensajes_no_leidos
      FROM users u
      INNER JOIN mensajes m ON (m.emisor_id = u.user_id AND m.receptor_id = ?) OR (m.emisor_id = ? AND m.receptor_id = u.user_id)
      WHERE u.user_id != ?
      ORDER BY ultimo_mensaje_fecha DESC
    `;
    const [rows] = await db.query(sql, [
      arrendador_id, arrendador_id,
      arrendador_id, arrendador_id,
      arrendador_id,
      arrendador_id, arrendador_id,
      arrendador_id
    ]);
    return rows;
  }
};

module.exports = { ChatModel };