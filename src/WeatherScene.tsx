import { Suspense } from 'react';
import Globe from './Globe';
import AtmosphereProfile from './AtmosphereProfile';
import type { WeatherData } from './api';
import type { AtmosphereVariable } from './AtmosphereProfile';

interface WeatherSceneProps {
  weatherData: WeatherData | null;
  atmosphereVariable?: AtmosphereVariable;
  showAtmosphere?: boolean;
  mapCenter?: { lat: number; lon: number } | null;
  basemap?: 'streets' | 'satellite';
  onSatelliteStatusChange?: (status: { loading: boolean; date: string | null; failed: boolean }) => void;
  onLocationDetected?: (lat: number, lon: number) => void;
}

export default function WeatherScene({
  weatherData,
  atmosphereVariable = 'temperature',
  showAtmosphere = true,
  mapCenter = null,
  basemap = 'streets',
  onSatelliteStatusChange,
  onLocationDetected,
}: WeatherSceneProps) {
  return (
    <>
      <color attach="background" args={['#000011']} />
      
      <Suspense fallback={null}>
        <Globe
          weatherData={weatherData}
          atmosphereVariable={atmosphereVariable}
          showAtmosphere={showAtmosphere}
          mapCenter={mapCenter}
          basemap={basemap}
          onSatelliteStatusChange={onSatelliteStatusChange}
          onLocationDetected={onLocationDetected}
        />
      </Suspense>

      {weatherData && showAtmosphere && (
        <AtmosphereProfile weatherData={weatherData} variable={atmosphereVariable} />
      )}
    </>
  );
}