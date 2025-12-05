const http = require('http');
const { Server } = require('socket.io');
const express = require('express');
const cors = require('cors');

// ДОДАТКОВІ ЗАЛЕЖНОСТІ
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const streamifier = require('streamifier');
const cloudinary = require('cloudinary').v2;

// =================================================================
// 1. КОНФІГУРАЦІЯ ТА СЕРВЕР
// =================================================================
const app = express();
const httpServer = http.createServer(app);
const port = 3000;
const upload = multer(); // Налаштування multer для роботи з буфером (без збереження на диск)

// Секретний ключ для JWT. Краще зчитувати з process.env
const JWT_SECRET = process.env.JWT_SECRET || 'my_super_secret_key_12345';


// 3. КОНФІГУРАЦІЯ CLOUDINARY
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
});

// Допоміжна функція для завантаження буфера в Cloudinary
const uploadToCloudinary = (fileBuffer) => {
    return new Promise((resolve, reject) => {
        let stream = cloudinary.uploader.upload_stream(
            { folder: 'fridgetrotter/avatars', tags: 'avatar' }, // Використовуємо окрему папку для аватарів
            (error, result) => {
                if (result) {
                    resolve(result);
                } else {
                    reject(error);
                }
            }
        );
        streamifier.createReadStream(fileBuffer).pipe(stream);
    });
};

// =================================================================
// 4. MIDDLEWARE ТА АВТЕНТИФІКАЦІЯ
// =================================================================

app.use(cors());
app.use(express.json());

////


// =================================================================
// 6. API МАРШРУТИ (ROUTES)
// =================================================================

// Маршрут для перевірки стану
app.get('/api/status', (req, res) => {
    res.json({ message: 'FridgeTrotter Backend працює!', db_status: 'Connected', version: '1.0' });
});



// --- ПРОФІЛЬ КОРИСТУВАЧА ---

// GET /api/user/profile (Приватний маршрут)
app.get('/api/user/profile', authenticateToken, async (req, res) => {
    const userId = req.user.userId;

    const query = `
        SELECT
            u.user_id, u.email, u.registration_date, u.is_agent,
            u.is_email_public, u.is_location_public,
            up.first_name, up.last_name, up.location, up.date_of_birth, up.bio, up.travel_interests, up.profile_image_url,
            us.countries_visited, us.cities_visited, us.followers_count,
            fs.fridge_color, fs.is_public AS fridge_is_public, fs.allow_comments AS fridge_allow_comments
        FROM users u
                 LEFT JOIN user_profiles up ON u.user_id = up.user_id
                 LEFT JOIN user_stats us ON u.user_id = us.user_id
                 LEFT JOIN fridge_settings fs ON u.user_id = fs.user_id
        WHERE u.user_id = $1;
    `;

    try {
        const result = await pool.query(query, [userId]);

        if (result.rows.length === 0) {
            // Це не повинно траплятися, якщо реєстрація створює профіль
            return res.status(404).json({ error: 'Профіль користувача не знайдено.' });
        }

        // Повертаємо об'єднаний об'єкт профілю
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Помилка отримання профілю:', error);
        res.status(500).json({ error: 'Помилка сервера при завантаженні профілю.' });
    }
});

// GET /api/user/:id/public (Отримання публічного профілю іншого користувача)
app.get('/api/user/:id/public', async (req, res) => {
    const targetUserId = req.params.id;
    const currentUserId = req.user ? req.user.userId : null; // Перевірка, чи авторизований поточний користувач

    // Отримати дані профілю, статистику та налаштування конфіденційності
    const query = `
        SELECT
            u.user_id, 
            CASE WHEN u.is_email_public OR $2 = u.user_id THEN u.email ELSE NULL END AS email,
            CASE WHEN u.is_location_public OR $2 = u.user_id THEN up.location ELSE NULL END AS location,
            up.first_name, up.last_name, up.date_of_birth, up.bio, up.travel_interests, up.profile_image_url,
            us.countries_visited, us.cities_visited, us.followers_count,
            fs.fridge_color, fs.is_public AS fridge_is_public, fs.allow_comments AS fridge_allow_comments
        FROM users u
        LEFT JOIN user_profiles up ON u.user_id = up.user_id
        LEFT JOIN user_stats us ON u.user_id = us.user_id
        LEFT JOIN fridge_settings fs ON u.user_id = fs.user_id
        WHERE u.user_id = $1;
    `;

    try {
        const result = await pool.query(query, [targetUserId, currentUserId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Профіль користувача не знайдено.' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Помилка отримання публічного профілю:', error);
        res.status(500).json({ error: 'Помилка сервера.' });
    }
});

// PUT /api/user/profile (Оновлення даних профілю)
app.put('/api/user/profile', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const {
        firstName, lastName, location, dateOfBirth, bio, travelInterests,
        isEmailPublic, isLocationPublic,
        fridgeColor, fridgeIsPublic, fridgeAllowComments // Додані поля холодильника
    } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Оновлення таблиці user_profiles
        const profileUpdateQuery = `
            UPDATE user_profiles
            SET
                first_name = $1,
                last_name = $2,
                location = $3,
                date_of_birth = $4,
                bio = $5,
                travel_interests = $6
            WHERE user_id = $7;
        `;
        await client.query(profileUpdateQuery, [
            firstName, lastName, location, dateOfBirth, bio, travelInterests, userId
        ]);

        // 2. Оновлення таблиці users (для конфіденційності email/location)
        const userUpdateQuery = `
            UPDATE users
            SET
                is_email_public = $1,
                is_location_public = $2
            WHERE user_id = $3;
        `;
        await client.query(userUpdateQuery, [isEmailPublic, isLocationPublic, userId]);

        // 3. Оновлення fridge_settings
        const fridgeUpdateQuery = `
            UPDATE fridge_settings
            SET 
                fridge_color = $1,
                is_public = $2,
                allow_comments = $3
            WHERE user_id = $4;
        `;
        await client.query(fridgeUpdateQuery, [fridgeColor, fridgeIsPublic, fridgeAllowComments, userId]);


        await client.query('COMMIT');
        res.json({ message: 'Дані профілю та налаштування холодильника успішно оновлено.' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Помилка оновлення профілю:', error);
        res.status(500).json({ error: 'Помилка сервера при оновленні профілю.' });
    } finally {
        client.release();
    }
});



// =================================================================
// 7. ЗАПУСК СЕРВЕРА
// =================================================================
httpServer.listen(port, () => {
    console.log(`✅ Сервер бекенду (з Socket.io) запущено на http://localhost:${port}`);
    console.log('Готовий приймати запити від фронтенду.');
});