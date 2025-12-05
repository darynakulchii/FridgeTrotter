const http = require('http');
const { Server } = require('socket.io');
const express = require('express');
const cors = require('cors');

// ДОДАТКОВІ ЗАЛЕЖНОСТІ
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const streamifier = require('streamifier');
const cloudinary = require('cloudinary').v2;

// =================================================================
// 1. КОНФІГУРАЦІЯ ТА СЕРВЕР
// =================================================================
const app = express();
const httpServer = http.createServer(app);
const port = 3000;
const upload = multer(); // Налаштування multer для роботи з буфером (без збереження на диск)

// Секретний ключ для JWT. Краще зчитувати з process.env
const JWT_SECRET = process.env.JWT_SECRET || 'my_super_secret_key_12345';

// 2. НАЛАШТУВАННЯ ПІДКЛЮЧЕННЯ ДО PostgreSQL
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'db',
    database: process.env.DB_DATABASE || 'fridgetrotter',
    password: process.env.DB_PASSWORD || 'mysecretpassword',
    port: 5432,
});

// Перевірка підключення до БД при старті
pool.query('SELECT NOW()')
    .then(res => console.log('✅ PostgreSQL підключено успішно, поточний час БД:', res.rows[0].now))
    .catch(err => console.error('❌ Помилка підключення PostgreSQL:', err));

// 3. КОНФІГУРАЦІЯ CLOUDINARY
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
});

// Допоміжна функція для завантаження буфера в Cloudinary
const uploadToCloudinary = (fileBuffer) => {
    return new Promise((resolve, reject) => {
        let stream = cloudinary.uploader.upload_stream(
            { folder: 'fridgetrotter/avatars', tags: 'avatar' }, // Використовуємо окрему папку для аватарів
            (error, result) => {
                if (result) {
                    resolve(result);
                } else {
                    reject(error);
                }
            }
        );
        streamifier.createReadStream(fileBuffer).pipe(stream);
    });
};

// =================================================================
// 4. MIDDLEWARE ТА АВТЕНТИФІКАЦІЯ
// =================================================================

app.use(cors());
app.use(express.json());

// MIDDLEWARE ДЛЯ АВТЕНТИФІКАЦІЇ (перевірка JWT)
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        return res.status(401).json({ error: 'Необхідна автентифікація: відсутній токен.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Недійсний токен.' });
        }
        req.user = user;
        next();
    });
};

// =================================================================
// 5. SOCKET.IO (ЧАТ В РЕАЛЬНОМУ ЧАСІ)
// =================================================================

// Функція для створення або отримання ID розмови
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

