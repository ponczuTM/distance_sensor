const express = require('express');
const cors = require('cors');
const { SerialPort } = require('serialport');

const app = express();
const port = 3001;
let human = false;

app.use(cors());
app.use(express.json());

let controller_port_number = 0;
let buffer = '';
let distances = {
    sensor_1: { distance: 175, isSitTaken: false },
    sensor_2: { distance: 175, isSitTaken: false },
    sensor_3: { distance: 175, isSitTaken: false },
    sensor_4: { distance: 175, isSitTaken: false },
};

const portName = 'COM6';
const baudRate = 115200;

const serialPort = new SerialPort({
    path: portName,
    baudRate: baudRate,
    dataBits: 8,
    parity: 'none',
    stopBits: 1,
    flowControl: false,
});


const formatData = (data) => {
    return data.split('').map(char => `[${char.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}]`).join('');
};

const processData = (data) => {
    const distanceMapping = {
        "[Dz=AB]": 5, // 0-10 cm
        "[Dz=01]": 17, // 10-25 cm
        "[Dz=02]": 37, // 25-50 cm
        "[Dz=03]": 62, // 50-75 cm
        "[Dz=04]": 87, // 75-100 cm
        "[Dz=05]": 112, // 100-125 cm
        "[Dz=06]": 137, // 125-150 cm
        "[Dz=07]": 160, // 150-170 cm
        "[Dz=XX]": 175, // 170+ cm
    };

    const distance = distanceMapping[data] || 0;
    // console.log('Distance from sensor_1:', distance);
    if (controller_port_number === 1) {
        updateSensorState('sensor_1', distance);
    }
    if (controller_port_number === 2) {
        updateSensorState('sensor_2', distance);
    }
    if (controller_port_number === 3) {
        updateSensorState('sensor_3', distance);
    }
    if (controller_port_number === 4) {
        updateSensorState('sensor_4', distance);
    }
};

const updateSensorState = (sensor, distance) => {
    distances[sensor].distance = distance;

    clearTimeout(distances[sensor].timeout);

    if (distance < 40) {

        distances[sensor].timeout = setTimeout(() => {

            if (distances[sensor].distance < 40) {
                distances[sensor].isSitTaken = true;
            }
        }, 1500);
    } else {
        distances[sensor].timeout = setTimeout(() => {
            if (distances[sensor].distance > 40) {
                distances[sensor].isSitTaken = false;
            }
        }, 4000);
    }
};

serialPort.on('data', (data) => {
    buffer += data.toString(); 

    if (buffer.includes('\r\n')) {
        const data = buffer;  
        const formattedRawData = formatData(data);
        const dataArray = formattedRawData.match(/\[([A-Fa-f0-9]{2})\]/g);
        if (dataArray && dataArray.length >= 4) {
            const port_id = dataArray?.[3]?.slice(1, -1);
            if (port_id === "31") controller_port_number = 1;
            if (port_id === "32") controller_port_number = 2;
            if (port_id === "33") controller_port_number = 3;
            if (port_id === "34") controller_port_number = 4;
        } else {
            console.log('No port ID found');
        }

        let startIdx = buffer.indexOf('[Dz=');
        let endIdx = buffer.indexOf(']');

        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
            const fullPacket = buffer.substring(startIdx, endIdx + 1);
            processData(fullPacket);
        }

        buffer = '';
        // console.log("sensor: ", controller_port_number);
    }
});

serialPort.on('error', (err) => {
    console.error('Error:', err.message);
});

app.get('/sensors/api', (req, res) => {
    res.json({
        sensors: [
            { name: 'sensor_1', distance: distances.sensor_1.distance, isSitTaken: distances.sensor_1.isSitTaken },
            { name: 'sensor_2', distance: distances.sensor_2.distance, isSitTaken: distances.sensor_2.isSitTaken },
            { name: 'sensor_3', distance: distances.sensor_3.distance, isSitTaken: distances.sensor_3.isSitTaken },
            { name: 'sensor_4', distance: distances.sensor_4.distance, isSitTaken: distances.sensor_4.isSitTaken }
        ]
    });
});

serialPort.on('open', () => {});
app.listen(port, () => {});
