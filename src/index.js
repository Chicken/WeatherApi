// dependencies and variables
require("dotenv").config();

const SerialPort = require("serialport");
const Readline = require("@serialport/parser-readline");
const port = new SerialPort("/dev/serial0", { baudRate: 9600 });
const parser = port.pipe(new Readline({ delimiter: "\n" }));

const express = require("express");
const app = express();
const cors = require("cors");

const readTemp = require("./sensors/sht31");
const readPressure = require("./sensors/bmp180");
const readLight = require("./sensors/bh1750");
const readRadiation = require("./sensors/cajoe");

const db = new (require("./db"));
const forecast = new (require("./forecast"));
const {
    arrAvg,
    getSpeedText,
    getDirectionText,
    getAverage,
    dewPoint,
    absoluteHumidity,
    feelsLikeTemp,
    log,
    webLog
} = require("./utils");

// global variables to save stuff
let windValues = [],
    radiationValues = [],
    tempValues = [],
    ldata = {},
    yesterdayAverage;

// fetch yesterdays average temperature and save it
db.getDailyAverage().then(res => yesterdayAverage = res);

// workaround for "this" being undefined
let save = () => db.save(ldata);
// save the data at startup
setTimeout(save, 1000 * 30);
// and on intervals of 10 minutes
setInterval(save, 1000 * 60 * 10);

// dailyaverage timer
// probably overcomplicated
let currentTime = new Date();
let currentHours = currentTime.getHours();
let currentMinutes = currentTime.getMinutes();
let timeTillStart = 24 * 60 - (currentHours * 60 + currentMinutes);
setTimeout(() => {
    tempValues.push(ldata.temperature);
    setInterval(() => {
        tempValues.push(ldata.temperature);
        if(tempValues.length == 8) {
            yesterdayAverage = tempValues.reduce((a, b) => a + b) / 8;
            tempValues = [];
        }
    }, 3 * 60 * 60 * 1000);
}, timeTillStart * 60 * 1000);

// cors, web logging and static files
app.use(cors({
    origin: "*"
}), webLog, express.static(__dirname + "/static"));

// forecast
app.get("/api/forecast", async (_req, res) => {
    log("API", 2, "Forecasts fetched");
    // yeah we making this object up on the fly
    // probably not good
    let latest = forecast.latest;
    res.send({
        today: {
            sunrise: latest.current.sunrise,
            sunset: latest.current.sunset,
            temp: latest.daily[0].temp,
            feels: latest.daily[0].feels_like,
            uv: latest.daily[0].uvi,
            windspeed: latest.daily[0].wind_speed,
            summary: latest.daily[0].weather[0].description,
            icon: latest.daily[0].weather[0].icon
        },
        week: latest.daily.map(v => {
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
    });
});

// all the weather data, this is the only useful endpoint
app.get("/api/weather", (_req, res) => {
    log("API", 2, "Weather data fetched");
    res.send(ldata);
});

// listen for requests
app.listen(process.env.PORT, () => {
    log("APP", 0, "Server online");
});

// the whole event loop is based on the wind sensor
// sending data on intervals and fetching everything else
// when that happens. Kinda stupid I know
parser.on("data", async data => {
    if(!db.ready) return;
    data = data.split(",");
    // if the data is invalid
    // (this happens way too often during the winter time)
    // take the latest valid data
    if(data[5].startsWith("V")) {
        log("SENSOR", 0, `Invalid wind data, ${data}`, true);
        try {
            data = windValues[windValues.length - 1];
        } catch(e) {
            log("SENSOR", 0, "No valid past values", true);
            return;
        }
    } else {
        log("SENSOR", 2, `New wind data, ${data}`);
        data = {
            direction: parseInt(data[1]),
            speed: parseFloat(data[3])
        };
    }

    // we get data every second so 600 seconds is 10 minutes
    // this is needed to calculate the average and gust
    if (windValues.length >= 600) windValues.shift();
    windValues.push(data);
    
    // use of promise.all and destructuring for neat code
    let [
        { temp, hum },
        pressure,
        lightness,
        radiation
    ] = await Promise.all([
        readTemp(),
        readPressure(),
        readLight(),
        readRadiation()
    ]);

    // for 10min radiation average
    if(radiationValues.length >= 600) radiationValues.shift();
    radiationValues.push(radiation);

    // windspeed average
    let wsAvg = parseFloat(arrAvg(windValues.map(v => v.speed)).toFixed(1));
    // yeah we do this giant object in the fly too
    // looks messy, is messy
    ldata = {
        windSpeedNow: windValues[windValues.length - 1].speed,
        windSpeedNowText: getSpeedText(windValues[windValues.length - 1].speed),
        windDirNow: windValues[windValues.length - 1].direction,
        windDirNowText:
            getDirectionText(windValues[windValues.length - 1].direction),
        windGust: Math.max(...windValues.map(v => v.speed)),
        windGustText: getSpeedText(Math.max(...windValues.map(v => v.speed))),
        windSpeedAvg: wsAvg,
        windSpeedAvgText: getSpeedText(arrAvg(windValues.map(v => v.speed))),
        windDirAvg:
            Math.round(getAverage(windValues.map(v => v.direction)).toFixed(1)),
        windDirAvgText:
            getDirectionText(getAverage(windValues.map(v => v.direction))),
        temperature: temp,
        dailyTempAvg: parseFloat(yesterdayAverage.toFixed(1)),
        humidity: hum,
        pressure,
        lightness,
        radiationNow: radiation,
        radiationAvg: parseFloat(arrAvg(radiationValues).toFixed(2)),
        dewPoint: parseFloat(dewPoint(temp, hum).toFixed(1)),
        absoluteHumidity: parseFloat(absoluteHumidity(temp, hum).toFixed(1)),
        feelsLikeTemp: feelsLikeTemp(temp, wsAvg)
    };

    log("SENSOR", 2, "Completed a cycle");
});

log("APP", 0, "Started");
