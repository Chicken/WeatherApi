// Simple debug script to read from i2c bus
// USAGE: node i2cread.js <address> <cmd> <size>

// require i2c-bus
const i2c = require("i2c-bus");
// open the first one
let i2c1 = i2c.openSync(1);
// parse args
let args = process.argv.slice(2);
// some argument checking  because i dont trust myself
if(args.length < 3 || args.some(v => isNaN(parseInt(v)) && isNaN(parseInt(v, 16)) )) {
    console.log("Not enough or invalid arguments.");
    process.exit(0);
}
// allocate a buffer
let buffer = Buffer.alloc(parseInt(args[2]));
// read i2c block the same size as the buffer and save it to the  buffer
// read from the supplied address with the command
i2c1.readI2cBlockSync(parseInt(args[0], 16), parseInt(args[1], 16), parseInt(args[2]), buffer);
// output the buffer as numbers joined by a -
// this is just a design choice
console.log(Array.from(buffer).join(" - "));
