export async function discoverDevices() {
  return [
    { type: 'modbus', host: '192.168.1.50', port: 502 },
    { type: 'mqtt', host: 'localhost', port: 1883 },
    { type: 'campbell', host: '192.168.1.60', port: 6785 },
    { type: 'hobo-usb', path: '/dev/ttyUSB0' },
  ];
}
