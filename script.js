const API_KEY = '93884a8e001a81fd2dc1b978e4980a43'; // Replace with your OpenWeatherMap API key

document.getElementById('locationBtn').addEventListener('click', fetchWeatherByLocation);
document.getElementById('submitBtn').addEventListener('click', submitLocation);
document.getElementById('unitSwitch').addEventListener('change', toggleUnits);
document.getElementById('locationInput').addEventListener('input', fetchLocationSuggestions);

let isCelsius = false;

// Display an error message to the user
function displayError(message) {
    const errorContainer = document.createElement('p');
    errorContainer.textContent = message;
    errorContainer.className = 'error-message';
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

// Fetch weather data based on location input
async function submitLocation() {
    const location = document.getElementById('locationInput').value;
    try {
        const data = await fetchGeoLocation(location);
        if (data.length > 0) {
            const { lat, lon, name } = data[0];
            document.getElementById('locationInput').value = name; // Autofill with selected location
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
            const suggestionItem = document.createElement('li');
            suggestionItem.textContent = location.name;
            suggestionItem.addEventListener('click', () => {
                document.getElementById('locationInput').value = location.name;
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
            document.getElementById('locationInput').value = data[0].name;
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
