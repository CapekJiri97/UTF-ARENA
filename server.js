const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

let players = {}; // Uložíme si stav všech hráčů v lobby a ve hře

io.on('connection', (socket) => {
  console.log(`[SERVER] Nový hráč připojen! ID: ${socket.id}`);

  // Výchozí stav nového hráče po připojení
  players[socket.id] = {
    id: socket.id,
    className: 'Bruiser',
    team: 0,
    x: 0,
    y: 0
  };

  // Pošli aktualizovaný seznam všem v místnosti
  io.emit('lobby_update', players);

  // Hráč si v menu vybral jinou postavu/tým
  socket.on('update_selection', (data) => {
    if(players[socket.id]) {
      players[socket.id].className = data.className;
      players[socket.id].team = data.team;
      io.emit('lobby_update', players); // Rozešli všem změnu
    }
  });

  // Někdo klikl na Start Game
  socket.on('start_game', () => {
    console.log(`[SERVER] Hra začíná! Host určuje AI: ${socket.id}`);
    io.emit('game_start', { players: players, hostId: socket.id }); // Přidán hostId
  });

  // Během hry: Hráč posílá svou lokální pozici
  socket.on('player_update', (data) => {
    if(players[socket.id]) {
      Object.assign(players[socket.id], data); // Dynamicky zkopíruje i level, killy, goldy atd.
      // Přepošleme všem OSTATNÍM hráčům (broadcast)
      socket.broadcast.emit('network_player_update', players[socket.id]);
    }
  });

  // Zprostředkování útoků a kouzel (Aby to viděli ostatní)
  socket.on('player_action', (data) => {
    socket.broadcast.emit('network_player_action', data);
  });

  // Host posílá stav botů, minionů a věží (Authoritative mode pro LAN)
  socket.on('host_state', (data) => {
    socket.broadcast.emit('network_host_state', data);
  });

  // Zprostředkování jednorázových událostí od Hosta (střely věží, poškození, konec hry)
  socket.on('host_event', (data) => {
    socket.broadcast.emit('network_host_event', data);
  });

  // Globální Kill Feed
  socket.on('broadcast_kill', (data) => {
    socket.broadcast.emit('network_kill_feed', data);
  });

  socket.on('disconnect', () => {
    console.log(`[SERVER] Hráč odpojen: ${socket.id}`);
    delete players[socket.id];
    io.emit('lobby_update', players);
    io.emit('player_disconnected', socket.id); // Odstraní ho z mapy, pokud se odpojil během hry
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[SERVER] Hra běží na portu ${PORT}...`);
  console.log(`[SERVER] Připojte se přes LAN IP tohoto PC.`);
});