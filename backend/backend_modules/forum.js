const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../auth_middleware');
const multer = require('multer');
const streamifier = require('streamifier');
const cloudinary = require('cloudinary').v2;

// Налаштування multer для обробки файлів у пам'яті
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // Ліміт 5MB на файл
});

// Допоміжна функція для завантаження на Cloudinary
const uploadToCloudinary = (fileBuffer) => {
    return new Promise((resolve, reject) => {
        let stream = cloudinary.uploader.upload_stream(
            { folder: 'fridgetrotter/posts', resource_type: 'image' },
            (error, result) => {
                if (result) {
                    resolve(result);
                } else {
                    console.error("Cloudinary upload error:", error);
                    reject(error);
                }
            }
        );
        streamifier.createReadStream(fileBuffer).pipe(stream);
    });
};

/**
 * GET /api/forum/posts
 * Отримання списку постів з зображеннями.
 * Додано підтримку author_id
 */
router.get('/posts', async (req, res) => {
    const { search, category, sort, author_id } = req.query;

    // Основний запит з агрегацією зображень
    let query = `
        SELECT
            p.post_id, p.author_id, p.title, p.content, p.category, p.created_at, p.likes_count,
            up.first_name, up.last_name, up.profile_image_url AS author_avatar,
            (SELECT COUNT(*) FROM comments WHERE post_id = p.post_id) AS comments_count,
            COALESCE(
                            ARRAY_AGG(pi.image_url) FILTER (WHERE pi.image_url IS NOT NULL),
                            '{}'
            ) AS images
        FROM posts p
                 JOIN user_profiles up ON p.author_id = up.user_id
                 LEFT JOIN post_images pi ON p.post_id = pi.post_id
        WHERE 1 = 1
    `;

    const queryParams = [];
    let paramIndex = 1;

    if (search) {
        query += ` AND (p.title ILIKE $${paramIndex} OR p.content ILIKE $${paramIndex})`;
        queryParams.push(`%${search}%`);
        paramIndex++;
    }

    if (category && category !== 'Всі теми') {
        query += ` AND p.category = $${paramIndex}`;
        queryParams.push(category);
        paramIndex++;
    }

    // === НОВЕ: Фільтр по автору ===
    if (author_id) {
        query += ` AND p.author_id = $${paramIndex}`;
        queryParams.push(author_id);
        paramIndex++;
    }

    // Групування обов'язкове при використанні агрегатних функцій (ARRAY_AGG)
    query += ` GROUP BY p.post_id, up.user_id`;

    // Сортування
    if (sort === 'popular') {
        query += ` ORDER BY p.likes_count DESC, p.created_at DESC`;
    } else if (sort === 'unanswered') {
        query += ` ORDER BY comments_count ASC, p.created_at DESC`;
    } else {
        query += ` ORDER BY p.created_at DESC`; // Default: Newest first
    }

    try {
        const result = await pool.query(query, queryParams);
        res.json({ posts: result.rows });
    } catch (error) {
        console.error('Помилка отримання постів:', error);
        res.status(500).json({ error: 'Помилка сервера.' });
    }
});

/**
 * GET /api/forum/posts/my
 * Отримання моїх постів.
 */
router.get('/posts/my', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const query = `
        SELECT
            p.post_id, p.title, p.content, p.category, p.created_at, p.likes_count,
            (SELECT COUNT(*) FROM comments WHERE post_id = p.post_id) AS comments_count,
            COALESCE(
                            ARRAY_AGG(pi.image_url) FILTER (WHERE pi.image_url IS NOT NULL),
                            '{}'
            ) AS images
        FROM posts p
                 LEFT JOIN post_images pi ON p.post_id = pi.post_id
        WHERE p.author_id = $1
        GROUP BY p.post_id
        ORDER BY p.created_at DESC;
    `;
    try {
        const result = await pool.query(query, [userId]);
        res.json({ posts: result.rows });
    } catch (error) {
        console.error('Помилка отримання моїх постів:', error);
        res.status(500).json({ error: 'Помилка сервера.' });
    }
});

