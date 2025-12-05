const express = require('express');
const router = express.Router();
const pool = require('../db'); // ВИПРАВЛЕНО: Коректний шлях до DB модуля
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Секретний ключ для JWT. Краще зчитувати з process.env
const JWT_SECRET = process.env.JWT_SECRET || 'my_super_secret_key_12345';

/**
 * MIDDLEWARE ДЛЯ АВТЕНТИФІКАЦІЇ (перевірка JWT)
 * Експортується для використання іншими маршрутами.
 */
const authenticateToken = (req, res, next) => {
    // Очікуємо формат "Bearer TOKEN"
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        return res.status(401).json({ error: 'Необхідна автентифікація: відсутній токен.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Недійсний токен.' });
        }
        req.user = user; // Зберігаємо дані користувача в об'єкті запиту
        next();
    });
};

/**
 * POST /api/auth/register
 * Реєстрація нового користувача (створення записів у users, user_profiles, user_stats, fridge_settings)
 */
router.post('/register', async (req, res) => {
    const { email, password, first_name, last_name } = req.body;

    if (!email || !password || !first_name || !last_name) {
        return res.status(400).json({ error: 'Необхідно вказати email, пароль, ім\'я та прізвище.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Хешування пароля
        const hashedPassword = await bcrypt.hash(password, 10);

        // 2. Вставка в таблицю users
        const userQuery = `
            INSERT INTO users (email, password_hash)
            VALUES ($1, $2)
            RETURNING user_id, email, is_agent;
        `;
        const userResult = await client.query(userQuery, [email, hashedPassword]);
        const userId = userResult.rows[0].user_id;

        // 3. Ініціалізація user_profiles (обов'язкові дані)
        const profileQuery = `
            INSERT INTO user_profiles (user_id, first_name, last_name)
            VALUES ($1, $2, $3);
        `;
        await client.query(profileQuery, [userId, first_name, last_name]);

        // 4. Ініціалізація user_stats
        await client.query('INSERT INTO user_stats (user_id) VALUES ($1);', [userId]);

        // 5. Ініціалізація fridge_settings
        await client.query('INSERT INTO fridge_settings (user_id) VALUES ($1);', [userId]);

        await client.query('COMMIT');
        res.status(201).json({
            message: 'Користувач успішно зареєстрований.',
            userId: userId
        });
    } catch (error) {
        await client.query('ROLLBACK');
        if (error.code === '23505') { // Unique violation (email)
            res.status(409).json({ error: 'Користувач з таким email вже існує.' });
        } else {
            console.error('Помилка реєстрації:', error);
            res.status(500).json({ error: 'Помилка сервера.' });
        }
    } finally {
        client.release();
    }
});

/**
 * POST /api/auth/login
 * Вхід користувача та видача JWT
 */
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

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
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
        return res.status(401).json({ error: 'Невірний email або пароль.' });
    }

    // 2. Створення JWT Payload
    const payload = {
        userId: user.user_id,
        email: user.email,
        first_name: user.first_name,
        isAgent: user.is_agent
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });

    // 3. Відповідь
    res.json({ message: 'Вхід успішний!', token, user: payload });
});

module.exports = { router, authenticateToken };
module.exports = { router };