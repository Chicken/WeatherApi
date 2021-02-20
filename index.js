/*
TODO LIST
- modular, this file is getting way too big
- get rid of the sht31 and bmp180 libs, would be cleaner to just manually read all from i2c
- clean up some code and api stuff

i2C ADDRESS CHEATSHEET
device  target    address
sht31   temp&hum  44
bmp180  pressure  77
bh1750  light     5c
        radiation 08
        future    48
*/

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
const cors = require("cors");
require("dotenv").config();

// global variables to save stuff
let values = [],
    radiationValues = [],
    ldata,
    raw = [],
    todayTemps = [],
    yesterdayAverage = undefined,
    latestTemp = {},
    latestPressure = 0,
    latestLight = 0,
    latestRadiation = 0,
    latestForecast = {};

// 0 = nothing, 1 = important, 2 = website, 3 = everything
const LOGGING_LEVEL = 2;

/**
 * Format date function
 * @param {Date} date - date object to be formatted 
 * @returns {String} formatted date
 */
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

// db connection pool
const pool = mariadb.createPool({
    database: "weather",
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PW,
    connectionLimit: 5
});

// get the dailyTempAvg from db because lazy to temperature and calculate
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

/**
 * Save the data to databse
 * @returns {Promise} - resolves when data is saved 
 */
async function saveToDb() {
    let conn = await pool.getConnection();
    try {
        await conn.query("INSERT INTO weather (time, windSpeedNow, windDirNow, windGust, windSpeedAvg, windDirAvg, temperature, dailyTempAvg, humidity, pressure, lightness, dewPoint, absoluteHumidity, feelsLikeTemp, radiationNow, radiationAvg) " +
                         "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [Date.now(), ldata.windSpeedNow, ldata.windDirNow, ldata.windGust, ldata.windSpeedAvg, ldata.windDirAvg, ldata.temperature, ldata.dailyTempAvg || null,
            ldata.humidity, ldata.pressure, ldata.lightness, ldata.dewPoint, ldata.absoluteHumidity, ldata.feelsLikeTemp, ldata.radiationNow, ldata.radiationAvg]);
    } catch (e) {
        log("DB", 0, e, true);
    } finally {
        log("DB", 0, "Saved weather to database.");
        conn.release();
    }
}

// save the data at startup
setTimeout(saveToDb, 1000*30);
// and on intervals of 10 minutes
setInterval(saveToDb, 1000*60*10);

// dailyaverage timer
// probably overcomplicated
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

// forecast fetch loop
async function fetchForecast() {
    log("THIRD PARTY", 2, "Forecast data fetched");
    latestForecast = await bent(200, "json")(`https://api.openweathermap.org/data/2.5/onecall?lat=65.012615&lon=25.471453&units=metric&lang=en&exclude=minutely&appid=${process.env.key}`);
}
fetchForecast();
setInterval(fetchForecast, 1000 * 60 * 10);

// cors
app.use(cors({
    origin: "*"
}));

// main page
app.get("/",(_req, res)=>{
    log("WEBPAGE", 1, "Visited");
    res.sendFile(__dirname + "/index.html");
});

// worker
app.get("/worker.js", (_req, res) => {
    res.sendFile(__dirname + "/worker.js");
});

// static files
app.use("/media", express.static(__dirname + "/media"));

// api doc
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

