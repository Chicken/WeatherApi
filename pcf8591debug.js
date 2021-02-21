// Simple debug script to read all channels of pcf8591
// USAGE: node pcf8591debug.js

// require i2cbus
const i2c = require("i2c-bus");
// open device
const i2c1 = i2c.openSync(1);

// function to "sleep" = add delay inbetween reads
let sleep = ms => new Promise(r => setTimeout(r, ms));

// header
console.log("Byte readings from each channel");
console.log("Ch:    0 |   1 |   2 |   3");
console.log("Cmd:", ( [...Array(4)].map((_, i) => (0x40 + i).toString(16).padStart(3, " ")) ).join(" | "));

// start anonymous async function to await the sleep call
(async () => {
    // just loop forever
    // eslint-disable-next-line no-constant-condition
    while(true) {
        // single line js magic
        // create array with the length of 4
        // fill it with the values from channels 1-4 of
        // the device according to the index in array
        // by reading a byte and using some bitwise math to turn index
        // into a control byte the hardware understands
        // and join the values with -
        console.log("Val:", [...Array(4)].map((_, i) => (i2c1.readByteSync(0x48, 0x40 + i)).toString().padStart(3, " ")).join(" | "));
        // await 1000ms (1 second)
        await sleep(1000);
    }
})();
