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
const SerialPort = require('serialport');
const SHT31 = require('raspi-node-sht31')
const sht31 = new SHT31()
const BMP180 = require('bmp180-sensor');
const Readline = require('@serialport/parser-readline');
const port = new SerialPort('/dev/serial0', { baudRate: 9600 });
const parser = port.pipe(new Readline({ delimiter: '\n' }));
const express = require('express');
const app = express();
//const bodyParser = require('body-parser');
//app.use(bodyParser.urlencoded({ extended: true }));
//app.use(bodyParser.json());
const i2c = require('i2c-bus')

let values = [],
    raw = [],
    todayTemps = [],
    yesterdayAverage = undefined,
    latestTemp = {},
    latestPressure = {},
    latestLight = {};

const LOGGING_LEVEL = 1; //0=nothing, 1=important, 2=website, 3=all the useless shit

//dailyaverage timer
let currentTime = new Date()
let currentHours = currentTime.getHours()
let currentMinutes = currentTime.getMinutes()
let timeTillStart = (24*60) - (currentHours * 60 + currentMinutes)
let interval
let timeout = setTimeout(()=>{
  console.log(formatDate(new Date())+"timeout start", todayTemps, yesterdayAverage)
  todayTemps.push(latestTemp.temp)
  console.log(formatDate(new Date())+"timeout end", todayTemps, yesterdayAverage)
  interval = setInterval(()=>{
    console.log(formatDate(new Date())+"setInterval start bois", todayTemps, yesterdayAverage)
    todayTemps.push(latestTemp.temp)
    if(todayTemps.length == 8) {
      yesterdayAverage = todayTemps.reduce((a,b) => a + b) / 8
      todayTemps = []
    }
    console.log(formatDate(new Date())+"setInterval end bois", todayTemps, yesterdayAverage)
  },3*60*60*1000)
}, timeTillStart * 60 * 1000)



app.get('/',(req, res)=>{
if(LOGGING_LEVEL>0) console.log(formatDate(new Date())+'WEBPAGE: visited');
res.sendFile(__dirname + '/index.html')
})

app.get('/media/:file', (req,res)=>{
if(LOGGING_LEVEL>1) console.log(formatDate(new Date())+'WEBPAGE: media loaded');
res.sendFile(__dirname + '/media/' + req.params.file)
})

/*
app.get('/api/temp', (req,res)=>{
if(LOGGING_LEVEL>1) console.log(formatDate(new Date())+'API: temperature and humidity data asked');
res.send(latestTemp)
})

app.get('/api/dailyaverage', (req,res)=>{
  if(LOGGING_LEVEL>1) console.log(formatDate(new Date())+'API: daily average temp data asked');
  res.send({avg: yesterdayAverage})
})

app.get('/api/pressure', (req,res)=>{
if(LOGGING_LEVEL>1) console.log(formatDate(new Date())+'API: pressure and temperature data asked');
res.send(latestPressure)
})

app.get('/api/light', (req,res)=>{
if(LOGGING_LEVEL>1) console.log(formatDate(new Date())+'API: light data asked');
res.send(latestLight)
})
*/

app.get('/api', (req,res)=>{
  if(LOGGING_LEVEL>1) console.log(formatDate(new Date())+'API: api mainpage visited');
  res.send('Incompleted<br><br>API ENDPOINTS:<br><br>  GET /api/raw - sensor raw data from 10mins<br>  GET /api/database?size=SIZE - returns the latest SIZE entries in database (all values))<br>  GET /api/parsed - sensor parsed data from 10mins<br>  GET /api/pressure - pressure and temperature<br><br>  POST /api/speed {speed: NUMBER} - wind speed to descriptive text<br>  POST /data/direction {direction: NUMBER} - wind direction to cardinal directions')
})

app.get('/api/raw', (req,res)=>{
  if(LOGGING_LEVEL>1) console.log(formatDate(new Date())+'API: raw data asked');
  res.send(raw)
})

app.get('/api/parsed', (req,res)=>{
if(LOGGING_LEVEL>1) console.log(formatDate(new Date())+'API: parsed data asked');
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
  return {temp: temp, hum: hum};
  } catch(e) {console.log(formatDate(new Date())+'ERROR: sht31,',e)}
};

async function readPressure() {
  try{
  let bmp180 = await BMP180({address:0x77,mode:3,units:'metric'})
  let data = await bmp180.read()
  if(LOGGING_LEVEL>2) console.log(formatDate(new Date())+'SENSOR: new pressure and temperature data ' + data.pressure)
  await bmp180.close();
  data.pressure = Math.round(data.pressure/100);
  return data
  } catch(e) {console.log(formatDate(new Date())+'ERROR: bmp180,',e)}
};

async function readLight() {
try{
let buffer = await new Buffer.alloc(2);
let i2c1 = await i2c.openPromisified(1);
await i2c1.readI2cBlock(0x5c, 0x20, 2, buffer);
if(LOGGING_LEVEL>2) console.log(formatDate(new Date())+'SENSOR: new light data ' + ((buffer[1] + (256 * buffer[0])) / 1.2))
await i2c1.close();
return {light: parseFloat(((buffer[1] + (256 * buffer[0])) / 1.2).toFixed(1))}
} catch(e) {console.log(formatDate(new Date())+'ERROR: bh1750,',e)}
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
});

function getDirection(dir) {
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

function getSpeed(speed) {
  speed = parseFloat(speed);
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

const arrAvg = arr => arr.reduce((a,b) => a + b, 0) / arr.length;

function deg2rad(degrees) {
	return degrees * (Math.PI/180);
}

function rad2deg(radians){
	return radians * (180/Math.PI);
}

function get_average(angles) {
	let sin_sum = 0;
	let cos_sum = 0;
	
	for(angle of angles){
		let r = deg2rad(angle)
		sin_sum += Math.sin(r)
		cos_sum += Math.cos(r)
	}
	let flen = angles.length
	let s = sin_sum / flen;
        let c = cos_sum / flen;

	let arc = rad2deg(Math.atan(s/c))
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

function dew_point(temp,hum) {
	let H = (Math.log10(hum)-2)/0.4343+(17.62*temp)/(243.12+temp);
	return 243.12*H/(17.62-H);
}

function absolute_humidity(temp,hum) {
	return 216.7*(hum/100*6.112*Math.exp(17.62*temp/(243.12+temp))/(273.15+temp));
}

function feels_like(T,V) {
	if(T>10||V<1.5) return T;
	return 13.12+0.6215*T-13.956*Math.pow(V,0.16)+0.4867*T*Math.pow(V,0.16)
}

function formatDate(date) {
return '[' + (date.getDate()) + '.' + (date.getMonth()+1) + '.' + date.getFullYear() + ' | ' + date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds() + '] ';
}

if(LOGGING_LEVEL>0) console.log(formatDate(new Date())+'APP: started')
