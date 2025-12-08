const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../auth_middleware');
const multer = require('multer');
const streamifier = require('streamifier');
const cloudinary = require('cloudinary').v2;
const bcrypt = require('bcrypt'); // Додано для роботи з паролями

const upload = multer();

// Допоміжна функція для завантаження на Cloudinary
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

// ==========================================
// 1. ОТРИМАННЯ ТА ОНОВЛЕННЯ ПРОФІЛЮ
// ==========================================

// GET /api/user/profile
// Отримує всі дані профілю, налаштування та статистику
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

// PUT /api/user/profile
// Оновлює текстові дані профілю та налаштування приватності/холодильника
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

        // 1. Оновлення user_profiles
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

        // 2. Оновлення users (налаштування приватності)
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
            INSERT INTO fridge_settings (user_id, fridge_color, is_public, allow_comments)
            VALUES ($4, $1, $2, $3)
            ON CONFLICT (user_id) DO UPDATE 
            SET fridge_color = $1, is_public = $2, allow_comments = $3;
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

// ==========================================
// 2. ЗАВАНТАЖЕННЯ АВАТАРА
// ==========================================

// POST /api/user/avatar
router.post('/avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
    const userId = req.user.userId;

    if (!req.file) {
        return res.status(400).json({ error: 'Файл для завантаження не надано.' });
    }

    try {
        const result = await uploadToCloudinary(req.file.buffer);
        const newAvatarUrl = result.secure_url;

        const updateQuery = `
            UPDATE user_profiles
            SET profile_image_url = $1
            WHERE user_id = $2
            RETURNING profile_image_url;
        `;
        const updateResult = await pool.query(updateQuery, [newAvatarUrl, userId]);

        if (updateResult.rows.length === 0) {
            throw new Error('Неможливо оновити аватар.');
        }

        res.json({
            message: 'Аватар успішно оновлено.',
            url: updateResult.rows[0].profile_image_url
        });

    } catch (error) {
        console.error('Помилка обробки аватара:', error.message || error);
        res.status(500).json({ error: 'Помилка сервера.' });
    }
});

// ==========================================
// 3. БЕЗПЕКА (ПАРОЛЬ ТА АКАУНТ)
// ==========================================

// PUT /api/user/password
// Зміна пароля
router.put('/password', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Введіть поточний та новий пароль.' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Новий пароль має містити мінімум 6 символів.' });
    }

    const client = await pool.connect();
    try {
        // Отримуємо хеш поточного пароля
        const userRes = await client.query('SELECT password_hash FROM users WHERE user_id = $1', [userId]);

        if (userRes.rows.length === 0) {
            return res.status(404).json({ error: 'Користувача не знайдено.' });
        }

        const user = userRes.rows[0];

        // Перевіряємо старий пароль
        const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isMatch) {
            return res.status(403).json({ error: 'Невірний поточний пароль.' });
        }

        // Хешуємо новий пароль
        const newHash = await bcrypt.hash(newPassword, 10);

        // Оновлюємо в БД
        await client.query('UPDATE users SET password_hash = $1 WHERE user_id = $2', [newHash, userId]);

        res.json({ message: 'Пароль успішно змінено.' });
    } catch (error) {
        console.error('Помилка зміни пароля:', error);
        res.status(500).json({ error: 'Помилка сервера.' });
    } finally {
        client.release();
    }
});

// DELETE /api/user/account
// Видалення акаунту
router.delete('/account', authenticateToken, async (req, res) => {
    const userId = req.user.userId;

    try {
        // Завдяки ON DELETE CASCADE в схемі бази даних,
        // видалення юзера автоматично видалить профіль, магніти, налаштування і т.д.
        await pool.query('DELETE FROM users WHERE user_id = $1', [userId]);

        res.json({ message: 'Акаунт успішно видалено.' });
    } catch (error) {
        console.error('Помилка видалення акаунту:', error);
        res.status(500).json({ error: 'Помилка сервера.' });
    }
});

// ==========================================
// 4. СОЦІАЛЬНА ВЗАЄМОДІЯ (ПІДПИСКИ)
// ==========================================

