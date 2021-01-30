// dependencies and variables
const mariadb = require("mariadb");
const bent = require("bent");
const SerialPort = require("serialport");
const SHT31 = require("raspi-node-sht31");
const sht31 = new SHT31();
const BMP180 = require("bmp180-sensor");
const i2c = require("i2c-bus");
const Readline = require("@serialport/parser-readline");
const port = new SerialPort("/dev/serial0", { baudRate: 9600 });
const parser = port.pipe(new Readline({ delimiter: "\n" }));
const express = require("express");
const app = express();
require("dotenv").config();

let values = [],
    ldata,
    raw = [],
    todayTemps = [],
    yesterdayAverage = undefined,
    latestTemp = {},
    latestPressure = {},
    latestLight = {},
    latestForecast = {};

// 0 = nothing, 1 = important, 2 = website, 3 = everything
const LOGGING_LEVEL = 2;

let formatDate = date => `[${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()} | ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}]`;

/**
 * Logger function
 * @param {String} scope - scope ex. "APP", "DB", "WEBPAGE"
 * @param {Number} level - logging level ex. 1, 2, 3
 * @param {String} msg - message to log ex. "started", "saved data"
 * @param {Boolean} error if true forces logging and calls console.error()
 */
let log = (scope, level, msg, error = false) => {
    if(LOGGING_LEVEL > level || error) console[error ? "error" : "log"](`${formatDate(new Date())} ${scope}: ${msg}`);
}; 

// db
const pool = mariadb.createPool({
    database: "weather",
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PW,
    connectionLimit: 5
});

(async()=>{
    let conn = await pool.getConnection();
    try {
        let res = await conn.query("SELECT dailyTempAvg FROM weather ORDER BY time desc LIMIT 1");
        yesterdayAverage = res[0].dailyTempAvg;
    } catch (e) {
        log("DB", 0, e, true);
    } finally {
        log("DB", 0, "Fetched latest dailyTempAvg from database.");
        conn.release();
    }
})();

async function saveToDb() {
    let conn = await pool.getConnection();
    try {
        await conn.query("INSERT INTO weather (time, windSpeedNow, windDirNow, windGust, windSpeedAvg, windDirAvg, temperature, dailyTempAvg, humidity, pressure, lightness, dewPoint, absoluteHumidity, feelsLikeTemp) " +
                         "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [Date.now(), ldata.windSpeedNow, ldata.windDirNow, ldata.windGust, ldata.windSpeedAvg, ldata.windDirAvg, ldata.temperature, ldata.dailyTempAvg || null,
            ldata.humidity, ldata.pressure, ldata.lightness, ldata.dewPoint, ldata.absoluteHumidity, ldata.feelsLikeTemp]);
    } catch (e) {
        log("DB", 0, e, true);
    } finally {
        log("DB", 0, "Saved weather to database.");
        conn.release();
    }
}

setTimeout(saveToDb, 1000*30);
setInterval(saveToDb, 1000*60*10);

// dailyaverage timer
// too lazy to implement fetching earlier data from db to memory
let currentTime = new Date();
let currentHours = currentTime.getHours();
let currentMinutes = currentTime.getMinutes();
let timeTillStart = 24 * 60 - (currentHours * 60 + currentMinutes);
setTimeout(() => {
    todayTemps.push(latestTemp.temp);
    setInterval(() => {
        todayTemps.push(latestTemp.temp);
        if(todayTemps.length == 8) {
            yesterdayAverage = todayTemps.reduce((a, b) => a + b) / 8;
            todayTemps = [];
        }
    }, 3 * 60 * 60 * 1000);
}, timeTillStart * 60 * 1000);

//forecast fetch loop
async function fetchForecast() {
    log("THIRD PARTY", 2, "Forecast data fetched");
    latestForecast = await bent(200, "json")(`https://api.openweathermap.org/data/2.5/onecall?lat=65.012615&lon=25.471453&units=metric&lang=en&exclude=minutely&appid=${process.env.key}`);
}
fetchForecast();
setInterval(fetchForecast, 1000 * 60 * 10);

//main page
app.get("/",(_req, res)=>{
    log("WEBPAGE", 1, "Visited");
    res.sendFile(__dirname + "/index.html");
});

