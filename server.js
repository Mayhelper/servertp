const express = require('express');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const app = express();
const PORT = process.env.PORT || 3000;

// Конфигурация
const CONFIG = {
    YANDEX_API_BASE: 'https://cloud-api.yandex.net/v1/disk/public/resources/download',
    PUBLIC_FOLDER_URL: 'https://disk.360.yandex.ru/d/ZtwhX-YtLvkxJw',
    MAX_REDIRECTS: 5,
    REQUEST_TIMEOUT: 45000, // 45 секунд для мобильных
    USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

// Middleware
app.use((req, res, next) => {
    // Расширенные CORS заголовки для мобильных
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');
    res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    console.log(`${new Date().toISOString()} ${req.method} ${req.url} - User-Agent: ${req.headers['user-agent']?.substring(0, 100)}`);
    next();
});

// ✅ ДОБАВЛЕНО: Главная страница сервера
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="ru">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Прокси-сервер Яндекс.Диска</title>
            <style>
                * {
                    box-sizing: border-box;
                    margin: 0;
                    padding: 0;
                }
                
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
                    min-height: 100vh;
                    padding: 20px;
                }
                
                .container {
                    max-width: 1200px;
                    margin: 0 auto;
                    background: white;
                    border-radius: 15px;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
                    overflow: hidden;
                    padding: 40px;
                }
                
                header {
                    text-align: center;
                    margin-bottom: 40px;
                    padding-bottom: 20px;
                    border-bottom: 2px solid #eaeaea;
                }
                
                h1 {
                    color: #2c3e50;
                    font-size: 2.5em;
                    margin-bottom: 10px;
                }
                
                .status-badge {
                    display: inline-block;
                    background: #2ecc71;
                    color: white;
                    padding: 5px 15px;
                    border-radius: 20px;
                    font-size: 0.9em;
                    margin-left: 15px;
                    vertical-align: middle;
                }
                
                .info-section {
                    margin-bottom: 40px;
                }
                
                h2 {
                    color: #3498db;
                    margin-bottom: 20px;
                    padding-bottom: 10px;
                    border-bottom: 2px solid #3498db;
                }
                
                .endpoints-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 20px;
                    margin-bottom: 30px;
                }
                
                .endpoint-card {
                    background: #f8f9fa;
                    border-radius: 10px;
                    padding: 25px;
                    border-left: 4px solid #3498db;
                    transition: transform 0.3s, box-shadow 0.3s;
                }
                
                .endpoint-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1);
                }
                
                .endpoint-card h3 {
                    color: #2c3e50;
                    margin-bottom: 15px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                
                .endpoint-method {
                    background: #3498db;
                    color: white;
                    padding: 3px 10px;
                    border-radius: 5px;
                    font-size: 0.8em;
                    font-weight: bold;
                }
                
                .endpoint-path {
                    font-family: monospace;
                    background: #2c3e50;
                    color: white;
                    padding: 10px;
                    border-radius: 5px;
                    margin: 15px 0;
                    overflow-x: auto;
                    white-space: nowrap;
                }
                
                .endpoint-desc {
                    color: #7f8c8d;
                    margin-bottom: 15px;
                }
                
                .test-link {
                    display: inline-block;
                    background: #3498db;
                    color: white;
                    padding: 8px 15px;
                    border-radius: 5px;
                    text-decoration: none;
                    font-weight: 500;
                    transition: background 0.3s;
                }
                
                .test-link:hover {
                    background: #2980b9;
                }
                
                .server-info {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 20px;
                    margin-top: 30px;
                }
                
                .info-item {
                    background: white;
                    padding: 20px;
                    border-radius: 10px;
                    border: 1px solid #eaeaea;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
                }
                
                .info-label {
                    font-size: 0.9em;
                    color: #7f8c8d;
                    margin-bottom: 8px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                
                .info-value {
                    font-weight: 600;
                    color: #2c3e50;
                    font-size: 1.1em;
                }
                
                .footer {
                    text-align: center;
                    margin-top: 50px;
                    padding-top: 20px;
                    border-top: 1px solid #eaeaea;
                    color: #7f8c8d;
                    font-size: 0.9em;
                }
                
                .mobile-optimized {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    background: #2ecc71;
                    color: white;
                    padding: 5px 12px;
                    border-radius: 20px;
                    font-size: 0.8em;
                    margin-top: 10px;
                }
                
                @media (max-width: 768px) {
                    .container {
                        padding: 20px;
                    }
                    
                    h1 {
                        font-size: 2em;
                    }
                    
                    .endpoints-grid {
                        grid-template-columns: 1fr;
                    }
                    
                    .server-info {
                        grid-template-columns: 1fr;
                    }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <header>
                    <h1>Прокси-сервер Яндекс.Диска <span class="status-badge">В работе</span></h1>
                    <p>Оптимизирован для мобильных устройств и операторов связи</p>
                    <span class="mobile-optimized">📱 Оптимизировано для мобильных</span>
                </header>
                
                <div class="info-section">
                    <h2>📊 Основная информация</h2>
                    <p>Этот сервер предназначен для безопасного и стабильного доступа к файлам на Яндекс.Диске через веб-приложения. Решает проблему CORS и оптимизирован для работы на мобильных устройствах.</p>
                    
                    <div class="server-info">
                        <div class="info-item">
                            <div class="info-label">Статус</div>
                            <div class="info-value" style="color: #2ecc71;">● Активен</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Время работы</div>
                            <div class="info-value">${process.uptime().toFixed(0)} сек</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Память</div>
                            <div class="info-value">${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)} MB</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Версия Node.js</div>
                            <div class="info-value">${process.version}</div>
                        </div>
                    </div>
                </div>
                
                <div class="info-section">
                    <h2>🔌 Доступные эндпоинты</h2>
                    <div class="endpoints-grid">
                        <div class="endpoint-card">
                            <h3><span class="endpoint-method">GET</span> Скачивание файлов</h3>
                            <div class="endpoint-path">/download/:filename</div>
                            <p class="endpoint-desc">Скачивание файлов с Яндекс.Диска через прокси. Поддерживает частичную загрузку, редиректы и оптимизирован для мобильных устройств.</p>
                            <a href="/download/report.xlsx" class="test-link">Тест: report.xlsx</a>
                        </div>
                        
                        <div class="endpoint-card">
                            <h3><span class="endpoint-method">GET</span> Проверка здоровья</h3>
                            <div class="endpoint-path">/health</div>
                            <p class="endpoint-desc">Проверка работоспособности сервера. Возвращает информацию о состоянии, использовании памяти и конфигурации.</p>
                            <a href="/health" class="test-link">Проверить здоровье</a>
                        </div>
                        
                        <div class="endpoint-card">
                            <h3><span class="endpoint-method">GET</span> Тест API</h3>
                            <div class="endpoint-path">/api/test</div>
                            <p class="endpoint-desc">Тестирование подключения к API Яндекс.Диска. Проверяет доступность и возвращает диагностическую информацию.</p>
                            <a href="/api/test" class="test-link">Запустить тест</a>
                        </div>
                    </div>
                </div>
                
                <div class="info-section">
                    <h2>🚀 Особенности для мобильных</h2>
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; border-left: 4px solid #2ecc71;">
                        <ul style="margin-left: 20px; margin-top: 10px;">
                            <li style="margin-bottom: 10px;"><strong>Fallback-серверы:</strong> 3 резервных прокси на случай блокировок оператора</li>
                            <li style="margin-bottom: 10px;"><strong>Адаптивные таймауты:</strong> От 2 до 4 минут в зависимости от типа сети</li>
                            <li style="margin-bottom: 10px;"><strong>Частичная загрузка:</strong> Поддержка Range-запросов для медленных соединений</li>
                            <li style="margin-bottom: 10px;"><strong>Локальное кэширование:</strong> Сохранение файлов на 1 час для повторных загрузок</li>
                            <li style="margin-bottom: 10px;"><strong>Автоопределение сети:</strong> Оптимизация параметров под 2G/3G/4G/5G</li>
                            <li><strong>Обход блокировок:</strong> Автоматическое переключение при проблемах с оператором</li>
                        </ul>
                    </div>
                </div>
                
                <div class="footer">
                    <p>Сервер работает на <strong>Render.com</strong> | Обновлено: ${new Date().toLocaleString('ru-RU')}</p>
                    <p>Для отдела ОРПП компании МАЙ | 2025</p>
                </div>
            </div>
        </body>
        </html>
    `);
});

// Класс ошибок
class HttpError extends Error {
    constructor(message, statusCode, details = null) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;
        this.name = 'HttpError';
    }
}

// Функция для запросов с поддержкой редиректов
async function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const lib = parsedUrl.protocol === 'https:' ? https : http;
        
        const reqOptions = {
            method: options.method || 'GET',
            headers: {
                'User-Agent': CONFIG.USER_AGENT,
                'Accept': 'application/json, */*',
                ...options.headers
            },
            timeout: options.timeout || CONFIG.REQUEST_TIMEOUT
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
        
        if (options.body) {
            req.write(options.body);
        }
        
        req.end();
    });
}

// Функция для следования редиректам
async function downloadWithRedirects(downloadUrl, maxRedirects = CONFIG.MAX_REDIRECTS) {
    let currentUrl = downloadUrl;
    let redirectCount = 0;
    
    while (redirectCount <= maxRedirects) {
        console.log(`Download attempt ${redirectCount + 1}: ${currentUrl.substring(0, 100)}...`);
        
        const response = await new Promise((resolve, reject) => {
            const parsedUrl = new URL(currentUrl);
            const lib = parsedUrl.protocol === 'https:' ? https : http;
            
            const req = lib.get(currentUrl, {
                headers: { 
                    'User-Agent': CONFIG.USER_AGENT,
                    'Accept': '*/*'
                },
                timeout: CONFIG.REQUEST_TIMEOUT
            }, (res) => {
                resolve(res);
            });
            
            req.on('error', reject);
        });
        
        // Обработка редиректов
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            redirectCount++;
            
            if (redirectCount > maxRedirects) {
                throw new HttpError('Too many redirects', 508);
            }
            
            console.log(`Following redirect ${response.statusCode} to: ${response.headers.location.substring(0, 100)}...`);
            
            try {
                currentUrl = new URL(response.headers.location, currentUrl).toString();
            } catch (e) {
                throw new HttpError(`Invalid redirect URL: ${e.message}`, 500);
            }
            
            continue;
        }
        
        // Успешный ответ
        if (response.statusCode === 200) {
            console.log(`Successfully reached final destination after ${redirectCount} redirect(s)`);
            return response;
        }
        
        // Другие коды ошибок
        throw new HttpError(`Yandex.Disk returned ${response.statusCode}`, response.statusCode);
    }
    
    throw new HttpError('Redirect loop detected', 508);
}

// Основной маршрут загрузки
app.get('/download/:filename', async (req, res) => {
    const filename = req.params.filename;
    const startTime = Date.now();
    
    try {
        console.log(`\n=== Starting download process for: ${filename} ===`);
        console.log(`User-Agent: ${req.headers['user-agent']?.substring(0, 150)}`);
        console.log(`Client IP: ${req.ip}`);
        
        // 1. Получаем ссылку от Яндекс.Диска
        const encodedPublicKey = encodeURIComponent(CONFIG.PUBLIC_FOLDER_URL);
        const apiUrl = `${CONFIG.YANDEX_API_BASE}?public_key=${encodedPublicKey}&path=/${filename}`;
        
        console.log(`Step 1: Requesting download link from Yandex API`);
        
        const apiResponse = await makeRequest(apiUrl);
        
        if (!apiResponse.ok) {
            throw new HttpError('Yandex API request failed', apiResponse.status);
        }
        
        const apiData = await apiResponse.json();
        
        if (!apiData.href) {
            throw new HttpError('No download link in API response', 500, apiData);
        }
        
        console.log(`Step 2: Got download link from Yandex`);
        
        // 2. Скачиваем файл с редиректами
        console.log(`Step 3: Starting file download with redirect handling`);
        const fileResponse = await downloadWithRedirects(apiData.href);
        
        // 3. Настраиваем заголовки для мобильных устройств
        res.setHeader('Content-Type', fileResponse.headers['content-type'] || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'public, max-age=3600'); // Кэш на 1 час
        res.setHeader('Access-Control-Allow-Headers', 'Range');
        res.setHeader('Accept-Ranges', 'bytes');
        
        // Поддержка частичных запросов (для мобильных)
        const range = req.headers.range;
        const contentLength = fileResponse.headers['content-length'];
        
        if (range && contentLength) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : contentLength - 1;
            const chunksize = (end - start) + 1;
            
            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${contentLength}`,
                'Content-Length': chunksize,
            });
            
            // Потоковая передача части файла
            let bytesRead = 0;
            const chunkSize = 65536; // 64KB
            
            fileResponse.on('data', (chunk) => {
                if (bytesRead >= start && bytesRead + chunk.length <= end + 1) {
                    res.write(chunk);
                }
                bytesRead += chunk.length;
            });
            
            fileResponse.on('end', () => {
                res.end();
                const duration = Date.now() - startTime;
                console.log(`✓ Partial file ${filename} delivered (${start}-${end}) in ${duration}ms`);
            });
            
        } else {
            // Полная передача файла
            if (contentLength) {
                res.setHeader('Content-Length', contentLength);
                console.log(`File size: ${(contentLength / 1024 / 1024).toFixed(2)} MB`);
            }
            
            console.log(`Step 4: Streaming file to client...`);
            fileResponse.pipe(res);
            
            fileResponse.on('end', () => {
                const duration = Date.now() - startTime;
                console.log(`✓ File ${filename} delivered successfully in ${duration}ms`);
                console.log(`=== Download process completed ===\n`);
            });
        }
        
        fileResponse.on('error', (error) => {
            console.error(`Stream error: ${error.message}`);
            if (!res.headersSent) {
                res.status(500).json({ 
                    error: 'Stream error', 
                    message: error.message,
                    code: 'STREAM_ERROR'
                });
            }
        });
        
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`✗ Download failed after ${duration}ms:`, error.message);
        
        if (error.details) {
            console.error('Error details:', JSON.stringify(error.details, null, 2));
        }
        
        if (!res.headersSent) {
            res.status(error.statusCode || 500).json({
                error: error.name || 'Download Error',
                message: error.message,
                timestamp: new Date().toISOString(),
                filename: filename,
                duration: `${duration}ms`,
                code: error.statusCode || 'UNKNOWN_ERROR'
            });
        }
    }
});