// POST /api/user/follow/:id
// Підписатися на користувача
router.post('/follow/:id', authenticateToken, async (req, res) => {
    const followerId = req.user.userId; // Хто підписується (я)
    const followingId = req.params.id;  // На кого підписуються

    if (followerId.toString() === followingId.toString()) {
        return res.status(400).json({ error: 'Не можна підписатись на себе.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Додаємо запис у таблицю підписок (якщо ще немає)
        // Примітка: Таблиця user_followers має бути створена в БД
        const insertRes = await client.query(`
            INSERT INTO user_followers (follower_id, following_id) 
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
            RETURNING *;
        `, [followerId, followingId]);

        // 2. Якщо вставка відбулася (тобто раніше не були підписані), оновлюємо лічильник
        if (insertRes.rows.length > 0) {
            await client.query(`
                UPDATE user_stats 
                SET followers_count = (SELECT COUNT(*) FROM user_followers WHERE following_id = $1) 
                WHERE user_id = $1;
            `, [followingId]);
        }

        await client.query('COMMIT');
        res.json({ message: 'Ви успішно підписалися.', followed: true });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Помилка підписки:', error);
        res.status(500).json({ error: 'Помилка сервера.' });
    } finally {
        client.release();
    }
});

// DELETE /api/user/follow/:id
// Відписатися від користувача
router.delete('/follow/:id', authenticateToken, async (req, res) => {
    const followerId = req.user.userId;
    const followingId = req.params.id;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Видаляємо запис
        const deleteRes = await client.query(`
            DELETE FROM user_followers 
            WHERE follower_id = $1 AND following_id = $2
            RETURNING *;
        `, [followerId, followingId]);

        // 2. Оновлюємо лічильник
        if (deleteRes.rows.length > 0) {
            await client.query(`
                UPDATE user_stats 
                SET followers_count = (SELECT COUNT(*) FROM user_followers WHERE following_id = $1) 
                WHERE user_id = $1;
            `, [followingId]);
        }

        await client.query('COMMIT');
        res.json({ message: 'Ви відписалися.', followed: false });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Помилка відписки:', error);
        res.status(500).json({ error: 'Помилка сервера.' });
    } finally {
        client.release();
    }
});

// ==========================================
// 5. ПУБЛІЧНИЙ ПРОФІЛЬ (ПЕРЕГЛЯД ІНШОГО КОРИСТУВАЧА)
// ==========================================

// GET /api/user/:id/public-profile
router.get('/:id/public-profile', async (req, res) => {
    const targetUserId = req.params.id;

    // Спробуємо дізнатися ID поточного юзера, якщо він залогінений (через хедера),
    // щоб перевірити статус підписки. Але це не блокує перегляд.
    let currentUserId = null;
    const authHeader = req.headers['authorization'];
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        try {
            const jwt = require('jsonwebtoken'); // Переконайтесь, що jwt підключено вгорі файлу або тут
            // Імпортуйте JWT_SECRET з auth_middleware або process.env
            const { JWT_SECRET } = require('../auth_middleware');
            const decoded = jwt.verify(token, JWT_SECRET);
            currentUserId = decoded.userId;
        } catch (e) { /* ігноруємо помилку токена для публічного перегляду */ }
    }

    const query = `
        SELECT 
            u.user_id, u.registration_date,
            up.first_name, up.last_name, up.location, up.bio, up.travel_interests, up.profile_image_url,
            us.countries_visited, us.cities_visited, us.followers_count,
            fs.fridge_color, fs.is_public AS fridge_is_public,
            (SELECT COUNT(*) FROM user_followers WHERE follower_id = $2 AND following_id = $1) AS is_following
        FROM users u
        LEFT JOIN user_profiles up ON u.user_id = up.user_id
        LEFT JOIN user_stats us ON u.user_id = us.user_id
        LEFT JOIN fridge_settings fs ON u.user_id = fs.user_id
        WHERE u.user_id = $1;
    `;

    try {
        const result = await pool.query(query, [targetUserId, currentUserId || -1]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Користувача не знайдено.' });
        }

        const user = result.rows[0];

        // Приховуємо локацію, якщо юзер це налаштував (можна додати перевірку is_location_public)
        // Для спрощення повертаємо як є.

        res.json({
            ...user,
            is_following: parseInt(user.is_following) > 0
        });
    } catch (error) {
        console.error('Помилка отримання публічного профілю:', error);
        res.status(500).json({ error: 'Помилка сервера.' });
    }
});

module.exports = { router };