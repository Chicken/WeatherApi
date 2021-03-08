const i2c = require("i2c-bus");
const { log } = require("../utils");

/** 
 * Read the radiation
 * @returns {Promise<Number>} current radiation level
 */
module.exports = async () => {
    try{
        let buffer = new Buffer.alloc(1);
        let i2c1 = await i2c.openPromisified(1);
        await i2c1.readI2cBlock(0x08, 0x00, 1, buffer);
        log("SENSOR", 2, `New radiation data, ${buffer[0]}`);
        await i2c1.close();
        return buffer[0] / 100;
    } catch(e) {
        log("SENSOR", 0, `cajoe, ${e}`, true);
    }
};
