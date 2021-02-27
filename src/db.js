const mariadb = require("mariadb");
const { log } = require("./utils");

module.exports = class Database {
    constructor() {
        this.ready = false;
        this.pool = mariadb.createPool({
            database: process.env.DB_DATABASE,
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PW,
            connectionLimit: 5
        });
    }
    
    /**
     * @returns {Promise<Number>} yesterdays temperature average
     */
    async getDailyAverage() {
        let conn = await this.pool.getConnection();
        let avg;
        try {
            let res = await conn.query(
                "SELECT dailyTempAvg FROM weather ORDER BY time desc LIMIT 1"
            );
            avg = res[0].dailyTempAvg;
            log("DB", 0, "Fetched latest dailyTempAvg from database.");
        } catch (e) {
            log("DB", 0, e, true);
        } finally {
            conn.release();
        }
        this.ready = true;
        return avg;
    }

    /**
     * Save the data to database
     * @param {Object} data - weather data  
     * @param {number} data.windSpeedNow
     * @param {number} data.windDirNow
     * @param {number} data.windGust
     * @param {number} data.windSpeedAvg
     * @param {number} data.windDirAvg
     * @param {number} data.temperature
     * @param {number} data.dailyTempAvg
     * @param {number} data.humidity
     * @param {number} data.pressure
     * @param {number} data.lightness
     * @param {number} data.dewPont
     * @param {number} data.absoluteHumidity
     * @param {number} data.feelsLikeTemp
     * @param {number} data.radiationNow
     * @param {number} data.radiationAvg
     * 
     */
    async save(data) {
        let conn = await this.pool.getConnection();
        try {
            await conn.query("INSERT INTO weather (time, windSpeedNow, "    + 
            "windDirNow, windGust, windSpeedAvg, windDirAvg, temperature, " +
            "dailyTempAvg, humidity, pressure, lightness, dewPoint, "       +
            "absoluteHumidity, feelsLikeTemp, radiationNow, radiationAvg) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                Date.now(), data.windSpeedNow, data.windDirNow, data.windGust,
                data.windSpeedAvg, data.windDirAvg, data.temperature,
                data.dailyTempAvg, data.humidity, data.pressure, data.lightness,
                data.dewPoint, data.absoluteHumidity, data.feelsLikeTemp,
                data.radiationNow, data.radiationAvg
            ]);
            log("DB", 0, "Saved weather to database.");
        } catch (e) {
            log("DB", 0, e, true);
        } finally {
            conn.release();
        }
    }
};
