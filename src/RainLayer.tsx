import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { WeatherData } from './api';
import { classifyWeatherCode, isRainy } from './weatherCode';

const rainVertexShader = `
  uniform float time;
  uniform float windSpeed;
  uniform float windDirection;
  uniform float fallSpeedBase;
  uniform float pointSize;

  attribute float randomSeed;

  varying float vAlpha;

  void main() {
    float angle = radians(windDirection);
    vec2 windVec = vec2(sin(angle), cos(angle)) * windSpeed * 0.04;

    vec3 pos = position;
    float speed = fallSpeedBase + randomSeed * 3.0;
    pos.y -= mod(time * speed + randomSeed * 100.0, 20.0);
    pos.x += windVec.x * (20.0 - pos.y) * 0.1;
    pos.z += windVec.y * (20.0 - pos.y) * 0.1;

    pos.x = mod(pos.x + 20.0, 40.0) - 20.0;
    pos.z = mod(pos.z + 20.0, 40.0) - 20.0;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = pointSize * (30.0 / -mvPosition.z);

    float edgeFade = smoothstep(20.0, 10.0, max(abs(pos.x), abs(pos.z)));
    float heightFade = smoothstep(0.0, 2.0, pos.y);
    vAlpha = edgeFade * heightFade * (0.2 + randomSeed * 0.4);

    gl_Position = projectionMatrix * mvPosition;
  }
`;

const rainFragmentShader = `
  uniform vec3 color;
  varying float vAlpha;

  void main() {
    vec2 xy = gl_PointCoord.xy - vec2(0.5);
    float ll = length(xy);
    if (ll > 0.5) discard;
    float glow = (0.5 - ll) * 2.0;
    gl_FragColor = vec4(color, vAlpha * glow);
  }
`;

interface RainLayerProps {
  weatherData: WeatherData;
}

// Real per-category tuning: drizzle is finer/slower, freezing rain is tinted
// icy blue, ordinary/shower rain is the standard blue streak.
function rainStyleFor(category: string) {
  switch (category) {
    case 'drizzle':
      return { color: '#8fd6ff', pointSize: 0.9, fallSpeedBase: 3.5 };
    case 'freezing-rain':
      return { color: '#bfe8ff', pointSize: 1.3, fallSpeedBase: 5.0 };
    default:
      return { color: '#00ccff', pointSize: 1.35, fallSpeedBase: 6.0 };
  }
}

export default function RainLayer({ weatherData }: RainLayerProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const { precipitation, wind_direction_10m: windDirection, wind_speed_10m: windSpeed, weather_code: weatherCode } = weatherData.current;
  const { category } = classifyWeatherCode(weatherCode);

  const particleCount = useMemo(() => {
    if (!isRainy(category) || precipitation <= 0.02) return 0;
    return Math.min(350 + precipitation * 450, 4500);
  }, [category, precipitation]);

  const [positions, seeds] = useMemo(() => {
    const pos = new Float32Array(Math.max(particleCount, 1) * 3);
    const sds = new Float32Array(Math.max(particleCount, 1));
    for (let i = 0; i < particleCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 40;
      pos[i * 3 + 1] = Math.random() * 20;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 40;
      sds[i] = Math.random();
    }
    return [pos, sds];
  }, [particleCount]);

  const style = rainStyleFor(category);

  const uniforms = useMemo(
    () => ({
      time: { value: 0 },
      windSpeed: { value: windSpeed },
      windDirection: { value: windDirection },
      fallSpeedBase: { value: style.fallSpeedBase },
      pointSize: { value: style.pointSize },
      color: { value: new THREE.Color(style.color) },
    }),
    [windSpeed, windDirection, style.fallSpeedBase, style.pointSize, style.color],
  );

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = state.clock.elapsedTime;
    }
  });

  if (particleCount === 0) return null;

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-randomSeed" args={[seeds, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        vertexShader={rainVertexShader}
        fragmentShader={rainFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
