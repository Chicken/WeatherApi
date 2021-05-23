const { Gpio } = require("onoff");
const { log } = require("../utils");

class Rain {
    constructor() {
        this._sensor = new Gpio(24, "in", "rising");
        this._cumulative = {
            daily: 0,
            hourly: 0
        };
        this._debouncing = false;

        this._sensor.watch(err => {
            if (err) {
                log("SENSOR", 0, `rain, ${err}`, true);
                return;
            }
            if (this._debouncing) return;
            this._cumulative.daily += 0.5;
            this._cumulative.hourly += 0.5;
            this._debouncing = true;
            setTimeout(() => this._debouncing = false, 50);
        });
    }

    /**
     * @returns {Number} the cumulative rain amount of the day in millimeters
     */
    getDaily() {
        return this._cumulative.daily;
    }

    /**
     * @returns {Number} the cumulative rain amount of the hour in millimeters
     */
    getHourly() {
        return this._cumulative.hourly;
    }

    /**
     * Clears the cumulative hourly counter
     */
    clearHourly() {
        this._cumulative.hourly = 0;
    }

    /**
     * Clears the cumulative daily counter
     */
    clearlyDaily() {
        this._cumulative.daily = 0;
    }

    /**
     * Unexports the gpio connection
     */
    close() {
        this._sensor.unexport();
    }
}

module.exports = Rain;
