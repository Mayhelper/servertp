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
    REQUEST_TIMEOUT: 30000,
    USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
};

// Middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
});

// Вспомогательные функции
class HttpError extends Error {
    constructor(message, statusCode, details = null) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;
        this.name = 'HttpError';
    }
}

async function makeApiRequest(url) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const lib = parsedUrl.protocol === 'https:' ? https : http;
        
        const req = lib.get(url, {
            headers: { 'User-Agent': CONFIG.USER_AGENT },
            timeout: CONFIG.REQUEST_TIMEOUT
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const result = {
                        ok: res.statusCode >= 200 && res.statusCode < 300,
                        status: res.statusCode,
                        headers: res.headers,
                        json: () => Promise.resolve(JSON.parse(data))
                    };
                    resolve(result);
                } catch (e) {
                    reject(new HttpError(`Failed to parse response: ${e.message}`, 500));
                }
            });
        });
        
        req.on('error', (err) => {
            reject(new HttpError(`Request failed: ${err.message}`, 500));
        });
        
        req.on('timeout', () => {
            req.destroy();
            reject(new HttpError('Request timeout', 504));
        });
    });
}

async function downloadWithRedirects(downloadUrl, maxRedirects = CONFIG.MAX_REDIRECTS) {
    let currentUrl = downloadUrl;
    let redirectCount = 0;
    
    while (redirectCount <= maxRedirects) {
        console.log(`Download attempt ${redirectCount + 1}: ${currentUrl}`);
        
        const response = await new Promise((resolve, reject) => {
            const parsedUrl = new URL(currentUrl);
            const lib = parsedUrl.protocol === 'https:' ? https : http;
            
            const req = lib.get(currentUrl, {
                headers: { 'User-Agent': CONFIG.USER_AGENT },
                timeout: CONFIG.REQUEST_TIMEOUT,
                maxRedirects: 0 // Мы сами обрабатываем редиректы
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
            
            console.log(`Following redirect ${response.statusCode} to: ${response.headers.location}`);
            
            // Обновляем URL для следующего запроса
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

// Маршруты
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Yandex.Disk Proxy</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }
                code { background: #f4f4f4; padding: 2px 5px; border-radius: 3px; }
                .test-link { display: inline-block; margin: 10px 0; padding: 10px 15px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; }
            </style>
        </head>
        <body>
            <h1>📁 Yandex.Disk Proxy Server</h1>
            <p>Status: <strong style="color: green;">Operational ✓</strong></p>
            <p>Use the endpoint: <code>/download/:filename</code></p>
            <p>Example: <a class="test-link" href="/download/report.xlsx">Download report.xlsx</a></p>
            <p>Test: <a href="/api/test">API Test</a> | <a href="/health">Health Check</a></p>
            <hr>
            <p><small>Server time: ${new Date().toISOString()}</small></p>
        </body>
        </html>
    `);
});

app.get('/download/:filename', async (req, res) => {
    const filename = req.params.filename;
    const startTime = Date.now();
    
    try {
        console.log(`\n=== Starting download process for: ${filename} ===`);
        
        // 1. Получаем ссылку для скачивания от Яндекс.Диска
        const encodedPublicKey = encodeURIComponent(CONFIG.PUBLIC_FOLDER_URL);
        const apiUrl = `${CONFIG.YANDEX_API_BASE}?public_key=${encodedPublicKey}&path=/${filename}`;
        
        console.log(`Step 1: Requesting download link from Yandex API`);
        console.log(`API URL: ${apiUrl}`);
        
        const apiResponse = await makeApiRequest(apiUrl);
        
        if (!apiResponse.ok) {
            throw new HttpError('Yandex API request failed', apiResponse.status);
        }
        
        const apiData = await apiResponse.json();
        
        if (!apiData.href) {
            throw new HttpError('No download link in API response', 500, apiData);
        }
        
        console.log(`Step 2: Got download link from Yandex`);
        console.log(`Download URL (initial): ${apiData.href.substring(0, 100)}...`);
        
        // 2. Скачиваем файл с обработкой редиректов
        console.log(`Step 3: Starting file download with redirect handling`);
        const fileResponse = await downloadWithRedirects(apiData.href);
        
        // 3. Настраиваем заголовки ответа
        res.setHeader('Content-Type', fileResponse.headers['content-type'] || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        
        if (fileResponse.headers['content-length']) {
            res.setHeader('Content-Length', fileResponse.headers['content-length']);
            console.log(`File size: ${(fileResponse.headers['content-length'] / 1024 / 1024).toFixed(2)} MB`);
        }
        
        // 4. Потоковая передача файла
        console.log(`Step 4: Streaming file to client...`);
        fileResponse.pipe(res);
        
        fileResponse.on('end', () => {
            const duration = Date.now() - startTime;
            console.log(`✓ File ${filename} delivered successfully in ${duration}ms`);
            console.log(`=== Download process completed ===\n`);
        });
        
        fileResponse.on('error', (error) => {
            console.error(`Stream error: ${error.message}`);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Stream error', message: error.message });
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
                duration: `${duration}ms`
            });
        }
    }
});

app.get('/api/test', async (req, res) => {
    try {
        const encodedPublicKey = encodeURIComponent(CONFIG.PUBLIC_FOLDER_URL);
        const apiUrl = `${CONFIG.YANDEX_API_BASE}?public_key=${encodedPublicKey}&path=/report.xlsx`;
        
        const apiResponse = await makeApiRequest(apiUrl);
        const apiData = await apiResponse.json();
        
        res.json({
            status: 'success',
            server: 'Yandex.Disk Proxy',
            timestamp: new Date().toISOString(),
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
                timeout: CONFIG.REQUEST_TIMEOUT
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message,
            details: error.details
        });
    }
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'yandex-disk-proxy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        node_version: process.version
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
        timestamp: new Date().toISOString()
    });
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════╗
║   Yandex.Disk Proxy Server               ║
║   Port: ${PORT}                              ║
║   Time: ${new Date().toISOString()}   ║
╚══════════════════════════════════════════╝
    
Endpoints:
  📍 /                     - Main page
  📥 /download/:filename   - Download files
  🧪 /api/test            - API test
  ❤️  /health             - Health check
    
Example: http://localhost:${PORT}/download/report.xlsx
    `);
});
