import { lazy, Suspense } from 'react';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';

import MapTerrain, { type BasemapMode } from './MapTerrain';
import RainLayer from './RainLayer';
import SnowLayer from './SnowLayer';
import FogLayer from './FogLayer';
import ClearSky from './ClearSky';
import StormCell from './StormCell';
import CloudLayer from './CloudLayer';
import WindVectors from './WindVectors';
import ScientificBoundingBox from './ScientificBoundingBox';
import AtmosphereProfile, { type AtmosphereVariable } from './AtmosphereProfile';
import type { WeatherData } from './api';

// Rapier's WASM physics engine is the single largest dependency in this app.
// Lazy-loading it means the initial page load doesn't have to fetch/parse it
// until a physics-driven structure actually needs to render.
const WeatherPhysicsField = lazy(() => import('./WeatherPhysicsField'));
const HailLayer = lazy(() => import('./HailLayer'));

interface WeatherSceneProps {
  weatherData: WeatherData | null;
  atmosphereVariable?: AtmosphereVariable;
  showAtmosphere?: boolean;
  mapCenter?: { lat: number; lon: number } | null;
  mapZoom?: number;
  basemap?: BasemapMode;
  onSatelliteStatusChange?: (status: { loading: boolean; date: string | null; failed: boolean }) => void;
}

// Map weather to colors and effects
const getSceneParams = (weatherData: WeatherData | null) => {
  if (!weatherData) return { color: new THREE.Color('#00e5ff'), intensity: 1 };

  const temp = weatherData.current.temperature_2m;

  let color = new THREE.Color('#00e5ff');
  if (temp > 25) color = new THREE.Color('#ff2255');
  else if (temp > 15) color = new THREE.Color('#ffaa00');
  else if (temp < 0) color = new THREE.Color('#2222ff');

  return { color, intensity: 1 + temp / 50 };
};

export default function WeatherScene({
  weatherData,
  atmosphereVariable = 'temperature',
  showAtmosphere = true,
  mapCenter = null,
  mapZoom = 12,
  basemap = 'streets',
  onSatelliteStatusChange,
}: WeatherSceneProps) {
  const params = getSceneParams(weatherData);

  return (
    <>
      <color attach="background" args={['#010204']} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[50, 100, 50]} intensity={1.05} color={'#ffffff'} />
      <pointLight position={[10, 20, 10]} intensity={0.7} color={params.color} />

      <EffectComposer>
        <Bloom luminanceThreshold={0.45} luminanceSmoothing={0.9} intensity={0.4} />
      </EffectComposer>

      <Suspense fallback={null}>
        {weatherData && (
          <>
            <MapTerrain
              weatherData={weatherData}
              mapCenter={mapCenter}
              mapZoom={mapZoom}
              basemap={basemap}
              onSatelliteStatusChange={onSatelliteStatusChange}
            />

            {/* Each of these is a distinct, self-gated structure driven by the
                real WMO weather code (or real cloud_cover/wind), so only the
                phenomenon actually occurring is rendered. */}
            <ClearSky weatherData={weatherData} />
            <CloudLayer weatherData={weatherData} />
            <FogLayer weatherData={weatherData} />
            <StormCell weatherData={weatherData} />
            <HailLayer weatherData={weatherData} />
            <RainLayer weatherData={weatherData} />
            <SnowLayer weatherData={weatherData} />

            <WindVectors weatherData={weatherData} />
            <WeatherPhysicsField weatherData={weatherData} />
            <ScientificBoundingBox />
          </>
        )}
      </Suspense>

      {weatherData && showAtmosphere && (
        <AtmosphereProfile weatherData={weatherData} variable={atmosphereVariable} />
      )}

      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        target={[0, 0, 0]}
        maxPolarAngle={Math.PI / 2.15}
        minDistance={18}
        maxDistance={70}
        autoRotate={false}
      />
    </>
  );
}
