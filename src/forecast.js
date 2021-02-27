const bent = require("bent");
const { log } = require("./utils");

module.exports = class Forecast {
    constructor() {
        this.fetchForecast();
        setInterval(this.fetchForecast, 1000 * 60 * 10);
    }

    async fetchForecast() {
        log("THIRD PARTY", 2, "Forecast data fetched");
        this.latest = await bent(200, "json")(
            "https://api.openweathermap.org/data/2.5/onecall" +
            "?lat=65.012615&lon=25.471453&units=metric&lang=en " +
            `&exclude=minutely&appid=${process.env.OPENWEATHERMAP}`);
    }
};
