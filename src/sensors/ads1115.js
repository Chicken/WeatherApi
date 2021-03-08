const i2c = require("i2c-bus");
const { log } = require("../utils");
const ADS1115 = require("ads1115");

/** 
 * Read all channels from ADS1115 analog to digital conveter
 * @returns {Promise<Array<Number>>} channels with numbers
 */
module.exports = async () => {
    try{
        let data = [];
        let i2c1 = await i2c.openPromisified(1);
        let ads1115 = await ADS1115(i2c1);
        ads1115.gain = "1";
        for(let ch of ["0+GND", "1+GND", "2+GND", "3+GND"]) {
            data.push(await ads1115.measure(ch));
        }
        log("SENSOR", 2, `New analog data, ${data}`);
        await i2c1.close();
        return data;
    } catch(e) {
        log("SENSOR", 0, `ads1115, ${e}`, true);
    }
};
