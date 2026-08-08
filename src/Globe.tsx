import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { Stars, OrbitControls } from '@react-three/drei';
import type { WeatherData } from './api';
import type { AtmosphereVariable } from './AtmosphereProfile';

interface GlobeProps {
  weatherData: WeatherData | null;
  atmosphereVariable?: AtmosphereVariable;
  showAtmosphere?: boolean;
  mapCenter?: { lat: number; lon: number } | null;
  basemap?: 'streets' | 'satellite';
  onLocationDetected?: (lat: number, lon: number) => void;
  onSatelliteStatusChange?: (status: { loading: boolean; date: string | null; failed: boolean }) => void;
}

// Earth radius in Three.js units
const EARTH_RADIUS = 50;
// Atmosphere shell radius
const ATMOSPHERE_RADIUS = EARTH_RADIUS * 1.02;
// Cloud layer radius
const CLOUD_RADIUS = EARTH_RADIUS * 1.01;

// Convert lat/lon to 3D position on sphere
const latLonToVector3 = (lat: number, lon: number, radius: number = EARTH_RADIUS) => {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
};

// Weather code to color mapping
const getWeatherColor = (weatherCode: number): THREE.Color => {
  if (weatherCode === 0) return new THREE.Color('#4da3ff'); // Clear
  if (weatherCode >= 1 && weatherCode <= 3) return new THREE.Color('#8888cc'); // Cloudy
  if (weatherCode >= 45 && weatherCode <= 48) return new THREE.Color('#aaaaaa'); // Fog
  if (weatherCode >= 51 && weatherCode <= 57) return new THREE.Color('#66aaff'); // Drizzle
  if (weatherCode >= 61 && weatherCode <= 67) return new THREE.Color('#3366ff'); // Rain
  if (weatherCode >= 71 && weatherCode <= 77) return new THREE.Color('#ffffff'); // Snow
  if (weatherCode >= 80 && weatherCode <= 82) return new THREE.Color('#4488ff'); // Rain showers
  if (weatherCode >= 85 && weatherCode <= 86) return new THREE.Color('#ddddff'); // Snow showers
  if (weatherCode >= 95 && weatherCode <= 99) return new THREE.Color('#ff8800'); // Thunderstorm
  return new THREE.Color('#4da3ff');
};

