const mysql = require('mysql2/promise'); 
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 30000,
    enableKeepAlive: true,
});

// Función para testear la conexión al arrancar
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log(`✅ RentUp DB: Conectado a "${process.env.DB_NAME}" en ${process.env.DB_HOST}`);
        connection.release();
    } catch (err) {
        console.error('❌ Error crítico de conexión a la base de datos:', err.message);
        console.log('Revisa tu archivo .env y que MySQL esté corriendo.');
    }
}

testConnection();

module.exports = pool;