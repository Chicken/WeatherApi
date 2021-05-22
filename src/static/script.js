/* global document Image fetch window */
// get html elements
const canvas = document.getElementById("rose");
const fields = {
    left: [
        document.getElementById("field1"),
        document.getElementById("field2"),
        document.getElementById("field3"),
        document.getElementById("field4")
    ],
    right: [
        document.getElementById("field5"),
        document.getElementById("field6"),
        document.getElementById("field7"),
        document.getElementById("field8")
    ],
    templarge: document.getElementById("templarge"),
    icon: document.getElementById("icon"),
    clock: document.getElementById("clock")
};

// get canvas context
const ctx = canvas.getContext("2d");
// load images for canvas
const bg = new Image();
bg.src = "./rose.webp";
const arrow = new Image();
arrow.src = "./arrow.webp";

// current resolution
let currentResolution = "";

// get current season
let season;
switch ((new Date().getMonth())) {
    case 11:
    case 0:
    case 1:
        season = "winter";
        break;
    case 2:
    case 3:
    case 4:
        season = "spring";
        break;
    case 5:
    case 6:
    case 7:
        season = "summer";
        break;
    case 8:
    case 9:
    case 10:
        season = "autumn";
        break;
}

// amount of choices for current season
let length = {
    summer: 13,
    winter: 6,
    autumn: 6,
    spring: 5
}[season];

// random bg number
let random = Math.floor(Math.random() * length) + 1;

// change background resolution
function changeBgResolution() {
    // get screen size
    let size;
    let width = window.screen.width * window.devicePixelRatio;
    if (width <= 1280) size = "low";
    if (width > 1280 && width <= 1920) size = "medium";
    if (width > 1920) size = "high";

    // if still same resolution, return
    if(currentResolution == size) return;
    currentResolution = size;

    let bgurl = `backgrounds/${size}/${season}/${random}.jpg`;

    // preload
    let preload = new Image();
    preload.src = bgurl;
    preload.onload = () => {
        // set bg
        let style = document.body.style;
        style["background"] = `url("${bgurl}") no-repeat center center fixed`;
        style["-webkit-background-size"] = "cover";
        style["-moz-background-size"] = "cover";
        style["-o-background-size"] = "cover";
        style["background-size"] = "cover";
    };
}

changeBgResolution();
window.onresize = changeBgResolution;

// function to draw the arrow pointing at a direction
async function draw(degrees){
    // draw background
    await ctx.drawImage(bg, 0, 0, 1000, 1000);
    // save state
    await ctx.save();
    // translated the center
    await ctx.translate(canvas.width / 2, canvas.height / 2);
    // rotate the amount of degrees
    await ctx.rotate(degrees * Math.PI / 180);
    // draw the arrow
    await ctx.drawImage(arrow, -arrow.width, -arrow.width, 1000, 1000);
    // restore state
    await ctx.restore();
}

// format times to ??:?? format
function formatTime(time) {
    let time2 = new Date(time);
    return `${time2.getHours().toString().padStart(2,"0")}`
         + `:${time2.getMinutes().toString().padStart(2,"0")}`;
}

// function to update the weather data
async function update() {

    // promise.all magic, fetch data from api
    let [
        data,
        forecast
    ] = await Promise.all([
        fetch("/api/weather"),
        fetch("/api/forecast")
    ]);

    [
        data,
        forecast
    ] = await Promise.all([
        data.json(),
        forecast.json()
    ]);

    // temperature to the large display
    fields.templarge.innerHTML = data.temperature.toFixed(1) + " &#176;C";

    // left side of the screen = data from weather station
    fields.left[0].innerHTML =
    `Temperature: ${data.temperature} &#176;C <br>
    Feels Like Temp: ${data.feelsLikeTemp} &#176;C <br>
    Yesterday Avg Temp: ${data.dailyTempAvg} &#176;C <br>
    Dew Point: ${data.dewPoint} &#176;C <br>`;

    fields.left[1].innerHTML =
    `Wind Speed Avg: ${data.windSpeedAvg} m/s <br>
    Wind Dir Avg: ${data.windDirAvg} &#176; <br>
    Wing Gust: ${data.windGust} m/s`;

    fields.left[2].innerHTML =
    `Humidity: ${data.humidity} % <br>
    Abs. Humidity: ${data.absoluteHumidity} g/m³ <br>
    Rain Intensity: ${data.rainIntensity} % <br>
    Rain Amount: ${data.rainAmount} mm`;

    fields.left[3].innerHTML =
    `Pressure: ${data.pressure} hPa <br>
    Lightness: ${data.lightness} lx <br>
    Solar Irradiance: ${data.solarIrradiance} W/m² <br>
    Radiation: ${data.radiationAvg} &micro;Sv/h <br>`;

    // calculate length of day manually cuz im stupid
    let dateRise = new Date(forecast.today.sunrise * 1000);
    let dateSet = new Date(forecast.today.sunset * 1000);
    let riseMin = dateRise.getMinutes() + dateRise.getHours() * 60;
    let setMin = dateSet.getMinutes() + dateSet.getHours() * 60;
    let diff = setMin - riseMin;
    let hours = (diff - diff % 60) / 60;
    let minutes = diff - hours * 60;

    // right side of the screen = data from openweathermap
    fields.right[0].innerHTML =
    `Forecast temp: ${forecast.today.temp.day} &#176;C<br>
    Forecast summary: <br>
    "${forecast.today.summary}"`;

    fields.right[1].innerHTML =
    `Sunrise: ${formatTime(forecast.today.sunrise * 1000)} <br>
    Sunset: ${formatTime(forecast.today.sunset * 1000)} <br>
    Length of day: ` +
    `${hours.toString().padStart(2, "0")}:` +
    `${minutes.toString().padStart(2, "0")}`;

    fields.right[2].innerHTML =
    `UV index: ${forecast.today.uv} <br>
    Wind speed: ${forecast.today.windspeed.toFixed(1)} m/s`;

    fields.right[3].innerHTML = 
    `Tomorrow: <br>
    Temperature max: ${forecast.week[1].temp.max.toFixed(1)} &#176;C<br>
    Temperature min: ${forecast.week[1].temp.min.toFixed(1)} &#176;C<br>
    Wind speed: ${forecast.week[1].windspeed.toFixed(1)} m/s`;

    // image
    let src = `https://openweathermap.org/img/wn/${forecast.today.icon}@4x.png`;
    if(fields.icon.src != src) fields.icon.src = src;
    if(fields.icon.alt != forecast.today.summary)
        fields.icon.alt = forecast.today.summary;
    
    // draw the wind rose
    draw(data.windDirAvg);
}

// function to update clock
function clock() {
    let date = new Date();
    fields.clock.innerHTML =
        `${date.getHours().toString().padStart(2, "0")}:` +
        `${date.getMinutes().toString().padStart(2, "0")}:` +
        `${date.getSeconds().toString().padStart(2, "0")}`;
}

// start loops but at first do it manually because setInterval bad
clock();
update();
// updating every half a second ensures it hits every second atleast once
setInterval(clock, 500);
// we dont need to update so often but its nice to have it update
setInterval(update, 10000);
