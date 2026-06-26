"use client";

// =============================================================================
// HopeScene — React Three Fiber drop-in scaffold (NOT yet mounted on the page).
//
// The first build deliberately ships a lightweight CSS/SVG sunrise (see
// components/motion/Sunrise.tsx) for best-in-class performance. This file is
// the ready-to-go 3D upgrade path: a slowly rotating "hope globe" with a warm
// sunrise key light.
//
// To enable it in the hero, dynamically import it (ssr: false):
//
//   const HopeScene = dynamic(
//     () => import("@/components/three/HopeScene").then((m) => m.HopeScene),
//     { ssr: false }
//   );
//
// ...then render <HopeScene /> in place of <Sunrise /> within Hero's <Scene>.
// =============================================================================

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useReducedMotion } from "framer-motion";
import type { Mesh } from "three";

function HopeGlobe() {
  const mesh = useRef<Mesh>(null);
  const reduce = useReducedMotion();

  useFrame((_, delta) => {
    if (!mesh.current || reduce) return;
    mesh.current.rotation.y += delta * 0.18;
  });

  return (
    <mesh ref={mesh}>
      <icosahedronGeometry args={[1.4, 2]} />
      <meshStandardMaterial
        color="#3D8B37"
        roughness={0.45}
        metalness={0.1}
        flatShading
      />
    </mesh>
  );
}

export function HopeScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 4.2], fov: 45 }}
      dpr={[1, 2]}
      style={{ width: "100%", aspectRatio: "1 / 1" }}
      gl={{ antialias: true, alpha: true }}
    >
      {/* warm sunrise key light + cool fill */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 4, 5]} intensity={2.2} color="#F7B733" />
      <directionalLight position={[-4, -2, -3]} intensity={0.8} color="#103D7A" />
      <HopeGlobe />
    </Canvas>
  );
}