// forecast
app.get("/api/forecast", (_req, res) => {
    log("API", 2, "Forecasts fetched");
    // yeah we making this object up on the fly
    // probably not good
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

// forecast but raw 3rd party api response, why do we need this again?
app.get("/api/forecast/all", (_req, res)=>{
    log("API", 2, "Raw forecast fetched");
    res.send(latestForecast);
});

// all the weather data, this is the only useful endpoint
app.get("/api/weather", (_req, res) => {
    log("API", 2, "Weather data fetched");
    res.send(ldata);
});

// raw wind sensor data, why do we need this again? probably debugging
app.get("/api/raw", (_req, res) => {
    log("API", 2, "Raw wind data fetched");
    res.send(raw);
});

// parsed wind sensor data, why do we need this again?
app.get("/api/parsed", (_req, res) => {
    log("API", 2, "Parsed wind data fetched");
    res.send(values);
});

// listen for requests
app.listen(process.env.PORT, () => {
    log("APP", 0, "Server online");
});

/** 
 * Read the temperature
 * @returns {Promise<{temp: Number, hum: Number}>} temperature and humidity object
 */
async function readTemp() {
    try{
        // too lazy to manually do stuff
        // just use some lib from the interwebs
        let data = await sht31.readSensorData();
        let temp = parseFloat(data.temperature.toFixed(1));
        let hum = Math.round(data.humidity);
        log("SENSOR", 2, "New temperature and humidity data " + temp + " " + hum);
        // fancy temp sensor gives humidity too
        return { temp, hum };
    } catch(e) {
        log("SENSOR", 0, `sht31, ${e}`, true);
    }
}

/** 
 * Read the air pressure
 * @returns {Promise<Number>} pressure
 */
async function readPressure() {
    try{
        // myeh lets just use a lib here too :D
        let bmp180 = await BMP180({ address:0x77, mode:3, units:"metric" });
        let data = await bmp180.read();
        log("SENSOR", 2, "New pressure data " + data.pressure);
        await bmp180.close();
        return Math.round(data.pressure / 100);
    } catch(e) {
        log("SENSOR", 0, `bmp180, ${e}`, true);
    }
}

/** 
 * Read the light level
 * @returns {Promise<Number>} current light level
 */
async function readLight() {
    try{
        // ran out of libs, gonna just manually read from i2c now
        // not too hard tbh
        let buffer = new Buffer.alloc(2);
        let i2c1 = await i2c.openPromisified(1);
        await i2c1.readI2cBlock(0x5c, 0x20, 2, buffer);
        log("SENSOR", 2, "New light data " + ((buffer[1] + (256 * buffer[0])) / 1.2));
        // gotta remember to close connection
        // had errors with these before
        await i2c1.close();
        // OK WTF IS THIS MAGIC MATH
        return parseFloat(((buffer[1] + (256 * buffer[0])) / 1.2).toFixed(1));
    } catch(e) {
        log("SENSOR", 0, `bh1750, ${e}`, true);
    }
}

/** 
 * Read the radiation
 * @returns {Promise<Number>} current radiation level
 */
async function readRadiation() {
    try{
        // smh gotta read manually here too
        let buffer = new Buffer.alloc(1);
        let i2c1 = await i2c.openPromisified(1);
        await i2c1.readI2cBlock(0x08, 0x00, 1, buffer);
        log("SENSOR", 2, "New radiation data " + buffer[0]);
        await i2c1.close();
        // this time no fancy math
        return buffer[0] / 100;
    } catch(e) {
        // I don't know the name of sensor ok?
        log("SENSOR", 0, `radiation, ${e}`, true);
    }
}

// the whole event loop is based on the wind sensor
// sending data on intervals and fetching everything else
// when that happens. Kinda stupid I know
parser.on("data", async data => {
    data = data.split(",");
    // if the data is invalid
    // (this happens way too often during the winter time)
    // take the latest valid data
    if(data[5].startsWith("V")) {
        log("SENSOR", 0, "Invalid wind data " + data, true);
        data = raw[raw.length - 1].split(",");
    } else {
        log("SENSOR", 2, "New wind data " + data);
    }
    // we get data every second so 600 seconds is 10 minutes
    // this is needed to calculate the average and gust
    if(raw.length >= 600) raw.shift();
    raw.push(data.join(","));
    data = {
        direction: parseInt(data[1]),
        speed: parseFloat(data[3])
    };
    if(values.length >= 600) values.shift();
    values.push(data);
    // use of promise.all and destructuring for neat code
    [
        latestTemp,
        latestPressure,
        latestLight,
        latestRadiation
    ] = await Promise.all([
        readTemp(),
        readPressure(),
        readLight(),
        readRadiation()
    ]);

    // for 10min radiation average
    if(radiationValues.length >= 600) radiationValues.shift();
    radiationValues.push(latestRadiation);

    // windspeed average
    let wsAvg = parseFloat(arrAvg(values.map(v => v.speed)).toFixed(1));
    // yeah we do this giant object in the fly too
    // looks messy, is messy
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
        pressure: latestPressure,
        lightness: Math.round(latestLight),
        radiationNow: latestRadiation,
        radiationAvg: parseFloat(arrAvg(radiationValues).toFixed(2)),
        dewPoint: parseFloat(dewPoint(latestTemp.temp, latestTemp.hum).toFixed(1)),
        absoluteHumidity: parseFloat(absoluteHumidity(latestTemp.temp, latestTemp.hum).toFixed(1)),
        feelsLikeTemp: feelsLikeTemp(latestTemp.temp, wsAvg)
    };
});

/** 
 * Degrees to text
 * 
 * Just a giant if function to turn degress into wind directions.
 * Now you may ask, the code is in english, the comments are in english,
 * the site is in english, so why tf are the wind directions in finnish?
 * 
 * I don't know and I don't care.
 * @param {Number} dir - the degrees in range from 0 to 360  
 * @returns {String} wind direction
 */
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

/** 
 * Speed to text
 * 
 * Just a giant if function to turn speed into descriptions.
 * Now you may ask, the code is in english, the comments are in english,
 * the site is in english, so why tf are the description in finnish?
 * 
 * I don't know and I don't care.
 * @param {Number} speed - the speed in meters per second 
 * @returns {String} descriptive text
 */
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


/**
 * Handy function to average an array of numbers
 * @param {Array<Number>} arr - array of numbers
 * @returns {Number} average 
 */
let arrAvg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;

/**
 * Function to turn degrees into radians
 * @param {Number} deg - degrees
 * @returns {Numbers} radians 
 */
let degToRad = deg => deg * (Math.PI / 180);

/**
 * Function to turn radians into degrees
 * @param {Number} rad - radians
 * @returns {Numbers} degrees
 */
let radToDeg = rad => rad * (180 / Math.PI);

/**
 * Get the average of angles in range of 0 to 360
 * 
 * I remember just yoinking a python version from online
 * and translating it to javascript
 * @param {Array<Number>} angles 
 * @returns {Number} the average angle
 */
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

/**
 * Calculate dew point
 * @param {Number} temp - temperature in celcius
 * @param {Number} hum - relative humidity
 * @returns {Number} dew point in celcius
 */
function dewPoint(temp, hum) {
    let H = (Math.log10(hum) - 2) / 0.4343 + (17.62 * temp) / (243.12 + temp);
    return 243.12 * H / (17.62 - H);
}

/**
 * Calculate the absolute humidity
 * @param {Number} temp - temperature in celcius
 * @param {Number} hum - relative humidity
 * @returns {Number} absolute humidity in grams per cube meter
 */
let absoluteHumidity = (temp, hum) => 216.7*(hum/100*6.112*Math.exp(17.62*temp/(243.12+temp))/(273.15+temp));

/**
 * Calculate feels like temperature
 * @param {Number} temp - temperature in celcius 
 * @param {Number} vel - wind velocity in meters per second
 * @returns {Number} feels like temperature in celcius
 */
function feelsLikeTemp(temp, vel) {
    if(temp > 10 || vel < 1.5) return temp;
    return (13.12 + 0.6215 * temp - 13.956 * Math.pow(vel, 0.16) + 0.4867 * temp * Math.pow(vel, 0.16)).toFixed(1);
}

log("APP", 0, "started");
