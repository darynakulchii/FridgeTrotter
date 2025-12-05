const { Pool } = require('pg');

// 1. НАЛАШТУВАННЯ ПІДКЛЮЧЕННЯ ДО PostgreSQL
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'db', // 'db' для Docker, 'localhost' для локального запуску
    database: process.env.DB_DATABASE || 'fridgetrotter',
    password: process.env.DB_PASSWORD || 'mysecretpassword',
    port: 5432,
});

// Перевірка підключення до БД при старті
pool.query('SELECT NOW()')
    .then(res => console.log('✅ PostgreSQL підключено успішно, поточний час БД:', res.rows[0].now))
    .catch(err => console.error('❌ Помилка підключення PostgreSQL:', err));

module.exports = pool;