const io = new Server(httpServer, {
    cors: {
        origin: "*",
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

            // TODO: (Сповіщення) Надіслати сповіщення отримувачу, якщо він не в кімнаті (НЕ РЕАЛІЗОВАНО)

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

// =================================================================
// 6. API МАРШРУТИ (ROUTES)
// =================================================================

// Маршрут для перевірки стану
app.get('/api/status', (req, res) => {
    res.json({ message: 'FridgeTrotter Backend працює!', db_status: 'Connected', version: '1.0' });
});

// --- АВТЕНТИФІКАЦІЯ ---

// POST /api/register
app.post('/api/register', async (req, res) => {
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

        // 3. Вставка в таблицю user_profiles (для обов'язкових даних)
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

// POST /api/login
app.post('/api/login', async (req, res) => {
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

// --- ПРОФІЛЬ КОРИСТУВАЧА ---

// GET /api/user/profile (Приватний маршрут)
app.get('/api/user/profile', authenticateToken, async (req, res) => {
    const userId = req.user.userId;

    const query = `
        SELECT
            u.user_id, u.email, u.registration_date, u.is_agent,
            u.is_email_public, u.is_location_public,
            up.first_name, up.last_name, up.location, up.date_of_birth, up.bio, up.travel_interests, up.profile_image_url,
            us.countries_visited, us.cities_visited, us.followers_count,
            fs.fridge_color, fs.is_public AS fridge_is_public, fs.allow_comments AS fridge_allow_comments
        FROM users u
                 LEFT JOIN user_profiles up ON u.user_id = up.user_id
                 LEFT JOIN user_stats us ON u.user_id = us.user_id
                 LEFT JOIN fridge_settings fs ON u.user_id = fs.user_id
        WHERE u.user_id = $1;
    `;

    try {
        const result = await pool.query(query, [userId]);

        if (result.rows.length === 0) {
            // Це не повинно траплятися, якщо реєстрація створює профіль
            return res.status(404).json({ error: 'Профіль користувача не знайдено.' });
        }

        // Повертаємо об'єднаний об'єкт профілю
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Помилка отримання профілю:', error);
        res.status(500).json({ error: 'Помилка сервера при завантаженні профілю.' });
    }
});

// GET /api/user/:id/public (Отримання публічного профілю іншого користувача)
app.get('/api/user/:id/public', async (req, res) => {
    const targetUserId = req.params.id;
    const currentUserId = req.user ? req.user.userId : null; // Перевірка, чи авторизований поточний користувач

    // Отримати дані профілю, статистику та налаштування конфіденційності
    const query = `
        SELECT
            u.user_id, 
            CASE WHEN u.is_email_public OR $2 = u.user_id THEN u.email ELSE NULL END AS email,
            CASE WHEN u.is_location_public OR $2 = u.user_id THEN up.location ELSE NULL END AS location,
            up.first_name, up.last_name, up.date_of_birth, up.bio, up.travel_interests, up.profile_image_url,
            us.countries_visited, us.cities_visited, us.followers_count,
            fs.fridge_color, fs.is_public AS fridge_is_public, fs.allow_comments AS fridge_allow_comments
        FROM users u
        LEFT JOIN user_profiles up ON u.user_id = up.user_id
        LEFT JOIN user_stats us ON u.user_id = us.user_id
        LEFT JOIN fridge_settings fs ON u.user_id = fs.user_id
        WHERE u.user_id = $1;
    `;

    try {
        const result = await pool.query(query, [targetUserId, currentUserId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Профіль користувача не знайдено.' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Помилка отримання публічного профілю:', error);
        res.status(500).json({ error: 'Помилка сервера.' });
    }
});

// PUT /api/user/profile (Оновлення даних профілю)
app.put('/api/user/profile', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const {
        firstName, lastName, location, dateOfBirth, bio, travelInterests,
        isEmailPublic, isLocationPublic,
        fridgeColor, fridgeIsPublic, fridgeAllowComments // Додані поля холодильника
    } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Оновлення таблиці user_profiles
        const profileUpdateQuery = `
            UPDATE user_profiles
            SET
                first_name = $1,
                last_name = $2,
                location = $3,
                date_of_birth = $4,
                bio = $5,
                travel_interests = $6
            WHERE user_id = $7;
        `;
        await client.query(profileUpdateQuery, [
            firstName, lastName, location, dateOfBirth, bio, travelInterests, userId
        ]);

        // 2. Оновлення таблиці users (для конфіденційності email/location)
        const userUpdateQuery = `
            UPDATE users
            SET
                is_email_public = $1,
                is_location_public = $2
            WHERE user_id = $3;
        `;
        await client.query(userUpdateQuery, [isEmailPublic, isLocationPublic, userId]);

        // 3. Оновлення fridge_settings
        const fridgeUpdateQuery = `
            UPDATE fridge_settings
            SET 
                fridge_color = $1,
                is_public = $2,
                allow_comments = $3
            WHERE user_id = $4;
        `;
        await client.query(fridgeUpdateQuery, [fridgeColor, fridgeIsPublic, fridgeAllowComments, userId]);


        await client.query('COMMIT');
        res.json({ message: 'Дані профілю та налаштування холодильника успішно оновлено.' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Помилка оновлення профілю:', error);
        res.status(500).json({ error: 'Помилка сервера при оновленні профілю.' });
    } finally {
        client.release();
    }
});


// POST /api/user/avatar (Завантаження файлу)
app.post('/api/user/avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
    const userId = req.user.userId;

    if (!req.file) {
        return res.status(400).json({ error: 'Файл для завантаження не надано.' });
    }

    try {
        // 1. Завантаження в Cloudinary
        const result = await uploadToCloudinary(req.file.buffer);
        const newAvatarUrl = result.secure_url;

        // 2. Оновлення URL в таблиці user_profiles
        const updateQuery = `
            UPDATE user_profiles
            SET profile_image_url = $1
            WHERE user_id = $2
            RETURNING profile_image_url;
        `;
        const updateResult = await pool.query(updateQuery, [newAvatarUrl, userId]);

        if (updateResult.rows.length === 0) {
            // Якщо user_profiles не існує, це свідчить про проблему в процесі реєстрації.
            throw new Error('Неможливо оновити аватар. Відсутній запис профілю.');
        }

        res.json({
            message: 'Аватар успішно оновлено.',
            url: updateResult.rows[0].profile_image_url
        });

    } catch (error) {
        console.error('Помилка обробки аватара:', error.message || error);
        const status = error.http_code || 500;
        res.status(status).json({ error: 'Помилка сервера під час завантаження або оновлення аватара.' });
    }
});

// --- ТУРИ ТА АГЕНЦІЇ ---

// GET /api/agencies (Отримання рейтингу агенцій)
app.get('/api/agencies', async (req, res) => {
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


// GET /api/tours (З пошуком та фільтрацією)
app.get('/api/tours', async (req, res) => {
    const { search, category, sort } = req.query;
    let query = `
        SELECT t.*, a.name AS agency_name, tc.name_ukr AS category_name
        FROM tours t
        JOIN agencies a ON t.agency_id = a.agency_id
        JOIN tour_categories tc ON t.category_id = tc.category_id
        WHERE 1 = 1
    `;
    const queryParams = [];
    let paramIndex = 1;

    // Фільтрація за пошуком
    if (search) {
        query += ` AND (t.title ILIKE $${paramIndex} OR t.description ILIKE $${paramIndex} OR t.location ILIKE $${paramIndex})`;
        queryParams.push(`%${search}%`);
        paramIndex++;
    }

    // Фільтрація за категорією
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
        // TODO: Додати поле популярності до таблиці tours
        query += ` ORDER BY t.rating DESC`; // Заглушка
    } else {
        query += ` ORDER BY t.tour_id DESC`; // Нові спочатку
    }

    try {
        const result = await pool.query(query, queryParams);
        res.json({ tours: result.rows });
    } catch (error) {
        console.error('Помилка отримання турів:', error);
        res.status(500).json({ error: 'Помилка сервера.' });
    }
});

// GET /api/tours/:id (Деталі туру)
app.get('/api/tours/:id', async (req, res) => {
    const tourId = req.params.id;
    const query = `
        SELECT t.*, a.name AS agency_name, tc.name_ukr AS category_name
        FROM tours t
        JOIN agencies a ON t.agency_id = a.agency_id
        JOIN tour_categories tc ON t.category_id = tc.category_id
        WHERE t.tour_id = $1;
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

// GET /api/tours/saved (Отримання збережених турів)
app.get('/api/tours/saved', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const query = `
        SELECT t.*, a.name AS agency_name, tc.name_ukr AS category_name, ust.saved_date
        FROM user_saved_tours ust
        JOIN tours t ON ust.tour_id = t.tour_id
        JOIN agencies a ON t.agency_id = a.agency_id
        JOIN tour_categories tc ON t.category_id = tc.category_id
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


// POST /api/tours/save (Збереження туру користувачем)
app.post('/api/tours/save', authenticateToken, async (req, res) => {
    const { tourId } = req.body;
    const userId = req.user.userId;

    if (!tourId) {
        return res.status(400).json({ error: 'Необхідно вказати ID туру.' });
    }

    const queryCheck = `SELECT * FROM user_saved_tours WHERE user_id = $1 AND tour_id = $2;`;
    const queryInsert = `INSERT INTO user_saved_tours (user_id, tour_id) VALUES ($1, $2);`;
    const queryDelete = `DELETE FROM user_saved_tours WHERE user_id = $1 AND tour_id = $2;`;

    try {
        const checkResult = await pool.query(queryCheck, [userId, tourId]);

        if (checkResult.rows.length > 0) {
            // Тур вже збережено, видаляємо
            await pool.query(queryDelete, [userId, tourId]);
            res.json({ message: 'Тур видалено зі збережених.', saved: false });
        } else {
            // Тур не збережено, додаємо
            await pool.query(queryInsert, [userId, tourId]);
            res.json({ message: 'Тур збережено.', saved: true });
        }
    } catch (error) {
        console.error('Помилка збереження туру:', error);
        res.status(500).json({ error: 'Помилка сервера.' });
    }
});


// --- ФОРУМ ТА ПОСТИ ---

// GET /api/posts
app.get('/api/posts', async (req, res) => {
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

// GET /api/posts/my (Отримання моїх постів)
app.get('/api/posts/my', authenticateToken, async (req, res) => {
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

// GET /api/posts/saved (Отримання збережених постів)
app.get('/api/posts/saved', authenticateToken, async (req, res) => {
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


// POST /api/posts (Створення нового поста)
app.post('/api/posts', authenticateToken, async (req, res) => {
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

// POST /api/posts/:id/like (Додавання/видалення лайка)
app.post('/api/posts/:id/like', authenticateToken, async (req, res) => {
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


// --- ХОЛОДИЛЬНИК (FRIDGE) ---

// GET /api/fridge/magnets (Отримання всіх доступних магнітів)
app.get('/api/fridge/magnets/available', authenticateToken, async (req, res) => {
    // Тут ми повертаємо весь словник доступних магнітів (таблиця MAGNETS)
    const query = `SELECT * FROM magnets ORDER BY country, city;`;
    try {
        const result = await pool.query(query);
        res.json({ magnets: result.rows });
    } catch (error) {
        console.error('Помилка отримання доступних магнітів:', error);
        res.status(500).json({ error: 'Помилка сервера.' });
    }
});

// GET /api/fridge/:userId/layout (Отримання розміщення магнітів користувача)
app.get('/api/fridge/:userId/layout', async (req, res) => {
    const targetUserId = req.params.userId;

    // TODO: Додати перевірку, чи холодильник користувача public
    // Якщо користувач не авторизований, або холодильник приватний, повернути 403/404

    const query = `
        SELECT
            ufm.user_fridge_magnet_id, ufm.x_position, ufm.y_position,
            m.magnet_id, m.country, m.city, m.icon_class, m.color_group
        FROM user_fridge_magnets ufm
        JOIN magnets m ON ufm.magnet_id = m.magnet_id
        WHERE ufm.user_id = $1;
    `;

    try {
        const result = await pool.query(query, [targetUserId]);
        res.json({ magnets: result.rows });
    } catch (error) {
        console.error('Помилка отримання магнітів холодильника:', error);
        res.status(500).json({ error: 'Помилка сервера.' });
    }
});

// POST /api/fridge/save (Збереження позицій магнітів)
app.post('/api/fridge/save', authenticateToken, async (req, res) => {
    const { magnetsData } = req.body; // Очікуємо масив [{ magnet_id, x_position, y_position }, ...]
    const userId = req.user.userId;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Очистити старі записи
        await client.query('DELETE FROM user_fridge_magnets WHERE user_id = $1;', [userId]);

        // 2. Вставити нові записи
        if (magnetsData && magnetsData.length > 0) {
            const values = magnetsData.map(magnet =>
                `(${userId}, ${magnet.magnet_id}, ${magnet.x_position}, ${magnet.y_position})`
            ).join(',');

            const insertQuery = `
                INSERT INTO user_fridge_magnets (user_id, magnet_id, x_position, y_position)
                VALUES ${values};
            `;
            await client.query(insertQuery);
        }

        await client.query('COMMIT');
        res.json({ message: 'Розміщення магнітів успішно збережено.', count: magnetsData ? magnetsData.length : 0 });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Помилка збереження магнітів:', error);
        res.status(500).json({ error: 'Помилка сервера.' });
    } finally {
        client.release();
    }
});

// --- ПОШУК КОМПАНІЇ ---

// GET /api/companion-ads (Отримання оголошень про компанію)
app.get('/api/companion-ads', async (req, res) => {
    const { search, type, sort } = req.query;
    let query = `
        SELECT 
            ca.ad_id, ca.destination_country, ca.start_date, ca.end_date, ca.min_group_size, ca.max_group_size, ca.description, ca.created_at,
            up.first_name, up.last_name, up.profile_image_url AS author_avatar,
            EXTRACT(YEAR FROM age(up.date_of_birth)) AS author_age,
            (SELECT array_agg(t.tag_name) FROM companion_ad_tags cat JOIN tags t ON cat.tag_id = t.tag_id WHERE cat.ad_id = ca.ad_id) AS tags
        FROM companion_ads ca
        JOIN user_profiles up ON ca.user_id = up.user_id
        WHERE 1 = 1
    `;
    const queryParams = [];
    let paramIndex = 1;

    // Фільтрація за пошуком (країна/місто/опис)
    if (search) {
        query += ` AND (ca.destination_country ILIKE $${paramIndex} OR ca.description ILIKE $${paramIndex})`;
        queryParams.push(`%${search}%`);
        paramIndex++;
    }

    // Фільтрація за типом (тегами)
    if (type) {
        // TODO: Додати логіку фільтрації за тегами (JOIN tags і перевірка наявності тега)
    }

    // Сортування
    if (sort === 'nearest_date') {
        query += ` ORDER BY ca.start_date ASC`;
    } else if (sort === 'budget_asc') {
        // TODO: Сортування за бюджетом (потрібно змінити схему тегів, щоб зберігати числове значення)
        query += ` ORDER BY ca.created_at DESC`; // Заглушка
    } else {
        query += ` ORDER BY ca.created_at DESC`; // Нові спочатку
    }

    try {
        const result = await pool.query(query, queryParams);
        res.json({ ads: result.rows });
    } catch (error) {
        console.error('Помилка отримання оголошень компанії:', error);
        res.status(500).json({ error: 'Помилка сервера.' });
    }
});

// POST /api/companion-ads (Створення оголошення про компанію)
app.post('/api/companion-ads', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const {
        destination_country, start_date, end_date,
        min_group_size, max_group_size, description,
        tags
    } = req.body;

    if (!destination_country || !start_date || !end_date || !description) {
        return res.status(400).json({ error: 'Необхідно заповнити всі обов\'язкові поля.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Вставка основного оголошення
        const adQuery = `
            INSERT INTO companion_ads (user_id, destination_country, start_date, end_date, min_group_size, max_group_size, description)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING ad_id;
        `;
        const adResult = await client.query(adQuery, [
            userId, destination_country, start_date, end_date,
            min_group_size || 1, max_group_size, description
        ]);
        const adId = adResult.rows[0].ad_id;

        // 2. Вставка тегів
        if (tags && tags.length > 0) {
            for (const tag of tags) {
                // Вставка тега у словник, якщо він ще не існує (ON CONFLICT DO NOTHING)
                await client.query(`
                    INSERT INTO tags (tag_name) VALUES ($1) ON CONFLICT (tag_name) DO NOTHING;
                `, [tag]);

                // Зв'язок тега з оголошенням
                const tagIdResult = await client.query(`
                    SELECT tag_id FROM tags WHERE tag_name = $1;
                `, [tag]);
                const tagId = tagIdResult.rows[0].tag_id;

                await client.query(`
                    INSERT INTO companion_ad_tags (ad_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;
                `, [adId, tagId]);
            }
        }

        await client.query('COMMIT');
        res.status(201).json({ message: 'Оголошення успішно створено!', adId: adId });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Помилка створення оголошення про компанію:', error);
        res.status(500).json({ error: 'Помилка сервера.' });
    } finally {
        client.release();
    }
});


// --- ЧАТ ---

// GET /api/conversations (Список розмов)
app.get('/api/conversations', authenticateToken, async (req, res) => {
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

// GET /api/conversations/:id/messages (Історія повідомлень)
app.get('/api/conversations/:id/messages', authenticateToken, async (req, res) => {
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


// =================================================================
// 7. ЗАПУСК СЕРВЕРА
// =================================================================
httpServer.listen(port, () => {
    console.log(`✅ Сервер бекенду (з Socket.io) запущено на http://localhost:${port}`);
    console.log('Готовий приймати запити від фронтенду.');
});