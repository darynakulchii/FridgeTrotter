const express = require('express');
const router = express.Router();
const pool = require('../db.js');
const { authenticateToken } = require('auth.js');
const { Server } = require('socket.io');

/**
 * Функція для створення або отримання ID розмови (використовується Socket.IO та HTTP-маршрутами).
 */
const ensureConversationExists = async (userOneId, userTwoId) => {
    // Впорядковуємо ID для унікального ключа
    const user_one = Math.min(userOneId, userTwoId);
    const user_two = Math.max(userOneId, userTwoId);

    try {
        let result = await pool.query(`
            SELECT conversation_id FROM conversations WHERE user_one_id = $1 AND user_two_id = $2
        `, [user_one, user_two]);

        if (result.rows.length > 0) {
            return result.rows[0].conversation_id;
        } else {
            result = await pool.query(`
                INSERT INTO conversations (user_one_id, user_two_id) VALUES ($1, $2) RETURNING conversation_id
            `, [user_one, user_two]);
            return result.rows[0].conversation_id;
        }
    } catch (err) {
        console.error("Помилка створення/пошуку розмови:", err);
        throw new Error("Не вдалося створити/отримати розмову.");
    }
};

/**
 * Ініціалізує Socket.IO обробники.
 * @param {http.Server} httpServer - HTTP-сервер Express.
 * @returns {Server} Екземпляр Socket.IO Server.
 */
const initializeSocketIO = (httpServer) => {
    const io = new Server(httpServer, {
        cors: {
            origin: "*", // Дозволити всі джерела для тестування
            methods: ["GET", "POST"]
        }
    });

    io.on('connection', (socket) => {
        console.log(`👤 Користувач підключився (Socket ID: ${socket.id})`);

        // 1. Приєднує користувача до його особистої кімнати для сповіщень
        socket.on('join_user_room', (userId) => {
            if (userId) {
                const userRoom = `user_${userId}`;
                socket.join(userRoom);
                console.log(`Клієнт ${socket.id} приєднався до особистої кімнати ${userRoom}`);
            }
        });

        // 2. Приєднує користувача до кімнати конкретної розмови
        socket.on('join_conversation', (conversationId) => {
            const room = `convo_${conversationId}`;
            socket.join(room);
            console.log(`Клієнт ${socket.id} приєднався до кімнати ${room}`);
        });

        // 3. Обробка відправки повідомлення
        socket.on('sendMessage', async ({ senderId, receiverId, messageText }) => {

            if (!senderId || !receiverId || !messageText) return;

            let conversationId;
            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                // 3.1. Створення або отримання ID розмови
                conversationId = await ensureConversationExists(senderId, receiverId);
                const room = `convo_${conversationId}`;

                // 3.2. Зберегти повідомлення в базу даних (таблиця 'messages')
                const messageQuery = `
                    INSERT INTO messages (conversation_id, sender_id, content)
                    VALUES ($1, $2, $3)
                    RETURNING message_id, conversation_id, sender_id, content, sent_at;
                `;
                const result = await client.query(messageQuery, [conversationId, senderId, messageText]);
                await client.query('COMMIT');

                const newMessage = result.rows[0];

                // 3.3. Надіслати повідомлення всім у кімнаті чату
                io.to(room).emit('receive_message', newMessage);

                // TODO: (Сповіщення) Надіслати сповіщення отримувачу, якщо він не в кімнаті

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Помилка обробки повідомлення:', error);
                socket.emit('messageError', 'Не вдалося надіслати повідомлення.');
            } finally {
                client.release();
            }
        });

        socket.on('disconnect', () => {
            console.log(`📴 Користувач відключився (Socket ID: ${socket.id})`);
        });
    });

    return io;
};

module.exports = { initializeSocketIO, ensureConversationExists };

///

/**
 * GET /api/chat/conversations
 * Отримання списку розмов користувача.
 */
router.get('/conversations', authenticateToken, async (req, res) => {
    const userId = req.user.userId;

    const query = `
        SELECT
            c.conversation_id,
            CASE
                WHEN c.user_one_id = $1 THEN c.user_two_id
                ELSE c.user_one_id
            END AS partner_id,
            up.first_name AS partner_first_name,
            up.last_name AS partner_last_name,
            up.profile_image_url AS partner_avatar_url,
            (SELECT content FROM messages WHERE conversation_id = c.conversation_id ORDER BY sent_at DESC LIMIT 1) AS last_message,
            (SELECT sent_at FROM messages WHERE conversation_id = c.conversation_id ORDER BY sent_at DESC LIMIT 1) AS last_message_at
        FROM conversations c
        JOIN users u ON u.user_id = CASE WHEN c.user_one_id = $1 THEN c.user_two_id ELSE c.user_one_id END
        JOIN user_profiles up ON up.user_id = u.user_id
        WHERE c.user_one_id = $1 OR c.user_two_id = $1
        ORDER BY last_message_at DESC NULLS LAST;
    `;

    try {
        const result = await pool.query(query, [userId]);
        res.json({ conversations: result.rows });
    } catch (error) {
        console.error('Помилка отримання розмов:', error);
        res.status(500).json({ error: 'Помилка сервера.' });
    }
});

/**
 * GET /api/chat/conversations/:id/messages
 * Отримання історії повідомлень для конкретної розмови.
 */
router.get('/conversations/:id/messages', authenticateToken, async (req, res) => {
    const conversationId = req.params.id;
    const userId = req.user.userId;

    // 1. Перевірка, чи користувач є учасником розмови
    const checkQuery = `
        SELECT 1 FROM conversations
        WHERE conversation_id = $1 AND (user_one_id = $2 OR user_two_id = $2);
    `;
    const checkResult = await pool.query(checkQuery, [conversationId, userId]);

    if (checkResult.rows.length === 0) {
        return res.status(403).json({ error: 'Доступ заборонено. Ви не є учасником цієї розмови.' });
    }

    // 2. Отримання повідомлень
    const messagesQuery = `
        SELECT message_id, sender_id, content, sent_at
        FROM messages
        WHERE conversation_id = $1
        ORDER BY sent_at ASC;
    `;

    try {
        const result = await pool.query(messagesQuery, [conversationId]);
        res.json({ messages: result.rows });
    } catch (error) {
        console.error('Помилка отримання повідомлень:', error);
        res.status(500).json({ error: 'Помилка сервера.' });
    }
});

/**
 * POST /api/chat/messages
 * Надсилання нового повідомлення. Цей маршрут використовується ФРОНТЕНДОМ
 * як резервний або для логіки, що не потребує WebSocket.
 * Примітка: Логіка відправки через Socket.IO знаходиться в sockets/chat.js
 */
router.post('/messages', authenticateToken, async (req, res) => {
    const { receiver_id, content } = req.body;
    const sender_id = req.user.userId;

    if (!receiver_id || !content) {
        return res.status(400).json({ error: 'Необхідно вказати отримувача та контент повідомлення.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Створення/отримання розмови (використовуємо функцію з модуля chat.js)
        const conversationId = await ensureConversationExists(sender_id, receiver_id);

        const messageResult = await client.query(`
            INSERT INTO messages (conversation_id, sender_id, content)
            VALUES ($1, $2, $3)
            RETURNING message_id, conversation_id, sender_id, content, sent_at;
        `, [conversationId, sender_id, content]);

        await client.query('COMMIT');
        res.status(201).json(messageResult.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Помилка відправки повідомлення (HTTP):', err);
        res.status(500).json({ error: 'Помилка сервера при відправці повідомлення.' });
    } finally {
        client.release();
    }
});

module.exports = router;