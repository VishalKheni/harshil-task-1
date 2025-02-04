const socketIO = require('socket.io');

let _io;
const setIO = (server) => {
  _io = socketIO(server, {
    cors: {
      origin: '*', // Replace with the allowed domain(s)
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    },
  });

  return _io;
};

const getIO = () => { return _io; };

module.exports = { getIO, setIO };
