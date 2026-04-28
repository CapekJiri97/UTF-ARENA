const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

let rooms = {
  'Room 1': { players: {}, started: false },
  'Room 2': { players: {}, started: false },
  'Room 3': { players: {}, started: false }
};

io.on('connection', (socket) => {
  console.log(`[SERVER] Nový hráč připojen! ID: ${socket.id}`);

  // Výchozí stav nového hráče po připojení
  let currentRoom = 'Room 1';
  socket.join(currentRoom);
  
  rooms[currentRoom].players[socket.id] = {
    id: socket.id,
    className: 'Bruiser',
    summonerSpell: 'Heal',
    team: 0,
    x: 0,
    y: 0
  };

  // Pošli aktualizovaný seznam všem v místnosti
  io.to(currentRoom).emit('lobby_update', rooms[currentRoom].players);

  // Přepínání roomek z Lobby
  socket.on('join_room', (roomName) => {
    if (!rooms[roomName] || currentRoom === roomName) return;
    // Odstranění ze staré roomky a aktualizace lobby pro ostatní
    socket.leave(currentRoom);
    let pData = rooms[currentRoom].players[socket.id];
    delete rooms[currentRoom].players[socket.id];
    io.to(currentRoom).emit('lobby_update', rooms[currentRoom].players);
    
    // Přidání do nové roomky
    currentRoom = roomName;
    socket.join(currentRoom);
    rooms[currentRoom].players[socket.id] = pData;
    io.to(currentRoom).emit('lobby_update', rooms[currentRoom].players);
  });

  // Hráč si v menu vybral jinou postavu/tým
  socket.on('update_selection', (data) => {
    const room = rooms[currentRoom];
    if (!room || !room.players[socket.id]) return;

    const player = room.players[socket.id];
    const newTeam = data.team;
    let newClass = data.className;
    let newSpell = data.summonerSpell || 'Heal';

    // --- LOGIKA PROTI DUPLIKÁTŮM ---
    const teamPlayers = Object.values(room.players).filter(p => p.team === newTeam && p.id !== socket.id);
    const isClassTakenOnNewTeam = (cls) => teamPlayers.some(p => p.className === cls);

    // Případ 1: Hráč mění tým. Musíme zkontrolovat, jestli jeho postava není v novém týmu už zabraná.
    if (newTeam !== player.team) {
        if (isClassTakenOnNewTeam(player.className)) {
            // Postava je zabraná, najdeme první volnou.
            const allClassNames = Object.keys(require('./classes.js').CLASSES);
            const takenClassNames = teamPlayers.map(p => p.className);
            const availableClass = allClassNames.find(cls => !takenClassNames.includes(cls));
            newClass = availableClass || player.className; // Fallback, kdyby nebylo nic volného
        } else {
            // Postava je volná, může si ji nechat.
            newClass = player.className;
        }
    }
    // Případ 2: Hráč mění postavu ve stejném týmu.
    else {
        if (isClassTakenOnNewTeam(newClass)) {
            // Požadovaná postava je zabraná, změnu neprovedeme.
            newClass = player.className;
        }
    }
    
    // Aplikujeme změny
    player.className = newClass;
    player.team = newTeam;
    player.summonerSpell = newSpell;

    io.to(currentRoom).emit('lobby_update', room.players);
  });

  // Někdo klikl na Start Game
  socket.on('start_game', () => {
    console.log(`[SERVER] Hra začíná v ${currentRoom}! Host: ${socket.id}`);
    rooms[currentRoom].started = true;
    io.to(currentRoom).emit('game_start', { players: rooms[currentRoom].players, hostId: socket.id }); 
  });

  // Během hry: Hráč posílá svou lokální pozici
  socket.on('player_update', (data) => {
    if(rooms[currentRoom].players[socket.id]) {
      Object.assign(rooms[currentRoom].players[socket.id], data);
      socket.broadcast.to(currentRoom).emit('network_player_update', rooms[currentRoom].players[socket.id]);
    }
  });

  // Zprostředkování útoků a kouzel (Aby to viděli ostatní)
  socket.on('player_action', (data) => socket.broadcast.to(currentRoom).emit('network_player_action', data));
  socket.on('host_state', (data) => socket.broadcast.to(currentRoom).emit('network_host_state', data));
  socket.on('host_event', (data) => socket.broadcast.to(currentRoom).emit('network_host_event', data));
  socket.on('broadcast_kill', (data) => socket.broadcast.to(currentRoom).emit('network_kill_feed', data));

  socket.on('disconnect', () => {
    console.log(`[SERVER] Hráč odpojen: ${socket.id}`);
    delete rooms[currentRoom].players[socket.id];
    io.to(currentRoom).emit('lobby_update', rooms[currentRoom].players);
    io.to(currentRoom).emit('player_disconnected', socket.id);
  });
});

app.get('/classes.js', (req, res) => {
  res.sendFile(__dirname + '/classes.js');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[SERVER] Hra běží na portu ${PORT}...`);
  console.log(`[SERVER] Připojte se přes LAN IP tohoto PC.`);
});