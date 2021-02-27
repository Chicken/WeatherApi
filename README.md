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
