const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Переконайтеся, що ключ співпадає з тим, що в auth_middleware.js
const JWT_SECRET = process.env.JWT_SECRET || 'my_super_secret_key_12345';

// POST /api/agencies/register
// Цей маршрут тепер ПУБЛІЧНИЙ (без authenticateToken), бо створює нового юзера
router.post('/register', async (req, res) => {
    // Отримуємо дані, включаючи пароль
    const { name, license, phone, email, website, agreement, password } = req.body;

    // 1. Валідація вхідних даних
    if (!name || !license || !phone || !email || !agreement || !password) {
        return res.status(400).json({ error: 'Будь ласка, заповніть всі обов\'язкові поля та надайте згоду.' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'Пароль має містити мінімум 6 символів.' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN'); // Початок транзакції

        // 2. Перевірка, чи існує вже користувач з таким email (для логіну)
        const userCheck = await client.query('SELECT 1 FROM users WHERE email = $1', [email]);
        if (userCheck.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Користувач з таким email вже існує.' });
        }

        // 3. Хешування пароля
        const hashedPassword = await bcrypt.hash(password, 10);

        // 4. Створення користувача в таблиці USERS
        // Встановлюємо is_agent = TRUE
        const userQuery = `
            INSERT INTO users (email, password_hash, is_agent, is_email_public, is_location_public)
            VALUES ($1, $2, TRUE, TRUE, TRUE)
            RETURNING user_id;
        `;
        const userResult = await client.query(userQuery, [email, hashedPassword]);
        const newUserId = userResult.rows[0].user_id;

        // 5. Створення профілю в USER_PROFILES
        // Використовуємо назву агенції як Ім'я, щоб у чатах/постах відображалася назва компанії
        const profileQuery = `
            INSERT INTO user_profiles (user_id, first_name, last_name, location, bio)
            VALUES ($1, $2, $3, $4, $5);
        `;
        await client.query(profileQuery, [
            newUserId,
            name,           // First Name = Назва агенції
            '(Агенція)',    // Last Name = Помітка
            'Україна',      // Дефолтна локація
            `Офіційна сторінка агенції ${name}` // Дефолтне біо
        ]);

        // 6. Ініціалізація допоміжних таблиць (щоб не було помилок в інших модулях)
        await client.query('INSERT INTO user_stats (user_id) VALUES ($1)', [newUserId]);
        await client.query('INSERT INTO fridge_settings (user_id) VALUES ($1)', [newUserId]);

        // 7. Створення запису в таблиці AGENCIES
        const agencyQuery = `
            INSERT INTO agencies (owner_id, name, license_number, phone, email, website, is_agreed_data_processing)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING agency_id;
        `;
        const agencyResult = await client.query(agencyQuery, [
            newUserId, name, license, phone, email, website || null, agreement
        ]);

        await client.query('COMMIT'); // Фіксація транзакції

        // 8. Автоматичний вхід (генерація токена)
        const tokenPayload = {
            userId: newUserId,
            email: email,
            first_name: name,
            isAgent: true
        };

        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '24h' });

        res.status(201).json({
            message: 'Агенцію успішно зареєстровано!',
            agencyId: agencyResult.rows[0].agency_id,
            token: token,
            user: tokenPayload
        });

    } catch (err) {
        await client.query('ROLLBACK'); // Відміна змін у разі помилки
        console.error('Помилка реєстрації агенції:', err);

        // Обробка помилок унікальності (PostgreSQL error code 23505)
        if (err.code === '23505') {
            if (err.constraint.includes('agencies_name_key')) {
                return res.status(409).json({ error: 'Агенція з такою назвою вже існує.' });
            }
            if (err.constraint.includes('agencies_license_number_key')) {
                return res.status(409).json({ error: 'Агенція з таким номером ліцензії вже існує.' });
            }
        }

        res.status(500).json({ error: 'Помилка сервера при реєстрації.' });
    } finally {
        client.release();
    }
});

module.exports = { router };