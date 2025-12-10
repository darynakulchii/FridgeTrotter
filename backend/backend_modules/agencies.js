const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../auth_middleware');

// POST /api/agencies/register
router.post('/register', authenticateToken, async (req, res) => {
    const { name, license, phone, email, website, agreement } = req.body;
    const userId = req.user.userId;

    // Валідація
    if (!name || !license || !phone || !email || !agreement) {
        return res.status(400).json({ error: 'Будь ласка, заповніть всі обов\'язкові поля та надайте згоду.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Створюємо агенцію
        const agencyQuery = `
            INSERT INTO agencies (owner_id, name, license_number, phone, email, website, is_agreed_data_processing)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING agency_id;
        `;
        const values = [userId, name, license, phone, email, website || null, agreement];
        const agencyResult = await client.query(agencyQuery, values);

        // 2. Оновлюємо статус користувача (робимо його агентом)
        await client.query('UPDATE users SET is_agent = TRUE WHERE user_id = $1', [userId]);

        await client.query('COMMIT');

        res.status(201).json({
            message: 'Агенцію успішно зареєстровано!',
            agencyId: agencyResult.rows[0].agency_id
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Помилка реєстрації агенції:', err);

        if (err.code === '23505') { // Помилка унікальності (вже існує така назва або ліцензія)
            if (err.constraint.includes('license')) return res.status(409).json({ error: 'Агенція з таким номером ліцензії вже існує.' });
            if (err.constraint.includes('name')) return res.status(409).json({ error: 'Агенція з такою назвою вже існує.' });
            return res.status(409).json({ error: 'Ви вже зареєстрували агенцію.' });
        }

        res.status(500).json({ error: 'Помилка сервера.' });
    } finally {
        client.release();
    }
});

module.exports = { router };