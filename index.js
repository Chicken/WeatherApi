//global vars
let global = {}

//repl
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});
rl.on("line", (input)=>{
    try{
        console.log(eval(input))
    } catch(e) {console.error(e)}
})

//dependencies and variables
const mariadb = require('mariadb');
const bent = require("bent");
const SerialPort = require('serialport');
const SHT31 = require('raspi-node-sht31');
const sht31 = new SHT31();
const BMP180 = require('bmp180-sensor');
const i2c = require('i2c-bus');
const Readline = require('@serialport/parser-readline');
const port = new SerialPort('/dev/serial0', { baudRate: 9600 });
const parser = port.pipe(new Readline({ delimiter: '\n' }));
const express = require('express');
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

const LOGGING_LEVEL = 2; //0=nothing, 1=important, 2=website, 3=all the useless shit

//db
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
      let res = await conn.query("SELECT dailyTempAvg FROM weather ORDER BY time desc LIMIT 1")
      yesterdayAverage = res[0].dailyTempAvg;
    } catch (e) {
        console.error(formatDate(new Date())+"DB: "+e);
    } finally {
        if(LOGGING_LEVEL>0) console.log(formatDate(new Date())+"DB: Fetched latest dailyTempAvg from database.");
        conn.release();
    }
})()

async function saveToDb() {
   let conn = await pool.getConnection();
    try {
        await conn.query("INSERT INTO weather (time, windSpeedNow, windDirNow, windGust, windSpeedAvg, windDirAvg, temperature, dailyTempAvg, humidity, pressure, lightness, dewPoint, absoluteHumidity, feelsLikeTemp) " +
                         "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                        [Date.now(), ldata.windSpeedNow, ldata.windDirNow, ldata.windGust, ldata.windSpeedAvg, ldata.windDirAvg, ldata.temperature, ldata.dailyTempAvg || null,
                        ldata.humidity, ldata.pressure, ldata.lightness, ldata.dewPoint, ldata.absoluteHumidity, ldata.feelsLikeTemp])
    } catch (e) {
        console.error(formatDate(new Date())+"DB: "+e);
    } finally {
        if(LOGGING_LEVEL>0) console.log(formatDate(new Date())+"DB: Saved weather to database.");
        conn.release();
    }
}

setTimeout(saveToDb, 1000*30)
setInterval(saveToDb, 1000*60*10)

//dailyaverage timer
let currentTime = new Date()
let currentHours = currentTime.getHours()
let currentMinutes = currentTime.getMinutes()
let timeTillStart = (24*60) - (currentHours * 60 + currentMinutes)
let interval
let timeout = setTimeout(()=>{
  todayTemps.push(latestTemp.temp)
  interval = setInterval(()=>{
    todayTemps.push(latestTemp.temp)
    if(todayTemps.length == 8) {
      yesterdayAverage = todayTemps.reduce((a,b) => a + b) / 8
      todayTemps = []
    }
  },3*60*60*1000)
}, timeTillStart * 60 * 1000)

//forecast fetch loop
async function fetchForecast() {
  if(LOGGING_LEVEL>2) console.log(formatDate(new Date())+'THIRD PARTY: forecast data fetched')
  latestForecast = await bent(200, "json")(`https://api.openweathermap.org/data/2.5/onecall?lat=65.012615&lon=25.471453&units=metric&lang=en&exclude=minutely&appid=${process.env.key}`)
}
fetchForecast()
let interval2 = setInterval(fetchForecast,1000*60*10)

//main page
app.get('/',(req, res)=>{
  if(LOGGING_LEVEL>1) console.log(formatDate(new Date())+'WEBPAGE: visited');
  res.sendFile(__dirname + '/index.html')
})

//worker
app.get('/worker.js',(req, res)=>{
  if(LOGGING_LEVEL>2) console.log(formatDate(new Date())+'WEBPAGE: worker loaded');
  res.sendFile(__dirname + '/worker.js')
})

//static files
app.use("/media", express.static(__dirname + '/media'));

