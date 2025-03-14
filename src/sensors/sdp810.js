const { log } = require("../utils");
const i2c = require("i2c-bus");

const addr = 0x25;

/** 
 * Read the differential pressure
 * @returns {Promise<number>} the differential pressure
 */
module.exports = async () => {
    try{
        let i2c1 = await i2c.openPromisified(1);
        await i2c1.i2cWrite(addr, 2, Buffer.from([0x36, 0x2F]));
        await new Promise(res => setTimeout(res, 45));
        let buf = Buffer.alloc(9);
        await i2c1.i2cRead(addr, buf.length, buf)
        if (crc(Uint8Array.prototype.slice.call(buf, 0, 2)) !== buf[2]) throw new Error("Crc 1 failed");
        if (crc(Uint8Array.prototype.slice.call(buf, 3, 5)) !== buf[5]) throw new Error("Crc 2 failed");
        if (crc(Uint8Array.prototype.slice.call(buf, 6, 8)) !== buf[8]) throw new Error("Crc 3 failed");
        let dp = ((buf[0] << 8) | buf[1]) / ((buf[6] << 8) | buf[7]);
        log("SENSOR", 2, `New differential pressure data, ${dp}`);
        await i2c1.close();
        return dp
    } catch(e) {
        log("SENSOR", 0, `sdp810, ${e}`, true);
    }
};

function crc(data) {
    const polynomial = 0x31
    let crc = 0xFF
    for (const byte of data) {
        crc ^= byte
        for (let i = 8; i > 0; --i) {
            crc = crc & 0x80 ? (crc << 1) ^ polynomial : crc << 1
            crc &= 0xFF
        }
    }
    return crc;
}
