const express = require('express');
const router = express.Router();
const pool = require('../db'); // ВИПРАВЛЕНО: Коректний шлях до DB модуля
const { authenticateToken } = require('../auth_middleware');

/**
 * GET /api/tours/agencies
 * Отримання рейтингу турагенцій.
 */
router.get('/agencies', async (req, res) => {
    const query = `
        SELECT * FROM agencies
        ORDER BY avg_rating DESC, review_count DESC;
    `;
    try {
        const result = await pool.query(query);
        res.json({ agencies: result.rows });
    } catch (error) {
        console.error('Помилка отримання агенцій:', error);
        res.status(500).json({ error: 'Помилка сервера.' });
    }
});

/**
 * GET /api/tours
 * Отримання списку турів з фільтрацією та сортуванням.
 */
router.get('/', async (req, res) => {
    const { search, category, sort } = req.query;
    let query = `
        SELECT t.*, a.name AS agency_name, tc.name_ukr AS category_name
        FROM tours t
                 JOIN agencies a ON t.agency_id = a.agency_id
                 LEFT JOIN tour_categories tc ON t.category_id = tc.category_id
        WHERE 1 = 1
    `;
    const queryParams = [];
    let paramIndex = 1;

    if (search) {
        query += ` AND (t.title ILIKE $${paramIndex} OR t.description ILIKE $${paramIndex} OR t.location ILIKE $${paramIndex})`;
        queryParams.push(`%${search}%`);
        paramIndex++;
    }

    if (category && category !== 'Всі категорії') {
        query += ` AND tc.name_ukr = $${paramIndex}`;
        queryParams.push(category);
        paramIndex++;
    }

    // Сортування
    if (sort === 'rating') {
        query += ` ORDER BY t.rating DESC`;
    } else if (sort === 'price_asc') {
        query += ` ORDER BY t.price_uah ASC`;
    } else if (sort === 'price_desc') {
        query += ` ORDER BY t.price_uah DESC`;
    } else if (sort === 'popular') {
        // Використовуємо рейтинг або інший показник популярності
        query += ` ORDER BY t.rating DESC`;
    } else {
        query += ` ORDER BY t.tour_id DESC`; // Нові спочатку
    }

    try {
        const result = await pool.query(query, queryParams);
        res.json({ tours: result.rows });
    } catch (error) {
        console.error('Помилка отримання турів:', error);
        res.status(500).json({ error: 'Помилка сервера.' });
    }
});

/**
 * GET /api/tours/:id
 * Деталі туру.
 */
router.get('/:id', async (req, res) => {
    const tourId = req.params.id;
    const query = `
        SELECT t.*, a.name AS agency_name, tc.name_ukr AS category_name
        FROM tours t
                 JOIN agencies a ON t.agency_id = a.agency_id
                 LEFT JOIN tour_categories tc ON t.category_id = tc.category_id
        WHERE t.tour_id = $1;
    `;
    try {
        const result = await pool.query(query, [tourId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Тур не знайдено.' });
        }
        res.json({ tour: result.rows[0] });
    } catch (error) {
        console.error('Помилка отримання деталей туру:', error);
        res.status(500).json({ error: 'Помилка сервера.' });
    }
});

/**
 * POST /api/tours/save
 * Додавання/видалення туру зі збережених.
 */
router.post('/save', authenticateToken, async (req, res) => {
    const { tourId } = req.body;
    const userId = req.user.userId;

    if (!tourId) {
        return res.status(400).json({ error: 'Необхідно вказати ID туру.' });
    }

    const queryCheck = `SELECT * FROM user_saved_tours WHERE user_id = $1 AND tour_id = $2;`;
    const queryInsert = `INSERT INTO user_saved_tours (user_id, tour_id) VALUES ($1, $2);`;
    const queryDelete = `DELETE FROM user_saved_tours WHERE user_id = $1 AND tour_id = $2;`;

    try {
        const checkResult = await pool.query(queryCheck, [userId, tourId]);

        if (checkResult.rows.length > 0) {
            await pool.query(queryDelete, [userId, tourId]);
            res.json({ message: 'Тур видалено зі збережених.', saved: false });
        } else {
            await pool.query(queryInsert, [userId, tourId]);
            res.json({ message: 'Тур збережено.', saved: true });
        }
    } catch (error) {
        console.error('Помилка збереження туру:', error);
        res.status(500).json({ error: 'Помилка сервера.' });
    }
});

/**
 * GET /api/tours/saved
 * Отримання збережених турів поточного користувача.
 */
router.get('/saved', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const query = `
        SELECT t.*, a.name AS agency_name, tc.name_ukr AS category_name, ust.saved_date
        FROM user_saved_tours ust
                 JOIN tours t ON ust.tour_id = t.tour_id
                 JOIN agencies a ON t.agency_id = a.agency_id
                 LEFT JOIN tour_categories tc ON t.category_id = tc.category_id
        WHERE ust.user_id = $1
        ORDER BY ust.saved_date DESC;
    `;
    try {
        const result = await pool.query(query, [userId]);
        res.json({ tours: result.rows });
    } catch (error) {
        console.error('Помилка отримання збережених турів:', error);
        res.status(500).json({ error: 'Помилка сервера.' });
    }
});

module.exports = { router };