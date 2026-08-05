import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { WeatherData } from './api';
import { classifyWeatherCode, isSnowy } from './weatherCode';

const snowVertexShader = `
  uniform float time;
  uniform float windSpeed;
  uniform float windDirection;

  attribute float randomSeed;

  varying float vAlpha;

  void main() {
    float angle = radians(windDirection);
    vec2 windVec = vec2(sin(angle), cos(angle)) * windSpeed * 0.03;

    vec3 pos = position;
    float fallSpeed = 1.2 + randomSeed * 1.3;
    pos.y -= mod(time * fallSpeed + randomSeed * 100.0, 20.0);

    // Snow sways side to side as it falls, drifting with real wind.
    pos.x += sin(time * 0.6 + randomSeed * 20.0) * 0.6 + windVec.x * (20.0 - pos.y) * 0.08;
    pos.z += cos(time * 0.5 + randomSeed * 20.0) * 0.6 + windVec.y * (20.0 - pos.y) * 0.08;

    pos.x = mod(pos.x + 20.0, 40.0) - 20.0;
    pos.z = mod(pos.z + 20.0, 40.0) - 20.0;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = 3.2 * (30.0 / -mvPosition.z);

    float edgeFade = smoothstep(20.0, 10.0, max(abs(pos.x), abs(pos.z)));
    float heightFade = smoothstep(0.0, 2.0, pos.y);
    vAlpha = edgeFade * heightFade * (0.5 + randomSeed * 0.5);

    gl_Position = projectionMatrix * mvPosition;
  }
`;

const snowFragmentShader = `
  varying float vAlpha;

  void main() {
    vec2 xy = gl_PointCoord.xy - vec2(0.5);
    float ll = length(xy);
    if (ll > 0.5) discard;
    float glow = (0.5 - ll) * 2.0;
    gl_FragColor = vec4(1.0, 1.0, 1.0, vAlpha * glow);
  }
`;

interface SnowLayerProps {
  weatherData: WeatherData;
}

export default function SnowLayer({ weatherData }: SnowLayerProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const { precipitation, wind_direction_10m: windDirection, wind_speed_10m: windSpeed, weather_code: weatherCode } = weatherData.current;
  const { category } = classifyWeatherCode(weatherCode);

  const particleCount = useMemo(() => {
    if (!isSnowy(category)) return 0;
    return Math.min(600 + precipitation * 500, 5000);
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

  const uniforms = useMemo(
    () => ({
      time: { value: 0 },
      windSpeed: { value: windSpeed },
      windDirection: { value: windDirection },
    }),
    [windSpeed, windDirection],
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
        vertexShader={snowVertexShader}
        fragmentShader={snowFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </points>
  );
}
