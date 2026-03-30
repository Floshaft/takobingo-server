require('dotenv').config();
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const { registerRoomHandlers } = require('./handlers/roomHandlers');
const { registerGameHandlers } = require('./handlers/gameHandlers');
const { registerChatHandlers } = require('./handlers/chatHandlers');
const roomService = require('./services/roomService');

const app = express();
const httpServer = createServer(app);

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
  },
});

app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());

// ── Health check ──────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    rooms: roomService.getRoomCount(),
    players: roomService.getPlayerCount(),
  });
});

// ── REST : infos d'une salle (pour rejoindre via lien) ────────
app.get('/api/room/:code', (req, res) => {
  const room = roomService.getRoomByCode(req.params.code.toUpperCase());
  if (!room) return res.status(404).json({ error: 'Salle introuvable' });
  res.json({
    code: room.code,
    theme: room.theme,
    playerCount: room.players.size,
    maxPlayers: room.maxPlayers,
    status: room.status,
  });
});

// ── Socket.io ─────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[+] Connexion : ${socket.id}`);

  registerRoomHandlers(io, socket);
  registerGameHandlers(io, socket);
  registerChatHandlers(io, socket);

  socket.on('disconnect', () => {
    console.log(`[-] Déconnexion : ${socket.id}`);
    roomService.handleDisconnect(io, socket);
  });
});

// ── Démarrage ─────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🐙 TakoBingo server running on http://localhost:${PORT}`);
});
