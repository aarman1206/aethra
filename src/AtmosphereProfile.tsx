import { useMemo } from 'react';
import { Line, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { AtmosphericLevel, WeatherData } from './api';

export type AtmosphereVariable = 'temperature' | 'humidity' | 'wind' | 'clouds' | 'precipitation';

interface AtmosphereProfileProps {
  weatherData: WeatherData;
  variable?: AtmosphereVariable;
}

// 1 scene unit ≈ 400 real meters of altitude, so the real 300 hPa level
// (≈ 9.6 km, from live geopotential height data) sits ~24 units up.
const ALTITUDE_SCALE = 400;
const PLANE_SIZE = 44;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function levelColor(level: AtmosphericLevel, variable: AtmosphereVariable, weatherData: WeatherData) {
  const color = new THREE.Color();
  switch (variable) {
    case 'temperature': {
      const t = clamp01((level.temperatureC + 50) / 90);
      color.setHSL(0.66 - t * 0.66, 0.85, 0.5);
      return color;
    }
    case 'humidity': {
      const h = clamp01(level.humidityPercent / 100);
      color.setHSL(0.56, 0.8, 0.25 + h * 0.45);
      return color;
    }
    case 'wind': {
      const w = clamp01(level.windSpeedKmh / 120);
      color.setHSL(0.33 - w * 0.33, 0.85, 0.5);
      return color;
    }
    case 'clouds': {
      const c = clamp01((weatherData.current.cloud_cover / 100) * (0.5 + 0.5 * (level.humidityPercent / 100)));
      color.setHSL(0, 0, 0.2 + c * 0.65);
      return color;
    }
    case 'precipitation': {
      const p = clamp01(weatherData.current.precipitation / 12);
      color.setHSL(0.58, 0.85, 0.3 + p * 0.35);
      return color;
    }
  }
}

function levelReadout(level: AtmosphericLevel) {
  const altitudeKm = (level.altitudeMeters / 1000).toFixed(1);
  return `${level.pressureHPa} hPa · ${altitudeKm} km · ${level.temperatureC.toFixed(1)}°C · ${level.windSpeedKmh.toFixed(0)} km/h @ ${level.windDirectionDeg.toFixed(0)}°`;
}

export default function AtmosphereProfile({ weatherData, variable = 'temperature' }: AtmosphereProfileProps) {
  const levels = weatherData.atmosphere;

  const renderLevels = useMemo(
    () =>
      levels.map((level) => {
        const y = Math.max(0.3, level.altitudeMeters / ALTITUDE_SCALE);
        const color = levelColor(level, variable, weatherData);
        const angle = (level.windDirectionDeg * Math.PI) / 180;
        const windLength = 2 + Math.min(level.windSpeedKmh / 15, 6);
        const arrowStart = new THREE.Vector3(0, y, 0);
        const arrowEnd = new THREE.Vector3(
          Math.sin(angle) * windLength,
          y,
          Math.cos(angle) * windLength,
        );

        return { level, y, color, arrowStart, arrowEnd };
      }),
    [levels, variable, weatherData],
  );

  if (levels.length === 0) return null;

  return (
    <group position={[0, 0, 0]}>
      {renderLevels.map(({ level, y, color, arrowStart, arrowEnd }, index) => (
        <group key={level.pressureHPa}>
          <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[PLANE_SIZE, PLANE_SIZE, 1, 1]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.16 - index * 0.015}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>

          <Line points={[arrowStart, arrowEnd]} color="#e0f2fe" lineWidth={1.5} transparent opacity={0.85} />
          <mesh position={arrowEnd} rotation={[Math.PI / 2, 0, -Math.atan2(arrowEnd.x - arrowStart.x, arrowEnd.z - arrowStart.z)]}>
            <coneGeometry args={[0.25, 0.7, 10]} />
            <meshBasicMaterial color="#e0f2fe" transparent opacity={0.9} />
          </mesh>

          <Text
            position={[-PLANE_SIZE / 2 + 1, y + 0.3, -PLANE_SIZE / 2 + 1]}
            fontSize={0.55}
            color="#7dd3fc"
            anchorX="left"
            anchorY="bottom"
          >
            {levelReadout(level)}
          </Text>
        </group>
      ))}
    </group>
  );
}
