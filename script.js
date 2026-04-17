const locationEl = document.getElementById('location');
const timeEl = document.getElementById('time');
const tempValueEl = document.getElementById('tempValue');
const conditionTextEl = document.getElementById('conditionText');
const conditionIconEl = document.getElementById('conditionIcon');
const precipValueEl = document.getElementById('precipValue');
const humidityValueEl = document.getElementById('humidityValue');
const windValueEl = document.getElementById('windValue');
const hourLabelsEl = document.getElementById('hourLabels');
const hourlyChartEl = document.getElementById('hourlyChart');
const dailyForecastEl = document.getElementById('dailyForecast');
const chartTitleEl = document.getElementById('chartTitle');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const tempTab = document.getElementById('tempTab');
const precipTab = document.getElementById('precipTab');
const windTab = document.getElementById('windTab');

const tabs = [tempTab, precipTab, windTab];
let currentMetric = 'temperature';

const weatherCodeMap = {
  0: ['☀️', 'Clear'],
  1: ['🌤️', 'Mostly clear'],
  2: ['⛅', 'Partly cloudy'],
  3: ['☁️', 'Cloudy'],
  45: ['🌫️', 'Fog'],
  48: ['🌫️', 'Depositing rime fog'],
  51: ['🌧️', 'Light drizzle'],
  53: ['🌧️', 'Moderate drizzle'],
  55: ['🌧️', 'Dense drizzle'],
  61: ['🌦️', 'Slight rain'],
  63: ['🌧️', 'Rain'],
  65: ['🌧️', 'Heavy rain'],
  71: ['🌨️', 'Snow'],
  73: ['🌨️', 'Snow showers'],
  75: ['🌨️', 'Heavy snow'],
  80: ['🌧️', 'Showers'],
  81: ['🌧️', 'Rain showers'],
  95: ['⛈️', 'Thunderstorm'],
};

function setActiveTab(activeTab) {
  tabs.forEach(tab => tab.classList.toggle('active', tab === activeTab));
  currentMetric = activeTab === tempTab ? 'temperature' : activeTab === precipTab ? 'precipitation' : 'wind';
  chartTitleEl.textContent = activeTab === tempTab ? 'Temperature' : activeTab === precipTab ? 'Precipitation' : 'Wind';
}

tempTab.addEventListener('click', () => setActiveTab(tempTab));
precipTab.addEventListener('click', () => setActiveTab(precipTab));
windTab.addEventListener('click', () => setActiveTab(windTab));

searchBtn.addEventListener('click', () => {
  const query = searchInput.value.trim();
  if (!query) return;
  lookupLocation(query);
});

searchInput.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    searchBtn.click();
  }
});

async function lookupLocation(query) {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
    const response = await fetch(url);
    const data = await response.json();
    if (!data.results || data.results.length === 0) {
      alert('Location not found. Try another city or postal code.');
      return;
    }
    const place = data.results[0];
    const label = `${place.name}${place.admin1 ? `, ${place.admin1}` : ''}${place.country ? `, ${place.country}` : ''}`;
    fetchWeather(place.latitude, place.longitude, label);
  } catch (error) {
    console.error(error);
    alert('Unable to fetch location. Check your network and try again.');
  }
}

function weatherLabel(code) {
  return weatherCodeMap[code] || ['🌈', 'Variable weather'];
}

function formatTime(date) {
  const options = { weekday: 'short', hour: 'numeric', minute: 'numeric' };
  return new Intl.DateTimeFormat('en-US', options).format(date);
}

function renderChart(hours, values, unit) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * 600;
    const y = 160 - ((value - min) / range) * 120;
    return `${x},${y}`;
  });

  const polyline = `<polyline fill="none" stroke="#dd9d2d" stroke-width="3" points="${points.join(' ')}"/>`;
  const circles = values.map((value, index) => {
    const x = (index / (values.length - 1)) * 600;
    const y = 160 - ((value - min) / range) * 120;
    return `<circle cx="${x}" cy="${y}" r="4" fill="#dd9d2d" />`;
  }).join('');

  hourlyChartEl.innerHTML = `
    <defs>
      <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ffb347" stop-opacity="0.8" />
        <stop offset="100%" stop-color="#dd9d2d" stop-opacity="0.15" />
      </linearGradient>
    </defs>
    <path d="M0,180 L600,180 L600,160 L0,160 Z" fill="url(#lineGradient)" />
    ${polyline}
    ${circles}
  `;

  hourLabelsEl.innerHTML = hours.map(hour => `<span>${hour}</span>`).join('');
}

