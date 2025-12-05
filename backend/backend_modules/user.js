const express = require('express');
const router = express.Router();
const pool = require('../db'); // ВИПРАВЛЕНО: Коректний шлях до DB модуля
const { authenticateToken } = require('./auth'); // ВИПРАВЛЕНО: Коректний шлях до middleware
const multer = require('multer');
const streamifier = require('streamifier');
const cloudinary = require('cloudinary').v2;

const upload = multer(); // Налаштування multer для роботи з буфером

// Допоміжна функція для завантаження буфера в Cloudinary (ЗБЕРЕЖЕНО ТУТ, оскільки Cloudinary util не створюється)
const uploadToCloudinary = (fileBuffer) => {
    return new Promise((resolve, reject) => {
        let stream = cloudinary.uploader.upload_stream(
            { folder: 'fridgetrotter/avatars', tags: 'avatar' },
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

/**
 * GET /api/user/profile
 * Отримання повних даних профілю поточного користувача.
 */
router.get('/profile', authenticateToken, async (req, res) => {
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
            return res.status(404).json({ error: 'Профіль користувача не знайдено.' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Помилка отримання профілю:', error);
        res.status(500).json({ error: 'Помилка сервера при завантаженні профілю.' });
    }
});

/**
 * PUT /api/user/profile
 * Оновлення даних профілю та налаштувань.
 */
router.put('/profile', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const {
        firstName, lastName, location, dateOfBirth, bio, travelInterests,
        isEmailPublic, isLocationPublic,
        fridgeColor, fridgeIsPublic, fridgeAllowComments
    } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Оновлення таблиці user_profiles (Особисті дані)
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

        // 2. Оновлення таблиці users (Конфіденційність)
        const userUpdateQuery = `
            UPDATE users
            SET
                is_email_public = $1,
                is_location_public = $2
            WHERE user_id = $3;
        `;
        await client.query(userUpdateQuery, [isEmailPublic, isLocationPublic, userId]);

        // 3. Оновлення fridge_settings (Налаштування холодильника)
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

/**
 * POST /api/user/avatar
 * Завантаження аватара на Cloudinary та оновлення URL у профілі.
 */
router.post('/avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
    const userId = req.user.userId;

    if (!req.file) {
        return res.status(400).json({ error: 'Файл для завантаження не надано.' });
    }

    try {
        // 1. Завантаження в Cloudinary
        const result = await uploadToCloudinary(req.file.buffer);
        const newAvatarUrl = result.secure_url;

        // 2. Оновлення URL в таблиці user_profiles
        const updateQuery = `
            UPDATE user_profiles
            SET profile_image_url = $1
            WHERE user_id = $2
            RETURNING profile_image_url;
        `;
        const updateResult = await pool.query(updateQuery, [newAvatarUrl, userId]);

        if (updateResult.rows.length === 0) {
            throw new Error('Неможливо оновити аватар. Відсутній запис профілю.');
        }

        res.json({
            message: 'Аватар успішно оновлено.',
            url: updateResult.rows[0].profile_image_url
        });

    } catch (error) {
        console.error('Помилка обробки аватара:', error.message || error);
        const status = error.http_code || 500;
        res.status(status).json({ error: 'Помилка сервера під час завантаження або оновлення аватара.' });
    }
});

/**
 * GET /api/user/:id/public
 * Отримання публічних даних профілю (для інших користувачів).
 */
router.get('/:id/public', async (req, res) => {
    const targetUserId = req.params.id;
    // Оскільки цей маршрут може бути викликаний неавторизованим користувачем,
    // req.user може бути відсутній. Проте, якщо токен надіслано, він обробляється Express.
    const currentUserId = req.user ? req.user.userId : null;

    const query = `
        SELECT
            u.user_id, u.is_agent,
            -- Показувати email/location лише якщо вони публічні АБО це запит самого користувача
            CASE WHEN u.is_email_public OR $2::text = u.user_id::text THEN u.email ELSE NULL END AS email,
            CASE WHEN u.is_location_public OR $2::text = u.user_id::text THEN up.location ELSE NULL END AS location,
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
        // NOTE: $2::text = u.user_id::text is a safeguard if currentUserId is null (not authenticated)
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

module.exports = router;
module.exports = { router };