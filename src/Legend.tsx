interface LegendProps {
  variable: string;
}

interface LegendConfig {
  title: string;
  unit: string;
  stops: Array<{ color: string; label: string }>;
}

const legends: Record<string, LegendConfig> = {
  temperature: {
    title: 'Temperature by altitude',
    unit: '°C',
    stops: [
      { color: '#3355ff', label: '-50' },
      { color: '#4da3ff', label: '-15' },
      { color: '#7dff9c', label: '5' },
      { color: '#ffcc33', label: '20' },
      { color: '#ff3355', label: '40' },
    ],
  },
  humidity: {
    title: 'Relative humidity by altitude',
    unit: '%',
    stops: [
      { color: '#0b2a3d', label: '0' },
      { color: '#0e5b82', label: '25' },
      { color: '#1ea3d6', label: '50' },
      { color: '#7fd9f7', label: '75' },
      { color: '#e6faff', label: '100' },
    ],
  },
  wind: {
    title: 'Wind speed by altitude',
    unit: 'km/h',
    stops: [
      { color: '#22cc55', label: '0' },
      { color: '#a6dc3c', label: '30' },
      { color: '#ffcc33', label: '60' },
      { color: '#ff8833', label: '90' },
      { color: '#ff3333', label: '120+' },
    ],
  },
  clouds: {
    title: 'Cloud cover (surface × humidity)',
    unit: '%',
    stops: [
      { color: '#1a1a1a', label: '0' },
      { color: '#4d4d4d', label: '25' },
      { color: '#808080', label: '50' },
      { color: '#b3b3b3', label: '75' },
      { color: '#f2f2f2', label: '100' },
    ],
  },
  precipitation: {
    title: 'Precipitation (surface, uniform across levels)',
    unit: 'mm',
    stops: [
      { color: '#0b2a3d', label: '0' },
      { color: '#124d75', label: '3' },
      { color: '#1a7bb0', label: '6' },
      { color: '#3fb8e8', label: '9' },
      { color: '#bff2ff', label: '12+' },
    ],
  },
};

export default function Legend({ variable }: LegendProps) {
  const legend = legends[variable] ?? legends.temperature;

  return (
    <div className="legend-card">
      <div className="legend-title">{legend.title}</div>
      <div className="legend-stops">
        {legend.stops.map((stop) => (
          <div key={stop.label} className="legend-stop">
            <div className="legend-swatch" style={{ background: stop.color }} />
            <span className="legend-label">{stop.label}</span>
          </div>
        ))}
      </div>
      <div className="legend-unit">{legend.unit}</div>
    </div>
  );
}
