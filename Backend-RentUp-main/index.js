const express = require('express');
require('dotenv').config();

const app = express();
const HTTP_PORT = process.env.PORT || 8080;

app.use(express.json());

// 🔥 ESTA LÍNEA ES LA CLAVE
const userRoutes = require('./routes/userRoutes');
app.use('/users', userRoutes);

app.listen(HTTP_PORT, () => {
    console.log(`Servidor escuchando en el puerto ${HTTP_PORT}`);
});