//api doc
app.get('/api', (req,res)=>{
  if(LOGGING_LEVEL>1) console.log(formatDate(new Date())+'WEBPAGE: api docs visited');
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
    &copy; Antti.Codes 2020`
  )
})

//forecast
app.get('/api/forecast', (req,res)=>{
  if(LOGGING_LEVEL>2) console.log(formatDate(new Date())+'API: forecasts fetched');
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
      }
    })
  })
})

//forecast but raw 3rd party api response
app.get('/api/forecast/all', (req,res)=>{
  if(LOGGING_LEVEL>2) console.log(formatDate(new Date())+'API: all forecasts fetched');
  res.send(latestForecast)
})

//all the weather data
app.get('/api/weather', (req,res)=>{
  if(LOGGING_LEVEL>2) console.log(formatDate(new Date())+'API: weather data asked');
  res.send(ldata)
})

//raw wind sensor data
app.get('/api/raw', (req,res)=>{
  if(LOGGING_LEVEL>2) console.log(formatDate(new Date())+'API: raw data asked');
  res.send(raw)
})

//parsed wind sensor data
app.get('/api/parsed', (req,res)=>{
  if(LOGGING_LEVEL>2) console.log(formatDate(new Date())+'API: parsed data asked');
  res.send(values)
})

app.listen(8080, ()=>{
  if(LOGGING_LEVEL>0) console.log(formatDate(new Date())+'APP: server online')
})

async function readTemp() {
  try{
    let data = await sht31.readSensorData();
    let temp = parseFloat(data.temperature.toFixed(1));
    let hum = Math.round(data.humidity);
    if(LOGGING_LEVEL>2) console.log(formatDate(new Date())+'SENSOR: new temperature and humidity data ' + hum + " " + temp)
    return {
      temp: temp,
      hum: hum
    };
  } catch(e) {
    console.log(formatDate(new Date())+'ERROR: sht31,',e)
  }
};

async function readPressure() {
  try{
    let bmp180 = await BMP180({address:0x77,mode:3,units:'metric'})
    let data = await bmp180.read()
    if(LOGGING_LEVEL>2) console.log(formatDate(new Date())+'SENSOR: new pressure and temperature data ' + data.pressure)
    await bmp180.close();
    data.pressure = Math.round(data.pressure/100);
    return data
  } catch(e) {
    console.log(formatDate(new Date())+'ERROR: bmp180,',e)
  }
};

async function readLight() {
  try{
    let buffer = await new Buffer.alloc(2);
    let i2c1 = await i2c.openPromisified(1);
    await i2c1.readI2cBlock(0x5c, 0x20, 2, buffer);
    if(LOGGING_LEVEL>2) console.log(formatDate(new Date())+'SENSOR: new light data ' + ((buffer[1] + (256 * buffer[0])) / 1.2))
    await i2c1.close();
    return {
      light: parseFloat(((buffer[1] + (256 * buffer[0])) / 1.2).toFixed(1))
    }
  } catch(e) {
    console.log(formatDate(new Date())+'ERROR: bh1750,',e)
  }
}

parser.on('data', async data =>{
  raw.push(data);
  if(LOGGING_LEVEL>2) console.log(formatDate(new Date())+'SENSOR: new wind data', data)
  if(raw.length>=600) raw.shift();
  data=data.split(',')
  if(LOGGING_LEVEL>0&&data[5].startsWith('V')) console.log(formatDate(new Date())+'SENSOR: invalid data', data);
  data={
    direction: parseInt(data[1]),
    speed: parseFloat(data[3])
  }
  if(values.length>=600) values.shift();
  values.push(data);
  latestTemp = await readTemp();
  latestPressure = await readPressure();
  latestLight = await readLight();
  ldata = {
    windSpeedNow: values[values.length-1].speed,
    windSpeedNowText: getSpeedText(values[values.length-1].speed),
    windDirNow: values[values.length-1].direction,
    windDirNowText: getDirectionText(values[values.length-1].direction),
    windGust: Math.max(...values.map(v=>v.speed)),
    windGustText: getSpeedText(Math.max(...values.map(v=>v.speed))),
    windSpeedAvg: parseFloat(arrAvg(values.map(v=>v.speed)).toFixed(1)),
    windSpeedAvgText: getSpeedText(arrAvg(values.map(v=>v.speed))),
    windDirAvg: Math.round(getAverage(values.map(v=>v.direction)).toFixed(1)),
    windDirAvgText: getDirectionText(getAverage(values.map(v=>v.direction))),
    temperature: latestTemp.temp,
    dailyTempAvg: yesterdayAverage ? parseFloat(yesterdayAverage.toFixed(1)) : undefined,
    humidity: latestTemp.hum,
    pressure: latestPressure.pressure,
    lightness: Math.round(latestLight.light),
    dewPoint: parseFloat(dewPoint(latestTemp.temp, latestTemp.hum).toFixed(1)),
    absoluteHumidity: parseFloat(absoluteHumidity(latestTemp.temp, latestTemp.hum).toFixed(1)),
    feelsLikeTemp: feelsLikeTemp(latestTemp.temp, values[values.length-1].speed)
  }
});

function getDirectionText(dir) {
  if(dir>=337.5||dir<22.5){
  	return "Pohjoinen"
  }
  if(dir>=22.5&&dir<67.5){
  	return "Koillinen"
  }
  if(dir>=67.5&&dir<112.5){
  	return "Itä"
  }
  if(dir>=112.5&&dir<157.5){
  	return "Kaakko"
  }
  if(dir>=157.5&&dir<202.5){
  	return "Etelä"
  }
  if(dir>=202.5&&dir<247.5){
  	return "Lounas"
  }
  if(dir>=247.5&&dir<292.5){
  	return "Länsi"
  }
  if(dir>=292.5&&dir<337.5){
  	return "Luode"
  }
  return 'ERROR';
}

function getSpeedText(speed) {
  if(speed<1){
    return "Tyyntä"
  } else if(speed>=1&&speed<4){
	  return "Heikkoa tuulta"
  } else if(speed>=4&&speed<8){
	  return "Kohtalaista tuulta"
  } else if(speed>=8&&speed<14){
  	return "Navakkaa tuulta"
  } else if(speed>=14&&speed<21){
	  return "Kovaa tuulta"
  } else if(speed>=21&&speed<33){
	  return "Myrskyä"
  } else if(speed>=33){
	  return "Hirmumyrskyä"
  } else {
	  return 'ERROR'
  }
}

function arrAvg(arr) {
  return arr.reduce((a,b) => a + b, 0) / arr.length;
}

function degToRad(degrees) {
  return degrees * (Math.PI/180);
}

function radToDeg(radians){
  return radians * (180/Math.PI);
}

function getAverage(angles) {
	let sinSum = 0;
	let cosSum = 0;

	for(angle of angles){
		let r = degToRad(angle)
		sinSum += Math.sin(r)
		cosSum += Math.cos(r)
	}
	let flen = angles.length
	let s = sinSum / flen;
        let c = cosSum / flen;

	let arc = radToDeg(Math.atan(s/c))
	let average = 0;
	if(s>0&&c>0) {
		average = arc;
	} else if(c<0) {
		average = arc + 180;
	} else if(s<0&&c>0) {
		average = arc + 360;
	}
	if(average==360) return 0;
	return average;
}

function dewPoint(temp,hum) {
	let H = (Math.log10(hum)-2)/0.4343+(17.62*temp)/(243.12+temp);
	return 243.12*H/(17.62-H);
}

function absoluteHumidity(temp,hum) {
	return 216.7*(hum/100*6.112*Math.exp(17.62*temp/(243.12+temp))/(273.15+temp));
}

function feelsLikeTemp(T,V) {
	if(T>10||V<1.5) return T;
	return (13.12+0.6215*T-13.956*Math.pow(V,0.16)+0.4867*T*Math.pow(V,0.16)).toFixed(1);
}

function formatDate(date) {
  return `[${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()} | ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}] `;
}

if(LOGGING_LEVEL>0) console.log(formatDate(new Date())+'APP: started')
