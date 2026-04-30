const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

let rooms = {};

io.on('connection', (socket) => {
  console.log(`[SERVER] Nový hráč připojen! ID: ${socket.id}`);

  let currentRoom = null;
  
  const sendRoomList = () => {
      const rList = Object.keys(rooms).map(name => ({
          name,
          players: Object.keys(rooms[name].players).length,
          started: rooms[name].started
      }));
      io.emit('room_list', rList);
  };

  // Pošli seznam aktivních roomek ihned po připojení (do browseru)
  sendRoomList();

  socket.on('create_room', (roomName) => {
      if (!roomName || roomName.trim() === '' || rooms[roomName]) return;
      rooms[roomName] = { players: {}, started: false };
      joinRoom(roomName);
      sendRoomList();
  });

  socket.on('join_room', (roomName) => {
      if (!rooms[roomName]) return;
      joinRoom(roomName);
  });

  socket.on('leave_room', () => {
      leaveCurrentRoom();
  });

  function leaveCurrentRoom() {
      if (currentRoom && rooms[currentRoom]) {
          socket.leave(currentRoom);
          delete rooms[currentRoom].players[socket.id];
          io.to(currentRoom).emit('lobby_update', { roomName: currentRoom, players: rooms[currentRoom].players });
          
          if (Object.keys(rooms[currentRoom].players).length === 0) {
              delete rooms[currentRoom];
          }
          currentRoom = null;
          sendRoomList();
      }
  }

  function joinRoom(roomName) {
      leaveCurrentRoom();
      currentRoom = roomName;
      socket.join(currentRoom);
      const team0Players = Object.values(rooms[currentRoom].players).filter(p => p.team === 0);
      const takenClasses = team0Players.map(p => p.className);
      const allClasses = ['Vanguard', 'Jirina', 'Bruiser', 'Tank', 'Hana', 'Goliath', 'Assassin', 'Zephyr', 'Kratoma', 'Marksman', 'Mage', 'Summoner', 'Healer', 'Acolyte', 'Keeper', 'Reaper'];
      const availableClass = allClasses.find(cls => !takenClasses.includes(cls)) || 'Bruiser';
      rooms[currentRoom].players[socket.id] = { id: socket.id, className: availableClass, summonerSpell: 'Heal', team: 0, x: 0, y: 0, ready: false };
      io.to(currentRoom).emit('lobby_update', { roomName: currentRoom, players: rooms[currentRoom].players });
  }

  // Hráč si v menu vybral jinou postavu/tým
  socket.on('update_selection', (data) => {
    if (!currentRoom || !rooms[currentRoom]) return;
    const room = rooms[currentRoom];
    if (!room || !room.players[socket.id]) return;

    const player = room.players[socket.id];
    const newTeam = data.team;
    let newClass = data.className;
    let newSpell = data.summonerSpell || 'Heal';

    if (newTeam === -1) { // Player chose to spectate
        player.team = -1;
        io.to(currentRoom).emit('lobby_update', { roomName: currentRoom, players: room.players });
        return;
    }

    // --- LOGIKA PROTI DUPLIKÁTŮM ---
    const teamPlayers = Object.values(room.players).filter(p => p.team === newTeam && p.id !== socket.id);
    const isClassTakenOnNewTeam = (cls) => teamPlayers.some(p => p.className === cls);

    // Případ 1: Hráč mění tým. Musíme zkontrolovat, jestli jeho postava není v novém týmu už zabraná.
    if (newTeam !== player.team) {
        if (isClassTakenOnNewTeam(player.className)) {
            // Postava je zabraná, najdeme první volnou.
            const allClassNames = ['Vanguard', 'Jirina', 'Bruiser', 'Tank', 'Hana', 'Goliath', 'Assassin', 'Zephyr', 'Kratoma', 'Marksman', 'Mage', 'Summoner', 'Healer', 'Acolyte', 'Keeper', 'Reaper'];
            const takenClassNames = teamPlayers.map(p => p.className);
            const availableClass = allClassNames.find(cls => !takenClassNames.includes(cls));
            newClass = availableClass || 'Bruiser'; // Bezpečný statický fallback, zabrání vložení undefined
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
    player.ready = false;

    io.to(currentRoom).emit('lobby_update', { roomName: currentRoom, players: room.players });
  });

  socket.on('toggle_ready', (isReady) => {
    if (!currentRoom || !rooms[currentRoom]) return;
    const room = rooms[currentRoom];
    if (room.players[socket.id]) {
        room.players[socket.id].ready = isReady;
        io.to(currentRoom).emit('lobby_update', { roomName: currentRoom, players: room.players });
    }
  });

  // Někdo klikl na Start Game
  socket.on('start_game', () => {
    if (!currentRoom || !rooms[currentRoom]) return;
    console.log(`[SERVER] Hra začíná v ${currentRoom}! Host: ${socket.id}`);
    rooms[currentRoom].started = true;
    io.to(currentRoom).emit('game_start', { players: rooms[currentRoom].players, hostId: socket.id }); 
    sendRoomList(); // Updatne lidem venku v prohlížeči informaci "[IN GAME]"
  });

  // Během hry: Hráč posílá svou lokální pozici
  socket.on('player_update', (data) => {
    if(currentRoom && rooms[currentRoom] && rooms[currentRoom].players[socket.id]) {
      Object.assign(rooms[currentRoom].players[socket.id], data);
      socket.broadcast.to(currentRoom).emit('network_player_update', rooms[currentRoom].players[socket.id]);
    }
  });

  // Zprostředkování útoků a kouzel (Aby to viděli ostatní)
  socket.on('player_action', (data) => { if (currentRoom) socket.broadcast.to(currentRoom).emit('network_player_action', data); });
  socket.on('host_state', (data) => { if (currentRoom) socket.broadcast.to(currentRoom).emit('network_host_state', data); });
  socket.on('host_event', (data) => { if (currentRoom) socket.broadcast.to(currentRoom).emit('network_host_event', data); });
  socket.on('broadcast_kill', (data) => { if (currentRoom) socket.broadcast.to(currentRoom).emit('network_kill_feed', data); });

  socket.on('disconnect', () => {
    console.log(`[SERVER] Hráč odpojen: ${socket.id}`);
    const tempRoom = currentRoom;
    leaveCurrentRoom();
    if (tempRoom) {
        io.to(tempRoom).emit('player_disconnected', socket.id);
    }
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