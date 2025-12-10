const http = require('http');
const express = require('express');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;
const jwt = require('jsonwebtoken'); // Потрібен для JWT_SECRET

// Переконуємось, що пул БД ініціалізовано
require('./db'); // Запускає файл db.js, який ініціалізує pool і перевіряє з'єднання

// Імпорт маршрутів та функцій
const { router: authRouter } = require('./backend_modules/auth');
const { router: userRouter } = require('./backend_modules/user');
const { router: toursRouter } = require('./backend_modules/tours');
const { router: forumRouter } = require('./backend_modules/forum');
const { router: fridgeRouter } = require('./backend_modules/fridge');
const { router: companionRouter } = require('./backend_modules/companion');
const { initializeSocketIO, router: chatRouter } = require('./backend_modules/chat');
const { router: notificationsRouter } = require('./backend_modules/notifications');
const { router: agenciesRouter } = require('./backend_modules/agencies');

// =================================================================
// 1. КОНФІГУРАЦІЯ ТА СЕРВЕР
// =================================================================
const app = express();
const httpServer = http.createServer(app);
const port = 3000;

// 2. КОНФІГУРАЦІЯ CLOUDINARY
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
});

// =================================================================
// 3. MIDDLEWARE
// =================================================================

app.use(cors());
app.use(express.json());

// =================================================================
// 4. SOCKET.IO (Ініціалізація)
// =================================================================

initializeSocketIO(httpServer);

// =================================================================
// 5. API МАРШРУТИ (ROUTES)
// =================================================================

// Маршрут для перевірки стану
app.get('/api/status', (req, res) => {
    res.json({ message: 'FridgeTrotter Backend працює!', db_status: 'Connected', version: '1.0' });
});

// Підключаємо маршрути
app.use('/api/auth', authRouter);
app.use('/api/user', userRouter);
app.use('/api/tours', toursRouter);
app.use('/api/forum', forumRouter);
app.use('/api/fridge', fridgeRouter);
app.use('/api/companion', companionRouter);
app.use('/api/chat', chatRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/agencies', agenciesRouter);


// =================================================================
// 6. ЗАПУСК СЕРВЕРА
// =================================================================
httpServer.listen(port, () => {
    console.log(`✅ Сервер бекенду (з Socket.io) запущено на http://localhost:${port}`);
    console.log('Готовий приймати запити від фронтенду.');
});