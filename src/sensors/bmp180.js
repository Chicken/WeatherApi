const BMP180 = require("bmp180-sensor");
const { log } = require("../utils");

/** 
 * Read the air pressure
 * @returns {Promise<Number>} pressure
 */
module.exports = async () => {
    try{
        // myeh lets just use a lib here too :D
        let bmp180 = await BMP180({ address:0x77, mode:3, units:"metric" });
        let pressure = await bmp180.readPressure();
        log("SENSOR", 2, `New pressure data, ${pressure}`);
        await bmp180.close();
        return Math.round(pressure / 100);
    } catch(e) {
        log("SENSOR", 0, `bmp180, ${e}`, true);
    }
};
