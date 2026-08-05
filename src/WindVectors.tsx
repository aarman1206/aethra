import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { WeatherData } from './api';

interface WindVectorsProps {
  weatherData: WeatherData;
}

const vectorVertexShader = `
  uniform float time;
  uniform float windSpeed;
  uniform float windDirection;
  
  attribute vec3 offset;
  attribute float randOffset;
  
  varying vec3 vColor;
  
  void main() {
    // Basic wind vector from data
    float angle = radians(windDirection);
    vec3 baseDir = vec3(sin(angle), 0.0, cos(angle));
    
    // Add only light turbulence so vectors still read as wind direction
    float noise = sin(offset.x * 0.25 + time * 0.4) * cos(offset.z * 0.25 + time * 0.4) * 0.12;
    vec3 turbulentDir = normalize(baseDir + vec3(noise, 0.05 * sin(time + randOffset), noise));
    
    // Rotate the cone to point in the turbulent direction
    // Default cone points UP (0,1,0). We need to rotate it to turbulentDir
    vec3 up = vec3(0.0, 1.0, 0.0);
    vec3 axis = cross(up, turbulentDir);
    float dotProduct = dot(up, turbulentDir);
    
    vec3 transformed = position;
    
    if (abs(dotProduct) < 0.999) {
      float angleRot = acos(dotProduct);
      axis = normalize(axis);
      
      // Rodrigues' rotation formula
      transformed = position * cos(angleRot) + 
                    cross(axis, position) * sin(angleRot) + 
                    axis * dot(axis, position) * (1.0 - cos(angleRot));
    }
    
    // Scale by wind speed
    transformed *= (0.45 + windSpeed * 0.025);
    
    // Animate position slightly to look like flow
    vec3 finalPos = offset;
    finalPos.y += sin(time * 0.8 + randOffset) * 0.18;
    
    // Determine color based on height and speed
    float heightMix = smoothstep(0.0, 15.0, finalPos.y);
    vec3 colorLow = vec3(0.0, 0.5, 1.0); // Blue
    vec3 colorHigh = vec3(1.0, 0.0, 0.2); // Red
    
    vColor = mix(colorLow, colorHigh, heightMix + (windSpeed / 50.0));
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(finalPos + transformed, 1.0);
  }
`;

const vectorFragmentShader = `
  varying vec3 vColor;
  void main() {
    // Add some rim lighting to the cone
    gl_FragColor = vec4(vColor * 0.9, 0.42);
  }
`;

export default function WindVectors({ weatherData }: WindVectorsProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  
  const gridSize = 9; // readable 9x9 wind field
  const heightLayers = 2; // near-surface and upper wind layers
  
  const instanceCount = gridSize * gridSize * heightLayers;
  
  const [offsets, randOffsets] = useMemo(() => {
    const off = new Float32Array(instanceCount * 3);
    const rand = new Float32Array(instanceCount);
    let i = 0;
    for (let x = 0; x < gridSize; x++) {
      for (let z = 0; z < gridSize; z++) {
        for (let y = 0; y < heightLayers; y++) {
          off[i * 3] = (x / (gridSize - 1) - 0.5) * 28;
          off[i * 3 + 1] = 1.3 + y * 3;
          off[i * 3 + 2] = (z / (gridSize - 1) - 0.5) * 28;
          rand[i] = (i * 37) % 100; // deterministic pseudo‑random
          i++;
        }
      }
    }
    return [off, rand];
  }, [instanceCount]);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = state.clock.elapsedTime;
    }
  });

  return (
    <instancedMesh args={[undefined, undefined, instanceCount]}>
      <coneGeometry args={[0.12, 0.85, 8]}>
        <instancedBufferAttribute attach="attributes-offset" args={[offsets, 3]} />
        <instancedBufferAttribute attach="attributes-randOffset" args={[randOffsets, 1]} />
      </coneGeometry>
      <shaderMaterial
        ref={materialRef}
        vertexShader={vectorVertexShader}
        fragmentShader={vectorFragmentShader}
        uniforms={{
          time: { value: 0 },
          windSpeed: { value: weatherData.current.wind_speed_10m },
          windDirection: { value: weatherData.current.wind_direction_10m }
        }}
        transparent
        depthWrite={false}
        blending={THREE.NormalBlending}
      />
    </instancedMesh>
  );
}
