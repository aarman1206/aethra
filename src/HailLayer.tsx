import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Physics, RigidBody, type RapierRigidBody } from '@react-three/rapier';
import type { WeatherData } from './api';
import { classifyWeatherCode } from './weatherCode';

interface HailLayerProps {
  weatherData: WeatherData;
}

const HAIL_COUNT = 24;

// Only renders for the real WMO "thunderstorm with hail" codes (96, 99) —
// distinct from ordinary thunderstorms and from rain/snow. Uses actual Rapier
// physics so hail pellets fall and bounce, rather than being a static effect.
export default function HailLayer({ weatherData }: HailLayerProps) {
  const pelletRefs = useRef<Array<RapierRigidBody | null>>([]);
  const { category } = classifyWeatherCode(weatherData.current.weather_code);
  const isHail = category === 'thunderstorm-hail';

  const pellets = useMemo(
    () =>
      Array.from({ length: HAIL_COUNT }, (_, index) => ({
        position: [((index * 7) % 16) - 8, 9 + (index % 5), ((index * 11) % 16) - 8] as [number, number, number],
        radius: 0.06 + (index % 3) * 0.03,
      })),
    [],
  );

  useFrame(() => {
    pelletRefs.current.forEach((body, index) => {
      if (!body) return;
      const position = body.translation();
      if (position.y < 0.2) {
        body.setTranslation({ x: ((index * 7) % 16) - 8, y: 9 + (index % 5), z: ((index * 11) % 16) - 8 }, true);
        body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      }
    });
  });

  if (!isHail) return null;

  return (
    <Physics gravity={[0, -18, 0]}>
      {pellets.map((pellet, index) => (
        <RigidBody
          key={index}
          ref={(body) => {
            pelletRefs.current[index] = body;
          }}
          colliders="ball"
          position={pellet.position}
          restitution={0.55}
          linearDamping={0.1}
        >
          <mesh>
            <sphereGeometry args={[pellet.radius, 8, 8]} />
            <meshStandardMaterial color="#e8f4ff" emissive="#a8d8ff" emissiveIntensity={0.3} roughness={0.2} />
          </mesh>
        </RigidBody>
      ))}
      <RigidBody type="fixed" position={[0, 0, 0]}>
        <mesh visible={false}>
          <boxGeometry args={[36, 0.2, 36]} />
          <meshBasicMaterial />
        </mesh>
      </RigidBody>
    </Physics>
  );
}
