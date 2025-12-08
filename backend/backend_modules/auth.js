const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../auth_middleware');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'my_super_secret_key_12345';

// === РЕЄСТРАЦІЯ ===
router.post('/register', async (req, res) => {
    // Отримуємо дані з тіла запиту
    const { email, password, first_name, last_name } = req.body;

    // Валідація
    if (!email || !password || !first_name || !last_name) {
        return res.status(400).json({ error: 'Всі поля обов\'язкові для заповнення.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Хешування пароля
        const hashedPassword = await bcrypt.hash(password, 10);

        // 2. Створення користувача
        const userQuery = `
            INSERT INTO users (email, password_hash)
            VALUES ($1, $2)
            RETURNING user_id, email, is_agent;
        `;
        const userResult = await client.query(userQuery, [email, hashedPassword]);
        const userId = userResult.rows[0].user_id;

        // 3. Створення профілю
        const profileQuery = `
            INSERT INTO user_profiles (user_id, first_name, last_name)
            VALUES ($1, $2, $3);
        `;
        await client.query(profileQuery, [userId, first_name, last_name]);

        // 4. Ініціалізація допоміжних таблиць
        await client.query('INSERT INTO user_stats (user_id) VALUES ($1);', [userId]);
        await client.query('INSERT INTO fridge_settings (user_id) VALUES ($1);', [userId]);

        await client.query('COMMIT');

        res.status(201).json({
            message: 'Реєстрація успішна! Тепер ви можете увійти.',
            userId: userId
        });

    } catch (error) {
        await client.query('ROLLBACK');
        if (error.code === '23505') { // Код помилки PostgreSQL для duplicate key
            res.status(409).json({ error: 'Користувач з таким email вже існує.' });
        } else {
            console.error('Registration Error:', error);
            res.status(500).json({ error: 'Помилка сервера при реєстрації.' });
        }
    } finally {
        client.release();
    }
});

// === ВХІД ===
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Введіть email та пароль.' });
    }

    try {
        // Шукаємо користувача
        const userQuery = `
            SELECT u.user_id, u.email, u.password_hash, up.first_name, up.last_name, u.is_agent
            FROM users u
            LEFT JOIN user_profiles up ON u.user_id = up.user_id
            WHERE u.email = $1;
        `;
        const userResult = await pool.query(userQuery, [email]);

        if (userResult.rows.length === 0) {
            return res.status(401).json({ error: 'Невірний email або пароль.' });
        }

        const user = userResult.rows[0];

        // Перевіряємо пароль
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Невірний email або пароль.' });
        }

        // Генеруємо токен
        const payload = {
            userId: user.user_id,
            email: user.email,
            first_name: user.first_name,
            isAgent: user.is_agent
        };

        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

        res.json({
            message: 'Вхід успішний!',
            token,
            user: payload
        });

    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ error: 'Помилка сервера при вході.' });
    }
});

module.exports = { router, authenticateToken };