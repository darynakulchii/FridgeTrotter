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

    try {
        // 1. Перевірка налаштувань (публічність та розмір)
        const settingsQuery = `
            SELECT is_public, magnet_size FROM fridge_settings WHERE user_id = $1;
        `;
        const settingsResult = await pool.query(settingsQuery, [targetUserId]);

        if (settingsResult.rows.length === 0) {
            // Якщо налаштувань немає і це чужий профіль — 404
            if (targetUserId.toString() !== (currentUserId || '').toString()) {
                return res.status(404).json({ error: 'Налаштування не знайдено.' });
            }
        } else {
            const { is_public } = settingsResult.rows[0];
            // Якщо профіль не публічний і це не власник — 403
            if (!is_public && targetUserId.toString() !== (currentUserId || '').toString()) {
                return res.status(403).json({ error: 'Холодильник є приватним.' });
            }
        }

        const magnetsQuery = `
            SELECT
                ufm.user_fridge_magnet_id, ufm.x_position, ufm.y_position, ufm.magnet_id,
                m.country, m.city, m.icon_class, m.color_group,
                m.image_url, m.shape
            FROM user_fridge_magnets ufm
            JOIN magnets m ON ufm.magnet_id = m.magnet_id
            WHERE ufm.user_id = $1;
        `;

        const magnetsResult = await pool.query(magnetsQuery, [targetUserId]);
        const settings = settingsResult.rows[0] || { is_public: true, magnet_size: 'medium' };

        res.json({
            magnets: magnetsResult.rows,
            settings: {
                magnet_size: settings.magnet_size
            }
        });

    } catch (error) {
        console.error('Помилка отримання даних холодильника:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Помилка сервера.' });
        }
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
            const uniqueMagnets = [];
            const seenIds = new Set();

            magnetsData.forEach(magnet => {
                // Переконуємось, що magnet_id це число
                const mId = parseInt(magnet.magnet_id);
                if (!seenIds.has(mId)) {
                    seenIds.add(mId);
                    uniqueMagnets.push(magnet);
                }
            });

            // Якщо після фільтрації щось залишилось, зберігаємо
            if (uniqueMagnets.length > 0) {
                const values = uniqueMagnets.map(magnet =>
                    `(${userId}, ${magnet.magnet_id}, ${magnet.x_position}, ${magnet.y_position})`
                ).join(',');

                const insertQuery = `
                    INSERT INTO user_fridge_magnets (user_id, magnet_id, x_position, y_position)
                    VALUES ${values};
                `;
                await client.query(insertQuery);
            }
        }

        await client.query('COMMIT');
        res.json({ message: 'Розміщення магнітів успішно збережено.', count: magnetsData ? magnetsData.length : 0 });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Помилка збереження магнітів:', error);
        // Додаємо деталі помилки у відповідь, щоб легше було дебажити
        res.status(500).json({ error: 'Помилка сервера.', details: error.message });
    } finally {
        client.release();
    }
});

module.exports = { router };