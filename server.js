const express = require('express');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const stream = require('stream');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware для CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    next();
});

const PUBLIC_FOLDER_URL = 'https://disk.360.yandex.ru/d/ZtwhX-YtLvkxJw';
const YANDEX_API_BASE = 'https://cloud-api.yandex.net/v1/disk/public/resources/download';

// Вспомогательная функция для HTTP запросов с улучшенной обработкой
function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const lib = parsedUrl.protocol === 'https:' ? https : http;
        
        const reqOptions = {
            method: options.method || 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                ...options.headers
            },
            timeout: 30000 // 30 секунд таймаут
        };
        
        const req = lib.request(url, reqOptions, (res) => {
            const chunks = [];
            
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
                const data = Buffer.concat(chunks);
                try {
                    const text = data.toString();
                    resolve({
                        ok: res.statusCode >= 200 && res.statusCode < 300,
                        status: res.statusCode,
                        headers: res.headers,
                        text: () => Promise.resolve(text),
                        json: () => Promise.resolve(JSON.parse(text))
                    });
                } catch(e) {
                    reject(e);
                }
            });
        });
        
        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        
        req.end();
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
            <p>Или тест: <a href="/test-download/report.xlsx">/test-download/report.xlsx</a> (прямая загрузка)</p>
        </body>
        </html>
    `);
});

// Основной маршрут - проксирует файл
app.get('/download/:filename', async (req, res) => {
    const filename = req.params.filename;
    console.log(`Запрос файла: ${filename}`);
    
    try {
        const encodedPublicKey = encodeURIComponent(PUBLIC_FOLDER_URL);
        const apiUrl = `${YANDEX_API_BASE}?public_key=${encodedPublicKey}&path=/${filename}`;
        
        console.log(`Запрос к API Яндекс.Диска: ${apiUrl}`);
        
        // Получаем ссылку для скачивания
        const apiResponse = await makeRequest(apiUrl);
        const data = await apiResponse.json();
        
        if (!apiResponse.ok) {
            console.error('Ошибка API Яндекс.Диска:', data);
            return res.status(apiResponse.status).json({ 
                error: 'Ошибка от Яндекс.Диска', 
                details: data 
            });
        }
        
        if (!data.href) {
            console.error('Нет ссылки для скачивания в ответе:', data);
            return res.status(500).json({ 
                error: 'Нет ссылки для скачивания в ответе API',
                response: data
            });
        }
        
        console.log('Получена ссылка для скачивания:', data.href);
        
        // Проксируем файл
        const fileUrl = data.href;
        const parsedUrl = new URL(fileUrl);
        const lib = parsedUrl.protocol === 'https:' ? https : http;
        
        // Устанавливаем заголовки для скачивания
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'no-cache');
        
        // Стримим файл
        lib.get(fileUrl, (fileRes) => {
            // Проверяем успешность ответа
            if (fileRes.statusCode !== 200) {
                console.error(`Ошибка загрузки файла: ${fileRes.statusCode}`);
                return res.status(fileRes.statusCode).json({
                    error: 'Ошибка при загрузке файла с Яндекс.Диска',
                    status: fileRes.statusCode
                });
            }
            
            // Копируем заголовки контента
            const contentType = fileRes.headers['content-type'];
            const contentLength = fileRes.headers['content-length'];
            
            if (contentType) {
                res.setHeader('Content-Type', contentType);
            }
            
            if (contentLength) {
                res.setHeader('Content-Length', contentLength);
                console.log(`Размер файла: ${contentLength} байт`);
            }
            
            console.log(`Начинаем передачу файла: ${filename}`);
            
            // Стримим данные
            fileRes.pipe(res);
            
            fileRes.on('end', () => {
                console.log(`Файл ${filename} успешно отправлен`);
            });
            
        }).on('error', (error) => {
            console.error('Ошибка подключения к Яндекс.Диску:', error.message);
            res.status(500).json({ 
                error: 'Ошибка подключения к Яндекс.Диску', 
                message: error.message 
            });
        });
        
    } catch(error) {
        console.error('Критическая ошибка:', error);
        res.status(500).json({ 
            error: 'Внутренняя ошибка сервера', 
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Альтернативный маршрут с прямой загрузкой (тест)
app.get('/test-download/:filename', async (req, res) => {
    const filename = req.params.filename;
    
    try {
        const encodedPublicKey = encodeURIComponent(PUBLIC_FOLDER_URL);
        const apiUrl = `${YANDEX_API_BASE}?public_key=${encodedPublicKey}&path=/${filename}`;
        
        const apiResponse = await makeRequest(apiUrl);
        const data = await apiResponse.json();
        
        if (!data.href) {
            return res.redirect('/');
        }
        
        // Перенаправляем напрямую на Яндекс.Диск
        res.redirect(data.href);
        
    } catch(error) {
        res.status(500).send('Ошибка: ' + error.message);
    }
});

// Маршрут для тестирования
app.get('/test', async (req, res) => {
    try {
        const encodedPublicKey = encodeURIComponent(PUBLIC_FOLDER_URL);
        const apiUrl = `${YANDEX_API_BASE}?public_key=${encodedPublicKey}&path=/report.xlsx`;
        
        const apiResponse = await makeRequest(apiUrl);
        const data = await apiResponse.json();
        
        res.json({
            status: 'Сервер работает',
            testApiUrl: apiUrl,
            apiResponse: data,
            downloadLink: `${req.protocol}://${req.get('host')}/download/report.xlsx`,
            directDownloadLink: `${req.protocol}://${req.get('host')}/test-download/report.xlsx`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Маршрут для проверки здоровья сервера
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        server: 'Render'
    });
});

app.listen(PORT, () => {
    console.log(`✅ Сервер запущен на порту ${PORT}`);
    console.log(`📥 Основной маршрут: /download/{filename}`);
    console.log(`🔗 Тестовый маршрут: /test-download/{filename}`);
});
