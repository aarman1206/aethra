import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Physics, RigidBody, type RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import type { AtmosphericLevel, WeatherData } from './api';

interface WeatherPhysicsFieldProps {
  weatherData: WeatherData;
}

const PARCEL_COUNT = 18;
// Matches AtmosphereProfile's real-altitude-to-scene-unit scale, so parcels
// respond to the real wind vector at their real approximate altitude.
const ALTITUDE_SCALE = 400;

function nearestLevelWind(levels: AtmosphericLevel[], altitudeMeters: number, fallback: { speedKmh: number; directionDeg: number }) {
  if (levels.length === 0) return fallback;

  let closest = levels[0];
  let closestDiff = Math.abs(levels[0].altitudeMeters - altitudeMeters);
  for (const level of levels) {
    const diff = Math.abs(level.altitudeMeters - altitudeMeters);
    if (diff < closestDiff) {
      closest = level;
      closestDiff = diff;
    }
  }
  return { speedKmh: closest.windSpeedKmh, directionDeg: closest.windDirectionDeg };
}

function getBaseForces(weatherData: WeatherData) {
  const { cloud_cover: cloudCover, precipitation, relative_humidity_2m: humidity, surface_pressure: pressure, temperature_2m: temperature } =
    weatherData.current;

  const buoyancy = (temperature - 15) * 0.012 + (humidity - 50) * 0.004;
  const pressureSink = (1013 - pressure) * 0.002;
  const rainDrag = Math.min(precipitation, 8) * 0.03;

  return {
    color: new THREE.Color().setHSL(0.58 - Math.min(temperature + 10, 45) / 120, 0.85, 0.58),
    cloudOpacity: 0.12 + Math.min(cloudCover / 100, 1) * 0.18,
    gravityY: -0.55 + buoyancy - pressureSink - rainDrag,
  };
}

export default function WeatherPhysicsField({ weatherData }: WeatherPhysicsFieldProps) {
  const parcelRefs = useRef<Array<RapierRigidBody | null>>([]);
  const base = useMemo(() => getBaseForces(weatherData), [weatherData]);
  const levels = weatherData.atmosphere;
  const surfaceFallback = {
    speedKmh: weatherData.current.wind_speed_10m,
    directionDeg: weatherData.current.wind_direction_10m,
  };

  const parcels = useMemo(
    () =>
      Array.from({ length: PARCEL_COUNT }, (_, index) => ({
        position: [
          ((index * 7) % 13 - 6) * 1.7,
          2.2 + (index % 4) * 1.6,
          ((index * 11) % 13 - 6) * 1.25,
        ] as [number, number, number],
        radius: 0.08 + (index % 3) * 0.025,
      })),
    [],
  );

  useFrame(() => {
    parcelRefs.current.forEach((body, index) => {
      if (!body) return;

      const position = body.translation();
      const altitudeMeters = Math.max(position.y, 0) * ALTITUDE_SCALE;
      const wind = nearestLevelWind(levels, altitudeMeters, surfaceFallback);
      const angle = (wind.directionDeg * Math.PI) / 180;
      const windScale = Math.min(wind.speedKmh / 60, 1.4);

      body.applyImpulse(
        {
          x: Math.sin(angle) * windScale * 0.02,
          y: Math.max(0, base.gravityY + 0.55) * 0.004,
          z: Math.cos(angle) * windScale * 0.02,
        },
        true,
      );

      if (Math.abs(position.x) > 16 || Math.abs(position.z) > 16 || position.y < 0.5 || position.y > 9) {
        body.setTranslation(
          {
            x: ((index * 7) % 13 - 6) * 1.7,
            y: 2.2 + (index % 4) * 1.6,
            z: ((index * 11) % 13 - 6) * 1.25,
          },
          true,
        );
        body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      }
    });
  });

  return (
    <Physics gravity={[0, base.gravityY, 0]} timeStep="vary">
      {parcels.map((parcel, index) => (
        <RigidBody
          key={index}
          ref={(body) => {
            parcelRefs.current[index] = body;
          }}
          colliders="ball"
          linearDamping={1.6}
          angularDamping={2}
          position={parcel.position}
          restitution={0.25}
        >
          <mesh>
            <sphereGeometry args={[parcel.radius, 12, 12]} />
            <meshStandardMaterial
              color={base.color}
              emissive={base.color}
              emissiveIntensity={0.45}
              transparent
              opacity={base.cloudOpacity}
              depthWrite={false}
            />
          </mesh>
        </RigidBody>
      ))}

      <RigidBody type="fixed" position={[0, -0.05, 0]}>
        <mesh visible={false}>
          <boxGeometry args={[32, 0.1, 32]} />
          <meshBasicMaterial />
        </mesh>
      </RigidBody>
    </Physics>
  );
}
