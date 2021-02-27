const i2c = require("i2c-bus");
const { log } = require("../utils");

/** 
 * Read the light level
 * @returns {Promise<Number>} current light level
 */
module.exports = async () => {
    try{
        // magic manual reading stuff
        let buff = new Buffer.alloc(2);
        let i2c1 = await i2c.openPromisified(1);
        await i2c1.readI2cBlock(0x5c, 0x10, 2, buff);
        // magic math
        let data = Math.round((buff[1] + (256 * buff[0])) / 1.2);
        log("SENSOR", 2, `New light data, ${data}`);
        await i2c1.close();
        return data;
    } catch(e) {
        log("SENSOR", 0, `bh1750, ${e}`, true);
    }
};
