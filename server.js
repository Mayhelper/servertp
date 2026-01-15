const express = require('express');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ ДОБАВЛЕНО: Middleware для обработки CORS
app.use((req, res, next) => {
    // Разрешаем запросы с любого источника (можно заменить на конкретный)
    res.header('Access-Control-Allow-Origin', '*');
    // Разрешаем методы, которые мы используем
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    // Разрешаем необходимые заголовки
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    
    // Обрабатываем предварительный запрос OPTIONS
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    next();
});

// Ваша публичная ссылка на папку Яндекс.Диска
const PUBLIC_FOLDER_URL = 'https://disk.360.yandex.ru/d/ZtwhX-YtLvkxJw';
const YANDEX_API_BASE = 'https://cloud-api.yandex.net/v1/disk/public/resources/download';

// Вспомогательная функция для выполнения HTTP запросов
function makeRequest(url) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const lib = parsedUrl.protocol === 'https:' ? https : http;
        const req = lib.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({
                        ok: res.statusCode >= 200 && res.statusCode < 300,
                        status: res.statusCode,
                        json: () => Promise.resolve(JSON.parse(data))
                    });
                } catch(e) {
                    reject(e);
                }
            });
        });
        req.on('error', reject);
    });
}

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Прокси для Яндекс.Диска</title></head>
        <body>
            <h1>Сервер работает! ✅</h1>
            <p>CORS включен. Файлы доступны через:</p>
            <p><code>/download/имя_файла</code></p>
            <p>Пример: <a href="/download/report.xlsx">/download/report.xlsx</a></p>
        </body>
        </html>
    `);
});

// ✅ ОСНОВНОЙ ИСПРАВЛЕННЫЙ МАРШРУТ - теперь проксирует файл через себя
app.get('/download/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;
        const encodedPublicKey = encodeURIComponent(PUBLIC_FOLDER_URL);
        const apiUrl = `${YANDEX_API_BASE}?public_key=${encodedPublicKey}&path=/${filename}`;
        
        console.log(`Запрос к API Яндекс.Диска: ${apiUrl}`);
        
        const apiResponse = await makeRequest(apiUrl);
        const data = await apiResponse.json();
        
        if (!apiResponse.ok) {
            // ✅ Добавляем CORS заголовки и для ошибок
            res.header('Access-Control-Allow-Origin', '*');
            return res.status(apiResponse.status).json({ 
                error: 'Ошибка от Яндекс.Диска', 
                details: data 
            });
        }
        
        if (!data.href) {
            res.header('Access-Control-Allow-Origin', '*');
            return res.status(500).json({ error: 'Нет ссылки для скачивания' });
        }
        
        console.log('Перенаправление на:', data.href);
        
        // ✅ Проксируем файл через сервер - скачиваем его и отдаем клиенту
        // Это обходит CORS, так как файл теперь идет с того же домена
        const fileUrl = data.href;
        const parsedUrl = new URL(fileUrl);
        const lib = parsedUrl.protocol === 'https:' ? https : http;
        
        lib.get(fileUrl, (fileRes) => {
            // Копируем заголовки от Яндекс.Диска
            res.setHeader('Content-Type', fileRes.headers['content-type'] || 'application/octet-stream');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Access-Control-Allow-Origin', '*');
            
            // Потоковая передача файла
            fileRes.pipe(res);
        }).on('error', (error) => {
            console.error('Ошибка загрузки файла:', error);
            res.header('Access-Control-Allow-Origin', '*');
            res.status(500).json({ 
                error: 'Ошибка загрузки файла', 
                message: error.message 
            });
        });
        
    } catch(error) {
        console.error('Ошибка:', error);
        res.header('Access-Control-Allow-Origin', '*');
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
        
        res.header('Access-Control-Allow-Origin', '*');
        res.json({
            status: 'Сервер работает с CORS',
            serverUrl: 'https://servertp.onrender.com',
            testApiRequest: apiUrl,
            instructions: 'Используйте /download/имя_файла для скачивания'
        });
    } catch (error) {
        res.header('Access-Control-Allow-Origin', '*');
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`✅ Сервер запущен на порту ${PORT} с поддержкой CORS`);
    console.log(`📥 Пример запроса файла: /download/report.xlsx`);
});
