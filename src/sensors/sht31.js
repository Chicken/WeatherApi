const SHT31 = require("raspi-node-sht31");
const sht31 = new SHT31();
const { log } = require("../utils");

/** 
 * Read the temperature
 * @returns {Promise<{temp: Number, hum: Number}>}
 * temperature and humidity object
 */
module.exports = async () => {
    try{
        // too lazy to manually do stuff
        // just use some lib from the interwebs
        let data = await sht31.readSensorData();
        let temp = parseFloat(data.temperature.toFixed(1));
        let hum = Math.round(data.humidity);
        log("SENSOR", 2, `New temperature and humidity data, ${temp}, ${hum}`);
        // fancy temp sensor gives humidity too
        return { temp, hum };
    } catch(e) {
        log("SENSOR", 0, `sht31, ${e}`, true);
    }
};
