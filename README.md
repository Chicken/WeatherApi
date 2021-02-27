## WeatherApi

Node.JS REST API and website for Raspberry PI Weather station.  
This is here just for the show. Not really helpful for anyone.  
Like what are the chances of you having the exact same hardware.

Live working version: https://weather.antti.codes/

---

### I2C Address cheat sheet

Device  | Address | Cmd   | Measuring 
---     | :---:   | :---: | ---
sht31   | 44      | ??    | temp & hum
bmp180  | 77      | ??    | pressure
bh1750  | 5c      | 10    | light
cajoe   | 08      | 00    | radiation
ads1115 | 48      | ??    | solar irradiance

Plus a Vaisala Ultrasonic Wind Sensor WS425 in serialport. 

### Todo

- even more cleanup
- ads1115 w/ solar irradience
- grafana integration
- improve daily average
- touch screen version
- error webhook to discord

### Database

Currently running MariaDB on a VPS.  

Table structure from mysqldump:
```sql
CREATE TABLE `weather` (
  `time` double DEFAULT NULL,
  `windSpeedNow` float DEFAULT NULL,
  `windDirNow` int(11) DEFAULT NULL,
  `windGust` float DEFAULT NULL,
  `windSpeedAvg` float DEFAULT NULL,
  `windDirAvg` int(11) DEFAULT NULL,
  `temperature` float DEFAULT NULL,
  `dailyTempAvg` float DEFAULT NULL,
  `humidity` int(11) DEFAULT NULL,
  `pressure` int(11) DEFAULT NULL,
  `lightness` int(11) DEFAULT NULL,
  `dewPoint` float DEFAULT NULL,
  `absoluteHumidity` float DEFAULT NULL,
  `feelsLikeTemp` float DEFAULT NULL,
  `radiationNow` float DEFAULT NULL,
  `radiationAvg` float DEFAULT NULL,
  `solarIrradiance` float DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```