//worker
app.get("/worker.js", (_req, res) => {
    res.sendFile(__dirname + "/worker.js");
});

//static files
app.use("/media", express.static(__dirname + "/media"));

//api doc
app.get("/api", (_req, res) => {
    log("WEBPAGE", 1, "Api docs visited");
    res.send(
        `API DOCS<br>
    <br>
    all endpoints return json data.
    GET /api/raw - raw wind data <br>
    GET /api/parsed - parsed wind data <br>
    GET /api/weather - all the weather info <br>
    GET /api/forecast - parsed forecast <br>
    GET /api/forecast/all - latest forecast fetched from openweathermap <br>
    <br>
    &copy; Antti.Codes 2021`
    );
});

//forecast
app.get("/api/forecast", (_req, res) => {
    log("API", 2, "Forecasts fetched");
    res.send({
        today: {
            sunrise: latestForecast.current.sunrise,
            sunset: latestForecast.current.sunset,
            temp: latestForecast.daily[0].temp,
            feels: latestForecast.daily[0].feels_like,
            uv: latestForecast.daily[0].uvi,
            windspeed: latestForecast.daily[0].wind_speed,
            summary: latestForecast.daily[0].weather[0].description,
            icon: latestForecast.daily[0].weather[0].icon
        },
        week: latestForecast.daily.map(v=>{
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

//forecast but raw 3rd party api response
app.get("/api/forecast/all", (_req, res)=>{
    log("API", 2, "Raw forecast fetched");
    res.send(latestForecast);
});

//all the weather data
app.get("/api/weather", (_req, res) => {
    log("API", 2, "Weather data fetched");
    res.send(ldata);
});

//raw wind sensor data
app.get("/api/raw", (_req, res) => {
    log("API", 2, "Raw wind data fetched");
    res.send(raw);
});

//parsed wind sensor data
app.get("/api/parsed", (_req, res) => {
    log("API", 2, "Parsed wind data fetched");
    res.send(values);
});

app.listen(process.env.PORT, () => {
    log("APP", 0, "Server online");
});

async function readTemp() {
    try{
        let data = await sht31.readSensorData();
        let temp = parseFloat(data.temperature.toFixed(1));
        let hum = Math.round(data.humidity);
        log("SENSOR", 2, "New temperature and humidity data " + temp + " " + hum);
        return { temp, hum };
    } catch(e) {
        log("SENSOR", 0, `sht31, ${e}`, true);
    }
}

async function readPressure() {
    try{
        let bmp180 = await BMP180({address:0x77,mode:3,units:"metric"});
        let data = await bmp180.read();
        log("SENSOR", 2, "New pressure and temperature data " + data.pressure + " " + data.temperature);
        await bmp180.close();
        data.pressure = Math.round(data.pressure/100);
        return data;
    } catch(e) {
        log("SENSOR", 0, `bmp180, ${e}`, true);
    }
}

async function readLight() {
    try{
        let buffer = await new Buffer.alloc(2);
        let i2c1 = await i2c.openPromisified(1);
        await i2c1.readI2cBlock(0x5c, 0x20, 2, buffer);
        log("SENSOR", 2, "New light data " + ((buffer[1] + (256 * buffer[0])) / 1.2));
        await i2c1.close();
        return {
            light: parseFloat(((buffer[1] + (256 * buffer[0])) / 1.2).toFixed(1))
        };
    } catch(e) {
        log("SENSOR", 0, `bh1750, ${e}`, true);
    }
}

parser.on("data", async data => {
    data = data.split(",");
    if(data[5].startsWith("V")) {
        log("SENSOR", 0, "Invalid wind data " + data, true);
        data = raw[raw.length - 1].split(",");
    } else {
        log("SENSOR", 2, "New wind data " + data);
    }
    if(raw.length >= 600) raw.shift();
    raw.push(data.join(","));
    data = {
        direction: parseInt(data[1]),
        speed: parseFloat(data[3])
    };
    if(values.length >= 600) values.shift();
    values.push(data);
    [
        latestTemp,
        latestPressure,
        latestLight
    ] = await Promise.all([
        readTemp(),
        readPressure(),
        readLight()
    ]);

    let wsAvg = parseFloat(arrAvg(values.map(v => v.speed)).toFixed(1));
    ldata = {
        windSpeedNow: values[values.length - 1].speed,
        windSpeedNowText: getSpeedText(values[values.length - 1].speed),
        windDirNow: values[values.length - 1].direction,
        windDirNowText: getDirectionText(values[values.length - 1].direction),
        windGust: Math.max(...values.map(v => v.speed)),
        windGustText: getSpeedText(Math.max(...values.map(v => v.speed))),
        windSpeedAvg: wsAvg,
        windSpeedAvgText: getSpeedText(arrAvg(values.map(v => v.speed))),
        windDirAvg: Math.round(getAverage(values.map(v => v.direction)).toFixed(1)),
        windDirAvgText: getDirectionText(getAverage(values.map(v => v.direction))),
        temperature: latestTemp.temp,
        dailyTempAvg: yesterdayAverage ? parseFloat(yesterdayAverage.toFixed(1)) : undefined,
        humidity: latestTemp.hum,
        pressure: latestPressure.pressure,
        lightness: Math.round(latestLight.light),
        dewPoint: parseFloat(dewPoint(latestTemp.temp, latestTemp.hum).toFixed(1)),
        absoluteHumidity: parseFloat(absoluteHumidity(latestTemp.temp, latestTemp.hum).toFixed(1)),
        feelsLikeTemp: feelsLikeTemp(latestTemp.temp, wsAvg)
    };
});

function getDirectionText(dir) {
    if(dir >= 337.5 || dir < 22.5) return "Pohjoinen";
    if(dir >= 22.5 && dir < 67.5) return "Koillinen";
    if(dir >= 67.5 && dir < 112.5) return "Itä";
    if(dir >= 112.5 && dir < 157.5) return "Kaakko";
    if(dir >= 157.5 && dir < 202.5) return "Etelä";
    if(dir >= 202.5 && dir < 247.5) return "Lounas";
    if(dir >= 247.5 && dir < 292.5) return "Länsi";
    if(dir >= 292.5 && dir < 337.5) return "Luode";
    return "ERROR";
}

function getSpeedText(speed) {
    if(speed < 1) return "Tyyntä";
    if(speed >= 1 && speed < 4) return "Heikkoa tuulta";
    if(speed >= 4 && speed < 8) return "Kohtalaista tuulta";
    if(speed >= 8 && speed < 14) return "Navakkaa tuulta";
    if(speed >= 14 && speed < 21) return "Kovaa tuulta";
    if(speed >= 21 && speed < 33) return "Myrskyä";
    if(speed >= 33) return "Hirmumyrskyä";
    return "ERROR";
}

let arrAvg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;

let degToRad = deg => deg * (Math.PI / 180);

let radToDeg = rad => rad * (180 / Math.PI);

function getAverage(angles) {
    let sinSum = 0;
    let cosSum = 0;

    for(let angle of angles){
        let r = degToRad(angle);
        sinSum += Math.sin(r);
        cosSum += Math.cos(r);
    }
  
    let flen = angles.length;
    let s = sinSum / flen;
    let c = cosSum / flen;

    let arc = radToDeg(Math.atan(s / c));
    let average = 0;
    if(s > 0 && c > 0) {
        average = arc;
    } else if(c < 0) {
        average = arc + 180;
    } else if(s < 0 && c > 0) {
        average = arc + 360;
    }
    if(average == 360) return 0;
    return average;
}

function dewPoint(temp, hum) {
    let H = (Math.log10(hum) - 2) / 0.4343 + (17.62 * temp) / (243.12 + temp);
    return 243.12 * H / (17.62 - H);
}

let absoluteHumidity = (temp, hum) => 216.7*(hum/100*6.112*Math.exp(17.62*temp/(243.12+temp))/(273.15+temp));

function feelsLikeTemp(T, V) {
    if(T > 10 || V < 1.5) return T;
    return (13.12 + 0.6215 * T - 13.956 * Math.pow(V, 0.16) + 0.4867 * T * Math.pow(V, 0.16)).toFixed(1);
}

log("APP", 0, "started");
