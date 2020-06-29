process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
var app = require('express')();
// var fs = require('fs');
var debug = true;
// var server = require('https').createServer({
//   key: fs.readFileSync('path to key file'),
//   cert: fs.readFileSync('path to cert file'),
//   ca: fs.readFileSync('path to bundle file')
// }, app);
var io = require('socket.io')(server);

var userList = [];

function getAttendees(Room) {
  console.log('\n----------------People in the room ' + Room + '-------------------\n')
  console.log(Object.values(userList[Room]).map(function (e) { if (e && e.name) return e.name; }));
  console.log('\n----------------------------------------------------------\n')
}

function initAttendee(room, ID, attendee = {}) {
  if (!(room in userList)) {
    userList[room] = {};
  }
  if (!(ID in userList[room])) {
    userList[room][ID] = {
      ...{ 
        state: 'idle',
        socket_id: ID
      },
      ...attendee
    };
  }
  return userList[room][ID];
}

function removeAttendee(room, ID) {
  delete userList[room][ID];
  if (userList[room].length <= 0) {
    delete userList[room];
  }
}

const dynamicNsp = io.of(/^\/session\/\d+$/).on('connect', (socket) => {
  try {
    const session = socket.nsp;
    const Room = socket.nsp.name;
    socket.join(Room);

    //On initial connection---------------------
    if (debug) {
      console.log('[' + socket.id + '] is connected to room:' + Room);
      console.log('|> Asking for introduction from ' + socket.id);
    }

    // if (socket.handshake.query.participant) {
    //   initAttendee(socket.nsp.name, socket.id, socket.handshake.query.participant);
    //   session.emit('updateParticipants', userList[Room]);
    // }
    session.to(`${socket.id}`).emit('welcome', { participants: ((Room in userList)?userList[Room]:[]) });
    //end of initial connection-----------------

    socket.on('disconnect', () => {
      const user = userList[Room][socket.id];
      if (user) {
        session.emit('participantDisconnected', { ...user, ...{ socket_id: socket.id } });
        if (debug) console.log('|> ' + (user.name||'') + ' is disconnected from ' + session.name);
      }
      removeAttendee(Room, socket.id);
      session.emit('updateParticipants', userList[Room]);
      if (debug) getAttendees(Room);
    });

    socket.on('introduction', (user) => {
      user = initAttendee(socket.nsp.name, socket.id, user);
      socket.broadcast.to(Room).emit('updateParticipants', userList[Room]);
      socket.broadcast.to(Room).emit('participantJoin', {...user,...{fromSocket:socket.id}});
      socket.broadcast.to(Room).emit('chat.join', { ...user, message: (user.name||'') + ' joined the chat', UID: socket.id });
      if (debug) console.log('   -> ' + user.name + ' joined the chat');
    });

    socket.on('chat.newMessage', function (message) {
      session.emit('chat.newMessage', message);
      if (debug) console.log('   -' + message.name + '@' + message.timestamp + ' : ' + message.message);
    });

    socket.on('error', function (err) {
      console.log(err)
    });

    socket.on('updateStatus', function (status) {
      userList[Room][socket.id].state = status;
      if (debug) console.log('|> ' + userList[Room][socket.id].name + ' is ' + status);
    });

    socket.on('requestAlternative', function (part) {
      if (socket.id in userList[Room]) {
        if(debug) console.log(`|> User requested an alternative connection due to low bitrate. To:${part} @ requestAlternative:${socket.id}`);
        session.to(`${part}`).emit(`requestAlternative:${socket.id}`);
      }
    });

    socket.on('backupReady', function (part) {
      if (socket.id in userList[Room]) {
        if(debug) console.log(`|> Backup channel is ready to go`);
        session.to(`${part}`).emit(`useBackUp:${socket.id}`);
      }
    });

    socket.on('ice.offerTo', function (offer) {
      if (socket.id in userList[Room]) {
        if(debug) console.log(`|> Offer is made to ${offer.to_socket_id} from ${socket.id}`);
        session.to(`${offer.to_socket_id}`).emit(`ice.offer:${socket.id}`, offer.offer);
      }
    });

    socket.on('ice.answerTo', function (answer) {
      session.to(`${answer.to_socket_id}`).emit(`ice.answer:${socket.id}`, answer.answer);
      if(debug) console.log(`|> Answer is sent to ${answer.to_socket_id} from ${socket.id}`);
    });

    socket.on('ice.candidateTo', function (candidate) {
      if(debug) console.log(`|> Candicates are sent to ${candidate.to_socket_id} from ${socket.id}`);
      session.to(`${candidate.to_socket_id}`).emit(`ice.newcandidate:${socket.id}`, candidate.candidate);
    });

    socket.on('ice.askReconnect', function (userID) {
      userList[Room][socket.id].state = status;
      console.log('|> ' + userList[Room][socket.id].name + ' is asking ' + userList[Room][userID].name + ' to reconnect');
      session.to(`${userID}`).emit('ice.reconnect', { uid: socket.id });
    });
    
  } catch (error) {
    console.log(error);
  }
});


io.on('connection', function (socket) {
  socket.send('No direct connection is allowed.');
  setTimeout(() => socket.disconnect(), 2000);
})

server.listen(6543, function (err) {
  if (err) throw err
  console.log("\n\nMission Control is listening on SSL:6543 ... \n\n");
});
