const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const port = process.env.PORT || 3000;

let rooms = {};

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Fallback to index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
};

io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('create room', (callback) => {
        const roomCode = uuidv4();
        rooms[roomCode] = {};
        callback(roomCode);
    });

    socket.on('join room', ({ username, room }) => {
        socket.join(room);
        if (!rooms[room]) {
            rooms[room] = {};
        }
        rooms[room][socket.id] = username;

        io.to(room).emit('user count', Object.keys(rooms[room]).length);
        io.to(room).emit('user list', Object.values(rooms[room]));

        socket.on('chat message', (message) => {
            io.to(room).emit('chat message', { username, message });
        });

        socket.on('upload', (file, callback) => {
            const fileName = path.join(__dirname, 'public', 'uploads', file.name);
            fs.writeFile(fileName, file.data, (err) => {
                if (err) {
                    console.error('File upload failed', err);
                    callback({ status: 'error' });
                } else {
                    const fileExtension = path.extname(file.name);
                    const mimeType = mimeTypes[fileExtension] || 'application/octet-stream';
                    const fileUrl = `/uploads/${file.name}`;
                    io.to(room).emit('file message', { username, fileUrl, mimeType });
                    callback({ status: 'ok', fileUrl });
                }
            });
        });

        socket.on('disconnect', () => {
            delete rooms[room][socket.id];
            io.to(room).emit('user count', Object.keys(rooms[room]).length);
            io.to(room).emit('user list', Object.values(rooms[room]));
            if (Object.keys(rooms[room]).length === 0) {
                delete rooms[room];
            }
        });
    });

    console.log("Server events added");
});

server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
