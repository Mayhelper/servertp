const express = require('express');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const app = express();
const PORT = process.env.PORT || 3000;

// Ваша публичная ссылка на папку Яндекс.Диска
const PUBLIC_FOLDER_URL = 'https://disk.360.yandex.ru/d/ZtwhX-YtLvkxJw';
const YANDEX_API_BASE = 'https://cloud-api.yandex.net/v1/disk/public/resources/download';

// Вспомогательная функция для выполнения HTTP запросов (замена fetch)
function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const lib = parsedUrl.protocol === 'https:' ? https : http;
        
        const req = lib.request(url, options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve({
                        ok: res.statusCode >= 200 && res.statusCode < 300,
                        status: res.statusCode,
                        json: () => Promise.resolve(jsonData),
                        text: () => Promise.resolve(data)
                    });
                } catch (e) {
                    reject(new Error(`Failed to parse JSON: ${e.message}`));
                }
            });
        });
        
        req.on('error', (err) => {
            reject(err);
        });
        
        if (options.headers) {
            Object.keys(options.headers).forEach(key => {
                req.setHeader(key, options.headers[key]);
            });
        }
        
        req.end();
    });
}

// Главная страница
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Прокси для Яндекс.Диска</title></head>
        <body>
            <h1>Сервер работает!</h1>
            <p>Для скачивания файла используйте: <code>/download/имя_файла</code></p>
            <p>Пример: <a href="/download/report.xlsx">/download/report.xlsx</a></p>
            <p>Проверка: <a href="/test">/test</a></p>
        </body>
        </html>
    `);
});

// Маршрут для скачивания файлов
app.get('/download/:filename', async (req, res) => {
    const filename = req.params.filename;
    
    try {
        console.log(`[${new Date().toISOString()}] Запрос файла: ${filename}`);
        
        // Формируем запрос к API Яндекс.Диска
        const encodedPublicKey = encodeURIComponent(PUBLIC_FOLDER_URL);
        const apiUrl = `${YANDEX_API_BASE}?public_key=${encodedPublicKey}&path=/${filename}`;
        
        console.log(`Запрос к API Яндекс.Диска: ${apiUrl}`);
        
        // Делаем запрос к API Яндекс.Диска с помощью нашей функции
        const apiResponse = await makeRequest(apiUrl);
        const data = await apiResponse.json();
        
        // Проверяем ответ API
        if (!apiResponse.ok) {
            console.error('Ошибка от API Яндекс.Диска:', data);
            
            if (apiResponse.status === 404) {
                return res.status(404).json({ 
                    error: 'Файл не найден',
                    message: `Файл "${filename}" не найден в указанной папке.`
                });
            }
            
            return res.status(apiResponse.status).json({ 
                error: 'Ошибка при обращении к Яндекс.Диску',
                details: data
            });
        }
        
        // Получаем прямую ссылку для скачивания
        const downloadUrl = data.href;
        
        if (!downloadUrl) {
            console.error('Не получена ссылка для скачивания:', data);
            return res.status(500).json({ 
                error: 'Ошибка сервера',
                message: 'Яндекс.Диск не вернул ссылку для скачивания.'
            });
        }
        
        console.log(`Перенаправляю на временную ссылку: ${downloadUrl}`);
        
        // Перенаправляем пользователя на прямую ссылку для скачивания
        res.redirect(downloadUrl);
        
    } catch (error) {
        console.error('Внутренняя ошибка сервера:', error);
        res.status(500).json({ 
            error: 'Внутренняя ошибка сервера',
            message: error.message
        });
    }
});

// Тестовый маршрут
app.get('/test', async (req, res) => {
    try {
        const encodedPublicKey = encodeURIComponent(PUBLIC_FOLDER_URL);
        const apiUrl = `${YANDEX_API_BASE}?public_key=${encodedPublicKey}&path=/report.xlsx`;
        
        res.json({
            status: 'Сервер работает',
            publicFolderUrl: PUBLIC_FOLDER_URL,
            testApiRequest: apiUrl,
            instructions: 'Используйте /download/имя_файла для скачивания',
            nodeVersion: process.version
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`✅ Сервер запущен на порту ${PORT}`);
    console.log(`🌐 Откройте в браузере: http://localhost:${PORT}`);
    console.log(`📥 Пример запроса файла: http://localhost:${PORT}/download/report.xlsx`);
    console.log(`🔧 Тестовая страница: http://localhost:${PORT}/test`);
});