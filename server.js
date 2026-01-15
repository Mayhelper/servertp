const express = require('express');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Ваша публичная ссылка на папку
const PUBLIC_FOLDER_URL = 'https://disk.360.yandex.ru/d/ZtwhX-YtLvkxJw';

// Базовый URL API Яндекс.Диска
const YANDEX_API_BASE = 'https://cloud-api.yandex.net/v1/disk/public/resources/download';

// Главная страница с инструкцией
app.get('/', (req, res) => {
  res.send(`
    <h1>Сервер для скачивания файлов из Яндекс.Диска</h1>
    <p>Использование: <code>/download/имя_файла</code></p>
    <p>Пример: <a href="/download/report.xlsx">/download/report.xlsx</a></p>
    <p>Публичная папка: ${PUBLIC_FOLDER_URL}</p>
  `);
});

// Маршрут для скачивания файлов
app.get('/download/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    
    // Кодируем публичную ссылку
    const encodedPublicKey = encodeURIComponent(PUBLIC_FOLDER_URL);
    
    // Формируем URL для запроса к API Яндекс.Диска
    // Обратите внимание: path должен начинаться с /
    const apiUrl = `${YANDEX_API_BASE}?public_key=${encodedPublicKey}&path=/${filename}`;
    
    console.log(`Запрос к API Яндекс.Диска: ${apiUrl}`);
    
    // Делаем запрос к API
    const apiResponse = await fetch(apiUrl);
    const data = await apiResponse.json();
    
    // Проверяем ответ
    if (!apiResponse.ok) {
      console.error('Ошибка API Яндекс.Диска:', data);
      
      // Проверяем, есть ли файл в папке
      if (apiResponse.status === 404) {
        return res.status(404).json({ 
          error: 'Файл не найден',
          message: `Файл "${filename}" не найден в указанной папке`
        });
      }
      
      return res.status(apiResponse.status).json({ 
        error: 'Ошибка API Яндекс.Диска', 
        details: data 
      });
    }
    
    // Получаем временную ссылку для скачивания
    const downloadUrl = data.href;
    
    if (!downloadUrl) {
      return res.status(500).json({ 
        error: 'Не получена ссылка для скачивания от Яндекс.Диска' 
      });
    }
    
    console.log(`Перенаправление на: ${downloadUrl}`);
    
    // Перенаправляем на прямую ссылку для скачивания
    res.redirect(downloadUrl);
    
  } catch (error) {
    console.error('Внутренняя ошибка сервера:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера', 
      message: error.message 
    });
  }
});

// Маршрут для получения списка файлов (опционально)
app.get('/list', async (req, res) => {
  try {
    const encodedPublicKey = encodeURIComponent(PUBLIC_FOLDER_URL);
    const apiUrl = `https://cloud-api.yandex.net/v1/disk/public/resources?public_key=${encodedPublicKey}`;
    
    const apiResponse = await fetch(apiUrl);
    const data = await apiResponse.json();
    
    if (!apiResponse.ok) {
      return res.status(apiResponse.status).json({ 
        error: 'Ошибка при получении списка файлов', 
        details: data 
      });
    }
    
    // Форматируем ответ с списоком файлов
    const files = data._embedded.items
      .filter(item => item.type === 'file')
      .map(file => ({
        name: file.name,
        path: file.path,
        size: file.size,
        created: file.created,
        modified: file.modified
      }));
    
    res.json({
      folder: data.name,
      total: files.length,
      files: files
    });
    
  } catch (error) {
    console.error('Ошибка при получении списка файлов:', error);
    res.status(500).json({ 
      error: 'Ошибка при получении списка файлов', 
      message: error.message 
    });
  }
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
  console.log(`Откройте в браузере: http://localhost:${PORT}`);
  console.log(`Пример запроса файла: http://localhost:${PORT}/download/report.xlsx`);
});
