const express = require('express');
const router = express.Router();
const pool = require('../db.js');
const { authenticateToken } = require('auth.js');

/**
 * GET /api/forum/posts
 * Отримання списку постів з фільтрацією та сортуванням.
 */
router.get('/posts', async (req, res) => {
    const { search, category, sort } = req.query;
    let query = `
        SELECT
            p.post_id, p.title, p.content, p.category, p.created_at, p.likes_count,
            up.first_name, up.last_name, up.profile_image_url AS author_avatar,
            (SELECT COUNT(*) FROM comments WHERE post_id = p.post_id) AS comments_count
        FROM posts p
        JOIN user_profiles up ON p.author_id = up.user_id
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

    // Сортування
    if (sort === 'popular') {
        query += ` ORDER BY p.likes_count DESC, p.created_at DESC`;
    } else if (sort === 'unanswered') {
        query += ` ORDER BY comments_count ASC, p.created_at DESC`;
    } else {
        query += ` ORDER BY p.created_at DESC`; // Останні
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
            (SELECT COUNT(*) FROM comments WHERE post_id = p.post_id) AS comments_count
        FROM posts p
        WHERE p.author_id = $1
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
            up.first_name, up.last_name, usp.saved_date
        FROM user_saved_posts usp
        JOIN posts p ON usp.post_id = p.post_id
        JOIN user_profiles up ON p.author_id = up.user_id
        WHERE usp.user_id = $1
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
 * POST /api/forum/posts
 * Створення нового поста.
 */
router.post('/posts', authenticateToken, async (req, res) => {
    const { title, content, category } = req.body;
    const authorId = req.user.userId;

    if (!title || !content) {
        return res.status(400).json({ error: 'Необхідно вказати заголовок та контент.' });
    }

    const query = `
        INSERT INTO posts (author_id, title, content, category)
        VALUES ($1, $2, $3, $4)
        RETURNING post_id, created_at;
    `;

    try {
        const result = await pool.query(query, [authorId, title, content, category || 'Загальна']);
        res.status(201).json({
            message: 'Пост успішно створено.',
            postId: result.rows[0].post_id,
            created_at: result.rows[0].created_at
        });
    } catch (error) {
        console.error('Помилка створення поста:', error);
        res.status(500).json({ error: 'Помилка сервера.' });
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
            // Лайк існує -> видаляємо
            await client.query(queryDelete, [userId, postId]);
            liked = false;
        } else {
            // Лайка немає -> додаємо
            await client.query(queryInsert, [userId, postId]);
            liked = true;
        }

        // Оновлюємо лічильник likes_count у таблиці posts
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

module.exports = router;