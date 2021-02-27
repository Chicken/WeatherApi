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
bh1750  | 5c      | 20    | light
cajoe   | 08      | ??    | radiation
ads1115 | 48      | ??    | solar irradiance

### Todo
- modular, this file is getting way too big
- clean up some code and api stuff
- grafana integration
- improve daily avarage
