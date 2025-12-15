const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../auth_middleware');
const multer = require('multer');
const streamifier = require('streamifier');
const cloudinary = require('cloudinary').v2;

// Налаштування Multer (до 5MB, в пам'ять)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
});

// Завантаження в Cloudinary
const uploadToCloudinary = (fileBuffer) => {
    return new Promise((resolve, reject) => {
        let stream = cloudinary.uploader.upload_stream(
            { folder: 'fridgetrotter/companions', resource_type: 'image' },
            (error, result) => {
                if (result) resolve(result);
                else reject(error);
            }
        );
        streamifier.createReadStream(fileBuffer).pipe(stream);
    });
};

/**
 * GET /api/companion/ads
 * Отримуємо оголошення + масив фото + бюджет
 */
router.get('/ads', async (req, res) => {
    const { search, type, sort } = req.query;

    let query = `
        SELECT
            ca.ad_id, ca.user_id, ca.destination_country, ca.start_date, ca.end_date,
            ca.min_group_size, ca.max_group_size, ca.description, ca.created_at,
            ca.budget_min, ca.budget_max,
            up.first_name, up.last_name, up.profile_image_url AS author_avatar,
            EXTRACT(YEAR FROM age(up.date_of_birth)) AS author_age,
            (SELECT array_agg(t.tag_name) FROM companion_ad_tags cat JOIN tags t ON cat.tag_id = t.tag_id WHERE cat.ad_id = ca.ad_id) AS tags,
            COALESCE(
                            ARRAY_AGG(cai.image_url) FILTER (WHERE cai.image_url IS NOT NULL), '{}'
            ) AS images
        FROM companion_ads ca
                 JOIN user_profiles up ON ca.user_id = up.user_id
                 LEFT JOIN companion_ad_images cai ON ca.ad_id = cai.ad_id
        WHERE 1 = 1
    `;
    const queryParams = [];
    let paramIndex = 1;

    if (search) {
        query += ` AND (ca.destination_country ILIKE $${paramIndex} OR ca.description ILIKE $${paramIndex})`;
        queryParams.push(`%${search}%`);
        paramIndex++;
    }

    if (type) {
        // Фільтрація по тегу
        query += ` AND ca.ad_id IN (
            SELECT cat.ad_id FROM companion_ad_tags cat JOIN tags t ON cat.tag_id = t.tag_id WHERE t.tag_name = $${paramIndex}
        )`;
        queryParams.push(type);
        paramIndex++;
    }

    // Групування для агрегації фото
    query += ` GROUP BY ca.ad_id, up.user_id`;

    // Сортування
    if (sort === 'budget_asc') {
        query += ` ORDER BY ca.budget_min ASC NULLS LAST`;
    } else if (sort === 'budget_desc') {
        query += ` ORDER BY ca.budget_min DESC NULLS LAST`;
    } else {
        query += ` ORDER BY ca.created_at DESC`;
    }

    try {
        const result = await pool.query(query, queryParams);
        res.json({ ads: result.rows });
    } catch (error) {
        console.error('Помилка отримання оголошень:', error);
        res.status(500).json({ error: 'Помилка сервера.' });
    }
});

/**
 * POST /api/companion/ads
 * Обробка: масив фото, бюджет, теги
 */
router.post('/ads', authenticateToken, upload.array('images', 8), async (req, res) => {
    const userId = req.user.userId;
    const {
        destination_country, start_date, end_date,
        min_group_size, max_group_size, description,
        tags, budget_min, budget_max
    } = req.body;
    const files = req.files;

    if (!destination_country || !start_date || !end_date || !description) {
        return res.status(400).json({ error: 'Необхідно заповнити всі обов\'язкові поля.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Вставка оголошення
        const adQuery = `
            INSERT INTO companion_ads (
                user_id, destination_country, start_date, end_date, 
                min_group_size, max_group_size, description,
                budget_min, budget_max
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING ad_id;
        `;

        // Перетворення пустих рядків у null
        const bMin = budget_min ? parseFloat(budget_min) : null;
        const bMax = budget_max ? parseFloat(budget_max) : null;

        const adResult = await client.query(adQuery, [
            userId, destination_country, start_date, end_date,
            min_group_size || 1, max_group_size, description,
            bMin, bMax
        ]);
        const adId = adResult.rows[0].ad_id;

        // 2. Обробка тегів
        let tagsArray = [];
        if (tags) {
            // Якщо tags передані як масив рядків (FormData може передавати tags[]), або як один рядок
            if (Array.isArray(tags)) tagsArray = tags;
            else tagsArray = tags.split(',').map(t => t.trim()).filter(Boolean);
        }

        if (tagsArray.length > 0) {
            for (const tag of tagsArray) {
                const cleanTag = tag.trim();
                await client.query(`INSERT INTO tags (tag_name) VALUES ($1) ON CONFLICT (tag_name) DO NOTHING;`, [cleanTag]);
                const tagIdResult = await client.query(`SELECT tag_id FROM tags WHERE tag_name = $1;`, [cleanTag]);
                const tagId = tagIdResult.rows[0].tag_id;
                await client.query(`INSERT INTO companion_ad_tags (ad_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`, [adId, tagId]);
            }
        }

        // 3. Завантаження та збереження фото
        if (files && files.length > 0) {
            const uploadPromises = files.map(file => uploadToCloudinary(file.buffer));
            const uploadResults = await Promise.all(uploadPromises);

            for (const result of uploadResults) {
                await client.query(
                    `INSERT INTO companion_ad_images (ad_id, image_url) VALUES ($1, $2)`,
                    [adId, result.secure_url]
                );
            }
        }

        await client.query('COMMIT');
        res.status(201).json({ message: 'Оголошення успішно створено!', adId: adId });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Помилка створення оголошення:', error);
        res.status(500).json({ error: 'Помилка сервера.' });
    } finally {
        client.release();
    }
});

module.exports = { router };