function createDailyCard(day) {
  const card = document.createElement('article');
  card.className = 'day-card';
  card.innerHTML = `
    <h2>${day.weekday}</h2>
    <div class="weather-icon-sm">${day.icon}</div>
    <div class="temp-range"><span>${day.max}°</span><span>${day.min}°</span></div>
    <p>${day.text}</p>
  `;
  return card;
}

function parseApiDateLocal(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function getHourlyDisplayData(data) {
  const now = new Date();
  const currentIndex = data.time.findIndex(time => new Date(time) >= now);
  const start = Math.max(currentIndex, 0);
  const end = Math.min(start + 12, data.time.length);
  const selected = data.time.slice(start, end);
  const result = selected.map((time, index) => {
    const date = new Date(time);
    return {
      label: date.getHours() === 0 ? '12a' : date.getHours() > 12 ? `${date.getHours() - 12}p` : `${date.getHours()}a`,
      value: currentMetric === 'temperature' ? data.temperature_2m[start + index]
        : currentMetric === 'precipitation' ? data.precipitation_probability[start + index]
        : data.windspeed_10m[start + index],
    };
  });
  return result;
}

function updateHourlyChart(weatherData) {
  const display = getHourlyDisplayData(weatherData.hourly);
  renderChart(display.map(item => item.label), display.map(item => item.value), currentMetric);
}

function updateWeatherDisplay(data, label) {
  const currentDate = new Date();
  const currentIndex = data.hourly.time.findIndex(time => new Date(time) >= currentDate);
  const index = currentIndex >= 0 ? currentIndex : 0;
  const temperature = data.hourly.temperature_2m[index];
  const precipitation = data.hourly.precipitation_probability[index];
  const wind = data.hourly.windspeed_10m[index];
  const code = data.hourly.weathercode[index];
  const [icon, text] = weatherLabel(code);

  locationEl.textContent = label;
  timeEl.textContent = formatTime(currentDate);
  tempValueEl.textContent = Math.round(temperature);
  conditionTextEl.textContent = text;
  conditionIconEl.textContent = icon;
  precipValueEl.textContent = `${Math.round(precipitation)}%`;
  humidityValueEl.textContent = `${Math.round(data.hourly.relativehumidity_2m[index] || 0)}%`;
  windValueEl.textContent = `${Math.round(wind)} mph`;

  const daily = data.daily.time.map((day, index) => {
    const code = data.daily.weathercode[index];
    const [icon] = weatherLabel(code);
    const date = parseApiDateLocal(day);
    const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
    return {
      weekday,
      icon,
      text: weatherLabel(code)[1],
      max: Math.round(data.daily.temperature_2m_max[index]),
      min: Math.round(data.daily.temperature_2m_min[index]),
    };
  });

  dailyForecastEl.innerHTML = '';
  daily.slice(0, 7).forEach(day => dailyForecastEl.appendChild(createDailyCard(day)));
  updateHourlyChart(data);
}

async function fetchWeather(lat, lon, label) {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation_probability,windspeed_10m,relativehumidity_2m,weathercode&daily=temperature_2m_max,temperature_2m_min,weathercode&current_weather=true&timezone=${encodeURIComponent(timezone)}`;
    const response = await fetch(url);
    const data = await response.json();
    updateWeatherDisplay(data, label);
  } catch (error) {
    console.error(error);
    alert('Unable to fetch weather data. Please try again later.');
  }
}

async function init() {
  setActiveTab(tempTab);
  fetchWeather(38.7377, -77.2534, 'Potomac, MD 20878');
}

init();
