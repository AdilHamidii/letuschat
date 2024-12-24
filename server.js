// Simple Multilingual Chat App
// Backend: Node.js with Express.js and WebSocket

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files
app.use(express.static('public'));

// Map to store temporary chat rooms and users' language preferences
const rooms = new Map();

// DeepL API Key (You should sign up at DeepL and get your key)
const DEEPL_API_KEY = '3d6b2ec9-4fa6-4bdd-91c0-43e62050fea2:fx';

// Route to generate a chat link
app.get('/generate', (req, res) => {
    const roomId = Math.random().toString(36).substring(2, 10);
    rooms.set(roomId, { users: [] });
    res.json({ link: `/chat/${roomId}` });
});



// Route to serve the chat page
app.get('/chat/:roomId', (req, res) => {
    if (!rooms.has(req.params.roomId)) {
        return res.status(404).send('Chat room not found');
    }
    res.sendFile(__dirname + '/public/chat.html');
});

// WebSocket connection
io.on('connection', (socket) => {
    let userLanguage = null; // to store user language temporarily
    
    socket.on('join', ({ roomId }) => {
        const room = rooms.get(roomId);
        if (room && room.users.length < 2) {
            room.users.push({ id: socket.id, language: null }); // Language will be set later
            socket.join(roomId);
            socket.emit('joined', { success: true });
        } else {
            socket.emit('joined', { success: false });
        }
    });

    // Set the user's language
    socket.on('setLanguage', (language) => {
        const room = findRoomByUserId(socket.id);
        if (room) {
            const user = room.users.find(user => user.id === socket.id);
            user.language = language; // Update language preference
        }
    });

    // Send and translate messages
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

    // Disconnect user and clean up room
    socket.on('disconnect', () => {
        for (const [roomId, room] of rooms.entries()) {
            room.users = room.users.filter(user => user.id !== socket.id);
            if (room.users.length === 0) {
                rooms.delete(roomId);
            }
        }
    });
});

// Helper function to find the room based on user ID
function findRoomByUserId(userId) {
    for (const room of rooms.values()) {
        if (room.users.some(user => user.id === userId)) {
            return room;
        }
    }
    return null;
}

// Function to translate messages using DeepL API
async function translateMessage(text, targetLanguage) {
    if (!targetLanguage) {
        return text; // No translation if no language is set
    }
    try {
        const response = await axios.post(
            'https://api-free.deepl.com/v2/translate', 
            null, 
            {
                params: {
                    auth_key: DEEPL_API_KEY,
                    text: text,
                    target_lang: targetLanguage.toUpperCase(), // DeepL uses language codes in uppercase
                }
            }
        );
        return response.data.translations[0].text;
    } catch (error) {
        console.error('Translation Error:', error);
        return text; // Fallback to the original message in case of error
    }
}

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