/**
 * GET /api/forum/posts/saved
 * Отримання збережених постів.
 */
router.get('/posts/saved', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const query = `
        SELECT
            p.post_id, p.title, p.content, p.category, p.created_at, p.likes_count,
            up.first_name, up.last_name, usp.saved_date,
            (SELECT COUNT(*) FROM comments WHERE post_id = p.post_id) AS comments_count,
            COALESCE(
                            ARRAY_AGG(pi.image_url) FILTER (WHERE pi.image_url IS NOT NULL),
                            '{}'
            ) AS images
        FROM user_saved_posts usp
                 JOIN posts p ON usp.post_id = p.post_id
                 JOIN user_profiles up ON p.author_id = up.user_id
                 LEFT JOIN post_images pi ON p.post_id = pi.post_id
        WHERE usp.user_id = $1
        GROUP BY p.post_id, up.user_id, usp.saved_date
        ORDER BY usp.saved_date DESC;
    `;
    try {
        const result = await pool.query(query, [userId]);
        res.json({ posts: result.rows });
    } catch (error) {
        console.error('Помилка отримання збережених постів:', error);
        res.status(500).json({ error: 'Помилка сервера.' });
    }
});

/**
 * GET /api/forum/posts/:id
 * Отримання одного поста.
 */
router.get('/posts/:id', async (req, res) => {
    const postId = req.params.id;
    const query = `
        SELECT
            p.post_id, p.title, p.content, p.category, p.created_at, p.likes_count,
            up.first_name, up.last_name, up.profile_image_url AS author_avatar,
            (SELECT COUNT(*) FROM comments WHERE post_id = p.post_id) AS comments_count,
            COALESCE(
                            ARRAY_AGG(pi.image_url) FILTER (WHERE pi.image_url IS NOT NULL),
                            '{}'
            ) AS images
        FROM posts p
                 JOIN user_profiles up ON p.author_id = up.user_id
                 LEFT JOIN post_images pi ON p.post_id = pi.post_id
        WHERE p.post_id = $1
        GROUP BY p.post_id, up.user_id;
    `;
    try {
        const result = await pool.query(query, [postId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Пост не знайдено.' });
        }
        res.json({ post: result.rows[0] });
    } catch (error) {
        console.error('Помилка отримання поста:', error);
        res.status(500).json({ error: 'Помилка сервера.' });
    }
});

/**
 * POST /api/forum/posts
 * Створення нового поста (з підтримкою фото).
 */
router.post('/posts', authenticateToken, upload.array('images', 8), async (req, res) => {
    const { title, content, category } = req.body;
    const authorId = req.user.userId;
    const files = req.files; // Масив файлів

    if (!title || !content) {
        return res.status(400).json({ error: 'Необхідно вказати заголовок та контент.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Створення запису про пост
        const postQuery = `
            INSERT INTO posts (author_id, title, content, category)
            VALUES ($1, $2, $3, $4)
            RETURNING post_id, created_at;
        `;
        const postResult = await client.query(postQuery, [authorId, title, content, category || 'Загальна']);
        const postId = postResult.rows[0].post_id;
        const createdAt = postResult.rows[0].created_at;

        const imageUrls = [];

        // 2. Завантаження зображень (якщо є)
        if (files && files.length > 0) {
            // Паралельне завантаження на Cloudinary
            const uploadPromises = files.map(file => uploadToCloudinary(file.buffer));
            const uploadResults = await Promise.all(uploadPromises);

            // Збір URL
            uploadResults.forEach(result => imageUrls.push(result.secure_url));

            // Збереження URL у БД
            const imageInsertQuery = `
                INSERT INTO post_images (post_id, image_url)
                VALUES ($1, $2);
            `;

            // Послідовна вставка (можна оптимізувати через один INSERT, але так безпечніше для помилок)
            for (const url of imageUrls) {
                await client.query(imageInsertQuery, [postId, url]);
            }
        }

        await client.query('COMMIT');

        res.status(201).json({
            message: 'Пост успішно створено.',
            postId: postId,
            created_at: createdAt,
            images: imageUrls
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Помилка створення поста:', error);
        res.status(500).json({ error: 'Помилка сервера.' });
    } finally {
        client.release();
    }
});

/**
 * PUT /api/forum/posts/:id
 * Редагування поста (Тільки текст).
 */
router.put('/posts/:id', authenticateToken, async (req, res) => {
    const postId = req.params.id;
    const userId = req.user.userId;
    const { title, content, category } = req.body;

    try {
        // Перевірка прав
        const checkQuery = 'SELECT author_id FROM posts WHERE post_id = $1';
        const checkResult = await pool.query(checkQuery, [postId]);

        if (checkResult.rows.length === 0) return res.status(404).json({ error: 'Пост не знайдено' });
        if (checkResult.rows[0].author_id !== userId) return res.status(403).json({ error: 'Немає прав' });

        const updateQuery = `
            UPDATE posts SET title = $1, content = $2, category = $3, updated_at = NOW()
            WHERE post_id = $4
        `;
        await pool.query(updateQuery, [title, content, category, postId]);
        res.json({ message: 'Пост оновлено' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

/**
 * DELETE /api/forum/posts/:id
 * Видалення свого поста.
 */
router.delete('/posts/:id', authenticateToken, async (req, res) => {
    const postId = req.params.id;
    const userId = req.user.userId;

    try {
        const checkQuery = 'SELECT author_id FROM posts WHERE post_id = $1';
        const checkResult = await pool.query(checkQuery, [postId]);

        if (checkResult.rows.length === 0) return res.status(404).json({ error: 'Пост не знайдено' });
        if (checkResult.rows[0].author_id !== userId) return res.status(403).json({ error: 'Немає прав' });

        await pool.query('DELETE FROM posts WHERE post_id = $1', [postId]);
        res.json({ message: 'Пост видалено' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

/**
 * DELETE /api/forum/saved
 * Очищення всіх збережених постів.
 */
router.delete('/saved', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    try {
        await pool.query('DELETE FROM user_saved_posts WHERE user_id = $1', [userId]);
        res.json({ message: 'Всі збережені пости видалено.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

/**
 * DELETE /api/forum/saved/:id
 * Видалення одного збереженого поста.
 */
router.delete('/saved/:id', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const postId = req.params.id;
    try {
        await pool.query('DELETE FROM user_saved_posts WHERE user_id = $1 AND post_id = $2', [userId, postId]);
        res.json({ message: 'Видалено зі збережених.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

/**
 * POST /api/forum/posts/:id/like
 * Додавання/видалення лайка.
 */
router.post('/posts/:id/like', authenticateToken, async (req, res) => {
    const postId = req.params.id;
    const userId = req.user.userId;

    const queryCheck = `SELECT * FROM post_likes WHERE user_id = $1 AND post_id = $2;`;
    const queryInsert = `INSERT INTO post_likes (user_id, post_id) VALUES ($1, $2);`;
    const queryDelete = `DELETE FROM post_likes WHERE user_id = $1 AND post_id = $2;`;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const checkResult = await client.query(queryCheck, [userId, postId]);
        let liked = false;

        if (checkResult.rows.length > 0) {
            await client.query(queryDelete, [userId, postId]);
            liked = false;
        } else {
            await client.query(queryInsert, [userId, postId]);
            liked = true;
        }

        await client.query(`
            UPDATE posts
            SET likes_count = (SELECT COUNT(*) FROM post_likes WHERE post_id = $1)
            WHERE post_id = $1;
        `, [postId]);

        await client.query('COMMIT');
        res.json({ message: liked ? 'Лайк додано.' : 'Лайк видалено.', liked: liked });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Помилка обробки лайка:', error);
        res.status(500).json({ error: 'Помилка сервера.' });
    } finally {
        client.release();
    }
});

module.exports = { router };