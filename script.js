const OPEN_METEO_BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org/search';

let isCelsius = document.getElementById('unitSwitch').checked;
const EXCELLENT_THRESHOLD = 21;
const GOOD_THRESHOLD = 28;

//document.getElementById('unitSwitch').addEventListener('change', toggleUnits);
//document.getElementById('locationInput').addEventListener('input', fetchLocationSuggestions);
document.getElementById('hourForecastBtn').addEventListener('click', () => switchForecastView('hour'));
document.getElementById('dayForecastBtn').addEventListener('click', () => switchForecastView('day'));
//window.addEventListener('load', fetchWeatherByLocation);
window.addEventListener('load', () => fetchWeatherData(36.197440, -81.875750));


function update12HourForecast(hourly) {
    const forecastContainer = document.getElementById('12forecastContainer');
    forecastContainer.innerHTML = '';

    for (let i = 1; i < 13; i++) {
        const hour = new Date();
        hour.setHours(hour.getHours() + i);
        const hourIndex = hour.getHours();
        const temp = hourly.temperature_2m[hourIndex];
        const humidity = hourly.relative_humidity_2m[hourIndex];
        const wetBulb = calculateWetBulb(temp, humidity);

        const hourEl = document.createElement('div');
        hourEl.className = 'card';
        hourEl.style.border = '5px solid';
        hourEl.style.borderColor = getBorderColor(wetBulb);



        hourEl.innerHTML = `
            <h3>${hour.toLocaleTimeString([], { hour: 'numeric', hour12: true })}</h3>
            <p>Temp: ${temp.toFixed(1)}°${isCelsius ? 'C' : 'F'}</p>
            <p>Wet Bulb: ${wetBulb.toFixed(1)}°${isCelsius ? 'C' : 'F'}</p>
            <p>Humidity: ${humidity}%</p>
            <p>Snowmaking Quality: ${getSnowQuality(wetBulb)}</p>
        `;

        forecastContainer.appendChild(hourEl);
    }
}

function displayError(message) {
    const errorContainer = document.createElement('div');
    errorContainer.textContent = message;
    errorContainer.className = 'error-message';
    document.body.prepend(errorContainer);
    setTimeout(() => errorContainer.remove(), 5000);
}

function switchForecastView(view) {
    const hourForecastBtn = document.getElementById('hourForecastBtn');
    const dayForecastBtn = document.getElementById('dayForecastBtn');
    const forecast = document.getElementById('forecast');
    const hourforecast = document.getElementById('hourforecast');

    if (view === 'hour') {
        hourForecastBtn.classList.add('active');
        dayForecastBtn.classList.remove('active');
        forecast.style.display = 'none';
        hourforecast.style.display = 'block';
    } else {
        hourForecastBtn.classList.remove('active');
        dayForecastBtn.classList.add('active');
        forecast.style.display = 'block';
        hourforecast.style.display = 'none';
    }
}

function generateBulletPointNotes(daily, index, night) {
    const notesContainer = document.createElement('div');
    const notesList = document.createElement('ul');

    const date = daily.time[index];
    const noteItem = document.createElement('li');
    const currentDate = new Date(date);
    const month = currentDate.getMonth() + 1; // getMonth() returns 0-11
    const day = currentDate.getDate();

    // Check wet bulb temperature for marginal conditions
    const excellentThreshold = isCelsius ? (EXCELLENT_THRESHOLD - 32) * 5 / 9 : EXCELLENT_THRESHOLD;
    const goodThreshold = isCelsius ? (GOOD_THRESHOLD - 32) * 5 / 9 : GOOD_THRESHOLD;
    let wetBulb = calculateWetBulb(daily.temperature_2m_max[index], daily.relative_humidity_2m_max[index]);
    if (night) {  wetBulb = calculateWetBulb(daily.temperature_2m_min[index], daily.relative_humidity_2m_min[index]);}
 
    if (wetBulb <= excellentThreshold) {
        const excellentNote = document.createElement('li');
        excellentNote.textContent = "Ideal conditions exist for snowmaking.";
        notesList.appendChild(excellentNote);
    }

    // Check precipitation probability for the next 3 days
    for (let i = index; i < index + 3 && i < daily.precipitation_probability_max.length; i++) {
        if (daily.precipitation_probability_max[i] > 60) {
            const precipitationNote = document.createElement('li');
            precipitationNote.textContent = "Precipitation in the next few days may affect snowmaking.";
            notesList.appendChild(precipitationNote);
            break;
        }
    }

    // Check temperature for the next 5 days
    for (let i = index; i < index + 5 && i < daily.temperature_2m_max.length; i++) {
        if (daily.temperature_2m_max[i] > 45) {
            const temperatureNote = document.createElement('li');
            temperatureNote.textContent = "Warm temperatures in the next few days may affect snowmaking.";
            notesList.appendChild(temperatureNote);
            break;
        }
    }

    if ((month === 8 && day >= 1) || (month === 12 && day <= 15) || (month > 8 && month < 12)) {
        noteItem.textContent = "Early season conditions may limit snowmaking opportunities.";
    } else if ((month === 3 && day >= 5) || (month === 7 && day <= 31) || (month > 3 && month < 7)) {
        noteItem.textContent = "Late season conditions may limit snowmaking opportunities.";
    }
    if (noteItem.textContent) {
        notesList.appendChild(noteItem);
    }

    if (wetBulb < goodThreshold) {
        const excellentNote = document.createElement('li');
        excellentNote.textContent = "Resort conditions may vary. The decision to make snow is decided by the resort and they may not be making snow even if conditions allow.";
        notesList.appendChild(excellentNote);
    }

    notesContainer.appendChild(notesList);
    return notesContainer.innerHTML;
}

