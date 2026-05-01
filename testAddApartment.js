// Script para probar el flujo de addApartment paso a paso
require('dotenv').config();
const db = require('./config/db');

async function test() {
    console.log('1. Probando conexión a BD...');
    try {
        const [rows] = await db.query('SELECT 1 as test');
        console.log('✅ BD OK:', rows[0]);
    } catch(e) {
        console.error('❌ BD Error:', e.message);
        process.exit(1);
    }

    console.log('\n2. Probando sharp...');
    try {
        const sharp = require('sharp');
        const testBuffer = Buffer.from('test');
        await sharp(testBuffer).toBuffer();
        console.log('✅ Sharp OK');
    } catch(e) {
        console.error('❌ Sharp Error:', e.message);
    }

    console.log('\n3. Probando idriveService...');
    try {
        const idriveService = require('./utils/idriveService');
        console.log('✅ idriveService cargado');
        // No probamos upload sin un archivo real
    } catch(e) {
        console.error('❌ idriveService Error:', e.message);
    }

    console.log('\n4. Probando ApartmentModel.addApartment...');
    try {
        const Apartment = require('./models/ApartmentModel');
        console.log('✅ Modelo cargado');
    } catch(e) {
        console.error('❌ Modelo Error:', e.message);
    }

    process.exit(0);
}

test();
