const roomService = require('../services/roomService');

const BANNED_WORDS = []; // Ajoute des mots bannis ici si besoin
const MAX_MSG_LENGTH = 200;
const RATE_LIMIT_MS = 500; // Anti-spam : 1 message max toutes les 500ms
const lastMessage = new Map(); // socketId → timestamp

function registerChatHandlers(io, socket) {

  socket.on('chat:message', ({ text }, callback) => {
    try {
      const player = roomService.getPlayer(socket.id);
      if (!player) throw new Error('Joueur introuvable.');

      // Anti-spam
      const now = Date.now();
      const last = lastMessage.get(socket.id) || 0;
      if (now - last < RATE_LIMIT_MS) throw new Error('Tu envoies des messages trop vite !');
      lastMessage.set(socket.id, now);

      // Validation
      const clean = text?.trim();
      if (!clean) throw new Error('Message vide.');
      if (clean.length > MAX_MSG_LENGTH) throw new Error(`Message trop long (max ${MAX_MSG_LENGTH} caractères).`);

      const room = roomService.getRoomById(player.roomId);
      if (!room) throw new Error('Salle introuvable.');

      const p = room.players.get(socket.id);

      const msg = {
        id: `${socket.id}-${now}`,
        playerId: socket.id,
        playerName: p?.name || player.name,
        avatar: p?.avatar || player.avatar,
        text: clean,
        timestamp: now,
      };

      io.to(room.id).emit('chat:message', msg);
      callback && callback({ success: true });
    } catch (err) {
      callback && callback({ success: false, error: err.message });
    }
  });

  // Réaction rapide (emoji)
  socket.on('chat:reaction', ({ emoji }, callback) => {
    try {
      const ALLOWED_REACTIONS = ['🎉','😱','😂','🔥','👏','😤','🐙','❤️'];
      if (!ALLOWED_REACTIONS.includes(emoji)) throw new Error('Réaction invalide.');

      const player = roomService.getPlayer(socket.id);
      if (!player) throw new Error('Joueur introuvable.');

      const room = roomService.getRoomById(player.roomId);
      if (!room) throw new Error('Salle introuvable.');

      const p = room.players.get(socket.id);

      io.to(room.id).emit('chat:reaction', {
        playerId: socket.id,
        playerName: p?.name || player.name,
        emoji,
        timestamp: Date.now(),
      });

      callback && callback({ success: true });
    } catch (err) {
      callback && callback({ success: false, error: err.message });
    }
  });
}

module.exports = { registerChatHandlers };
