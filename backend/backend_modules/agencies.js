const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
// ІМПОРТУЄМО middleware для захисту маршрутів
const { authenticateToken } = require('../auth_middleware');
const multer = require('multer');
const streamifier = require('streamifier');
const cloudinary = require('cloudinary').v2;

const JWT_SECRET = process.env.JWT_SECRET || 'my_super_secret_key_12345';
const upload = multer({ storage: multer.memoryStorage() });

// Функція завантаження в Cloudinary
const uploadToCloudinary = (fileBuffer) => {
    return new Promise((resolve, reject) => {
        let stream = cloudinary.uploader.upload_stream(
            { folder: 'fridgetrotter/magnets', resource_type: 'image' },
            (error, result) => {
                if (result) resolve(result);
                else reject(error);
            }
        );
        streamifier.createReadStream(fileBuffer).pipe(stream);
    });
};

// =================================================================
// 1. РЕЄСТРАЦІЯ (ПУБЛІЧНИЙ МАРШРУТ)
// =================================================================
router.post('/register', async (req, res) => {
    const { name, license, phone, email, website, agreement, password } = req.body;

    if (!name || !license || !phone || !email || !agreement || !password) {
        return res.status(400).json({ error: 'Будь ласка, заповніть всі обов\'язкові поля.' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'Пароль має містити мінімум 6 символів.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Перевірка існування користувача
        const userCheck = await client.query('SELECT 1 FROM users WHERE email = $1', [email]);
        if (userCheck.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Користувач з таким email вже існує.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Створення користувача
        const userResult = await client.query(`
            INSERT INTO users (email, password_hash, is_agent, is_email_public, is_location_public)
            VALUES ($1, $2, TRUE, TRUE, TRUE)
            RETURNING user_id;
        `, [email, hashedPassword]);
        const newUserId = userResult.rows[0].user_id;

        // Створення профілю
        await client.query(`
            INSERT INTO user_profiles (user_id, first_name, last_name, location, bio)
            VALUES ($1, $2, '(Агенція)', 'Україна', $3);
        `, [newUserId, name, `Офіційна сторінка турагенції ${name}`]);

        // Ініціалізація допоміжних таблиць
        await client.query('INSERT INTO user_stats (user_id) VALUES ($1)', [newUserId]);
        await client.query('INSERT INTO fridge_settings (user_id) VALUES ($1)', [newUserId]);

        // Створення агенції
        const agencyResult = await client.query(`
            INSERT INTO agencies (owner_id, name, license_number, phone, email, website, is_agreed_data_processing)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING agency_id;
        `, [newUserId, name, license, phone, email, website || null, agreement]);

        await client.query('COMMIT');

        // Автоматичний вхід
        const tokenPayload = { userId: newUserId, email: email, first_name: name, isAgent: true };
        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '24h' });

        res.status(201).json({
            message: 'Агенцію зареєстровано!',
            agencyId: agencyResult.rows[0].agency_id,
            token: token,
            user: tokenPayload
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Registration error:', err);
        if (err.code === '23505') {
            if (err.constraint && err.constraint.includes('name')) return res.status(409).json({ error: 'Агенція з такою назвою вже існує.' });
            if (err.constraint && err.constraint.includes('license')) return res.status(409).json({ error: 'Ліцензія вже зареєстрована.' });
        }
        res.status(500).json({ error: 'Помилка сервера.' });
    } finally {
        client.release();
    }
});

// =================================================================
// 2. ОТРИМАННЯ ПРОФІЛЮ АГЕНЦІЇ (GET /me)
// =================================================================
router.get('/me', authenticateToken, async (req, res) => {
    // Отримуємо ID користувача з токена
    const userId = req.user.userId;

    // Шукаємо агенцію, яка належить цьому користувачу
    // Також підтягуємо логотип з таблиці user_profiles
    const query = `
        SELECT 
            a.*,
            up.profile_image_url AS logo_url
        FROM agencies a
        JOIN user_profiles up ON a.owner_id = up.user_id
        WHERE a.owner_id = $1;
    `;

    try {
        const result = await pool.query(query, [userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Профіль агенції не знайдено.' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get Agency Profile Error:', error);
        res.status(500).json({ error: 'Помилка сервера.' });
    }
});

// =================================================================
// 3. ОНОВЛЕННЯ ПРОФІЛЮ АГЕНЦІЇ (PUT /me)
// =================================================================
router.put('/me', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { description, phone, website, name } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Оновлюємо таблицю agencies
        // COALESCE дозволяє не оновлювати поле, якщо воно не передано (null)
        const updateAgencyQuery = `
            UPDATE agencies
            SET 
                description = COALESCE($1, description),
                phone = COALESCE($2, phone),
                website = COALESCE($3, website),
                name = COALESCE($4, name)
            WHERE owner_id = $5
            RETURNING agency_id;
        `;
        const result = await client.query(updateAgencyQuery, [description, phone, website, name, userId]);

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Агенцію не знайдено.' });
        }

        // Якщо змінили назву агенції, варто оновити і user_profiles (first_name),
        // бо ми використовуємо його як відображуване ім'я в чатах/постах
        if (name) {
            await client.query(`
                UPDATE user_profiles SET first_name = $1 WHERE user_id = $2
            `, [name, userId]);
        }

        await client.query('COMMIT');
        res.json({ message: 'Профіль агенції оновлено успішно.' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Update Agency Error:', error);
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Агенція з такою назвою вже існує.' });
        }
        res.status(500).json({ error: 'Помилка сервера.' });
    } finally {
        client.release();
    }
});

// =================================================================
// 4. МОЇ ТУРИ (GET /me/tours)
// =================================================================
router.get('/me/tours', authenticateToken, async (req, res) => {
    const userId = req.user.userId;

    const query = `
        SELECT t.*, tc.name_ukr as category_name
        FROM tours t
        JOIN agencies a ON t.agency_id = a.agency_id
        LEFT JOIN tour_categories tc ON t.category_id = tc.category_id
        WHERE a.owner_id = $1
        ORDER BY t.tour_id DESC;
    `;

    try {
        const result = await pool.query(query, [userId]);
        res.json({ tours: result.rows });
    } catch (error) {
        console.error('Get Agency Tours Error:', error);
        res.status(500).json({ error: 'Помилка сервера.' });
    }
});

/**
 * POST /api/agencies/magnets
 * Створення замовлення на магніт (або завантаження свого, або запит менеджеру)
 */
router.post('/magnets', authenticateToken, upload.single('image'), async (req, res) => {
    const userId = req.user.userId;
    const { type, shape, comment, country, city, linked_tour_id } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Отримуємо ID агенції користувача
        const agencyRes = await client.query('SELECT agency_id FROM agencies WHERE owner_id = $1', [userId]);
        if (agencyRes.rows.length === 0) {
            return res.status(403).json({ error: 'У вас немає зареєстрованої агенції.' });
        }
        const agencyId = agencyRes.rows[0].agency_id;

        let imageUrl = null;

        // 2. Якщо це завантаження свого дизайну - обробляємо файл
        if (type === 'upload' && req.file) {
            const uploadResult = await uploadToCloudinary(req.file.buffer);
            imageUrl = uploadResult.secure_url;
        }

        // 3. Зберігаємо замовлення
        const insertQuery = `
            INSERT INTO magnets (country, city, icon_class, color_group, image_url, shape, linked_tour_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING magnet_id;
        `;

        await client.query(insertQuery, [
            country,
            city,
            'fa-magnet',
            'blue',
            imageUrl,
            shape,
            linked_tour_id || null
        ]);

        await client.query('COMMIT');
        res.status(201).json({ message: 'Магніт успішно додано до каталогу!' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Magnet Order Error:', error);
        res.status(500).json({ error: 'Помилка додавання магніту.' });
    } finally {
        client.release();
    }
});

router.get('/bookings', authenticateToken, async (req, res) => {
    const userId = req.user.userId;

    const query = `
        SELECT tb.*, t.title AS tour_title, up.first_name, up.last_name, u.email
        FROM tour_bookings tb
                 JOIN tours t ON tb.tour_id = t.tour_id
                 JOIN agencies a ON t.agency_id = a.agency_id
                 JOIN user_profiles up ON tb.user_id = up.user_id
                 JOIN users u ON up.user_id = u.user_id
        WHERE a.owner_id = $1
        ORDER BY tb.booking_date DESC;
    `;

    try {
        const result = await pool.query(query, [userId]);
        res.json({ bookings: result.rows });
    } catch(e) {
        res.status(500).json({ error: 'Error fetching bookings' });
    }
});

// === ПІДТВЕРДЖЕННЯ БРОНЮВАННЯ ===
router.post('/bookings/:id/confirm', authenticateToken, async (req, res) => {
    const bookingId = req.params.id;
    const userId = req.user.userId; // ID агента

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Перевірка прав (чи це бронювання належить агенції юзера)
        // ... (код перевірки owner_id через join tables)

        // 2. Оновлення статусу
        await client.query(`UPDATE tour_bookings SET status = 'confirmed' WHERE booking_id = $1`, [bookingId]);

        // 3. Отримання даних для "Email" та Магніту
        const bookingData = await client.query(`
            SELECT tb.user_id, t.title, t.tour_id, m.magnet_id, u.email
            FROM tour_bookings tb
            JOIN tours t ON tb.tour_id = t.tour_id
            JOIN users u ON tb.user_id = u.user_id
            LEFT JOIN magnets m ON t.tour_id = m.linked_tour_id
            WHERE tb.booking_id = $1
        `, [bookingId]);

        const { user_id: clientUserId, title, magnet_id, email: clientEmail } = bookingData.rows[0];

        // 4. "Відправка Email" (імітація)
        console.log(`[EMAIL SENDING] To: ${clientEmail}. Subject: Тур підтверджено! Tour: ${title}.`);

        // 5. Видача магніту (якщо він прив'язаний до туру)
        let magnetMessage = '';
        if (magnet_id) {
            // Перевіряємо, чи немає вже такого магніту у юзера
            await client.query(`
                INSERT INTO user_fridge_magnets (user_id, magnet_id, x_position, y_position)
                VALUES ($1, $2, 50, 50)
                ON CONFLICT DO NOTHING
            `, [clientUserId, magnet_id]);
            magnetMessage = 'Магніт автоматично додано на холодильник клієнта!';
        }

        // 6. Створення сповіщення для клієнта
        await client.query(`
            INSERT INTO notifications (user_id, message) 
            VALUES ($1, $2)
        `, [clientUserId, `Ваше бронювання туру "${title}" підтверджено! ${magnet_id ? 'Вам видано новий магніт!' : ''}`]);

        await client.query('COMMIT');
        res.json({ message: `Бронювання підтверджено. ${magnetMessage}` });

    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Server error' });
    } finally {
        client.release();
    }
});

module.exports = { router };