async function fetchWeatherData(lat, lon) {
    document.getElementById('loadingData').style.display = 'block';
    document.getElementById('currentConditions').style.display = 'none';
    document.getElementById('forecast').style.display = 'none';
    document.getElementById('viewSwitch').style.display = 'none';
    document.getElementById('footer').style.display = 'none';
    try {
      //  console.log(`${OPEN_METEO_BASE_URL}?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relative_humidity_2m&daily=temperature_2m_max,temperature_2m_min,relative_humidity_2m_min,relative_humidity_2m_max,precipitation_probability_max&temperature_unit=${isCelsius ? 'celsius' : 'fahrenheit'}&timezone=auto`);

        const response = await fetch(`${OPEN_METEO_BASE_URL}?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relative_humidity_2m&daily=temperature_2m_max,temperature_2m_min,relative_humidity_2m_min,relative_humidity_2m_max,precipitation_probability_max&forecast_days=14&temperature_unit=${isCelsius ? 'celsius' : 'fahrenheit'}&timezone=auto`);

        if (!response.ok) throw new Error(`Weather data fetch failed: ${response.status}`);

        const data = await response.json();

        if (data.hourly && data.daily) {
            document.getElementById('loadingData').style.display = 'none';
            document.getElementById('currentConditions').style.display = 'block';
            document.getElementById('forecast').style.display = 'block';
            document.getElementById('viewSwitch').style.display = 'block';
            document.getElementById('footer').style.display = 'block';
            document.getElementById('hourForecastBtn').classList.remove('active');
            document.getElementById('dayForecastBtn').classList.add('active');
            document.getElementById('hourforecast').style.display = 'none';
            updateCurrentConditions(data.hourly, data.daily);
            update12HourForecast(data.hourly);

            updateForecast(data.daily);
            update12HourForecast(data.hourly);
        } else {
            displayError("Weather data is unavailable.");
        }
    } catch (error) {
        displayError("Failed to fetch weather data. Please try again.");
        console.error("Error fetching weather data:", error);
    }
}

function toggleUnits() {
    isCelsius = document.getElementById('unitSwitch').checked;
    const location = document.getElementById('locationInput').value;
    if (location) submitLocation();
}

function updateCurrentConditions(hourly, daily) {
    const currentTemp = hourly.temperature_2m[new Date().getHours()];
    const humidity = hourly.relative_humidity_2m[new Date().getHours()];
    const wetBulb = calculateWetBulb(currentTemp, humidity);

    document.getElementById('temp').textContent = `${currentTemp.toFixed(1)}°${isCelsius ? 'C' : 'F'}`;
    document.getElementById('humidity').textContent = `${humidity}%`;
    document.getElementById('wetBulb').textContent = `${wetBulb.toFixed(1)}°${isCelsius ? 'C' : 'F'}`;
    document.getElementById('currentConditions').style.border = '5px solid';
    document.getElementById('currentConditions').style.borderColor = getBorderColor(wetBulb);
    document.getElementById('notes').innerHTML = generateBulletPointNotes(daily, 0);

    updateSnowQuality(wetBulb);
}

function calculateWetBulb(temp, humidity) {
    if (!isCelsius) temp = (temp - 32) * 5 / 9;

    const wetBulb = temp * Math.atan(0.151977 * Math.sqrt(humidity + 8.313659)) + Math.atan(temp + humidity) - Math.atan(humidity - 1.676331) + 0.00391838 * Math.pow(humidity, 1.5) * Math.atan(0.023101 * humidity) - 4.686035;

    return isCelsius ? wetBulb : (wetBulb * 9 / 5) + 32;
}

async function fetchLocationSuggestions() {
    const query = document.getElementById('locationInput').value;
    if (query.length < 3) return;

    try {
        const response = await fetch(`${NOMINATIM_BASE_URL}?q=${query}&format=json&addressdetails=1&limit=5`);
        if (!response.ok) throw new Error("Location suggestions fetch failed");

        const data = await response.json();
        const suggestionsList = document.getElementById('suggestions');
        suggestionsList.innerHTML = '';

        data.forEach(location => {
            const locationName = `${location.display_name}`;
            const suggestionItem = document.createElement('li');
            suggestionItem.textContent = locationName;
            suggestionItem.addEventListener('click', () => {
                document.getElementById('locationInput').value = locationName;
                suggestionsList.innerHTML = '';
                fetchWeatherData(location.lat, location.lon);
            });
            suggestionsList.appendChild(suggestionItem);
        });
    } catch (error) {
        displayError("Failed to fetch location suggestions.");
        console.error("Error fetching location suggestions:", error);
    }
}

