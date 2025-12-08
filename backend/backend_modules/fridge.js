const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../auth_middleware');

/**
 * GET /api/fridge/magnets/available
 */
router.get('/magnets/available', authenticateToken, async (req, res) => {
    const query = `SELECT * FROM magnets ORDER BY country, city;`;
    try {
        const result = await pool.query(query);
        res.json({ magnets: result.rows });
    } catch (error) {
        console.error('Помилка отримання доступних магнітів:', error);
        res.status(500).json({ error: 'Помилка сервера.' });
    }
});

/**
 * GET /api/fridge/:userId/layout
 */
router.get('/:userId/layout', async (req, res) => {
    const targetUserId = req.params.userId;
    const currentUserId = req.user ? req.user.userId : null;

    // Перевірка налаштувань (публічність)
    const settingsQuery = `
        SELECT is_public FROM fridge_settings WHERE user_id = $1;
    `;
    const settingsResult = await pool.query(settingsQuery, [targetUserId]);

    if (settingsResult.rows.length === 0) {
        // Якщо налаштувань немає, вважаємо приватним за замовчуванням
        if (targetUserId.toString() !== (currentUserId || '').toString()) {
            return res.status(404).json({ error: 'Налаштування не знайдено.' });
        }
    } else {
        const { is_public } = settingsResult.rows[0];
        if (!is_public && targetUserId.toString() !== (currentUserId || '').toString()) {
            return res.status(403).json({ error: 'Холодильник є приватним.' });
        }
    }

    const query = `
        SELECT
            ufm.user_fridge_magnet_id, ufm.x_position, ufm.y_position, ufm.magnet_id,
            m.country, m.city, m.icon_class, m.color_group
        FROM user_fridge_magnets ufm
                 JOIN magnets m ON ufm.magnet_id = m.magnet_id
        WHERE ufm.user_id = $1;
    `;

    try {
        const result = await pool.query(query, [targetUserId]);
        res.json({ magnets: result.rows });
    } catch (error) {
        console.error('Помилка отримання магнітів:', error);
        res.status(500).json({ error: 'Помилка сервера.' });
    }
});

/**
 * POST /api/fridge/save
 */
router.post('/save', authenticateToken, async (req, res) => {
    const { magnetsData } = req.body;
    const userId = req.user.userId;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Очистити старі записи
        await client.query('DELETE FROM user_fridge_magnets WHERE user_id = $1;', [userId]);

        // 2. Вставити нові записи
        if (magnetsData && magnetsData.length > 0) {
            const values = magnetsData.map(magnet =>
                `(${userId}, ${magnet.magnet_id}, ${magnet.x_position}, ${magnet.y_position})`
            ).join(',');

            const insertQuery = `
                INSERT INTO user_fridge_magnets (user_id, magnet_id, x_position, y_position)
                VALUES ${values};
            `;
            await client.query(insertQuery);
        }

        await client.query('COMMIT');
        res.json({ message: 'Розміщення магнітів успішно збережено.', count: magnetsData ? magnetsData.length : 0 });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Помилка збереження магнітів:', error);
        res.status(500).json({ error: 'Помилка сервера.' });
    } finally {
        client.release();
    }
});

module.exports = { router };