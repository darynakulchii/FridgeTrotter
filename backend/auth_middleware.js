const jwt = require('jsonwebtoken');

// Секретний ключ для JWT. Краще зчитувати з process.env
const JWT_SECRET = process.env.env || 'my_super_secret_key_12345';

/**
 * MIDDLEWARE ДЛЯ АВТЕНТИФІКАЦІЇ (перевірка JWT)
 * Перевіряє наявність та валідність токена для захищених маршрутів.
 */
const authenticateToken = (req, res, next) => {
    // Очікуємо формат "Bearer TOKEN"
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        // 401 Unauthorized (Відсутній токен)
        return res.status(401).json({ error: 'Необхідна автентифікація: відсутній токен.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            // 403 Forbidden (Недійсний/протермінований токен)
            return res.status(403).json({ error: 'Недійсний токен.' });
        }
        req.user = user; // Зберігаємо дані користувача в об'єкті запиту
        next(); // Продовжуємо обробку маршруту
    });
};

module.exports = { authenticateToken, JWT_SECRET };