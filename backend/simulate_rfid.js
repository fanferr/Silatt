const io = require('socket.io-client');

const socket = io('http://localhost:3000');

const tagId = process.argv[2] || 'TAG-' + Math.floor(Math.random() * 100000);

socket.on('connect', () => {
    console.log('Connected to server as RFID Reader');
    console.log(`Scanning tag: ${tagId}`);
    socket.emit('rfid_scan', tagId);

    setTimeout(() => {
        socket.disconnect();
    }, 1000);
});