export default function Globe({
  weatherData,
  mapCenter,
  onLocationDetected,
}: GlobeProps) {
  const globeRef = useRef<THREE.Mesh>(null);
  const atmosphereRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);
  const markerRef = useRef<THREE.Mesh>(null);
  const weatherPinsRef = useRef<THREE.Group>(null);
  
  const [earthTexture, setEarthTexture] = useState<THREE.Texture | null>(null);
  const [cloudTexture, setCloudTexture] = useState<THREE.Texture | null>(null);
  const [normalMap, setNormalMap] = useState<THREE.Texture | null>(null);
  const [specularMap, setSpecularMap] = useState<THREE.Texture | null>(null);
  const [nightTexture, setNightTexture] = useState<THREE.Texture | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);

  // Detect user location on mount
  useEffect(() => {
    if (!navigator.geolocation) return;
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        setUserLocation({ lat, lon });
        onLocationDetected?.(lat, lon);
      },
      (error) => {
        console.log('Geolocation denied or unavailable:', error.message);
        // Default to New York
        setUserLocation({ lat: 40.7128, lon: -74.0060 });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  }, [onLocationDetected]);

  // Load textures
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    
    let cancelled = false;
    
    const loadTextures = async () => {
      try {
        // Try to load NASA textures
        const [dayTexture, nightTex, normalTex, specularTex, cloudTex] = await Promise.all([
          loader.loadAsync('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_atmos_2048.jpg'),
          loader.loadAsync('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_lights_2048.png'),
          loader.loadAsync('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_normal_2048.jpg'),
          loader.loadAsync('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_specular_2048.jpg'),
          loader.loadAsync('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_clouds_1024.png'),
        ]);
        
        if (cancelled) return;
        
        // Configure textures
        [dayTexture, nightTex, normalTex, specularTex, cloudTex].forEach(t => {
          t.colorSpace = THREE.SRGBColorSpace;
          t.wrapS = THREE.RepeatWrapping;
          t.wrapT = THREE.RepeatWrapping;
        });
        
        nightTex.colorSpace = THREE.SRGBColorSpace;
        normalTex.colorSpace = THREE.NoColorSpace;
        specularTex.colorSpace = THREE.NoColorSpace;
        
        setEarthTexture(dayTexture);
        setNightTexture(nightTex);
        setNormalMap(normalTex);
        setSpecularMap(specularTex);
        setCloudTexture(cloudTex);
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to load Earth textures:', err);
        if (!cancelled) {
          // Fallback to procedural textures
          setIsLoading(false);
        }
      }
    };
    
    loadTextures();
    
    return () => { cancelled = true; };
  }, []);

  // Animate clouds rotation
  useFrame((state) => {
    if (!weatherData) {
      if (cloudsRef.current) {
        cloudsRef.current.rotation.y += 0.00003;
      }
      if (atmosphereRef.current) {
        atmosphereRef.current.rotation.y += 0.00001;
      }
    }
    
    // Pulse marker
    if (markerRef.current) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.15;
      markerRef.current.scale.setScalar(scale);
    }
  });

  // Current location to focus on
  const targetLat = mapCenter?.lat ?? weatherData?.latitude ?? userLocation?.lat ?? 40.7128;
  const targetLon = mapCenter?.lon ?? weatherData?.longitude ?? userLocation?.lon ?? -74.0060;

  // Create weather pins for forecast locations
  const weatherPins = useMemo(() => {
    if (!weatherData) return null;
    
    const pins: THREE.Mesh[] = [];
    const pinGeometry = new THREE.ConeGeometry(0.15, 0.6, 8);
    
    // Add current location pin
    const currentPos = latLonToVector3(targetLat, targetLon, EARTH_RADIUS * 1.04);
    const pinMaterial = new THREE.MeshBasicMaterial({ 
      color: getWeatherColor(weatherData.current.weather_code),
      transparent: true,
      opacity: 0.9,
    });
    const currentPin = new THREE.Mesh(pinGeometry, pinMaterial);
    currentPin.position.copy(currentPos);
    currentPin.lookAt(0, 0, 0);
    currentPin.rotateX(Math.PI / 2);
    pins.push(currentPin);
    
    return pins;
  }, [weatherData, targetLat, targetLon]);

  if (isLoading) {
    return (
      <group>
        <mesh>
          <sphereGeometry args={[EARTH_RADIUS, 64, 64]} />
          <meshBasicMaterial color="#0a1a2f" />
        </mesh>
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          target={[0, 0, 0]}
          minDistance={EARTH_RADIUS * 1.2}
          maxDistance={EARTH_RADIUS * 6}
          autoRotate={true}
          autoRotateSpeed={0.3}
        />
      </group>
    );
  }

  return (
    <group ref={weatherPinsRef}>
      {/* Earth Globe */}
      <mesh ref={globeRef} receiveShadow>
        <sphereGeometry args={[EARTH_RADIUS, 128, 128]} />
        <meshStandardMaterial
          map={earthTexture}
          normalMap={normalMap}
          roughnessMap={specularMap}
          roughness={0.7}
          metalness={0.1}
          toneMapped={true}
        />
      </mesh>

      {/* Night side lights */}
      <mesh>
        <sphereGeometry args={[EARTH_RADIUS, 128, 128]} />
        <meshBasicMaterial
          map={nightTexture}
          transparent={true}
          opacity={0.6}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      {/* Cloud layer */}
      {cloudTexture && (
        <mesh ref={cloudsRef}>
          <sphereGeometry args={[CLOUD_RADIUS, 64, 64]} />
          <meshBasicMaterial
            map={cloudTexture}
            transparent={true}
            opacity={0.4}
            alphaTest={0.05}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      )}

      {/* Atmosphere glow */}
      <mesh ref={atmosphereRef}>
        <sphereGeometry args={[ATMOSPHERE_RADIUS, 64, 64]} />
        <meshBasicMaterial
          color="#4da3ff"
          transparent={true}
          opacity={0.08}
          side={THREE.BackSide}
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Outer atmosphere halo */}
      <mesh>
        <sphereGeometry args={[ATMOSPHERE_RADIUS * 1.15, 32, 32]} />
        <meshBasicMaterial
          color="#0088ff"
          transparent={true}
          opacity={0.04}
          side={THREE.BackSide}
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Location marker on globe */}
      <group>
        <mesh 
          ref={markerRef}
          position={latLonToVector3(targetLat, targetLon, EARTH_RADIUS * 1.03)}
        >
          <sphereGeometry args={[0.4, 16, 16]} />
          <meshBasicMaterial 
            color={weatherData ? getWeatherColor(weatherData.current.weather_code) : '#00e5ff'}
            toneMapped={false}
          />
        </mesh>
        
        {/* Vertical line from surface to marker */}
        <mesh position={latLonToVector3(targetLat, targetLon, EARTH_RADIUS * 1.015)}>
          <cylinderGeometry args={[0.03, 0.03, EARTH_RADIUS * 0.03, 8]} />
          <meshBasicMaterial 
            color={weatherData ? getWeatherColor(weatherData.current.weather_code) : '#00e5ff'}
            transparent={true}
            opacity={0.6}
            toneMapped={false}
          />
        </mesh>
      </group>

      {/* Weather pins for forecast */}
      {weatherPins && weatherPins.map((pin, index) => (
        <primitive key={index} object={pin} />
      ))}

      {/* Localized Weather Effects */}
      {weatherData && (
        <LocalWeatherEffect 
          weatherCode={weatherData.current.weather_code} 
          lat={targetLat} 
          lon={targetLon} 
        />
      )}

      {/* Lighting - Sun position based on time of day */}
      <ambientLight intensity={0.4} />
      <directionalLight 
        position={[-100, 100, 50]} 
        intensity={1.5} 
        color="#fff8e7"
        castShadow
      >
        <orthographicCamera 
          args={[-EARTH_RADIUS * 1.5, EARTH_RADIUS * 1.5, EARTH_RADIUS * 1.5, -EARTH_RADIUS * 1.5, 0.1, 500]} 
        />
      </directionalLight>
      <directionalLight position={[100, -50, -100]} intensity={0.3} color="#4466aa" />
      <pointLight position={[0, 0, 0]} intensity={0.1} color="#ff6600" distance={EARTH_RADIUS * 2} decay={2} />

      {/* Bloom effect for atmosphere glow */}
      <EffectComposer>
        <Bloom 
          luminanceThreshold={0.3} 
          luminanceSmoothing={0.9} 
          intensity={0.6}
          mipmapBlur={true}
        />
      </EffectComposer>

      {/* Stars background */}
      <Stars 
        radius={EARTH_RADIUS * 20} 
        depth={EARTH_RADIUS * 10} 
        count={3000} 
        factor={4} 
        saturation={0} 
      />

      {/* Camera Controls - Google Earth style */}
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        target={latLonToVector3(targetLat, targetLon, 0).toArray()}
        minDistance={EARTH_RADIUS * 1.15}
        maxDistance={EARTH_RADIUS * 8}
        minPolarAngle={0}
        maxPolarAngle={Math.PI}
        autoRotate={!weatherData}
        autoRotateSpeed={0.2}
        dampingFactor={0.05}
        enableDamping={true}
        zoomSpeed={1.2}
        rotateSpeed={0.8}
      />
    </group>
  );
}

