const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../auth_middleware');
const multer = require('multer');
const streamifier = require('streamifier');
const cloudinary = require('cloudinary').v2;

const upload = multer();

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

// GET /api/user/profile
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

        // 2. Оновлення users
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

module.exports = { router };