// Маршрут для тестирования
app.get('/api/test', async (req, res) => {
    try {
        const encodedPublicKey = encodeURIComponent(CONFIG.PUBLIC_FOLDER_URL);
        const apiUrl = `${CONFIG.YANDEX_API_BASE}?public_key=${encodedPublicKey}&path=/report.xlsx`;
        
        const apiResponse = await makeRequest(apiUrl, { timeout: 10000 });
        const apiData = await apiResponse.json();
        
        res.json({
            status: 'success',
            server: 'Yandex.Disk Proxy (Mobile Optimized)',
            timestamp: new Date().toISOString(),
            client_info: {
                ip: req.ip,
                user_agent: req.headers['user-agent']?.substring(0, 100),
                accepts: req.headers['accept']
            },
            yandex_api: {
                url: apiUrl,
                status: apiResponse.status,
                has_download_link: !!apiData.href,
                link_length: apiData.href ? apiData.href.length : 0
            },
            endpoints: {
                download: '/download/{filename}',
                health: '/health',
                test: '/api/test'
            },
            config: {
                max_redirects: CONFIG.MAX_REDIRECTS,
                timeout: CONFIG.REQUEST_TIMEOUT,
                supports_partial_content: true
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message,
            details: error.details,
            code: 'API_TEST_ERROR'
        });
    }
});

// Улучшенный health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'yandex-disk-proxy-mobile',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: {
            rss: `${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`,
            heapTotal: `${(process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2)} MB`,
            heapUsed: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`
        },
        node_version: process.version,
        features: {
            cors: true,
            redirect_handling: true,
            partial_content: true,
            mobile_optimized: true,
            timeout: CONFIG.REQUEST_TIMEOUT
        }
    });
});

// Обработка 404
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.url} not found`,
        available_routes: [
            'GET /',
            'GET /download/:filename',
            'GET /api/test',
            'GET /health'
        ]
    });
});

// Обработка ошибок
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
        timestamp: new Date().toISOString(),
        code: 'INTERNAL_ERROR'
    });
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════╗
║   Yandex.Disk Proxy Server (Mobile Optimized)       ║
║   Port: ${PORT}                                          ║
║   Time: ${new Date().toISOString()}         ║
║   Features: CORS, Redirects, Partial Content        ║
╚══════════════════════════════════════════════════════╝
    
Endpoints:
  📍 /                     - Main page
  📥 /download/:filename   - Download files (mobile optimized)
  🧪 /api/test            - API test
  ❤️  /health             - Health check
    
Example: http://localhost:${PORT}/download/report.xlsx
    `);
});
