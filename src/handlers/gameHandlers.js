const roomService = require('../services/roomService');

function registerGameHandlers(io, socket) {

  socket.on('game:start', (_, callback) => {
    try {
      const player = roomService.getPlayer(socket.id);
      if (!player) throw new Error('Joueur introuvable.');
      const room = roomService.getRoomById(player.roomId);
      if (!room) throw new Error('Salle introuvable.');
      if (room.hostId !== socket.id) throw new Error("Seul l'hôte peut lancer la partie.");
      if (room.players.size < 1) throw new Error('Il faut au moins 1 joueur.');
      if (room.status !== 'lobby') throw new Error('La partie est déjà lancée.');

      // Génère les cartons
      for (const [socketId, p] of room.players) {
        p.card = roomService.generateCard(room.theme, room.customWords);
      }

      room.status = 'playing';
      room.drawnItems = [];
      room.scores.forEach((_, k) => room.scores.set(k, 0));

      // 1. On notifie tout le monde que la partie commence (avec hostId !)
      io.to(room.id).emit('game:started', {
        hostId: room.hostId,
        theme: room.theme,
        players: [...room.players.values()].map(p => ({
          id: p.id, name: p.name, avatar: p.avatar, isHost: p.isHost, score: 0,
        })),
      });

      // 2. Léger délai puis on envoie les cartons individuellement
      setTimeout(() => {
        for (const [socketId, p] of room.players) {
          io.to(socketId).emit('game:cardDealt', { card: p.card });
        }
      }, 300);

      io.to(room.id).emit('chat:system', { text: '🎮 La partie commence ! Bonne chance !' });
      console.log(`[Game] Partie lancée dans la salle ${room.code} (${room.players.size} joueurs)`);
      callback({ success: true });
    } catch (err) {
      callback({ success: false, error: err.message });
    }
  });

  socket.on('game:draw', (_, callback) => {
    try {
      const player = roomService.getPlayer(socket.id);
      if (!player) throw new Error('Joueur introuvable.');
      const room = roomService.getRoomById(player.roomId);
      if (!room) throw new Error('Salle introuvable.');
      if (room.hostId !== socket.id) throw new Error("Seul l'hôte peut tirer les boules.");
      if (room.status !== 'playing') throw new Error("La partie n'est pas en cours.");

      const allItems = room.customWords || roomService.THEMES[room.theme];
      const remaining = allItems.filter(w => !room.drawnItems.includes(w));

      if (remaining.length === 0) {
        room.status = 'finished';
        io.to(room.id).emit('game:noMoreBalls', { scores: buildScoreBoard(room) });
        callback({ success: false, error: 'Plus de boules disponibles !' });
        return;
      }

      const drawn = remaining[Math.floor(Math.random() * remaining.length)];
      room.drawnItems.push(drawn);

      io.to(room.id).emit('game:ballDrawn', {
        item: drawn,
        index: room.drawnItems.length,
        total: allItems.length,
        drawnItems: room.drawnItems,
      });

      console.log(`[Game] ${room.code} → tirage #${room.drawnItems.length} : "${drawn}"`);
      callback({ success: true, item: drawn });
    } catch (err) {
      callback({ success: false, error: err.message });
    }
  });

  socket.on('game:markCell', ({ cellIndex }, callback) => {
    try {
      const player = roomService.getPlayer(socket.id);
      if (!player) throw new Error('Joueur introuvable.');
      const room = roomService.getRoomById(player.roomId);
      if (!room) throw new Error('Salle introuvable.');
      if (room.status !== 'playing') throw new Error("La partie n'est pas en cours.");
      const p = room.players.get(socket.id);
      if (!p || !p.card) throw new Error('Carton introuvable.');
      const word = p.card[cellIndex];
      if (word === 'FREE') { callback({ success: true }); return; }
      if (!room.drawnItems.includes(word)) throw new Error(`"${word}" n'a pas encore été tiré.`);
      const current = room.scores.get(socket.id) || 0;
      room.scores.set(socket.id, current + 10);
      io.to(room.id).emit('game:scoreUpdated', { scores: buildScoreBoard(room) });
      callback({ success: true, score: room.scores.get(socket.id) });
    } catch (err) {
      callback({ success: false, error: err.message });
    }
  });

  socket.on('game:bingo', (_, callback) => {
    try {
      const player = roomService.getPlayer(socket.id);
      if (!player) throw new Error('Joueur introuvable.');
      const room = roomService.getRoomById(player.roomId);
      if (!room) throw new Error('Salle introuvable.');
      if (room.status !== 'playing') throw new Error("La partie n'est pas en cours.");
      const p = room.players.get(socket.id);
      if (!p || !p.card) throw new Error('Carton introuvable.');
      const valid = roomService.checkBingo(p.card, room.drawnItems);
      if (!valid) {
        callback({ success: false, error: '❌ Pas encore de bingo valide !' });
        io.to(room.id).emit('chat:system', { text: `😬 ${p.name} a crié BINGO trop tôt !` });
        return;
      }
      const current = room.scores.get(socket.id) || 0;
      room.scores.set(socket.id, current + 500);
      room.status = 'finished';
      io.to(room.id).emit('game:bingoWon', {
        winner: { id: p.id, name: p.name, avatar: p.avatar },
        scores: buildScoreBoard(room),
      });
      io.to(room.id).emit('chat:system', { text: `🏆 ${p.name} a gagné ! BINGO !!!` });
      console.log(`[Game] BINGO ! Gagnant : ${p.name} dans la salle ${room.code}`);
      callback({ success: true });
    } catch (err) {
      callback({ success: false, error: err.message });
    }
  });

  socket.on('game:restart', (_, callback) => {
    try {
      const player = roomService.getPlayer(socket.id);
      if (!player) throw new Error('Joueur introuvable.');
      const room = roomService.getRoomById(player.roomId);
      if (!room) throw new Error('Salle introuvable.');
      if (room.hostId !== socket.id) throw new Error("Seul l'hôte peut relancer.");
      room.status = 'lobby';
      room.drawnItems = [];
      room.players.forEach(p => { p.card = null; });
      room.scores.forEach((_, k) => room.scores.set(k, 0));
      io.to(room.id).emit('game:restarted', roomService.serializeRoom(room));
      io.to(room.id).emit('chat:system', { text: '🔄 Nouvelle partie ! Le lobby est ouvert.' });
      callback({ success: true });
    } catch (err) {
      callback({ success: false, error: err.message });
    }
  });
}

function buildScoreBoard(room) {
  return [...room.players.values()]
    .map(p => ({ id: p.id, name: p.name, avatar: p.avatar, score: room.scores.get(p.id) || 0 }))
    .sort((a, b) => b.score - a.score);
}

module.exports = { registerGameHandlers };
