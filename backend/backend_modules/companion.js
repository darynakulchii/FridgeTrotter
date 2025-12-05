const express = require('express');
const router = express.Router();
const pool = require('../db.js');
const { authenticateToken } = require('auth.js');

/**
 * GET /api/companion/ads
 * Отримання оголошень про пошук компанії з фільтрацією.
 */
router.get('/ads', async (req, res) => {
    const { search, type, sort } = req.query;
    let query = `
        SELECT 
            ca.ad_id, ca.destination_country, ca.start_date, ca.end_date, ca.min_group_size, ca.max_group_size, ca.description, ca.created_at,
            up.first_name, up.last_name, up.profile_image_url AS author_avatar,
            EXTRACT(YEAR FROM age(up.date_of_birth)) AS author_age,
            (SELECT array_agg(t.tag_name) FROM companion_ad_tags cat JOIN tags t ON cat.tag_id = t.tag_id WHERE cat.ad_id = ca.ad_id) AS tags
        FROM companion_ads ca
        JOIN user_profiles up ON ca.user_id = up.user_id
    `;
    const queryParams = [];
    let paramIndex = 1;

    let whereClause = `WHERE 1 = 1`;

    if (search) {
        whereClause += ` AND (ca.destination_country ILIKE $${paramIndex} OR ca.description ILIKE $${paramIndex})`;
        queryParams.push(`%${search}%`);
        paramIndex++;
    }

    // Фільтрація за типом (тегами)
    if (type) {
        whereClause += ` AND ca.ad_id IN (
            SELECT cat.ad_id
            FROM companion_ad_tags cat
            JOIN tags t ON cat.tag_id = t.tag_id
            WHERE t.tag_name = $${paramIndex}
        )`;
        queryParams.push(type);
        paramIndex++;
    }

    query += ` ${whereClause}`;

    // Сортування
    if (sort === 'nearest_date') {
        query += ` ORDER BY ca.start_date ASC`;
    } else if (sort === 'budget_asc') {
        // Тут потрібна логіка сортування за бюджетом, якщо теги бюджету числові
        query += ` ORDER BY ca.created_at DESC`; // Заглушка
    } else {
        query += ` ORDER BY ca.created_at DESC`; // Нові спочатку
    }

    try {
        const result = await pool.query(query, queryParams);
        res.json({ ads: result.rows });
    } catch (error) {
        console.error('Помилка отримання оголошень компанії:', error);
        res.status(500).json({ error: 'Помилка сервера.' });
    }
});

/**
 * POST /api/companion/ads
 * Створення оголошення про пошук компанії.
 */
router.post('/ads', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const {
        destination_country, start_date, end_date,
        min_group_size, max_group_size, description,
        tags
    } = req.body;

    if (!destination_country || !start_date || !end_date || !description) {
        return res.status(400).json({ error: 'Необхідно заповнити всі обов\'язкові поля.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Вставка основного оголошення
        const adQuery = `
            INSERT INTO companion_ads (user_id, destination_country, start_date, end_date, min_group_size, max_group_size, description)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING ad_id;
        `;
        const adResult = await client.query(adQuery, [
            userId, destination_country, start_date, end_date,
            min_group_size || 1, max_group_size, description
        ]);
        const adId = adResult.rows[0].ad_id;

        // 2. Вставка тегів
        if (tags && tags.length > 0) {
            for (const tag of tags) {
                // Вставка тега у словник, якщо він ще не існує (ON CONFLICT DO NOTHING)
                await client.query(`
                    INSERT INTO tags (tag_name) VALUES ($1) ON CONFLICT (tag_name) DO NOTHING;
                `, [tag]);

                // Зв'язок тега з оголошенням
                const tagIdResult = await client.query(`
                    SELECT tag_id FROM tags WHERE tag_name = $1;
                `, [tag]);
                const tagId = tagIdResult.rows[0].tag_id;

                await client.query(`
                    INSERT INTO companion_ad_tags (ad_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;
                `, [adId, tagId]);
            }
        }

        await client.query('COMMIT');
        res.status(201).json({ message: 'Оголошення успішно створено!', adId: adId });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Помилка створення оголошення про компанію:', error);
        res.status(500).json({ error: 'Помилка сервера.' });
    } finally {
        client.release();
    }
});

module.exports = router;