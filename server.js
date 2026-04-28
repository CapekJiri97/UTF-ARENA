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
    if(rooms[currentRoom].players[socket.id]) {
      rooms[currentRoom].players[socket.id].className = data.className;
      rooms[currentRoom].players[socket.id].team = data.team;
      io.to(currentRoom).emit('lobby_update', rooms[currentRoom].players); // Rozešli pouze dané roomce
    }
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[SERVER] Hra běží na portu ${PORT}...`);
  console.log(`[SERVER] Připojte se přes LAN IP tohoto PC.`);
});