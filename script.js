const OPEN_METEO_BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org/search';

//document.getElementById('locationBtn').addEventListener('click', fetchWeatherByLocation);
//document.getElementById('submitBtn').addEventListener('click', submitLocation);
document.getElementById('unitSwitch').addEventListener('change', toggleUnits);
document.getElementById('locationInput').addEventListener('input', fetchLocationSuggestions);

let isCelsius = document.getElementById('unitSwitch').checked;

// Constants for snow quality thresholds and gauge percentages
const EXCELLENT_THRESHOLD = 21;
const GOOD_THRESHOLD = 28;

// Display an error message to the user
function displayError(message) {
    const errorContainer = document.createElement('div');
    errorContainer.textContent = message;
    errorContainer.className = 'error-message';
    
    // Append and automatically remove after 5 seconds
    document.body.prepend(errorContainer);
    setTimeout(() => errorContainer.remove(), 5000);
}

// Fetch weather data based on latitude and longitude using Open-Meteo API
async function fetchWeatherData(lat, lon) {
    try {
        const response = await fetch(`${OPEN_METEO_BASE_URL}?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relative_humidity_2m&daily=temperature_2m_max,temperature_2m_min&temperature_unit=${isCelsius ? 'celsius' : 'fahrenheit'}&timezone=auto`);
        
        if (!response.ok) {
            throw new Error(`Weather data fetch failed: ${response.status}`);
        }

        const data = await response.json();

        if (data.hourly && data.daily) {
            updateCurrentConditions(data.hourly, data.daily);
            updateForecast(data.daily);
        } else {
            displayError("Weather data is unavailable.");
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

// Update Current Conditions
function updateCurrentConditions(hourly, daily) {
    const currentTemp = hourly.temperature_2m[new Date().getHours()]; // Get the temperature for the current hour
    const humidity = hourly.relative_humidity_2m[new Date().getHours()];
    const wetBulb = calculateWetBulb(currentTemp, humidity);

    document.getElementById('temp').textContent = `${currentTemp.toFixed(1)} °${isCelsius ? 'C' : 'F'}`;
    document.getElementById('humidity').textContent = `${humidity}%`;
    document.getElementById('wetBulb').textContent = `${wetBulb.toFixed(1)} °${isCelsius ? 'C' : 'F'}`;

    updateSnowQuality(wetBulb);
}

// Calculate Wet Bulb Temperature (approximation formula)
function calculateWetBulb(temp, humidity) {
    // Convert temperature to Celsius if it's in Fahrenheit
    if (!isCelsius) {
        temp = (temp - 32) * 5 / 9;
    }

    const wetBulb = temp * Math.atan(0.151977 * Math.sqrt(humidity + 8.313659)) + Math.atan(temp + humidity) - Math.atan(humidity - 1.676331) + 0.00391838 * Math.pow(humidity, 1.5) * Math.atan(0.023101 * humidity) - 4.686035;

    // Convert wet bulb temperature back to Fahrenheit if needed
    return isCelsius ? wetBulb : (wetBulb * 9 / 5) + 32;
}

// Fetch location suggestions using Nominatim API
async function fetchLocationSuggestions() {
    const query = document.getElementById('locationInput').value;
    if (query.length < 3) return; // Only fetch if query is longer than 2 characters

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

// Fetch weather data based on location input using Nominatim for geocoding
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

// Fetch weather data based on GPS location
async function fetchWeatherByLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            await fetchWeatherData(lat, lon);

            // Fetch the nearest location name using Nominatim reverse geocoding
            try {
                const response = await fetch(`${NOMINATIM_BASE_URL}?q=${lat},${lon}&format=json&addressdetails=1&limit=1`);
                if (!response.ok) throw new Error("Reverse geocoding fetch failed");

                const data = await response.json();
                if (data.length > 0) {
                    const locationName = data[0].display_name;
                    document.getElementById('locationInput').value = locationName;
                } else {
                    displayError("Unable to determine the nearest location.");
                }
            } catch (error) {
                displayError("Failed to fetch the nearest location.");
                console.error("Error fetching the nearest location:", error);
            }
        }, (error) => {
            displayError("Unable to access GPS location.");
            console.error("Geolocation error:", error);
        });
    } else {
        displayError("Geolocation is not supported by this browser.");
    }
}

// Fetch weather data based on GPS location on page load
window.addEventListener('load', fetchWeatherByLocation);

function updateSnowQuality(wetBulb) {
    const snowQualityElement = document.getElementById('quality');

    const { snowQuality } = determineSnowQuality(wetBulb);

    updateSnowQualityDisplay(snowQuality, wetBulb);
}

// Function to determine snow quality based on wet bulb temperature
function determineSnowQuality(wetBulb) {
    let snowQuality;
    let excellentThreshold = EXCELLENT_THRESHOLD;
    let goodThreshold = GOOD_THRESHOLD;

    // Adjust thresholds if using Celsius
    if (isCelsius) {
        excellentThreshold = (EXCELLENT_THRESHOLD - 32) * 5 / 9;
        goodThreshold = (GOOD_THRESHOLD - 32) * 5 / 9;
    }

    if (wetBulb < excellentThreshold) {
        snowQuality = "Excellent (Snowmaking Optimal)";
    } else if (wetBulb < goodThreshold) {
        snowQuality = "Poor (Snowmaking Possible)";
    } else {
        snowQuality = "Too Warm (Snowmaking Not Possible)";
    }

    return { snowQuality };
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
    snowQualityElement.textContent = snowQuality;
    if (wetBulb < GOOD_THRESHOLD) {
      //  snowIndicator.textContent = '❄️'; // Snowflake icon for possible snowmaking
    } else {
      //  snowIndicator.textContent = `${(wetBulb - GOOD_THRESHOLD).toFixed(1)}° Too Warm`;
    }
}

function updateForecast(daily) {
    const forecastContainer = document.getElementById('forecastContainer');
    forecastContainer.innerHTML = '';

    daily.temperature_2m_max.forEach((highTemp, index) => {
        const lowTemp = daily.temperature_2m_min[index];
        const avgTemp = (highTemp + lowTemp) / 2;
        const wetBulb = calculateWetBulb(lowTemp, daily.humidity_2m ? daily.humidity_2m[index] : 50);
        
        const dayEl = document.createElement('div');
        dayEl.className = wetBulb < GOOD_THRESHOLD ? (wetBulb < EXCELLENT_THRESHOLD ? 'dark-blue' : 'light-blue') : 'red';
        
        dayEl.innerHTML = `
            <p>${new Date(daily.time[index]).toLocaleDateString()}</p>
            <p>High: ${highTemp.toFixed(1)}°</p>
            <p>Low: ${lowTemp.toFixed(1)}°</p>
            <p>${wetBulb < GOOD_THRESHOLD ? (wetBulb < EXCELLENT_THRESHOLD ? '❄️ Excellent (Snowmaking Optimal)' : '"Poor (Snowmaking Possible)') : `Too Warm (Snowmaking Not Possible)`}</p>
        `;

        forecastContainer.appendChild(dayEl);
    });
}