async function submitLocation() {
    const location = document.getElementById('locationInput').value;
    try {
        const response = await fetch(`${NOMINATIM_BASE_URL}?q=${location}&format=json&addressdetails=1&limit=1`);
        if (!response.ok) throw new Error("Location fetch failed");

        const data = await response.json();
        if (data.length > 0) {
            const { lat, lon } = data[0];
            await fetchWeatherData(lat, lon);
        } else {
            displayError("Location not found. Please enter a valid location.");
        }
    } catch (error) {
        displayError("Failed to fetch location data. Please try again.");
        console.error("Error fetching location data:", error);
    }
}

function updateSnowQuality(wetBulb) {
    const snowQualityElement = document.getElementById('quality');
    const snowQuality = getSnowQuality(wetBulb);
    snowQualityElement.textContent = snowQuality;
}

function getSnowQuality(wetBulb) {
    const excellentThreshold = isCelsius ? (EXCELLENT_THRESHOLD - 32) * 5 / 9 : EXCELLENT_THRESHOLD;
    const goodThreshold = isCelsius ? (GOOD_THRESHOLD - 32) * 5 / 9 : GOOD_THRESHOLD;

    if (wetBulb < excellentThreshold) {
        return "Dry Snow (Snowmaking Optimal)";
    } else if (wetBulb < goodThreshold) {
        return "Wet Snow (Snowmaking Possible)";
    } else {
        return "NA (Snowmaking Not Possible)";
    }
}

function getBorderColor(wetBulb) {
    const excellentThreshold = isCelsius ? (EXCELLENT_THRESHOLD - 32) * 5 / 9 : EXCELLENT_THRESHOLD;
    const goodThreshold = isCelsius ? (GOOD_THRESHOLD - 32) * 5 / 9 : GOOD_THRESHOLD;

    if (wetBulb < excellentThreshold) {
        return 'blue';
    } else if (wetBulb < goodThreshold) {
        return 'lightblue';
    } else {
        return 'red';
    }
}

function updateForecast(daily) {
    const forecastContainer = document.getElementById('forecastContainer');
    forecastContainer.innerHTML = '';

    daily.temperature_2m_max.slice(0, 6).forEach((highTemp, index) => {
        const lowTemp = daily.temperature_2m_min[index];
        const wetBulbDay = calculateWetBulb(highTemp, daily.relative_humidity_2m_max[index]);
        const wetBulbNight = calculateWetBulb(lowTemp, daily.relative_humidity_2m_min[index]);
        const notes = generateBulletPointNotes(daily, index);

        const dayEl = createForecastCard(daily.time[index], 'Day', highTemp, wetBulbDay, daily.relative_humidity_2m_max[index], false, generateBulletPointNotes(daily, index, false));
        const nightEl = createForecastCard(daily.time[index], 'Night', lowTemp, wetBulbNight, daily.relative_humidity_2m_min[index], true, generateBulletPointNotes(daily, index, true));

        forecastContainer.appendChild(dayEl);
        forecastContainer.appendChild(nightEl);
    });
}

function createForecastCard(date, period, temp, wetBulb, humidity, isNight = false, notes) {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.border = '5px solid';
    card.style.borderColor = getBorderColor(wetBulb);
    if (isNight) card.style.backgroundColor = '#f0f0f0';
    card.innerHTML = `
        <h3>${date} (${period})</h3>
        <p>${period === 'Day' ? 'High' : 'Low'} Temp: ${temp.toFixed(1)}°${isCelsius ? 'C' : 'F'}</p>
        <p>Wet Bulb: ${wetBulb.toFixed(1)}°${isCelsius ? 'C' : 'F'}</p>
        <p>Humidity: ${humidity}%</p>
        <p>Snowmaking Quality: ${getSnowQuality(wetBulb)}</p>
        <p>Notes: ${notes}</p>
    `;

    return card;
}

function createSnowflakes() {
    const snowflakeContainer = document.getElementById('snowflakeContainer');
    snowflakeContainer.innerHTML = '';

    const snowflakeCount = Math.floor(Math.random() * 4) + 6;

    for (let i = 0; i < snowflakeCount; i++) {
        const snowflake = document.createElement('div');
        snowflake.classList.add('snowflake');

        const snowflakeInner = document.createElement('div');
        snowflakeInner.classList.add('snowflake-inner');

        snowflake.style.left = `${Math.random() * 100}vw`;

        const sizeClass = ['size-small', 'size-medium', 'size-large'][Math.floor(Math.random() * 3)];
        snowflake.classList.add(sizeClass);

        const speedClass = ['speed-slow', 'speed-medium', 'speed-fast'][Math.floor(Math.random() * 3)];
        snowflake.classList.add(speedClass);

        const delayClass = `delay-${Math.floor(Math.random() * 7)}`;
        snowflake.classList.add(delayClass);

        snowflake.appendChild(snowflakeInner);
        snowflakeContainer.appendChild(snowflake);

        snowflake.addEventListener('animationend', () => {
            snowflake.remove();
            createSnowflakes();
        });
    }
}

createSnowflakes();
