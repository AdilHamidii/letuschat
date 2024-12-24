

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = new Server(server);


app.use(express.static('public'));


const rooms = new Map();


const DEEPL_API_KEY = '3d6b2ec9-4fa6-4bdd-91c0-43e62050fea2:fx';


app.get('/generate', (req, res) => {
    const roomId = Math.random().toString(36).substring(2, 10);
    rooms.set(roomId, { users: [] });
    res.json({ link: `/chat/${roomId}` });
});

app.get('/chat/:roomId', (req, res) => {
    if (!rooms.has(req.params.roomId)) {
        return res.status(404).send('Chat room not found');
    }
    res.sendFile(__dirname + '/public/chat.html');
});


io.on('connection', (socket) => {
    let userLanguage = null; 
    
    socket.on('join', ({ roomId }) => {
        const room = rooms.get(roomId);
        if (room && room.users.length < 2) {
            room.users.push({ id: socket.id, language: null }); 
            socket.join(roomId);
            socket.emit('joined', { success: true });
        } else {
            socket.emit('joined', { success: false });
        }
    });

   
    socket.on('setLanguage', (language) => {
        const room = findRoomByUserId(socket.id);
        if (room) {
            const user = room.users.find(user => user.id === socket.id);
            user.language = language; 
        }
    });

 
    socket.on('message', async ({ roomId, message }) => {
        const room = rooms.get(roomId);
        if (room) {
            for (const user of room.users) {
                if (user.id !== socket.id) {
                    const translatedMessage = await translateMessage(message, user.language);
                    io.to(user.id).emit('message', { message: translatedMessage });
                }
            }
        }
    });

    socket.on('disconnect', () => {
        for (const [roomId, room] of rooms.entries()) {
            room.users = room.users.filter(user => user.id !== socket.id);
            if (room.users.length === 0) {
                rooms.delete(roomId);
            }
        }
    });
});


function findRoomByUserId(userId) {
    for (const room of rooms.values()) {
        if (room.users.some(user => user.id === userId)) {
            return room;
        }
    }
    return null;
}


async function translateMessage(text, targetLanguage) {
    if (!targetLanguage) {
        return text; 
    }
    try {
        const response = await axios.post(
            'https://api-free.deepl.com/v2/translate', 
            null, 
            {
                params: {
                    auth_key: DEEPL_API_KEY,
                    text: text,
                    target_lang: targetLanguage.toUpperCase(), 
                }
            }
        );
        return response.data.translations[0].text;
    } catch (error) {
        console.error('Translation Error:', error);
        return text; 
    }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
