const mariadb = require("mariadb");
const { log } = require("./utils");

module.exports = class Database {
    constructor() {
        this.readyPhase = 2;
        this.pool = mariadb.createPool({
            database: process.env.DB_DATABASE,
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PW,
            connectionLimit: 5
        });
    }

    get ready() {
        return !this.readyPhase;
    }

    async setup() {
        let conn = await this.pool.getConnection();
        try {
            await conn.query(
                `CREATE TABLE IF NOT EXISTS dailyAverage
                (time double, temperature float);`
            );
            await conn.query(
                `CREATE TABLE IF NOT EXISTS weather (
                time double,
                windSpeedNow float,
                windDirNow int(11),
                windGust float,
                windSpeedAvg float,
                windDirAvg int(11),
                temperature float,
                humidity int(11),
                pressure int(11),
                lightness int(11),
                dewPoint float,
                absoluteHumidity float,
                feelsLikeTemp float,
                radiationNow float,
                radiationAvg float,
                solarIrradiance int(11)
                );`
            );
        } catch (e) {
            log("DB", 0, e, true);
            process.exit(0);
        } finally {
            conn.release();
            this.readyPhase--;
        }
    }
    
    /**
     * @returns {Promise<Number>} yesterdays temperature average
     */
    async getDailyAverage() {
        if(this.readyPhase > 1) return null;
        let conn = await this.pool.getConnection();
        let avg;
        try {
            let res = await conn.query(
                `SELECT temperature FROM dailyAverage
                ORDER BY time desc LIMIT 1`
            );
            avg = res[0]?.temperature ?? null;
            log("DB", 0, "Fetched latest dailyTempAvg from database.");
        } catch (e) {
            log("DB", 0, e, true);
        } finally {
            conn.release();
        }
        this.readyPhase--;
        return avg;
    }

    /**
     * Save the data to database
     * @param {Object} data - weather data
     */
    async save(data) {
        if(!this.ready) return;
        let conn = await this.pool.getConnection();
        try {
            await conn.query("INSERT INTO weather (time, windSpeedNow, "    + 
            "windDirNow, windGust, windSpeedAvg, windDirAvg, temperature, " +
            "humidity, pressure, lightness, dewPoint, solarIrradiance, "    +
            "absoluteHumidity, feelsLikeTemp, radiationNow, radiationAvg) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                Date.now(), data.windSpeedNow, data.windDirNow, data.windGust,
                data.windSpeedAvg, data.windDirAvg, data.temperature,
                data.humidity, data.pressure, data.lightness, data.dewPoint, 
                data.solarIrradiance, data.absoluteHumidity, data.feelsLikeTemp,
                data.radiationNow, data.radiationAvg
            ]);
            log("DB", 0, "Saved weather to database.");
        } catch (e) {
            log("DB", 0, e, true);
        } finally {
            conn.release();
        }
    }

    /**
     * Save daily temperature data to database
     * @param {number} data - daily temperature average 
     */
    async saveDailyAvg(data) {
        if(!this.ready) return;
        let conn = await this.pool.getConnection();
        try {
            await conn.query("INSERT INTO dailyAverage VALUES (?, ?)", [
                Date.now(), data
            ]);
            log("DB", 0, "Saved daily temperature to database.");
        } catch (e) {
            log("DB", 0, e, true);
        } finally {
            conn.release();
        }
    }
};
