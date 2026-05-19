const io = require('socket.io-client');

const socket = io('http://localhost:3000');

socket.on('connect', () => {
    console.log('Connected to server as Impact Sensor');
    simulatePunch();
});

function simulatePunch() {
    console.log('Simulating punch...');

    // 1. Send low noise (idle)
    let steps = 0;
    const idleInterval = setInterval(() => {
        const noise = Math.random() * 5;
        socket.emit('sensor_stream', noise);
        steps++;

        if (steps > 20) {
            clearInterval(idleInterval);
            sendImpact();
        }
    }, 50);
}

function sendImpact() {
    // 2. Send spike (Impact)
    let force = 0;
    const peak = 500 + Math.random() * 500; // Random peak between 500 and 1000
    let up = true;

    const impactInterval = setInterval(() => {
        if (up) {
            force += 100;
            if (force >= peak) {
                force = peak;
                up = false;
                // Emit event at peak
                socket.emit('impact_detected', Math.round(peak));
            }
        } else {
            force -= 100;
            if (force <= 0) {
                force = 0;
                clearInterval(impactInterval);
                socket.emit('sensor_stream', 0);
                console.log(`Punch finished. Peak: ${Math.round(peak)}`);
                socket.disconnect(); // Or keep running for next punch
            }
        }
        socket.emit('sensor_stream', force);
    }, 20); // Fast update for impact
}