function LocalWeatherEffect({ weatherCode, lat, lon }: { weatherCode: number, lat: number, lon: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  
  const isRain = (weatherCode >= 51 && weatherCode <= 67) || (weatherCode >= 80 && weatherCode <= 82) || (weatherCode >= 95 && weatherCode <= 99);
  const isSnow = (weatherCode >= 71 && weatherCode <= 77) || (weatherCode >= 85 && weatherCode <= 86);
  const isCloud = weatherCode >= 1 && weatherCode <= 48;
  
  const particleCount = isRain ? 300 : (isSnow ? 200 : (isCloud ? 50 : 0));
  
  const [positions, setPositions] = useState<Float32Array>(new Float32Array());
  const [velocities, setVelocities] = useState<Float32Array>(new Float32Array());
  
  useEffect(() => {
    if (particleCount === 0) {
      setPositions(new Float32Array());
      return;
    }
    
    const pos = new Float32Array(particleCount * 3);
    const vel = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 4; 
      pos[i * 3 + 1] = Math.random() * 4;     
      pos[i * 3 + 2] = (Math.random() - 0.5) * 4; 
      
      vel[i * 3] = (Math.random() - 0.5) * 0.01;
      vel[i * 3 + 1] = isRain ? -0.15 - Math.random() * 0.1 : (isSnow ? -0.03 - Math.random() * 0.03 : 0);
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.01;
    }
    
    setPositions(pos);
    setVelocities(vel);
  }, [particleCount, isRain, isSnow]);
  
  useFrame(() => {
    if (!pointsRef.current || positions.length === 0) return;
    const posAttribute = pointsRef.current.geometry.attributes.position;
    const posArray = posAttribute.array as Float32Array;
    
    for (let i = 0; i < particleCount; i++) {
      posArray[i * 3] += velocities[i * 3];
      posArray[i * 3 + 1] += velocities[i * 3 + 1];
      posArray[i * 3 + 2] += velocities[i * 3 + 2];
      
      if (posArray[i * 3 + 1] < 0) {
        posArray[i * 3 + 1] = 4;
        posArray[i * 3] = (Math.random() - 0.5) * 4;
        posArray[i * 3 + 2] = (Math.random() - 0.5) * 4;
      }
      
      if (isCloud && !isRain && !isSnow) {
         posArray[i * 3] += 0.002;
         if (posArray[i * 3] > 2) posArray[i * 3] = -2;
      }
    }
    
    posAttribute.needsUpdate = true;
  });
  
  const groupRef = useRef<THREE.Group>(null);
  const position = useMemo(() => latLonToVector3(lat, lon, EARTH_RADIUS * 1.01), [lat, lon]);
  
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.position.copy(position);
      groupRef.current.lookAt(0, 0, 0); 
      groupRef.current.rotateX(Math.PI / 2); 
    }
  });

  if (particleCount === 0 || positions.length === 0) return null;

  const color = isRain ? '#66aaff' : (isSnow ? '#ffffff' : '#cccccc');
  const size = isRain ? 0.08 : (isSnow ? 0.12 : 0.6);
  const opacity = isCloud && !isRain && !isSnow ? 0.3 : 0.8;
  
  return (
    <group ref={groupRef}>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={positions.length / 3}
            array={positions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={size}
          color={color}
          transparent={true}
          opacity={opacity}
          sizeAttenuation={true}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </group>
  );
}