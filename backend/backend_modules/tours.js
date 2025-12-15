const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../auth_middleware');
const multer = require('multer');
const streamifier = require('streamifier');
const cloudinary = require('cloudinary').v2;
const upload = multer({ storage: multer.memoryStorage() });

// Допоміжна функція завантаження фото
const uploadToCloudinary = (fileBuffer) => {
    return new Promise((resolve, reject) => {
        let stream = cloudinary.uploader.upload_stream(
            { folder: 'fridgetrotter/tours', resource_type: 'image' },
            (error, result) => {
                if (result) resolve(result);
                else reject(error);
            }
        );
        streamifier.createReadStream(fileBuffer).pipe(stream);
    });
};

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
        query += ` ORDER BY t.rating DESC`;
    } else {
        query += ` ORDER BY t.tour_id DESC`;
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
 */
router.get('/:id', async (req, res) => {
    const tourId = req.params.id;
    // Оновлений запит: збираємо всі картинки в масив images
    const query = `
        SELECT
            t.*,
            a.name AS agency_name,
            tc.name_ukr AS category_name,
            COALESCE(ARRAY_AGG(ti.image_url) FILTER (WHERE ti.image_url IS NOT NULL), '{}') AS images,
            (SELECT magnet_id FROM magnets WHERE linked_tour_id = t.tour_id LIMIT 1) as linked_magnet_id
        FROM tours t
                 JOIN agencies a ON t.agency_id = a.agency_id
                 LEFT JOIN tour_categories tc ON t.category_id = tc.category_id
                 LEFT JOIN tour_images ti ON t.tour_id = ti.tour_id
        WHERE t.tour_id = $1
        GROUP BY t.tour_id, a.name, tc.name_ukr;
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
 */
router.post('/', authenticateToken, upload.array('images', 10), async (req, res) => {
    const userId = req.user.userId;
    const { title, price, duration, location, description, category_id, program, dates } = req.body;
    const files = req.files;

    if (!title || !price || !duration || !location) {
        return res.status(400).json({ error: 'Заповніть всі обов\'язкові поля.' });
    }

    let datesArray = [];
    if (dates) {
        try {
            datesArray = Array.isArray(dates) ? dates : JSON.parse(dates);
        } catch(e) { datesArray = []; }
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Перевірка агенції
        const agencyRes = await client.query('SELECT agency_id FROM agencies WHERE owner_id = $1', [userId]);
        if (agencyRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Ви не зареєстровані як агенція.' });
        }
        const agencyId = agencyRes.rows[0].agency_id;

        // 2. Завантаження фото в Cloudinary
        const imageUrls = [];
        if (files && files.length > 0) {
            const uploadPromises = files.map(file => uploadToCloudinary(file.buffer));
            const results = await Promise.all(uploadPromises);
            results.forEach(res => imageUrls.push(res.secure_url));
        }

        // Головне фото - це перше фото зі списку (або null)
        const mainImageUrl = imageUrls.length > 0 ? imageUrls[0] : null;

        // 3. Створюємо тур (зберігаємо головне фото в image_url для сумісності з картками на головній)
        const insertTourQuery = `
            INSERT INTO tours (agency_id, title, description, location, duration_days, price_uah, image_url, category_id, program, available_dates)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING tour_id;
        `;

        const tourRes = await client.query(insertTourQuery, [
            agencyId, title, description, location,
            parseInt(duration), parseFloat(price),
            mainImageUrl, category_id ? parseInt(category_id) : null,
            program, datesArray
        ]);

        const newTourId = tourRes.rows[0].tour_id;

        // 4. Зберігаємо всі фото в таблицю tour_images
        if (imageUrls.length > 0) {
            const imageInsertQuery = `INSERT INTO tour_images (tour_id, image_url) VALUES ($1, $2)`;
            for (const url of imageUrls) {
                await client.query(imageInsertQuery, [newTourId, url]);
            }
        }

        // Оновлюємо лічильник
        await client.query('UPDATE agencies SET total_tours_count = total_tours_count + 1 WHERE agency_id = $1', [agencyId]);

        await client.query('COMMIT');

        res.status(201).json({
            message: 'Тур успішно створено!',
            tourId: newTourId
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Create Tour Error:', error);
        res.status(500).json({ error: 'Помилка сервера при створенні туру.' });
    } finally {
        client.release();
    }
});

// === КОМЕНТАРІ ДО ТУРІВ ===

// Отримати коментарі
router.get('/:id/comments', async (req, res) => {
    const tourId = req.params.id;
    const query = `
        SELECT tc.*, up.first_name, up.last_name, up.profile_image_url 
        FROM tour_comments tc
        JOIN user_profiles up ON tc.user_id = up.user_id
        WHERE tc.tour_id = $1
        ORDER BY tc.created_at DESC;
    `;
    try {
        const result = await pool.query(query, [tourId]);
        res.json({ comments: result.rows });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Додати коментар
router.post('/:id/comments', authenticateToken, async (req, res) => {
    const tourId = req.params.id;
    const userId = req.user.userId;
    const { content } = req.body;
    if(!content) return res.status(400).json({error: 'Пустий коментар'});

    try {
        await pool.query('INSERT INTO tour_comments (tour_id, user_id, content) VALUES ($1, $2, $3)', [tourId, userId, content]);
        res.json({ message: 'Коментар додано' });
    } catch(error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// === БРОНЮВАННЯ ТУРУ ===
router.post('/:id/book', authenticateToken, async (req, res) => {
    const tourId = req.params.id;
    const userId = req.user.userId;
    const { phone, date, participants } = req.body;

    if (!phone || !participants) return res.status(400).json({ error: 'Заповніть обовʼязкові поля' });

    try {
        await pool.query(
            `INSERT INTO tour_bookings (user_id, tour_id, contact_phone, selected_date, participants_count)
             VALUES ($1, $2, $3, $4, $5)`,
            [userId, tourId, phone, date || null, participants]
        );

        // Тут можна додати відправку сповіщення агенту через socket.io

        res.json({ message: 'Заявку на бронювання відправлено! Менеджер звʼяжеться з вами.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Помилка бронювання' });
    }
});

/**
 * DELETE /api/tours/saved
 * Очистити всі збережені тури
 */
router.delete('/saved', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    try {
        await pool.query('DELETE FROM user_saved_tours WHERE user_id = $1', [userId]);
        res.json({ message: 'Всі збережені тури видалено.' });
    } catch (error) {
        console.error('Помилка очищення турів:', error);
        res.status(500).json({ error: 'Помилка сервера.' });
    }
});

/**
 * GET /api/tours/saved
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

router.post('/', authenticateToken, upload.single('image'), async (req, res) => {
    const userId = req.user.userId;
    const { title, price, duration, location, description, category_id } = req.body;

    if (!title || !price || !duration || !location) {
        return res.status(400).json({ error: 'Заповніть всі обов\'язкові поля.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Знаходимо ID агенції, що належить користувачу
        const agencyRes = await client.query('SELECT agency_id FROM agencies WHERE owner_id = $1', [userId]);

        if (agencyRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Ви не зареєстровані як агенція.' });
        }
        const agencyId = agencyRes.rows[0].agency_id;

        // 2. Завантажуємо фото (якщо є)
        let imageUrl = null;
        if (req.file) {
            const uploadResult = await uploadToCloudinary(req.file.buffer);
            imageUrl = uploadResult.secure_url;
        }

        // 3. Створюємо тур
        const insertQuery = `
            INSERT INTO tours (agency_id, title, description, location, duration_days, price_uah, image_url, category_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING tour_id;
        `;

        const tourRes = await client.query(insertQuery, [
            agencyId,
            title,
            description,
            location,
            parseInt(duration),
            parseFloat(price),
            imageUrl,
            category_id ? parseInt(category_id) : null
        ]);

        // Оновлюємо лічильник турів в агенції
        await client.query('UPDATE agencies SET total_tours_count = total_tours_count + 1 WHERE agency_id = $1', [agencyId]);

        await client.query('COMMIT');

        res.status(201).json({
            message: 'Тур успішно створено!',
            tourId: tourRes.rows[0].tour_id
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Create Tour Error:', error);
        res.status(500).json({ error: 'Помилка сервера при створенні туру.' });
    } finally {
        client.release();
    }
});

module.exports = { router };