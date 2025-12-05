const http = require('http');
const { Server } = require('socket.io');
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

// 1. НАЛАШТУВАННЯ
const app = express();
const httpServer = http.createServer(app);
const port = 3000;
const JWT_SECRET = 'my_super_secret_key_12345'; // ЗАМІНІТЬ НА СКЛАДНИЙ СЕКРЕТ

// --- CLOUDINARY CONFIG --- (Для завантаження фото)
const cloudinary = require('cloudinary').v2;
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dpkbwlkfx',
    api_key: process.env.CLOUDINARY_API_KEY || '434715286878721',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'fMjYqN6wgd08AOUJlcPyFBXnHV4',
    secure: true
});

// 2. НАЛАШТУВАННЯ ПІДКЛЮЧЕННЯ ДО PostgreSQL
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'db', // Ім'я сервісу з docker-compose.yml
    database: process.env.DB_DATABASE || 'fridgetrotter',
    password: process.env.DB_PASSWORD || 'mysecretpassword',
    port: 5432,
});

// Перевірка підключення до БД при старті
pool.query('SELECT NOW()')
    .then(res => console.log('✅ PostgreSQL підключено успішно, поточний час БД:', res.rows[0].now))
    .catch(err => console.error('❌ Помилка підключення PostgreSQL:', err));


// 3. MIDDLEWARE
app.use(cors());
app.use(express.json());

// 4. ІНІЦІАЛІЗАЦІЯ SOCKET.IO
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Дозволити будь-який фронтенд для тестування
        methods: ["GET", "POST"]
    }
});

// ===============================================
// 5. МАРШРУТИ (ДОДАЙТЕ СВОЮ ЛОГІКУ ТУТ)
// ===============================================

// Приклад: Маршрут для перевірки стану
app.get('/api/status', (req, res) => {
    res.json({ message: 'FridgeTrotter Backend працює!', db_status: 'Connected' });
});

// ===============================================
// 6. ЗАПУСК СЕРВЕРА
// ===============================================
httpServer.listen(port, () => {
    console.log(`✅ Сервер бекенду (з Socket.io) запущено на http://localhost:${port}`);
    console.log('Готовий приймати запити від фронтенду.');
});
//docker-compose up --build