## WeatherApi

Node.JS REST API and website for Raspberry PI Weather station.  
This is here just for the show. Not really helpful for anyone.  
Like what are the chances of you having the exact same hardware.

Live working version: https://weather.antti.codes/

---

### Hardware

#### I2C

Device  | Address | Cmd   | Measuring 
---     | :---:   | :---: | ---
sht31   | 44      | ??    | temp & hum
bmp180  | 77      | ??    | pressure
bh1750  | 5c      | 10    | light
cajoe   | 08      | 00    | radiation
ads1115 | 48      | ??    | solar irradiance & rain intensity

Ads1115 is a 16-bit analog to digital convertor and can have multiple targets.

#### Other

Whole thing runs on a Raspberry Pi 4 Model B.  
Many of the sensors go through an arduino before connecting to rpi.  
Vaisala Ultrasonic Wind Sensor WS425 in serialport.  
Unidentified rain sensor (rs1) from an old modded station.

### Todo
This is a global todo for everything connected to this project.  
Includes the API, webpage, hardware and android application.  

- grafana integration
- touch screen version
- error webhook to discord
- update rpi os
- length of day display
- autoupdate
- i18n via geoip
- ws425 module
