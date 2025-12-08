const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../auth_middleware');

// GET /api/notifications
// Отримання списку сповіщень поточного користувача
router.get('/', authenticateToken, async (req, res) => {
    const userId = req.user.userId;

    const query = `
        SELECT * FROM notifications
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 50;
    `;

    try {
        const result = await pool.query(query, [userId]);

        // Підрахунок непрочитаних
        const unreadCountQuery = `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE`;
        const countResult = await pool.query(unreadCountQuery, [userId]);

        res.json({
            notifications: result.rows,
            unreadCount: parseInt(countResult.rows[0].count)
        });
    } catch (error) {
        console.error('Помилка отримання сповіщень:', error);
        res.status(500).json({ error: 'Помилка сервера.' });
    }
});

// PATCH /api/notifications/read
// Позначити всі сповіщення як прочитані
router.patch('/read', authenticateToken, async (req, res) => {
    const userId = req.user.userId;

    const query = `
        UPDATE notifications
        SET is_read = TRUE
        WHERE user_id = $1 AND is_read = FALSE;
    `;

    try {
        await pool.query(query, [userId]);
        res.json({ message: 'Сповіщення позначено як прочитані.' });
    } catch (error) {
        console.error('Помилка оновлення сповіщень:', error);
        res.status(500).json({ error: 'Помилка сервера.' });
    }
});

// Експортуємо router та допоміжну функцію для створення сповіщень (для використання в інших модулях)
const createNotification = async (io, userId, message, linkUrl = null) => {
    try {
        const query = `
            INSERT INTO notifications (user_id, message, link_url)
            VALUES ($1, $2, $3)
            RETURNING *;
        `;
        const result = await pool.query(query, [userId, message, linkUrl]);
        const newNotification = result.rows[0];

        // Відправка через Socket.IO в реальному часі
        if (io) {
            io.to(`user_${userId}`).emit('new_notification', newNotification);
        }

        return newNotification;
    } catch (error) {
        console.error('Помилка створення сповіщення:', error);
    }
};

module.exports = { router, createNotification };