# 🐙 TakoBingo — Backend Multijoueur

Serveur temps réel pour TakoBingo, construit avec **Node.js**, **Express** et **Socket.io**.

---

## 🚀 Installation & Démarrage

```bash
cd takobingo-server
npm install

# Copie et configure les variables d'environnement
cp .env.example .env

# Dev (avec rechargement auto)
npm run dev

# Production
npm start
```

Le serveur tourne sur **http://localhost:3001** par défaut.

---

## 📁 Structure du projet

```
takobingo-server/
├── src/
│   ├── index.js                  # Point d'entrée (Express + Socket.io)
│   ├── handlers/
│   │   ├── roomHandlers.js       # Créer / rejoindre / quitter une salle
│   │   ├── gameHandlers.js       # Lancer partie, tirer boule, BINGO !
│   │   └── chatHandlers.js       # Messages & réactions
│   ├── services/
│   │   └── roomService.js        # Logique métier, état des salles
│   └── client/
│       └── socket.js             # Client React prêt à l'emploi
├── package.json
└── .env.example
```

---

## 🔌 Événements Socket.io

### Client → Serveur (emit)

| Événement | Payload | Description |
|---|---|---|
| `room:create` | `{ name, avatar, theme, maxPlayers }` | Créer une salle |
| `room:join` | `{ code, name, avatar }` | Rejoindre via code |
| `room:setTheme` | `{ theme }` | Changer le thème (hôte) |
| `room:leave` | — | Quitter la salle |
| `game:start` | — | Lancer la partie (hôte) |
| `game:draw` | — | Tirer une boule (hôte) |
| `game:markCell` | `{ cellIndex }` | Valider une case |
| `game:bingo` | — | Appeler BINGO ! |
| `game:restart` | — | Rejouer (hôte) |
| `chat:message` | `{ text }` | Envoyer un message |
| `chat:reaction` | `{ emoji }` | Envoyer une réaction |

### Serveur → Client (on)

| Événement | Payload | Description |
|---|---|---|
| `room:updated` | `Room` | État de la salle mis à jour |
| `game:started` | `{ theme, players }` | Partie lancée |
| `game:cardDealt` | `{ card: string[] }` | Carton privé du joueur |
| `game:ballDrawn` | `{ item, index, total, drawnItems }` | Nouvelle boule tirée |
| `game:scoreUpdated` | `{ scores }` | Tableau des scores |
| `game:bingoWon` | `{ winner, scores }` | Un joueur a gagné |
| `game:noMoreBalls` | `{ scores }` | Plus de boules disponibles |
| `game:restarted` | `Room` | Retour au lobby |
| `chat:message` | `{ playerName, avatar, text, timestamp }` | Message reçu |
| `chat:reaction` | `{ playerName, emoji }` | Réaction reçue |
| `chat:system` | `{ text }` | Message système |

---

## 🎨 Thèmes disponibles

`food` · `travel` · `music` · `cinema` · `sport` · `animals` · `games`

---

## 🔗 Intégration React (exemple)

```jsx
import { connectSocket, createRoom, EVENTS, getSocket } from './services/socket';
import { useEffect, useState } from 'react';

function App() {
  const [room, setRoom] = useState(null);
  const [card, setCard] = useState([]);

  useEffect(() => {
    connectSocket();
    const socket = getSocket();

    socket.on(EVENTS.ROOM_UPDATED, setRoom);
    socket.on(EVENTS.CARD_DEALT, ({ card }) => setCard(card));
    socket.on(EVENTS.BALL_DRAWN, ({ item }) => console.log('Tiré :', item));
    socket.on(EVENTS.BINGO_WON, ({ winner }) => alert(`${winner.name} a gagné !`));

    return () => socket.removeAllListeners();
  }, []);

  const handleCreate = async () => {
    const { room } = await createRoom({
      name: 'Julie',
      avatar: 'JC',
      theme: 'food',
      maxPlayers: 8,
    });
    setRoom(room);
  };

  return <button onClick={handleCreate}>Créer une salle</button>;
}
```

---

## ☁️ Déploiement

**Railway** (recommandé pour Socket.io) :
```bash
# Installe le CLI Railway
npm install -g @railway/cli
railway login
railway init
railway up
```

**Variables d'environnement en production** :
```
PORT=3001
CLIENT_URL=https://ton-takobingo.vercel.app
NODE_ENV=production
```

---

## 🧱 Prochaines évolutions

- [ ] Persistance avec Redis (salles survivent aux redémarrages)
- [ ] Authentification JWT
- [ ] Thèmes personnalisés avec images
- [ ] Spectateur (mode lecture seule)
- [ ] Statistiques par joueur
