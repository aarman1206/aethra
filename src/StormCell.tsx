import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { WeatherData } from './api';
import { classifyWeatherCode, isThunderstorm } from './weatherCode';

const stormVertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;
  uniform float time;
  uniform float intensity;

  // Simple 3D noise function for vertex displacement
  vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
  
  float snoise(vec3 v){ 
    const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
    const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy) );
    vec3 x0 = v - i + dot(i, C.xxx) ;
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min( g.xyz, l.zxy );
    vec3 i2 = max( g.xyz, l.zxy );
    vec3 x1 = x0 - i1 + 1.0 * C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
    i = mod(i, 289.0 ); 
    vec4 p = permute( permute( permute( 
               i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
             + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
             + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
    float n_ = 1.0/7.0;
    vec3  ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z *ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_ );
    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4( x.xy, y.xy );
    vec4 b1 = vec4( x.zw, y.zw );
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
    vec3 p0 = vec3(a0.xy,h.x);
    vec3 p1 = vec3(a0.zw,h.y);
    vec3 p2 = vec3(a1.xy,h.z);
    vec3 p3 = vec3(a1.zw,h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;
    vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                  dot(p2,x2), dot(p3,x3) ) );
  }

  void main() {
    vUv = uv;
    vNormal = normal;
    
    // Animate turbulence
    float noise = snoise(position * 0.5 + time * 0.5) * intensity;
    
    // Taper bottom, wider at top (like anvil cloud)
    float heightTaper = smoothstep(-5.0, 5.0, position.y);
    float displacementAmount = noise * (1.0 + heightTaper * 2.0);
    
    vec3 displaced = position + normal * displacementAmount;
    vPosition = displaced;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

const stormFragmentShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;
  uniform float time;
  uniform float intensity;
  uniform vec3 colorCenter;
  uniform vec3 colorEdge;

  void main() {
    // Edge detection for rim lighting
    vec3 viewDir = normalize(cameraPosition - vPosition);
    float rim = 1.0 - max(dot(viewDir, normalize(vNormal)), 0.0);
    rim = smoothstep(0.4, 1.0, rim);
    
    // Internal lightning effect
    float flash = step(0.98, fract(sin(time * 10.0 + vPosition.y) * 43758.5453)) * intensity;
    
    // Core cloud color
    float heightMix = smoothstep(-5.0, 5.0, vPosition.y);
    vec3 baseColor = mix(colorCenter, colorEdge, heightMix);
    
    // Add rim lighting and flash
    vec3 finalColor = baseColor + (vec3(1.0, 1.0, 1.0) * rim * 0.5) + (vec3(0.8, 0.9, 1.0) * flash);
    
    // Transparency based on rim and height (softer edges)
    float alpha = (0.3 + rim * 0.7) * (0.8 + intensity * 0.2);
    
    // Fade out at extreme top/bottom
    alpha *= smoothstep(-6.0, -4.0, vPosition.y) * smoothstep(6.0, 4.0, vPosition.y);
    
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

interface StormCellProps {
  weatherData: WeatherData;
}

export default function StormCell({ weatherData }: StormCellProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = state.clock.elapsedTime;
    }
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.1;
    }
  });

  // Storm cells are a distinct structure from general cloud cover (CloudLayer)
  // and from ordinary rain (RainLayer): this only renders for the real WMO
  // thunderstorm codes (95/96/99), not just any precipitation or cloudiness.
  const { category } = classifyWeatherCode(weatherData.current.weather_code);
  if (!isThunderstorm(category)) return null;

  const intensity = Math.max(0.4, Math.min(weatherData.current.precipitation / 5.0, 1.5));

  const colorCenter = new THREE.Color(weatherData.current.precipitation > 2 ? '#161622' : '#2c313d');
  const colorEdge = new THREE.Color('#4a5568');

  return (
    <group position={[0, 8, 0]}>
      <mesh ref={meshRef}>
        <cylinderGeometry args={[6, 2, 10, 64, 32, true]} />
        <shaderMaterial
          ref={materialRef}
          vertexShader={stormVertexShader}
          fragmentShader={stormFragmentShader}
          uniforms={{
            time: { value: 0 },
            intensity: { value: intensity },
            colorCenter: { value: colorCenter },
            colorEdge: { value: colorEdge }
          }}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.NormalBlending}
        />
      </mesh>
    </group>
  );
}
