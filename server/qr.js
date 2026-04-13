'use strict';

const qrcode = require('qrcode-terminal');

function printQR(url) {
  qrcode.generate(url, { small: true }, (qr) => {
    console.log('\nScan to join on mobile:');
    console.log(qr);
    console.log(url);
    console.log('');
  });
}

module.exports = { printQR };
