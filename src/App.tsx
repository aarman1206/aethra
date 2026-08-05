import { useCallback, useEffect, Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Search, Loader2, Wind, Droplets, Thermometer, Gauge, Satellite, Map as MapIcon } from 'lucide-react';
import WeatherScene from './WeatherScene';
import Legend from './Legend';
import { fetchWeather, searchCity } from './api';
import type { WeatherData } from './api';
import type { AtmosphereVariable } from './AtmosphereProfile';
import type { BasemapMode } from './MapTerrain';
import { classifyWeatherCode } from './weatherCode';

const DEFAULT_CITY = 'New York';

interface SatelliteStatus {
  loading: boolean;
  date: string | null;
  failed: boolean;
}

function App() {
  const [city, setCity] = useState(DEFAULT_CITY);
  const [searchInput, setSearchInput] = useState('');
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [realtime, setRealtime] = useState(true);
  const [atmosphereVariable, setAtmosphereVariable] = useState<AtmosphereVariable>('temperature');
  const [pollInterval, setPollInterval] = useState<number>(60);
  const [showAtmosphere, setShowAtmosphere] = useState(true);
  const [mapZoom, setMapZoom] = useState(12);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lon: number } | null>(null);
  const [basemap, setBasemap] = useState<BasemapMode>('streets');
  const [satelliteStatus, setSatelliteStatus] = useState<SatelliteStatus>({ loading: false, date: null, failed: false });

  const loadData = useCallback(async (cityName: string) => {
    setLoading(true);
    setError(null);
    try {
      const location = await searchCity(cityName);
      if (location) {
        setCity(location.name);
        setMapCenter({ lat: location.latitude, lon: location.longitude });
        const data = await fetchWeather(location.latitude, location.longitude);
        setWeatherData(data);
      } else {
        setError('Location not found');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unexpected error while loading weather data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(DEFAULT_CITY);
  }, [loadData]);

  useEffect(() => {
    if (!realtime) return;
    const id = setInterval(() => {
      loadData(city);
    }, Math.max(5, pollInterval) * 1000);
    return () => clearInterval(id);
  }, [realtime, pollInterval, city, loadData]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      loadData(searchInput);
      setSearchInput('');
    }
  };

  const basemapLabel = basemap === 'streets'
    ? 'OpenStreetMap'
    : satelliteStatus.loading
      ? 'Loading NASA imagery…'
      : satelliteStatus.failed
        ? 'NASA imagery unavailable'
        : `NASA MODIS · ${satelliteStatus.date ?? 'unknown date'}`;

  return (
    <>
      <div className="canvas-container">
        <Canvas camera={{ position: [0, 30, 42], fov: 42 }}>
          <Suspense fallback={null}>
            <WeatherScene
              weatherData={weatherData}
              atmosphereVariable={atmosphereVariable}
              showAtmosphere={showAtmosphere}
              mapCenter={mapCenter}
              mapZoom={mapZoom}
              basemap={basemap}
              onSatelliteStatusChange={setSatelliteStatus}
            />
          </Suspense>
        </Canvas>
      </div>

      <div className="ui-layer">
        <div className="header">
          <div className="brand">
            <h1>Aethra</h1>
            <div className="subtitle">Live weather &amp; atmospheric data</div>
          </div>

          <form className="search interactive" onSubmit={handleSearch}>
            <input
              type="text"
              placeholder="Search a city…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <button type="submit">
              <Search size={16} />
            </button>
          </form>

          <div className="toolbar interactive">
            <div className="segmented">
              <button
                type="button"
                className={basemap === 'streets' ? 'active' : ''}
                onClick={() => setBasemap('streets')}
              >
                <MapIcon size={13} /> Streets
              </button>
              <button
                type="button"
                className={basemap === 'satellite' ? 'active' : ''}
                onClick={() => setBasemap('satellite')}
              >
                <Satellite size={13} /> Satellite
              </button>
            </div>

            <label className="chip">
              <input type="checkbox" checked={realtime} onChange={(e) => setRealtime(e.target.checked)} />
              Realtime
            </label>

            {realtime && (
              <label className="chip">
                Every
                <input
                  type="number"
                  min={5}
                  value={pollInterval}
                  onChange={(e) => setPollInterval(Number(e.target.value))}
                />
                s
              </label>
            )}

            <label className="chip">
              <input type="checkbox" checked={showAtmosphere} onChange={(e) => setShowAtmosphere(e.target.checked)} />
              Atmosphere
            </label>

            <select value={atmosphereVariable} onChange={(e) => setAtmosphereVariable(e.target.value as AtmosphereVariable)}>
              <option value="temperature">Temperature</option>
              <option value="humidity">Humidity</option>
              <option value="wind">Wind Speed</option>
              <option value="clouds">Cloud Cover</option>
              <option value="precipitation">Precipitation</option>
            </select>

            <div className="stepper">
              <button type="button" onClick={() => setMapZoom((z) => Math.max(8, z - 1))}>−</button>
              <span>{mapZoom}</span>
              <button type="button" onClick={() => setMapZoom((z) => Math.min(16, z + 1))}>+</button>
            </div>

            <button type="button" onClick={() => mapCenter && setMapZoom(12)}>Recenter</button>
          </div>
        </div>

        {showAtmosphere && (
          <div className="legend interactive">
            <Legend variable={atmosphereVariable} />
          </div>
        )}

        {loading ? (
          <div className="loader-container interactive">
            <Loader2 className="loader-spinner" />
            <div>Loading live weather data…</div>
          </div>
        ) : error ? (
          <div className="panel error-panel interactive">
            <div className="row-value danger">{error}</div>
            <button onClick={() => loadData(DEFAULT_CITY)}>Retry</button>
          </div>
        ) : weatherData ? (
          <div className="dashboard">
            <div className="sidebar interactive">
              <div className="panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div className="panel-title" style={{ marginBottom: 0 }}>Current Conditions</div>
                  <div className="status-pill">
                    <div className="dot" /> Live
                  </div>
                </div>

                <div className="row">
                  <div className="row-label">Location</div>
                  <div className="row-value accent">{city}</div>
                </div>

                <div className="row">
                  <div className="row-label">Phenomenon (WMO)</div>
                  <div className="row-value">{classifyWeatherCode(weatherData.current.weather_code).label}</div>
                </div>

                <div className="row">
                  <div className="row-label">Day / Night</div>
                  <div className="row-value">{weatherData.current.is_day === 1 ? 'Day' : 'Night'}</div>
                </div>

                <div className="row">
                  <div className="row-label"><Thermometer size={14} /> Temperature</div>
                  <div className="row-value">{weatherData.current.temperature_2m}°C</div>
                </div>

                <div className="row">
                  <div className="row-label"><Wind size={14} /> Wind Speed</div>
                  <div className="row-value">{weatherData.current.wind_speed_10m} km/h</div>
                </div>

                <div className="row">
                  <div className="row-label">Wind Direction</div>
                  <div className="row-value">{weatherData.current.wind_direction_10m}°</div>
                </div>

                <div className="row">
                  <div className="row-label"><Droplets size={14} /> Humidity</div>
                  <div className="row-value">{weatherData.current.relative_humidity_2m}%</div>
                </div>

                <div className="row">
                  <div className="row-label">Cloud Cover</div>
                  <div className="row-value">{weatherData.current.cloud_cover}%</div>
                </div>

                <div className="row">
                  <div className="row-label"><Gauge size={14} /> Pressure</div>
                  <div className="row-value">{weatherData.current.surface_pressure} hPa</div>
                </div>

                <div className="row">
                  <div className="row-label">Precipitation</div>
                  <div className={`row-value ${weatherData.current.precipitation > 0 ? 'accent' : ''}`}>
                    {weatherData.current.precipitation} mm
                  </div>
                </div>
              </div>

              <div className="panel">
                <div className="panel-title">System</div>
                <div className="row">
                  <div className="row-label">Physics Engine</div>
                  <div className="row-value accent" style={{ fontSize: '0.85rem' }}>Rapier (WASM)</div>
                </div>
                <div className="row">
                  <div className="row-label">Basemap</div>
                  <div className="row-value small">{basemapLabel}</div>
                </div>
                <div className="row">
                  <div className="row-label">Surface Wind</div>
                  <div className="row-value small">
                    {weatherData.current.wind_speed_10m.toFixed(1)} km/h @ {weatherData.current.wind_direction_10m.toFixed(0)}°
                  </div>
                </div>
              </div>

              <div className="panel">
                <div className="panel-title">NASA POWER Cross-Check</div>
                {weatherData.nasa ? (
                  <>
                    <div className="row">
                      <div className="row-label">Temperature</div>
                      <div className="row-value">
                        {typeof weatherData.nasa.temperature_2m === 'number' ? `${weatherData.nasa.temperature_2m.toFixed(1)}°C` : 'N/A'}
                      </div>
                    </div>
                    <div className="row">
                      <div className="row-label">Wind Speed</div>
                      <div className="row-value">
                        {typeof weatherData.nasa.wind_speed_10m === 'number' ? `${weatherData.nasa.wind_speed_10m.toFixed(1)} m/s` : 'N/A'}
                      </div>
                    </div>
                    <div className="row">
                      <div className="row-label">Humidity</div>
                      <div className="row-value">
                        {typeof weatherData.nasa.relative_humidity_2m === 'number' ? `${weatherData.nasa.relative_humidity_2m.toFixed(0)}%` : 'N/A'}
                      </div>
                    </div>
                    <div className="row">
                      <div className="row-label">Sample (UTC)</div>
                      <div className="row-value small">{weatherData.nasa.timestamp ?? 'N/A'}</div>
                    </div>
                  </>
                ) : (
                  <div className="row">
                    <div className="row-label">Status</div>
                    <div className="row-value small">Unavailable</div>
                  </div>
                )}
              </div>
            </div>

            <div className="center-area" />

            <div className="sidebar interactive">
              <div className="panel">
                <div className="panel-title">Atmospheric Sounding</div>
                {weatherData.atmosphere.length > 0 ? (
                  weatherData.atmosphere
                    .slice()
                    .sort((a, b) => a.pressureHPa - b.pressureHPa)
                    .map((level) => (
                      <div className="row" key={level.pressureHPa}>
                        <div className="row-label">{level.pressureHPa} hPa · {(level.altitudeMeters / 1000).toFixed(1)} km</div>
                        <div className="row-value small">
                          {level.temperatureC.toFixed(1)}°C · {level.windSpeedKmh.toFixed(0)} km/h
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="row">
                    <div className="row-label">Status</div>
                    <div className="row-value small">Unavailable</div>
                  </div>
                )}
              </div>

              <div className="panel">
                <div className="panel-title">7-Day Forecast</div>
                {weatherData.daily.time.map((time: string, index: number) => {
                  const date = new Date(time);
                  const day = date.toLocaleDateString('en-US', { weekday: 'short' });
                  return (
                    <div className="row" key={time}>
                      <div className="row-label">T+{index} ({day})</div>
                      <div className="row-value">{weatherData.daily.temperature_2m_max[index]}°C</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}

        <div className="attribution interactive">
          © OpenStreetMap contributors · Weather: Open-Meteo (GFS/ICON) · Cross-check: NASA POWER · Imagery: NASA GIBS/MODIS
        </div>
      </div>
    </>
  );
}

export default App;
