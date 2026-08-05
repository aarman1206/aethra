import { Stars } from '@react-three/drei';
import type { WeatherData } from './api';
import { classifyWeatherCode, isClear } from './weatherCode';

interface ClearSkyProps {
  weatherData: WeatherData;
}

// Driven by real is_day (Open-Meteo) — a genuine day/night flag, not a guess
// from local clock time — and the real WMO clear-sky classification.
export default function ClearSky({ weatherData }: ClearSkyProps) {
  const { weather_code: weatherCode, is_day: isDayFlag } = weatherData.current;
  const { category } = classifyWeatherCode(weatherCode);

  if (!isClear(category)) return null;

  const isDay = isDayFlag === 1;
  const position: [number, number, number] = isDay ? [26, 34, -26] : [-26, 34, 26];

  return (
    <group>
      <mesh position={position}>
        <sphereGeometry args={[2, 24, 24]} />
        <meshBasicMaterial color={isDay ? '#fff4d6' : '#cbd5e1'} />
      </mesh>
      <pointLight position={position} intensity={isDay ? 1.2 : 0.35} color={isDay ? '#fff4d6' : '#93c5fd'} distance={140} />
      {!isDay && <Stars radius={80} depth={40} count={2200} factor={2} fade speed={0.5} />}
    </group>
  );
}
