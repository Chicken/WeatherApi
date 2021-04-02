// dependencies and variables
require("dotenv").config();

const cron = require("node-cron");

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
const readAnalog = require("./sensors/ads1115");

const db = new (require("./db"))();
const forecast = new (require("./forecast"))();
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

// db setup and fetch yesterdays average temperature
db.setup().then(() => {
    db.getDailyAverage().then(res => yesterdayAverage = res);
});

// workaround for "this" being undefined
let save = () => db.save(ldata);
// save the data at startup
setTimeout(save, 1000 * 30);
// and on intervals of 10 minutes
setInterval(save, 1000 * 60 * 10);

// every 3 hours
cron.schedule("0 */3 * * *", () => {
    tempValues.push(ldata.temperature);
});

// 30min after midnight
cron.schedule("30 0 * * *", () => {
    yesterdayAverage = parseFloat(
        (tempValues.reduce((a, b) => a + b) / 8).toFixed(1)
    );
    db.saveDailyAvg(yesterdayAverage);
    tempValues = [];
});

// cors, web logging and static files
app.use(cors({
    origin: "*"
}), webLog, express.static(__dirname + "/static"));

// forecast
app.get("/api/forecast", async (_req, res) => {
    log("API", 2, "Forecasts fetched");
    res.send(forecast.latest);
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
        radiation,
        [ solarIrradiance, rainIntensity ]
    ] = await Promise.all([
        readTemp(),
        readPressure(),
        readLight(),
        readRadiation(),
        readAnalog()
    ]);

    // correction math for analog sensors
    solarIrradiance = Math.round((solarIrradiance * 0.125) / 1.67);
    // 23500 is just some arbitary number I just made up
    rainIntensity = 23500 - rainIntensity;
    rainIntensity = rainIntensity < 0 ? 0 : Math.round(rainIntensity / 23500);

    // for 1 hour radiation average
    if(radiationValues.length >= 3600) radiationValues.shift();
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
        dailyTempAvg: yesterdayAverage,
        humidity: hum,
        rainIntensity,
        pressure,
        lightness,
        solarIrradiance,
        radiationNow: radiation,
        radiationAvg: parseFloat(arrAvg(radiationValues).toFixed(2)),
        dewPoint: parseFloat(dewPoint(temp, hum).toFixed(1)),
        absoluteHumidity: parseFloat(absoluteHumidity(temp, hum).toFixed(1)),
        feelsLikeTemp: feelsLikeTemp(temp, wsAvg)
    };

    log("SENSOR", 2, "Completed a cycle");
});

log("APP", 0, "Started");
