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
        log("DB", 0, "Connection pool initialized");
    }

    get ready() {
        return !this.readyPhase;
    }

    async close() {
        await this.pool.end();
    }

    async setup() {
        let conn = await this.pool.getConnection();
        try {
            await conn.query(
                `CREATE TABLE IF NOT EXISTS daily (
                time double,
                temperature float,
                rainAmount float
                );`
            );
            await conn.query(
                `CREATE TABLE IF NOT EXISTS hourly (
                time double,
                rainAmount float
                );`
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
                solarIrradiance int(11),
                rainIntensity int(11)
                );`
            );
        } catch (e) {
            log("DB", 0, e, true);
            process.exit(0);
        } finally {
            conn.release();
            this.readyPhase--;
            log("DB", 0, "Ensured table existance");
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
                `SELECT temperature FROM daily
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
            "absoluteHumidity, feelsLikeTemp, radiationNow, radiationAvg, " +
            "rainIntensity)" +
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                Date.now(), data.windSpeedNow, data.windDirNow, data.windGust,
                data.windSpeedAvg, data.windDirAvg, data.temperature,
                data.humidity, data.pressure, data.lightness, data.dewPoint, 
                data.solarIrradiance, data.absoluteHumidity, data.feelsLikeTemp,
                data.radiationNow, data.radiationAvg, data.rainIntensity
            ]);
            log("DB", 0, "Saved weather to database.");
        } catch (e) {
            log("DB", 0, e, true);
        } finally {
            conn.release();
        }
    }

    /**
     * Save daily data to database
     * @param {Objet} data - daily data
     */
    async saveDaily(data) {
        if(!this.ready) return;
        let conn = await this.pool.getConnection();
        try {
            await conn.query("INSERT INTO daily VALUES (?, ?, ?)", [
                Date.now(), data.temperature, data.rainAmount
            ]);
            log("DB", 0, "Saved daily data to database.");
        } catch (e) {
            log("DB", 0, e, true);
        } finally {
            conn.release();
        }
    }

    /**
     * Save hourly data to database
     * @param {number} data - hourly data
     */
    async saveHourly(data) {
        if(!this.ready) return;
        let conn = await this.pool.getConnection();
        try {
            await conn.query("INSERT INTO hourly VALUES (?, ?)", [
                Date.now(), data.rainAmount
            ]);
            log("DB", 0, "Saved hourly data to database.");
        } catch (e) {
            log("DB", 0, e, true);
        } finally {
            conn.release();
        }
    }
};
