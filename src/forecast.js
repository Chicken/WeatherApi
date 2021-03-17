const bent = require("bent");
const { log } = require("./utils");

module.exports = class Forecast {
    constructor() {
        this.fetchForecast();
        setInterval(this.fetchForecast.bind(this), 1000 * 60 * 10);
    }

    async fetchForecast() {
        log("THIRD PARTY", 2, "Forecast data fetched");
        let res = await bent(200, "json")(
            "https://api.openweathermap.org/data/2.5/onecall" +
            "?lat=65.012615&lon=25.471453&units=metric&lang=en" +
            `&exclude=minutely&appid=${process.env.OPENWEATHERMAP}`);
        this.latest = {
            today: {
                sunrise: res.current.sunrise,
                sunset: res.current.sunset,
                temp: res.daily[0].temp,
                feels: res.daily[0].feels_like,
                uv: res.daily[0].uvi,
                windspeed: res.daily[0].wind_speed,
                summary: res.daily[0].weather[0].description,
                icon: res.daily[0].weather[0].icon
            },
            week: res.daily.map(v => {
                return {
                    time: v.dt,
                    temp: {
                        max: v.temp.max,
                        min: v.temp.min
                    },
                    icon: v.weather[0].icon,
                    windspeed: v.wind_speed,
                    sunrise: v.sunrise,
                    sunset: v.sunset,
                };
            })
        };
    }
};
