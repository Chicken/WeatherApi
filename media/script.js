/* global document Image fetch navigator */
const canvas = document.getElementById("rose");
const ctx = canvas.getContext("2d");
const bg = new Image();
bg.src = "./media/rose.webp";
const arrow = new Image();
arrow.src = "./media/arrow.webp";

async function draw(degrees){
    await ctx.drawImage(bg, 0, 0, 1000, 1000);
    await ctx.save();
    await ctx.translate(canvas.width / 2, canvas.height / 2);
    await ctx.rotate(degrees * Math.PI/180);
    await ctx.drawImage(arrow, -arrow.width, -arrow.width, 1000, 1000);
    await ctx.restore();
}

function formatTime(time) {
    let time2 = new Date(time);
    return `${time2.getHours().toString().padStart(2,"0")}:${time2.getMinutes().toString().padStart(2,"0")}`;
}

// Server side rendering? What's that lol? Bwoi we doing this client side.

async function update() {
    let data = await fetch("/api/weather");
    data = await data.json();

    document.getElementById("templarge").innerHTML = data.temperature.toFixed(1) + " &#176;C";

    document.getElementById("temp").innerHTML =
    `Temperature: ${data.temperature} &#176;C <br>
    Feels Like Temp: ${data.feelsLikeTemp} &#176;C <br>
    Yesterday Avg Temp: ${data.dailyTempAvg} &#176;C <br>
    `;

    document.getElementById("wind").innerHTML =
    `Wind Speed Avg: ${data.windSpeedAvg} m/s <br>
    Wind Dir Avg: ${data.windDirAvg} &#176; <br>
    Wing Gust: ${data.windGust} m/s
    `;

    document.getElementById("humidity").innerHTML =
    `Humidity: ${data.humidity} % <br>
    Abs. Humidity: ${data.absoluteHumidity} g/m³ <br>
    Dew Point ${data.dewPoint} &#176;C
    `;

    document.getElementById("other").innerHTML =
    `Pressure: ${data.pressure} hPa <br>
    Lightness: ${data.lightness} lx <br>
    Radiation: ${data.radiation} &micro;Sv/h <br>
    `;

    let forecast = await fetch("/api/forecast");
    forecast = await forecast.json();

    document.getElementById("forecast").innerHTML =
    `Forecast temp: ${forecast.today.temp.day} &#176;C<br>
    Forecast summary: <br>
    "${forecast.today.summary}"
    `;

    let dateRise = new Date(forecast.today.sunrise * 1000);
    let dateSet = new Date(forecast.today.sunset * 1000);
    let riseMin = dateRise.getMinutes() + dateRise.getHours() * 60;
    let setMin = dateSet.getMinutes() + dateSet.getHours() * 60;
    let diff = setMin - riseMin;
    let hours = (diff - diff % 60) / 60;
    let minutes = diff - hours * 60;

    document.getElementById("sun").innerHTML =
    `Sunrise: ${formatTime(forecast.today.sunrise * 1000)} <br>
    Sunset: ${formatTime(forecast.today.sunset * 1000)} <br>
    Length of day: ${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")} 
    `;

    document.getElementById("misc").innerHTML =
    `UV index: ${forecast.today.uv} <br>
    Wind speed: ${forecast.today.windspeed.toFixed(1)} m/s`;

    document.getElementById("tomorrow").innerHTML = 
    `Tomorrow: <br>
    Temperature max: ${forecast.week[1].temp.max.toFixed(1)} &#176;C<br>
    Temperature min: ${forecast.week[1].temp.min.toFixed(1)} &#176;C<br>
    Wind speed: ${forecast.week[1].windspeed.toFixed(1)} m/s`;

    let icon = document.getElementById("icon");
    let src = `https://openweathermap.org/img/wn/${forecast.today.icon}@4x.png`;
    if(icon.src != src) icon.src = src;
    if(icon.alt != forecast.today.summary) icon.alt = forecast.today.summary;
    
    draw(data.windDirAvg);
}

function clock() {
    let date = new Date();
    document.getElementById("clock").innerHTML = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}`;
}

// start loops
clock();
update();
setInterval(clock, 500);
setInterval(update, 5000);

if(navigator != undefined && navigator.serviceWorker != undefined) {
    navigator.serviceWorker.register("worker.js", { scope: "/" })
        .then(() => console.log("Service Worker Registered"));
} else {
    console.error("Cannot register service worker!");
}
