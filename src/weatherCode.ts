// Official WMO weather interpretation codes, as used by Open-Meteo and most
// national weather services. This is the real, standardized classification of
// "what phenomenon is currently happening" — not a heuristic guess from
// thresholds. Reference: https://open-meteo.com/en/docs (WMO Weather code)

export type PhenomenonCategory =
  | 'clear'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'freezing-rain'
  | 'snow'
  | 'rain-showers'
  | 'snow-showers'
  | 'thunderstorm'
  | 'thunderstorm-hail';

interface PhenomenonInfo {
  category: PhenomenonCategory;
  label: string;
}

const WMO_CODE_TABLE: Record<number, PhenomenonInfo> = {
  0: { category: 'clear', label: 'Clear sky' },
  1: { category: 'clear', label: 'Mainly clear' },
  2: { category: 'cloudy', label: 'Partly cloudy' },
  3: { category: 'cloudy', label: 'Overcast' },
  45: { category: 'fog', label: 'Fog' },
  48: { category: 'fog', label: 'Depositing rime fog' },
  51: { category: 'drizzle', label: 'Light drizzle' },
  53: { category: 'drizzle', label: 'Moderate drizzle' },
  55: { category: 'drizzle', label: 'Dense drizzle' },
  56: { category: 'freezing-rain', label: 'Light freezing drizzle' },
  57: { category: 'freezing-rain', label: 'Dense freezing drizzle' },
  61: { category: 'rain', label: 'Slight rain' },
  63: { category: 'rain', label: 'Moderate rain' },
  65: { category: 'rain', label: 'Heavy rain' },
  66: { category: 'freezing-rain', label: 'Light freezing rain' },
  67: { category: 'freezing-rain', label: 'Heavy freezing rain' },
  71: { category: 'snow', label: 'Slight snow fall' },
  73: { category: 'snow', label: 'Moderate snow fall' },
  75: { category: 'snow', label: 'Heavy snow fall' },
  77: { category: 'snow', label: 'Snow grains' },
  80: { category: 'rain-showers', label: 'Slight rain showers' },
  81: { category: 'rain-showers', label: 'Moderate rain showers' },
  82: { category: 'rain-showers', label: 'Violent rain showers' },
  85: { category: 'snow-showers', label: 'Slight snow showers' },
  86: { category: 'snow-showers', label: 'Heavy snow showers' },
  95: { category: 'thunderstorm', label: 'Thunderstorm' },
  96: { category: 'thunderstorm-hail', label: 'Thunderstorm with slight hail' },
  99: { category: 'thunderstorm-hail', label: 'Thunderstorm with heavy hail' },
};

export function classifyWeatherCode(code: number): PhenomenonInfo {
  return WMO_CODE_TABLE[code] ?? { category: 'clear', label: 'Unknown' };
}

export const isRainy = (category: PhenomenonCategory) =>
  category === 'rain' || category === 'rain-showers' || category === 'drizzle' || category === 'freezing-rain';

export const isSnowy = (category: PhenomenonCategory) => category === 'snow' || category === 'snow-showers';

export const isThunderstorm = (category: PhenomenonCategory) =>
  category === 'thunderstorm' || category === 'thunderstorm-hail';

export const isFoggy = (category: PhenomenonCategory) => category === 'fog';

export const isCloudy = (category: PhenomenonCategory) => category === 'cloudy';

export const isClear = (category: PhenomenonCategory) => category === 'clear';
