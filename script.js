const API_KEY = '93884a8e001a81fd2dc1b978e4980a43'; // Replace with your OpenWeatherMap API key

document.getElementById('locationBtn').addEventListener('click', fetchWeatherByLocation);
document.getElementById('submitBtn').addEventListener('click', submitLocation);
document.getElementById('unitSwitch').addEventListener('change', toggleUnits);
document.getElementById('locationInput').addEventListener('input', fetchLocationSuggestions);

let isCelsius = false;

// Constants for snow quality thresholds and gauge percentages
const EXCELLENT_THRESHOLD = 21;
const GOOD_THRESHOLD = 28;
const EXCELLENT_GAUGE_PERCENTAGE = 100;
const GOOD_GAUGE_PERCENTAGE = 70;
const TOO_WARM_GAUGE_PERCENTAGE = 30;

// Display an error message to the user
function displayError(message) {
    const errorContainer = document.createElement('div');
    errorContainer.textContent = message;
    errorContainer.className = 'error-message';
    
    // Append and automatically remove after 5 seconds
    document.body.prepend(errorContainer);
    setTimeout(() => errorContainer.remove(), 5000);
}

// Fetch weather data based on GPS location
async function fetchWeatherByLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                await fetchNearestCity(lat, lon);
                await fetchWeatherData(lat, lon);
            },
            (error) => {
                displayError("Unable to access GPS location.");
                console.error("Geolocation error:", error);
            }
        );
    } else {
        displayError("Geolocation is not supported by this browser.");
    }
}

// Call fetchWeatherByLocation on page load
window.addEventListener('load', fetchWeatherByLocation);

// Fetch weather data based on location input
async function submitLocation() {
    const location = document.getElementById('locationInput').value;
    try {
        const data = await fetchGeoLocation(location);
        if (data.length > 0) {
            const { lat, lon, name, state, country } = data[0];
            document.getElementById('locationInput').value = `${name}, ${state || ''}, ${country}`; // Autofill with selected location
            await fetchWeatherData(lat, lon);
        } else {
            displayError("Location not found. Please enter a valid location.");
        }
    } catch (error) {
        displayError("Failed to fetch location data. Please try again.");
        console.error("Error fetching location data:", error);
    }
}

// Fetch location suggestions for the input field
async function fetchLocationSuggestions() {
    const query = document.getElementById('locationInput').value;
    if (query.length < 3) return; // Only fetch if query is longer than 2 characters

    try {
        const data = await fetchGeoLocation(query);

        const suggestionsList = document.getElementById('suggestions');
        suggestionsList.innerHTML = '';
        data.forEach(location => {
            const locationName = `${location.name}, ${location.state || ''}, ${location.country}`;
            const suggestionItem = document.createElement('li');
            suggestionItem.textContent = locationName;
            suggestionItem.addEventListener('click', () => {
                document.getElementById('locationInput').value = locationName;
                suggestionsList.innerHTML = '';
            });
            suggestionsList.appendChild(suggestionItem);
        });
    } catch (error) {
        displayError("Failed to fetch location suggestions.");
        console.error("Error fetching location suggestions:", error);
    }
}

