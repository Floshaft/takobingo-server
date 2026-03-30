const { v4: uuidv4 } = require('uuid');

// ── Thèmes disponibles ────────────────────────────────────────
const THEMES = {
  food:    ['Pizza','Sushi','Tacos','Burger','Ramen','Pasta','Sashimi','Kebab','Fondue','Curry','Mochi','Tapas','Poke','Raclette','Dim Sum','Paella','Falafel','Tiramisu','Baklava','Croissant','Lasagne','Tempura','Pad Thai','Gaufre','Crêpe'],
  travel:  ['Paris','Tokyo','New York','Bali','Rome','Sydney','Dubai','Cancun','Marrakech','Lisbonne','Bangkok','Kyoto','Amsterdam','Barcelone','Santorin','Le Caire','Alger','Mumbai','Oslo','Québec','Séoul','Helsinki','La Havane','Auckland','Bogota'],
  music:   ['Rock','Jazz','Pop','Rap','Salsa','Blues','Reggae','Électro','Classique','K-Pop','Métal','Soul','Techno','R&B','Flamenco','Bossa Nova','Gospel','Punk','Country','Opéra','Tango','Funk','Ambient','Trap','Cumbia'],
  cinema:  ['Avatar','Matrix','Titanic','Alien','Rocky','Joker','Dune','Parasite','Inception','Amélie','Forrest Gump','Gladiator','Psychose','Casablanca','Intouchables','Spotlight','Tenet','1917','Léon','Selma','Arrival','Lincoln','Whiplash','Up','Soul'],
  sport:   ['Football','Tennis','Basket','Rugby','Natation','Cyclisme','Boxe','Judo','Golf','Surf','Volley','Handball','Athlétisme','Escrime','Tir à l\'arc','Ski','Snowboard','Escalade','Voile','BMX','Triathlon','Hockey','Formule 1','Gym','Taekwondo'],
  animals: ['Lion','Dauphin','Koala','Panda','Aigle','Pieuvre','Girafe','Pingouin','Tigre','Loutre','Lamantin','Axolotl','Wombat','Fennec','Quokka','Tapir','Okapi','Capybara','Caracal','Serval','Mandrill','Kinkajou','Aye-aye','Narval','Pangolin'],
  games:   ['Tetris','Zelda','Mario','Minecraft','Fortnite','Pac-Man','Sonic','Doom','Among Us','Pokémon','Dark Souls','Hades','Celeste','Portal','Half-Life','Hollow Knight','Skyrim','Elden Ring','Stardew Valley','Animal Crossing','FIFA','GTA','Les Sims','Overwatch','Fall Guys'],
};

// ── Stockage en mémoire ───────────────────────────────────────
const rooms = new Map();   // roomId  → Room
const players = new Map(); // socketId → { roomId, name, avatar }

// ── Modèle Room ───────────────────────────────────────────────
function createRoom({ hostId, hostName, avatar, theme = 'food', maxPlayers = 8 }) {
  const code = generateCode();
  const room = {
    id: uuidv4(),
    code,
    hostId,
    theme,
    maxPlayers,
    status: 'lobby',   // lobby | playing | finished
    players: new Map(), // socketId → PlayerData
    drawnItems: [],
    scores: new Map(),  // socketId → number
    createdAt: Date.now(),
  };
  room.players.set(hostId, { id: hostId, name: hostName, avatar, card: null, isHost: true });
  room.scores.set(hostId, 0);
  rooms.set(room.id, room);
  return room;
}

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while ([...rooms.values()].some(r => r.code === code));
  return code;
}

// ── Génération de carton 5×5 ──────────────────────────────────
function generateCard(theme) {
  const pool = [...(THEMES[theme] || THEMES.food)];
  shuffle(pool);
  const words = pool.slice(0, 24);
  words.splice(12, 0, 'FREE'); // case centrale toujours libre
  return words;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ── Vérification bingo ────────────────────────────────────────
const WINNING_LINES = [
  [0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14],[15,16,17,18,19],[20,21,22,23,24], // lignes
  [0,5,10,15,20],[1,6,11,16,21],[2,7,12,17,22],[3,8,13,18,23],[4,9,14,19,24], // colonnes
  [0,6,12,18,24],[4,8,12,16,20],                                                // diagonales
];

function checkBingo(card, drawnItems) {
  const markedSet = new Set(
    card.map((w, i) => (w === 'FREE' || drawnItems.includes(w)) ? i : -1).filter(i => i >= 0)
  );
  return WINNING_LINES.some(line => line.every(i => markedSet.has(i)));
}

// ── Sérialisation (Map → Array pour JSON) ────────────────────
function serializeRoom(room) {
  return {
    id: room.id,
    code: room.code,
    theme: room.theme,
    status: room.status,
    maxPlayers: room.maxPlayers,
    drawnItems: room.drawnItems,
    players: [...room.players.values()].map(p => ({
      id: p.id, name: p.name, avatar: p.avatar, isHost: p.isHost,
      score: room.scores.get(p.id) || 0,
    })),
    drawnCount: room.drawnItems.length,
  };
}

// ── API publique ──────────────────────────────────────────────
module.exports = {
  THEMES,

  createRoom,
  generateCard,
  checkBingo,
  serializeRoom,

  getRoomByCode(code) {
    return [...rooms.values()].find(r => r.code === code) || null;
  },

  getRoomById(id) {
    return rooms.get(id) || null;
  },

  getRoomCount: () => rooms.size,

  getPlayerCount: () => players.size,

  registerPlayer(socketId, roomId, name, avatar) {
    players.set(socketId, { roomId, name, avatar });
  },

  getPlayer(socketId) {
    return players.get(socketId) || null;
  },

  handleDisconnect(io, socket) {
    const playerData = players.get(socket.id);
    if (!playerData) return;

    const room = rooms.get(playerData.roomId);
    if (!room) { players.delete(socket.id); return; }

    room.players.delete(socket.id);
    players.delete(socket.id);

    if (room.players.size === 0) {
      rooms.delete(room.id);
      return;
    }

    // Si l'hôte part, on passe le rôle au suivant
    if (room.hostId === socket.id) {
      const newHost = room.players.values().next().value;
      newHost.isHost = true;
      room.hostId = newHost.id;
    }

    io.to(room.id).emit('room:updated', serializeRoom(room));
    io.to(room.id).emit('chat:system', {
      text: `${playerData.name} a quitté la partie.`,
    });
  },
};
