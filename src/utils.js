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
module.exports.getDirectionText = dir => {
    if(dir >= 337.5 || dir < 22.5) return "Pohjoinen";
    if(dir >= 22.5 && dir < 67.5) return "Koillinen";
    if(dir >= 67.5 && dir < 112.5) return "Itä";
    if(dir >= 112.5 && dir < 157.5) return "Kaakko";
    if(dir >= 157.5 && dir < 202.5) return "Etelä";
    if(dir >= 202.5 && dir < 247.5) return "Lounas";
    if(dir >= 247.5 && dir < 292.5) return "Länsi";
    if(dir >= 292.5 && dir < 337.5) return "Luode";
    return "ERROR";
};

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
module.exports.getSpeedText = speed => {
    if(speed < 1) return "Tyyntä";
    if(speed >= 1 && speed < 4) return "Heikkoa tuulta";
    if(speed >= 4 && speed < 8) return "Kohtalaista tuulta";
    if(speed >= 8 && speed < 14) return "Navakkaa tuulta";
    if(speed >= 14 && speed < 21) return "Kovaa tuulta";
    if(speed >= 21 && speed < 33) return "Myrskyä";
    if(speed >= 33) return "Hirmumyrskyä";
    return "ERROR";
};


/**
 * Handy function to average an array of numbers
 * @param {Array<Number>} arr - array of numbers
 * @returns {Number} average 
 */
module.exports.arrAvg = arr => {
    let farr = arr.filter(v => !isNaN(Number(v)));
    return farr.reduce((a, b) => a + b, 0) / farr.length;
};

/**
 * Function to turn degrees into radians
 * @param {Number} deg - degrees
 * @returns {Numbers} radians 
 */
module.exports.degToRad = deg => deg * (Math.PI / 180);

/**
 * Function to turn radians into degrees
 * @param {Number} rad - radians
 * @returns {Numbers} degrees
 */
module.exports.radToDeg = rad => rad * (180 / Math.PI);

/**
 * Get the average of angles in range of 0 to 360
 * 
 * I remember just yoinking a python version from online
 * and translating it to javascript
 * @param {Array<Number>} angles 
 * @returns {Number} the average angle
 */
module.exports.getAverage = angles => {
    let sinSum = 0;
    let cosSum = 0;

    for(let angle of angles){
        let r = this.degToRad(angle);
        sinSum += Math.sin(r);
        cosSum += Math.cos(r);
    }
  
    let flen = angles.length;
    let s = sinSum / flen;
    let c = cosSum / flen;

    let arc = this.radToDeg(Math.atan(s / c));
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
};

/**
 * Calculate dew point
 * @param {Number} temp - temperature in celcius
 * @param {Number} hum - relative humidity
 * @returns {Number} dew point in celcius
 */
module.exports.dewPoint = (temp, hum) => {
    let H = (Math.log10(hum) - 2) / 0.4343 + (17.62 * temp) / (243.12 + temp);
    return 243.12 * H / (17.62 - H);
};

/**
 * Calculate the absolute humidity
 * @param {Number} temp - temperature in celcius
 * @param {Number} hum - relative humidity
 * @returns {Number} absolute humidity in grams per cube meter
 */
module.exports.absoluteHumidity = (temp, hum) =>
    216.7 * (hum / 100 * 6.112 * Math.exp(17.62 * 
    temp / (243.12 + temp)) / (273.15 + temp));

/**
 * Calculate feels like temperature
 * @param {Number} temp - temperature in celcius 
 * @param {Number} vel - wind velocity in meters per second
 * @returns {Number} feels like temperature in celcius
 */
module.exports.feelsLikeTemp = (temp, vel) => {
    if(temp > 10 || vel < 1.5) return temp;
    return (13.12 + 0.6215 * temp - 13.956 * Math.pow(vel, 0.16)
            + 0.4867 * temp * Math.pow(vel, 0.16)).toFixed(1);
};

/**
 * Format date function
 * @param {Date} date - date object to be formatted 
 * @returns {String} formatted date
 */
module.exports.formatDate = d => {
    return `[${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()} | ` +
    `${d.getHours().toString().padStart(2, "0")}:` +
    `${d.getMinutes().toString().padStart(2, "0")}:` +
    `${d.getSeconds().toString().padStart(2, "0")}]`;
};

/**
 * Logger function
 * @param {String} scope - scope ex. "APP", "DB", "WEBPAGE"
 * @param {Number} level - logging level 0 = important, 1 = not so, 2 = all
 * @param {String} msg - message to log ex. "started", "saved data"
 * @param {Boolean} error if true forces logging and calls console.error()
 */
module.exports.log = (scope, level, msg, error = false) => {
    // 0 = errors, 1 = important, 2 = not so, 3 = all
    if(process.env.LOGGING_LEVEL > level || error)
        console[error ? "error" : "log"](
            `${this.formatDate(new Date())} ${scope}: ${msg}`
        );
}; 

module.exports.webLog = (req, _res, next) => {
    this.log("WEB", 2, `${req.method} - ${req.originalUrl}`);
    next();
};
