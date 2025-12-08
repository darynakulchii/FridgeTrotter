// js/api-config.js
export const API_URL = 'http://localhost:3000/api';

// Функція для отримання заголовків (включаючи Токен, якщо він є)
export function getHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
}