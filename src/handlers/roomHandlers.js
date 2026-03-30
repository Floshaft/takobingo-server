const roomService = require('../services/roomService');

function registerRoomHandlers(io, socket) {

  // ── Créer une salle ────────────────────────────────────────
  socket.on('room:create', ({ name, avatar, theme, maxPlayers }, callback) => {
    try {
      const room = roomService.createRoom({
        hostId: socket.id,
        hostName: name,
        avatar,
        theme: theme || 'food',
        maxPlayers: maxPlayers || 8,
      });

      roomService.registerPlayer(socket.id, room.id, name, avatar);
      socket.join(room.id);

      console.log(`[Room] ${name} a créé la salle ${room.code}`);

      callback({ success: true, room: roomService.serializeRoom(room) });
    } catch (err) {
      callback({ success: false, error: err.message });
    }
  });

  // ── Rejoindre une salle ────────────────────────────────────
  socket.on('room:join', ({ code, name, avatar }, callback) => {
    try {
      const room = roomService.getRoomByCode(code.toUpperCase());

      if (!room)       throw new Error('Salle introuvable. Vérifie le code !');
      if (room.status !== 'lobby') throw new Error('La partie est déjà en cours.');
      if (room.players.size >= room.maxPlayers) throw new Error('La salle est complète.');
      if ([...room.players.values()].some(p => p.name === name))
        throw new Error('Ce pseudo est déjà pris dans cette salle.');

      room.players.set(socket.id, { id: socket.id, name, avatar, card: null, isHost: false });
      room.scores.set(socket.id, 0);
      roomService.registerPlayer(socket.id, room.id, name, avatar);
      socket.join(room.id);

      console.log(`[Room] ${name} a rejoint la salle ${room.code}`);

      // Notifie tous les autres joueurs
      socket.to(room.id).emit('room:updated', roomService.serializeRoom(room));
      socket.to(room.id).emit('chat:system', { text: `🎉 ${name} a rejoint la partie !` });

      callback({ success: true, room: roomService.serializeRoom(room) });
    } catch (err) {
      callback({ success: false, error: err.message });
    }
  });

  // ── Changer le thème (hôte seulement) ─────────────────────
  socket.on('room:setTheme', ({ theme }, callback) => {
    try {
      const player = roomService.getPlayer(socket.id);
      if (!player) throw new Error('Joueur introuvable.');

      const room = roomService.getRoomById(player.roomId);
      if (!room) throw new Error('Salle introuvable.');
      if (room.hostId !== socket.id) throw new Error('Seul l\'hôte peut changer le thème.');
      if (!roomService.THEMES[theme]) throw new Error('Thème invalide.');

      room.theme = theme;
      io.to(room.id).emit('room:updated', roomService.serializeRoom(room));
      callback({ success: true });
    } catch (err) {
      callback({ success: false, error: err.message });
    }
  });

  // ── Quitter une salle ──────────────────────────────────────
  socket.on('room:leave', (_, callback) => {
    try {
      const player = roomService.getPlayer(socket.id);
      if (player) {
        roomService.handleDisconnect(io, socket);
        socket.leave(player.roomId);
      }
      callback && callback({ success: true });
    } catch (err) {
      callback && callback({ success: false, error: err.message });
    }
  });
}

module.exports = { registerRoomHandlers };
