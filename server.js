const fs = require('fs');
const path = require('path');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const textFilePath = 'text.txt';

// Обработка статических файлов
app.use(express.static(path.join(__dirname, 'public')));

// Маршрут для загрузки списка файлов
app.get('/files', (req, res) => {
    fs.readdir('.', (err, files) => {
        if (err) {
            return res.status(500).send('Ошибка при загрузке списка файлов');
        }
        res.json(files.filter(file => file.endsWith('.txt')));
    });
});

// Маршрут для скачивания файла
app.get('/download/:filename', (req, res) => {
    const filename = req.params.filename;
    res.download(filename, (err) => {
        if (err) {
            console.error(`Ошибка скачивания файла ${filename}:`, err);
            res.status(500).send('Ошибка при скачивании файла');
        }
    });
});

// Слушаем подключение клиентов
io.on('connection', (socket) => {
    console.log('Новое подключение');

    // Загрузка текущего текста
    fs.readFile(textFilePath, 'utf8', (err, data) => {
        if (err) {
            socket.emit('log', 'Ошибка чтения файла');
            return;
        }
        socket.emit('load text', data);
    });

    // Обработка отправки текста
    socket.on('send text', (text) => {
        fs.writeFile(textFilePath, text, 'utf8', (err) => {
            if (err) {
                socket.emit('log', 'Ошибка записи в файл');
                return;
            }
            io.emit('new text', text); // Отправляем новый текст всем подключенным клиентам
            socket.emit('log', 'Текст успешно сохранен');
        });
    });

    // Обработка копирования текста в новый файл
    socket.on('copy text', (newFileName) => {
        // Добавляем расширение .txt, если его нет
        if (!newFileName.endsWith('.txt')) {
            newFileName += '.txt';
        }

        fs.readFile(textFilePath, 'utf8', (err, data) => {
            if (err) {
                socket.emit('log', 'Ошибка чтения исходного файла');
                return;
            }
            fs.writeFile(newFileName, data, 'utf8', (err) => {
                if (err) {
                    socket.emit('log', 'Ошибка записи в новый файл');
                    return;
                }
                socket.emit('log', `Файл "${newFileName}" успешно создан`);
                loadFileList();
            });
        });
    });

    // Очистка текста
    socket.on('clear text', () => {
        fs.writeFile(textFilePath, '', 'utf8', (err) => {
            if (err) {
                socket.emit('log', 'Ошибка очистки файла');
                return;
            }
            io.emit('clear text'); // Отправляем очистку всем клиентам
            socket.emit('log', 'Файл очищен');
        });
    });
});

// Запуск сервера
server.listen(3000, () => {
    console.log('Сервер запущен!');
});
