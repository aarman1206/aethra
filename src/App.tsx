import { useCallback, useEffect, Suspense, useState, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Search, Loader2, Menu, Navigation } from 'lucide-react';
import WeatherScene from './WeatherScene';
import Legend from './Legend';
import { fetchWeather, searchCity } from './api';
import type { WeatherData } from './api';
import type { AtmosphereVariable } from './AtmosphereProfile';
import type { BasemapMode } from './MapTerrain';
import { classifyWeatherCode } from './weatherCode';
import { useSpring } from 'framer-motion';

const DEFAULT_CITY = 'New York';

const NAV_CATEGORIES = [
  { key: 'weather', label: 'Weather', icon: '☀️' },
  { key: 'atmosphere', label: 'Atmosphere', icon: '🌡️' },
  { key: 'forecast', label: 'Forecast', icon: '📅' },
  { key: 'layers', label: 'Layers', icon: '🗺️' },
  { key: 'physics', label: 'Physics', icon: '⚛️' },
  { key: 'nasa', label: 'NASA Data', icon: '🚀' },
  { key: 'settings', label: 'Settings', icon: '⚙️' },
] as const;

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
  const [mapCenter, setMapCenter] = useState<{ lat: number; lon: number } | null>(null);
  const [mapZoom, setMapZoom] = useState(12);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [basemap, setBasemap] = useState<BasemapMode>('streets');
  const [satelliteStatus, setSatelliteStatus] = useState<SatelliteStatus>({ loading: false, date: null, failed: false });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeCategory, setActiveCategory] = useState<(typeof NAV_CATEGORIES)[number]['key']>('weather');

  // For gesture-based drawer - use spring for fluid animation
  const drawerRef = useRef<HTMLDivElement>(null);
  const drawerX = useSpring(0, { damping: 20, stiffness: 200 });

  const loadData = useCallback(async (query: string) => {
    setLoading(true);
    setError(null);
    try {
      let lat: number, lon: number, locationName: string;
      
      // Check if query is a coordinate string like "40.7128,-74.0060"
      const coordMatch = query.match(/^(-?\d+\.\d+),(-?\d+\.\d+)$/);
      
      if (coordMatch) {
        lat = parseFloat(coordMatch[1]);
        lon = parseFloat(coordMatch[2]);
        locationName = "My Location";
      } else {
        const location = await searchCity(query);
        if (location) {
          lat = location.latitude;
          lon = location.longitude;
          locationName = location.name;
        } else {
          setError('Location not found');
          setLoading(false);
          return;
        }
      }

      setCity(locationName);
      setMapCenter({ lat, lon });
      const data = await fetchWeather(lat, lon);
      setWeatherData(data);
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

  const handleLocationDetected = useCallback((lat: number, lon: number) => {
    setUserLocation({ lat, lon });
    setMapCenter((prev) => {
      if (!prev) {
        loadData(`${lat.toFixed(4)},${lon.toFixed(4)}`);
        return { lat, lon };
      }
      return prev;
    });
  }, [loadData]);

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

  const activeCategoryLabel = NAV_CATEGORIES.find((category) => category.key === activeCategory)?.label ?? 'Weather';

  const renderCategoryContent = () => {
    if (!weatherData) {
      return (
        <div className="panel">
          <div className="row">
            <div className="row-label">Waiting for data</div>
            <div className="row-value small">Search to load weather</div>
          </div>
        </div>
      );
    }

    switch (activeCategory) {
      case 'weather':
        return (
          <div className="panel">
            <div className="row summary-row">
              <div>
                <div className="row-label">Location</div>
                <div className="row-value accent">{city}</div>
              </div>
              <div className="status-pill">
                <div className="dot" /> Live
              </div>
            </div>
            <div className="row">
              <div className="row-label">Phenomenon</div>
              <div className="row-value">{classifyWeatherCode(weatherData.current.weather_code).label}</div>
            </div>
            <div className="row">
              <div className="row-label">Temperature</div>
              <div className="row-value">{weatherData.current.temperature_2m}°C</div>
            </div>
            <div className="row">
              <div className="row-label">Wind</div>
              <div className="row-value">{weatherData.current.wind_speed_10m} km/h</div>
            </div>
            <div className="row">
              <div className="row-label">Humidity</div>
              <div className="row-value">{weatherData.current.relative_humidity_2m}%</div>
            </div>
          </div>
        );
      case 'atmosphere':
        return (
          <div className="panel">
            <div className="row">
              <div className="row-label">Variable</div>
              <div className="row-value small">{atmosphereVariable}</div>
            </div>
            <div className="row">
              <div className="row-label">Levels</div>
              <div className="row-value small">{weatherData.atmosphere.length}</div>
            </div>
            {showAtmosphere && <Legend variable={atmosphereVariable} />}
            {weatherData.atmosphere.map((level) => (
              <div className="row compact" key={level.pressureHPa}>
                <div className="row-label">{level.pressureHPa} hPa</div>
                <div className="row-value small">{level.temperatureC.toFixed(1)}°C</div>
              </div>
            ))}
          </div>
        );
      case 'forecast':
        return (
          <div className="panel">
            {weatherData.daily.time.map((time: string, index: number) => {
              const date = new Date(time);
              const day = date.toLocaleDateString('en-US', { weekday: 'short' });
              return (
                <div className="row" key={time}>
                  <div className="row-label">{day}</div>
                  <div className="row-value">{weatherData.daily.temperature_2m_max[index]}°C</div>
                </div>
              );
            })}
          </div>
        );
      case 'layers':
        return (
          <div className="panel">
            <div className="segmented">
              <button
                type="button"
                className={basemap === 'streets' ? 'active' : ''}
                onClick={() => setBasemap('streets')}
              >
                Streets
              </button>
              <button
                type="button"
                className={basemap === 'satellite' ? 'active' : ''}
                onClick={() => setBasemap('satellite')}
              >
                Satellite
              </button>
            </div>
            <div className="row">
              <div className="row-label">Atmosphere Overlay</div>
              <div>
                <label className="chip">
                  <input
                    type="checkbox"
                    checked={showAtmosphere}
                    onChange={(e) => setShowAtmosphere(e.target.checked)}
                  />
                  Show
                </label>
              </div>
            </div>
            <div className="row">
              <div className="row-label">Variable</div>
              <select value={atmosphereVariable} onChange={(e) => setAtmosphereVariable(e.target.value as AtmosphereVariable)}>
                <option value="temperature">Temperature</option>
                <option value="humidity">Humidity</option>
                <option value="wind">Wind Speed</option>
                <option value="clouds">Cloud Cover</option>
                <option value="precipitation">Precipitation</option>
              </select>
            </div>
            <div className="row">
              <div className="row-label">Zoom</div>
              <div className="stepper">
                <button type="button" onClick={() => setMapZoom((z) => Math.max(8, z - 1))}>−</button>
                <span>{mapZoom}</span>
                <button type="button" onClick={() => setMapZoom((z) => Math.min(16, z + 1))}>+</button>
              </div>
            </div>
            <button type="button" onClick={() => mapCenter && setMapZoom(12)}>Recenter map</button>
          </div>
        );
      case 'physics':
        return (
          <div className="panel">
            <div className="row">
              <div className="row-label">Engine</div>
              <div className="row-value accent">Rapier (WASM)</div>
            </div>
            <div className="row">
              <div className="row-label">Surface wind</div>
              <div className="row-value small">{weatherData.current.wind_speed_10m.toFixed(1)} km/h</div>
            </div>
            <div className="row">
              <div className="row-label">Wind direction</div>
              <div className="row-value small">{weatherData.current.wind_direction_10m.toFixed(0)}°</div>
            </div>
          </div>
        );
      case 'nasa':
        return (
          <div className="panel">
            {weatherData.nasa ? (
              <>
                <div className="row">
                  <div className="row-label">Temp</div>
                  <div className="row-value">{weatherData.nasa.temperature_2m?.toFixed(1)}°C</div>
                </div>
                <div className="row">
                  <div className="row-label">Wind</div>
                  <div className="row-value">{weatherData.nasa.wind_speed_10m?.toFixed(1)} m/s</div>
                </div>
                <div className="row">
                  <div className="row-label">Humidity</div>
                  <div className="row-value">{weatherData.nasa.relative_humidity_2m?.toFixed(0)}%</div>
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
        );
      case 'settings':
        return (
          <div className="panel">
            <div className="row">
              <div className="row-label">Realtime updates</div>
              <label className="chip">
                <input type="checkbox" checked={realtime} onChange={(e) => setRealtime(e.target.checked)} />
                Enabled
              </label>
            </div>
            {realtime && (
              <div className="row">
                <div className="row-label">Poll interval</div>
                <input type="number" min={5} value={pollInterval} onChange={(e) => setPollInterval(Number(e.target.value))} />
              </div>
            )}
            <div className="row">
              <div className="row-label">Map style</div>
              <div className="row-value small">{basemapLabel}</div>
            </div>
            <div className="row">
              <div className="row-label">Search</div>
              <input type="text" placeholder="Search a city…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
            </div>
            <button type="button" onClick={handleSearch}>Apply</button>
          </div>
        );
      default:
        return null;
    }
  };

  // Handle touch gestures for drawer
  useEffect(() => {
    if (!drawerRef.current) return;
    
    const element = drawerRef.current;
    let startX = 0;
    let isDragging = false;
    
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      isDragging = true;
      e.preventDefault();
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging || e.touches.length !== 1) return;
      
      const currentX = e.touches[0].clientX;
      const diffX = currentX - startX;
      
      // Only allow opening from left edge
      if (diffX > 0 && !drawerOpen) {
        // Prevent scrolling when dragging
        e.preventDefault();
        const translateX = Math.min(diffX, element.clientWidth);
        drawerX.set(translateX);
      }
    };
    
    const handleTouchEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      
      // Determine if we should open or close based on position
      const currentX = drawerX.get();
      const shouldOpen = currentX > element.clientWidth / 2;
      setDrawerOpen(shouldOpen);
      
      if (shouldOpen) {
        drawerX.set(element.clientWidth);
      } else {
        drawerX.set(0);
      }
    };
    
    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: false });
    
    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [drawerX, drawerOpen]);

  // Sync drawer spring with drawerOpen state
  useEffect(() => {
    if (drawerRef.current) {
      if (drawerOpen) {
        drawerX.set(drawerRef.current.clientWidth);
      } else {
        drawerX.set(0);
      }
    }
  }, [drawerOpen, drawerX]);

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
              basemap={basemap}
              onSatelliteStatusChange={setSatelliteStatus}
              onLocationDetected={handleLocationDetected}
            />
          </Suspense>
        </Canvas>
      </div>

      <div className="ui-layer">
        <div className="topbar">
          <div className="topbar-left">
            <button
              className="menu-button interactive"
              type="button"
              aria-label="Open navigation drawer"
              onClick={() => setDrawerOpen(!drawerOpen)}
            >
              <Menu size={20} />
            </button>
            <div className="brand">
              <h1>Aethra</h1>
              <div className="subtitle">Live weather & atmospheric data</div>
            </div>
          </div>

          <form className="search interactive" onSubmit={handleSearch}>
            <input
              type="text"
              placeholder="Search a city…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <button type="submit" aria-label="Search city">
              <Search size={16} />
            </button>
          </form>
          
          {/* My Location Button */}
          <button
            className="location-button interactive"
            type="button"
            aria-label="Use my location"
            onClick={() => {
              if (userLocation) {
                setMapCenter(userLocation);
                loadData(`${userLocation.lat.toFixed(4)},${userLocation.lon.toFixed(4)}`);
              } else if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    const lat = pos.coords.latitude;
                    const lon = pos.coords.longitude;
                    setUserLocation({ lat, lon });
                    setMapCenter({ lat, lon });
                    loadData(`${lat.toFixed(4)},${lon.toFixed(4)}`);
                  },
                  (err) => console.log('Location error:', err),
                  { enableHighAccuracy: true, timeout: 10000 }
                );
              }
            }}
          >
            <Navigation size={20} />
          </button>
        </div>

        <div className="workspace">
          {/* Gesture area for drawer - invisible but captures touches from left edge */}
          <div 
            className="drawer-gesture-area" 
            onTouchStart={(e) => {
              if (e.touches[0].clientX < 50) {
                e.stopPropagation();
              }
            }}
          />
          
          <div 
            className={`drawer-backdrop ${drawerOpen ? 'visible' : ''}`} 
            onClick={() => setDrawerOpen(false)}
          />
          
          <aside 
            ref={drawerRef}
            className={`nav-panel interactive ${drawerOpen ? 'open' : ''} ${sidebarCollapsed ? 'collapsed' : ''} apple-drawer`}
            style={{ transform: `translateX(${drawerX}px)` }}
          >
            <div className="nav-panel-header">
              <div>
                <div className="nav-title">Navigation</div>
                <div className="nav-subtitle">{activeCategoryLabel}</div>
              </div>
              <div className="nav-actions">
                <button
                  type="button"
                  className="nav-collapse-button interactive"
                  aria-label={sidebarCollapsed ? 'Expand panel' : 'Collapse panel'}
                  onClick={() => setSidebarCollapsed((value) => !value)}
                >
                  {sidebarCollapsed ? '›' : '‹'}
                </button>
                <button
                  type="button"
                  className="nav-close-button interactive"
                  aria-label="Close drawer"
                  onClick={() => setDrawerOpen(false)}
                >
                  ×
                </button>
              </div>
            </div>

            <div className="nav-list">
              {NAV_CATEGORIES.map((category) => (
                <button
                  key={category.key}
                  type="button"
                  className={`nav-tab ${activeCategory === category.key ? 'active' : ''} apple-nav-tab`}
                  onClick={() => {
                    setActiveCategory(category.key);
                    setDrawerOpen(false);
                  }}
                >
                  <span style={{ fontSize: '1.1rem', marginRight: '0.5rem' }}>{category.icon}</span>
                  {category.label}
                </button>
              ))}
            </div>

            <div className="nav-content">
              <div className="category-header">{activeCategoryLabel}</div>
              {renderCategoryContent()}
            </div>
          </aside>
        </div>

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
        ) : null}

        <div className="attribution interactive">
          © OpenStreetMap contributors · Weather: Open-Meteo (GFS/ICON) · Cross-check: NASA POWER · Imagery: NASA GIBS/MODIS
        </div>
      </div>
    </>
  );
}

export default App;