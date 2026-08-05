import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { WeatherData } from './api';
import { lat2tile, lon2tile } from './tileMath';

export type BasemapMode = 'streets' | 'satellite';

interface MapTerrainProps {
  weatherData: WeatherData;
  mapCenter?: { lat: number; lon: number } | null;
  mapZoom?: number;
  basemap?: BasemapMode;
  onSatelliteStatusChange?: (status: { loading: boolean; date: string | null; failed: boolean }) => void;
}

const TILE_GRID = 5;
const TILE_SIZE = 256;
const SATELLITE_MAX_ZOOM = 8;
const SATELLITE_DATE_LOOKBACK_DAYS = 6;

const formatISODate = (date: Date) => date.toISOString().slice(0, 10);

const buildTileCoords = (centerX: number, centerY: number) =>
  Array.from({ length: TILE_GRID * TILE_GRID }, (_, index) => ({
    x: centerX + (index % TILE_GRID) - Math.floor(TILE_GRID / 2),
    y: centerY + Math.floor(index / TILE_GRID) - Math.floor(TILE_GRID / 2),
  }));

const buildCanvasFromTiles = (tileTextures: THREE.Texture[]) => {
  const canvas = document.createElement('canvas');
  canvas.width = TILE_SIZE * TILE_GRID;
  canvas.height = TILE_SIZE * TILE_GRID;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create canvas for map tiles');

  tileTextures.forEach((tex, index) => {
    const img = tex.image as HTMLImageElement | HTMLCanvasElement | ImageBitmap | undefined;
    if (img) {
      const px = (index % TILE_GRID) * TILE_SIZE;
      const py = Math.floor(index / TILE_GRID) * TILE_SIZE;
      ctx.drawImage(img, px, py, TILE_SIZE, TILE_SIZE);
    }
    tex.dispose();
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
};

export default function MapTerrain({
  weatherData,
  mapCenter,
  mapZoom = 12,
  basemap = 'streets',
  onSatelliteStatusChange,
}: MapTerrainProps) {
  const markerRef = useRef<THREE.Mesh>(null);
  const [mapTexture, setMapTexture] = useState<THREE.Texture | null>(null);

  const lat = mapCenter?.lat ?? weatherData.latitude;
  const lon = mapCenter?.lon ?? weatherData.longitude;

  const effectiveZoom = basemap === 'satellite' ? Math.min(mapZoom, SATELLITE_MAX_ZOOM) : mapZoom;
  const centerTileX = lon2tile(lon, effectiveZoom);
  const centerTileY = lat2tile(lat, effectiveZoom);

  const tileCoords = useMemo(
    () => buildTileCoords(centerTileX, centerTileY),
    [centerTileX, centerTileY],
  );

  useEffect(() => {
    let cancelled = false;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');

    const loadStreets = () => {
      Promise.all(
        tileCoords.map(({ x, y }) => loader.loadAsync(`https://tile.openstreetmap.org/${effectiveZoom}/${x}/${y}.png`)),
      )
        .then((tileTextures) => {
          if (cancelled) return;
          setMapTexture(buildCanvasFromTiles(tileTextures));
        })
        .catch((err) => {
          console.error('Failed to load OpenStreetMap tiles:', err);
          if (!cancelled) setMapTexture(null);
        });
    };

    const loadSatellite = async () => {
      onSatelliteStatusChange?.({ loading: true, date: null, failed: false });
      const centerX = centerTileX;
      const centerY = centerTileY;

      for (let daysBack = 1; daysBack <= SATELLITE_DATE_LOOKBACK_DAYS; daysBack += 1) {
        const candidateDate = new Date();
        candidateDate.setUTCDate(candidateDate.getUTCDate() - daysBack);
        const dateStr = formatISODate(candidateDate);
        const probeUrl = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${dateStr}/GoogleMapsCompatible_Level9/${effectiveZoom}/${centerY}/${centerX}.jpg`;

        try {
          await loader.loadAsync(probeUrl);
          if (cancelled) return;

          const tileTextures = await Promise.all(
            tileCoords.map(({ x, y }) =>
              loader.loadAsync(
                `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${dateStr}/GoogleMapsCompatible_Level9/${effectiveZoom}/${y}/${x}.jpg`,
              ),
            ),
          );
          if (cancelled) return;

          setMapTexture(buildCanvasFromTiles(tileTextures));
          onSatelliteStatusChange?.({ loading: false, date: dateStr, failed: false });
          return;
        } catch {
          // Try an earlier date; imagery may be missing due to cloud masking or orbit gaps.
        }
      }

      if (!cancelled) {
        console.error('NASA GIBS satellite imagery unavailable for this location; falling back to streets.');
        onSatelliteStatusChange?.({ loading: false, date: null, failed: true });
        loadStreets();
      }
    };

    if (basemap === 'satellite') {
      loadSatellite();
    } else {
      loadStreets();
    }

    return () => {
      cancelled = true;
    };
  }, [basemap, centerTileX, centerTileY, effectiveZoom, tileCoords, onSatelliteStatusChange]);

  useFrame((state) => {
    if (markerRef.current) {
      markerRef.current.position.y = 0.8 + Math.sin(state.clock.elapsedTime * 2) * 0.06;
    }
  });

  const markerPosition = [0, 0.8, 0] as [number, number, number];

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[44, 44, 160, 160]} />
        {mapTexture ? (
          <meshBasicMaterial map={mapTexture} toneMapped={false} />
        ) : (
          <meshStandardMaterial color="#0b1726" />
        )}
      </mesh>

      <mesh ref={markerRef} position={markerPosition}>
        <sphereGeometry args={[0.35, 24, 24]} />
        <meshBasicMaterial color="#00e5ff" />
      </mesh>

      <mesh position={markerPosition}>
        <cylinderGeometry args={[0.025, 0.025, 1.6, 16]} />
        <meshBasicMaterial color="#ff4f7d" />
      </mesh>

      <gridHelper args={[44, 10, '#1b82ad', '#173445']} position={[0, 0.025, 0]} />
    </group>
  );
}
