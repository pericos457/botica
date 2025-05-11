const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Importamos las rutas
const userRoutes = require('./routers/userRouters.js');
const productRoutes = require('./routers/productRouters');
const clientRouter = require('./routers/clientRouters');
const purchaseRouter = require('./routers/purchaseRouters');

class Server {
  constructor() {
    this.app = express();
    this.config();
    this.routes();
  }

  // Configuración del servidor
  config() {
    this.app.use(express.json());  // Para procesar cuerpos de solicitud JSON

    // Configuración de CORS para permitir solicitudes desde el frontend (puerto 3001)
    this.app.use(cors({
      origin: 'http://localhost:3001',  // Cambiar al dominio de tu frontend
      methods: ['GET', 'POST', 'PUT', 'DELETE'],  // Métodos permitidos
      allowedHeaders: ['Content-Type', 'Authorization'],  // Encabezados permitidos
    }));

    // Servir archivos estáticos desde la carpeta "uploads"
    this.app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
  }

  // Rutas de la API
  routes() {
    this.app.use('/api', userRoutes);          // Rutas de usuarios
    this.app.use('/productos', productRoutes);  // Rutas de productos
    this.app.use('/clientes', clientRouter);    // Rutas de clientes
    this.app.use('/compras', purchaseRouter); // ✅ SOLO esta
    this.app.use('/api/compras', purchaseRouter);

  }

  // Iniciar el servidor
  start() {
    const PORT = process.env.PORT || 3000;  // Usamos el puerto desde el archivo .env o el puerto 3000 por defecto
    this.app.listen(PORT, () => {
      console.log(`Servidor corriendo en el puerto ${PORT}`);
    });
  }
}

// Crear e iniciar el servidor
const server = new Server();
server.start();
