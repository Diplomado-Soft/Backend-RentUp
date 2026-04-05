const express = require('express');
require('dotenv').config();

const app = express();
const HTTP_PORT = process.env.PORT || process.env.SERVER_PORT || 8080;

app.use(express.json());

app.listen(HTTP_PORT, () => {
    console.log(`Servidor escuchando en el puerto ${HTTP_PORT}`);
});