// Fetch latitude and longitude based on a query using Geocoding API
async function fetchGeoLocation(query) {
    const response = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${query}&limit=5&appid=${API_KEY}`);
    
    if (!response.ok) {
        throw new Error(`Location fetch failed: ${response.status}`);
    }
    return await response.json();
}

// Fetch the nearest city name based on latitude and longitude
async function fetchNearestCity(lat, lon) {
    try {
        const response = await fetch(`https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${API_KEY}`);
        
        if (!response.ok) {
            throw new Error(`Nearest city fetch failed: ${response.status}`);
        }
        
        const data = await response.json();
        if (data.length > 0) {
            const { name, state, country } = data[0];
            document.getElementById('locationInput').value = `${name}, ${state || ''}, ${country}`;
        } else {
            displayError("Unable to find nearest city.");
        }
    } catch (error) {
        displayError("Failed to fetch nearest city.");
        console.error("Error fetching nearest city:", error);
    }
}

// Fetch weather data for a given latitude and longitude
async function fetchWeatherData(lat, lon) {
    try {
        const response = await fetch(`https://api.openweathermap.org/data/2.5/onecall?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=${isCelsius ? 'metric' : 'imperial'}`);
        
        if (!response.ok) {
            throw new Error(`Weather data fetch failed: ${response.status}`);
        }

        const data = await response.json();

        if (data.current) {
            updateCurrentConditions(data.current);
        } else {
            displayError("Current weather data is unavailable.");
        }

        if (data.daily) {
            updateForecast(data.daily);
        } else {
            displayError("Daily forecast data is unavailable.");
        }
    } catch (error) {
        displayError("Failed to fetch weather data. Please try again.");
        console.error("Error fetching weather data:", error);
    }
}

// Toggle between Celsius and Fahrenheit
function toggleUnits() {
    isCelsius = document.getElementById('unitSwitch').checked;
    const location = document.getElementById('locationInput').value;
    if (location) {
        submitLocation(); // Re-fetch data for the current location
    }
}

function updateCurrentConditions(current) {
    const temp = current.temp;
    const humidity = current.humidity;
    const wetBulb = calculateWetBulb(temp, humidity);

    document.getElementById('temp').textContent = `${temp.toFixed(1)} °${isCelsius ? 'C' : 'F'}`;
    document.getElementById('humidity').textContent = `${humidity}%`;
    document.getElementById('wetBulb').textContent = `${wetBulb.toFixed(1)} °${isCelsius ? 'C' : 'F'}`;

    updateSnowQuality(wetBulb);
}

function updateSnowQuality(wetBulb) {
    const snowQualityElement = document.getElementById('quality');
    const gaugeValue = document.querySelector('.gauge-value');
    const gaugeText = document.querySelector('.gauge-text');
    const snowIndicator = document.getElementById('snowIndicator');

    const { snowQuality, gaugeClass, gaugePercentage } = determineSnowQuality(wetBulb);

    updateGauge(gaugeClass, gaugePercentage);
    updateSnowQualityDisplay(snowQuality, wetBulb);
}

// Function to determine snow quality based on wet bulb temperature
function determineSnowQuality(wetBulb) {
    let snowQuality, gaugeClass, gaugePercentage;

    if (wetBulb < EXCELLENT_THRESHOLD) {
        snowQuality = "Excellent";
        gaugeClass = "excellent";
        gaugePercentage = EXCELLENT_GAUGE_PERCENTAGE;
    } else if (wetBulb < GOOD_THRESHOLD) {
        snowQuality = "Good";
        gaugeClass = "good";
        gaugePercentage = GOOD_GAUGE_PERCENTAGE;
    } else {
        snowQuality = "Too Warm";
        gaugeClass = "too-warm";
        gaugePercentage = TOO_WARM_GAUGE_PERCENTAGE;
    }

    return { snowQuality, gaugeClass, gaugePercentage };
}

// Function to update the gauge display
function updateGauge(gaugeClass, gaugePercentage) {
    const gaugeValue = document.querySelector('.gauge-value');
    const gaugeText = document.querySelector('.gauge-text');
    gaugeValue.className = `gauge-value ${gaugeClass}`;
    gaugeValue.style.strokeDasharray = `${gaugePercentage} 100`;
    gaugeText.textContent = `${gaugePercentage}%`;
}

