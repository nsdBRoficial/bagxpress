"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Points, PointMaterial, Sparkles, Stars } from "@react-three/drei";
import { useRef, useMemo } from "react";
import * as THREE from "three";

function RotatingToken() {
  const tokenRef = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (tokenRef.current) {
      tokenRef.current.rotation.y += delta * 0.5;
      tokenRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.5) * 0.2;
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={2}>
      <mesh ref={tokenRef} scale={1.5}>
        {/* Abstract Token Shape (Cylinder / Coin) */}
        <cylinderGeometry args={[1, 1, 0.2, 64]} />
        <meshPhysicalMaterial
          color="#7c3aed"
          emissive="#14f195"
          emissiveIntensity={0.5}
          roughness={0.1}
          metalness={0.9}
          clearcoat={1}
          clearcoatRoughness={0.1}
          transmission={0.5}
          ior={1.5}
          thickness={0.5}
        />
        
        {/* Inner Core */}
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.8, 0.8, 0.21, 32]} />
          <meshBasicMaterial color="#00d4ff" />
        </mesh>
      </mesh>
    </Float>
  );
}

function HolographicCard() {
  const cardRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (cardRef.current) {
      cardRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.3;
      cardRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.2) * 0.1;
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={0.2} floatIntensity={1} position={[0, -2, 1]}>
      <mesh ref={cardRef}>
        <boxGeometry args={[3, 1.8, 0.05]} />
        <meshPhysicalMaterial
          color="#ffffff"
          transmission={0.9}
          opacity={1}
          metalness={0.2}
          roughness={0.1}
          ior={1.5}
          thickness={0.1}
          emissive="#7c3aed"
          emissiveIntensity={0.2}
        />
        {/* Card Chip Mockup */}
        <mesh position={[-1, 0, 0.03]}>
          <planeGeometry args={[0.4, 0.3]} />
          <meshBasicMaterial color="#14f195" />
        </mesh>
      </mesh>
    </Float>
  );
}

function ConnectionsLines() {
  const points = useMemo(() => {
    const pts = [];
    for (let i = 0; i < 20; i++) {
      pts.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10
        )
      );
    }
    return pts;
  }, []);

  const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);

  return (
    <lineSegments geometry={lineGeometry}>
      <lineBasicMaterial color="#00d4ff" transparent opacity={0.2} />
    </lineSegments>
  );
}

export default function Hero3D() {
  return (
    <div className="w-full h-full relative pointer-events-none">
      <Canvas camera={{ position: [0, 0, 7], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={2} color="#7c3aed" />
        <spotLight position={[-10, -10, 10]} angle={0.15} penumbra={1} intensity={2} color="#14f195" />
        
        <RotatingToken />
        <HolographicCard />
        
        {/* Background Network */}
        <ConnectionsLines />
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        <Sparkles count={200} scale={12} size={2} speed={0.4} color="#00d4ff" />
      </Canvas>
    </div>
  );
}
