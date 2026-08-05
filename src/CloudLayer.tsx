import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { WeatherData } from './api';

interface CloudLayerProps {
  weatherData: WeatherData;
}

const MAX_PUFFS = 14;
const CLOUD_ALTITUDE = 9; // scene units, roughly a low-level cloud deck
const DRIFT_BOUND = 20;

export default function CloudLayer({ weatherData }: CloudLayerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { cloud_cover: cloudCover, wind_direction_10m: windDirection, wind_speed_10m: windSpeed } = weatherData.current;

  const puffs = useMemo(
    () =>
      Array.from({ length: MAX_PUFFS }, (_, index) => {
        const angle = (index / MAX_PUFFS) * Math.PI * 2;
        const radius = 6 + ((index * 7) % 9);
        return {
          position: [Math.cos(angle) * radius, ((index * 3) % 4) * 0.6, Math.sin(angle) * radius] as [number, number, number],
          scale: 2.2 + ((index * 5) % 6) * 0.35,
        };
      }),
    [],
  );

  // Real cloud_cover (%) controls how many puffs are visible and how dense they look.
  const activePuffCount = Math.round((cloudCover / 100) * MAX_PUFFS);
  const opacity = 0.15 + Math.min(cloudCover / 100, 1) * 0.45;

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;

    // Real wind direction/speed drives the cloud deck's drift.
    const angle = (windDirection * Math.PI) / 180;
    const drift = Math.min(windSpeed / 40, 1) * delta * 0.6;
    group.position.x += Math.sin(angle) * drift;
    group.position.z += Math.cos(angle) * drift;

    if (group.position.x > DRIFT_BOUND) group.position.x = -DRIFT_BOUND;
    if (group.position.x < -DRIFT_BOUND) group.position.x = DRIFT_BOUND;
    if (group.position.z > DRIFT_BOUND) group.position.z = -DRIFT_BOUND;
    if (group.position.z < -DRIFT_BOUND) group.position.z = DRIFT_BOUND;
  });

  if (cloudCover < 10) return null;

  return (
    <group ref={groupRef} position={[0, CLOUD_ALTITUDE, 0]}>
      {puffs.slice(0, activePuffCount).map((puff, index) => (
        <mesh key={index} position={puff.position} scale={puff.scale}>
          <sphereGeometry args={[1, 12, 10]} />
          <meshStandardMaterial color="#dfe6ee" transparent opacity={opacity} roughness={1} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