function createSnowflakes() {
    const snowflakeContainer = document.getElementById('snowflakeContainer');

    // Remove any existing snowflakes
    snowflakeContainer.innerHTML = '';

    // Generate 6-10 snowflakes
    const snowflakeCount = Math.floor(Math.random() * 4) + 6;

    for (let i = 0; i < snowflakeCount; i++) {
        const snowflake = document.createElement('div');
        snowflake.classList.add('snowflake');

        // Create inner div for rotation and sway animations
        const snowflakeInner = document.createElement('div');
        snowflakeInner.classList.add('snowflake-inner');

        // Randomize position within the viewport
        snowflake.style.left = `${Math.random() * 100}vw`;

        // Randomize size
        const sizeClass = ['size-small', 'size-medium', 'size-large'][Math.floor(Math.random() * 3)];
        snowflake.classList.add(sizeClass);

        // Randomize speed of falling
        const speedClass = ['speed-slow', 'speed-medium', 'speed-fast'][Math.floor(Math.random() * 3)];
        snowflake.classList.add(speedClass);

        // Randomize animation delay for staggered start
        const delayClass = `delay-${Math.floor(Math.random() * 7)}`; // 0 to 5 seconds
        snowflake.classList.add(delayClass);

        // Append inner div to outer snowflake div
        snowflake.appendChild(snowflakeInner);

        // Append snowflake to container
        snowflakeContainer.appendChild(snowflake);

        // Remove snowflake after animation ends to regenerate
        snowflake.addEventListener('animationend', () => {
            snowflake.remove();
            createSnowflakes(); // Recursively create a new snowflake after one falls
        });
    }
}

// Initialize snowflakes
createSnowflakes();

// Function to update the snow quality display
function updateSnowQualityDisplay(snowQuality, wetBulb) {
    const snowQualityElement = document.getElementById('quality');
    const snowIndicator = document.getElementById('snowIndicator');
    snowQualityElement.textContent = snowQuality;
    if (wetBulb < GOOD_THRESHOLD) {
        snowIndicator.textContent = '❄️'; // Snowflake icon for possible snowmaking
    } else {
        snowIndicator.textContent = `${(wetBulb - GOOD_THRESHOLD).toFixed(1)}° Too Warm`;
    }
}

// Function to calculate the wet bulb temperature
function calculateWetBulb(temp, humidity) {
    if (typeof temp !== 'number' || typeof humidity !== 'number' || temp < 0 || humidity < 0 || humidity > 100) {
        throw new Error('Invalid input: Temperature and humidity must be numbers, and humidity must be between 0 and 100.');
    }

    // Simple formula for Wet Bulb approximation
    return temp * Math.atan(0.151977 * Math.sqrt(humidity + 8.313659)) + Math.atan(temp + humidity) - Math.atan(humidity - 1.676331) + 0.00391838 * Math.pow(humidity, 1.5) * Math.atan(0.023101 * humidity) - 4.686035;
}

function updateForecast(daily) {
    const forecastContainer = document.getElementById('forecastContainer');
    forecastContainer.innerHTML = '';

    daily.slice(0, 7).forEach(day => {
        const dayEl = document.createElement('div');
        const highTemp = day.temp.max;
        const lowTemp = day.temp.min;
        const wetBulb = calculateWetBulb((highTemp + lowTemp) / 2, day.humidity);
        const tooWarm = wetBulb >= 28;

        dayEl.className = tooWarm ? 'red' : wetBulb < 21 ? 'dark-blue' : 'light-blue';
        dayEl.innerHTML = `
            <p>${new Date(day.dt * 1000).toLocaleDateString()}</p>
            <p>High: ${highTemp.toFixed(1)}°</p>
            <p>Low: ${lowTemp.toFixed(1)}°</p>
            <p>${tooWarm ? `${(wetBulb - 28).toFixed(1)}° Too Warm` : '❄️ Snowmaking'}</p>
        `;
        forecastContainer.appendChild(dayEl);
    });
}

function toggleUnits() {
    isCelsius = !isCelsius;
    const lat = 34.0522; // Example coordinates (or use actual location data)
    const lon = -118.2437;
    fetchWeatherData(lat, lon);
}