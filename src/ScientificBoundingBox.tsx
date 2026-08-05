import { Line, Text } from '@react-three/drei';
import * as THREE from 'three';

export default function ScientificBoundingBox() {
  const size = 44;
  const height = 8;
  const half = size / 2;
  const color = new THREE.Color('#00e5ff');

  // Bounding box lines
  const boxPoints = [
    // Bottom square
    [-half, 0, -half], [half, 0, -half],
    [half, 0, -half], [half, 0, half],
    [half, 0, half], [-half, 0, half],
    [-half, 0, half], [-half, 0, -half],
    
    // Top square
    [-half, height, -half], [half, height, -half],
    [half, height, -half], [half, height, half],
    [half, height, half], [-half, height, half],
    [-half, height, half], [-half, height, -half],
    
    // Vertical posts
    [-half, 0, -half], [-half, height, -half],
    [half, 0, -half], [half, height, -half],
    [half, 0, half], [half, height, half],
    [-half, 0, half], [-half, height, half],
  ].map(p => new THREE.Vector3(...p));

  // Height tick marks
  const ticks = [];
  for (let i = 0; i <= height; i += 5) {
    ticks.push([new THREE.Vector3(-half, i, -half), new THREE.Vector3(-half + 0.75, i, -half)]);
    ticks.push([new THREE.Vector3(half, i, half), new THREE.Vector3(half - 0.75, i, half)]);
  }

  return (
    <group>
      <Line points={boxPoints} color={color} segments lineWidth={1} transparent opacity={0.18} />
      
      {ticks.map((tick, i) => (
        <Line key={i} points={tick} color={color} lineWidth={1} transparent opacity={0.28} />
      ))}

      {/* Axis Labels */}
      <Text position={[-half - 1, height, -half]} fontSize={0.55} color="#00e5ff" anchorX="right" anchorY="middle">
        Z-AXIS
      </Text>
      <Text position={[half + 1, 0, half]} fontSize={0.55} color="#00e5ff" anchorX="left" anchorY="middle">
        +Y
      </Text>
      <Text position={[-half, height + 0.5, -half]} fontSize={0.55} color="#00e5ff" anchorX="center" anchorY="bottom">
        ATMOS MODEL
      </Text>
      
      {/* Basemap is the primary spatial reference; the frame only marks model bounds. */}
    </group>
  );
}
