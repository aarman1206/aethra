export interface NASAWeatherData {
  temperature_2m?: number;
  wind_speed_10m?: number;
  wind_direction_10m?: number;
  relative_humidity_2m?: number;
  precipitation?: number;
  surface_pressure?: number;
  timestamp?: string;
}

export interface AtmosphericLevel {
  pressureHPa: number;
  altitudeMeters: number;
  temperatureC: number;
  windSpeedKmh: number;
  windDirectionDeg: number;
  humidityPercent: number;
}

export interface WeatherData {
  latitude: number;
  longitude: number;
  nasa?: NASAWeatherData;
  atmosphere: AtmosphericLevel[];
  current: {
    temperature_2m: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    relative_humidity_2m: number;
    precipitation: number;
    surface_pressure: number;
    cloud_cover: number;
    weather_code: number;
    is_day: number;
  };
  daily: {
    time: string[];
    temperature_2m_max: number[];
  };
}

interface NASAResponse {
  properties?: {
    parameter?: Record<string, Record<string, number | string | null>>;
  };
}

interface CitySearchResult {
  id?: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
}

const PRESSURE_LEVELS_HPA = [1000, 850, 700, 500, 300] as const;

interface OpenMeteoCurrentResponse {
  current: WeatherData['current'];
  daily: WeatherData['daily'];
}

interface OpenMeteoPressureResponse {
  hourly: {
    time: string[];
    [key: string]: string[] | number[];
  };
}

const formatPowerDate = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  return `${year}${month}${day}`;
};

// NASA POWER uses -999 (and similar large negative sentinels) to mark missing data.
const isValidPowerValue = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > -900;

const latestFiniteValue = (series?: Record<string, number | string | null>) => {
  if (!series) return undefined;

  const latestEntry = Object.entries(series)
    .filter(([, value]) => isValidPowerValue(value))
    .sort(([a], [b]) => a.localeCompare(b))
    .at(-1);

  return latestEntry ? { timestamp: latestEntry[0], value: latestEntry[1] as number } : undefined;
};

const fetchNASAWeather = async (lat: number, lon: number): Promise<NASAWeatherData | undefined> => {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - 1);

  const parameters = ['T2M', 'RH2M', 'WS10M', 'WD10M', 'PRECTOTCORR', 'PS'].join(',');
  const url = `https://power.larc.nasa.gov/api/temporal/hourly/point?parameters=${parameters}&community=RE&longitude=${lon}&latitude=${lat}&start=${formatPowerDate(start)}&end=${formatPowerDate(end)}&format=JSON`;

  const response = await fetch(url);
  if (!response.ok) return undefined;

  const data = (await response.json()) as NASAResponse;
  const parameter = data.properties?.parameter;
  if (!parameter) return undefined;

  const temperature = latestFiniteValue(parameter.T2M);
  const humidity = latestFiniteValue(parameter.RH2M);
  const windSpeed = latestFiniteValue(parameter.WS10M);
  const windDirection = latestFiniteValue(parameter.WD10M);
  const precipitation = latestFiniteValue(parameter.PRECTOTCORR);
  const pressure = latestFiniteValue(parameter.PS);

  return {
    temperature_2m: temperature?.value,
    relative_humidity_2m: humidity?.value,
    wind_speed_10m: windSpeed?.value,
    wind_direction_10m: windDirection?.value,
    precipitation: precipitation?.value,
    surface_pressure: pressure?.value,
    timestamp: temperature?.timestamp ?? humidity?.timestamp ?? windSpeed?.timestamp,
  };
};

const nearestHourIndex = (times: string[]) => {
  const now = Date.now();
  let bestIndex = 0;
  let bestDiff = Infinity;
  times.forEach((time, index) => {
    const diff = Math.abs(new Date(time).getTime() - now);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = index;
    }
  });
  return bestIndex;
};

const fetchAtmosphericProfile = async (lat: number, lon: number): Promise<AtmosphericLevel[]> => {
  const variables = PRESSURE_LEVELS_HPA.flatMap((level) => [
    `temperature_${level}hPa`,
    `wind_speed_${level}hPa`,
    `wind_direction_${level}hPa`,
    `relative_humidity_${level}hPa`,
    `geopotential_height_${level}hPa`,
  ]);

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=${variables.join(',')}&forecast_days=1&timezone=auto`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch atmospheric profile data');
  }

  const data = (await response.json()) as OpenMeteoPressureResponse;
  const index = nearestHourIndex(data.hourly.time);

  const readValue = (key: string): number => {
    const series = data.hourly[key];
    const value = Array.isArray(series) ? series[index] : undefined;
    return typeof value === 'number' ? value : 0;
  };

  return PRESSURE_LEVELS_HPA.map((level) => ({
    pressureHPa: level,
    altitudeMeters: readValue(`geopotential_height_${level}hPa`),
    temperatureC: readValue(`temperature_${level}hPa`),
    windSpeedKmh: readValue(`wind_speed_${level}hPa`),
    windDirectionDeg: readValue(`wind_direction_${level}hPa`),
    humidityPercent: readValue(`relative_humidity_${level}hPa`),
  })).sort((a, b) => b.pressureHPa - a.pressureHPa);
};

export const fetchWeather = async (lat: number, lon: number): Promise<WeatherData> => {
  const currentUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,surface_pressure,wind_speed_10m,wind_direction_10m,cloud_cover,weather_code,is_day&daily=temperature_2m_max&timezone=auto`;

  const [currentResult, nasaResult, atmosphereResult] = await Promise.allSettled([
    fetch(currentUrl),
    fetchNASAWeather(lat, lon),
    fetchAtmosphericProfile(lat, lon),
  ]);

  if (currentResult.status === 'rejected' || !currentResult.value.ok) {
    throw new Error('Failed to fetch Open-Meteo weather data');
  }

  const current = (await currentResult.value.json()) as OpenMeteoCurrentResponse;

  const weatherData: WeatherData = {
    latitude: lat,
    longitude: lon,
    current: current.current,
    daily: current.daily,
    atmosphere: atmosphereResult.status === 'fulfilled' ? atmosphereResult.value : [],
    nasa: nasaResult.status === 'fulfilled' ? nasaResult.value : undefined,
  };

  return weatherData;
};

export const searchCity = async (name: string): Promise<CitySearchResult | null> => {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to search city');
  }
  const data = (await response.json()) as { results?: CitySearchResult[] };
  if (data.results && data.results.length > 0) {
    return data.results[0];
  }
  return null;
};
