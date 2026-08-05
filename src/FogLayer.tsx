import type { WeatherData } from './api';
import { classifyWeatherCode, isFoggy } from './weatherCode';

interface FogLayerProps {
  weatherData: WeatherData;
}

// Real fog: attaches actual THREE.js scene fog (not a decorative plane), so
// visibility genuinely degrades with distance — matching how fog behaves.
// Density is scaled by real relative humidity, since denser fog correlates
// with saturation.
export default function FogLayer({ weatherData }: FogLayerProps) {
  const { weather_code: weatherCode, relative_humidity_2m: humidity } = weatherData.current;
  const { category } = classifyWeatherCode(weatherCode);

  if (!isFoggy(category)) return null;

  const density = 0.012 + Math.min(humidity / 100, 1) * 0.028;

  return <fogExp2 attach="fog" color="#93a5b8" density={density} />;
}
