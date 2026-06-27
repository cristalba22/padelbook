import React, { useEffect, useRef } from "react";

export default function Padel3DScene({ variant = "ambient", className = "" }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    let disposed = false;
    let cleanup = () => {};

    async function initScene() {
      const THREE = await import("three");
      if (disposed || !mountRef.current) return;

      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
      const startedAt = performance.now();
      const group = new THREE.Group();
      const isHero = variant === "hero";

      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
      renderer.setClearColor(0x000000, 0);
      mount.appendChild(renderer.domElement);

      camera.position.set(isHero ? 0.2 : 0, isHero ? 2.2 : 2.7, isHero ? 8.2 : 9.4);
      camera.lookAt(0, 0, 0);

      scene.add(new THREE.AmbientLight(0x9dffbf, 0.55));
      const keyLight = new THREE.PointLight(0x7cff9d, 3.2, 24);
      keyLight.position.set(-3.4, 3.6, 4.8);
      scene.add(keyLight);
      const rimLight = new THREE.PointLight(0x40ffd0, 2.4, 20);
      rimLight.position.set(4.2, 1.8, -3.4);
      scene.add(rimLight);

      const lineMaterial = new THREE.LineBasicMaterial({
        color: 0xb9ff5c,
        transparent: true,
        opacity: isHero ? 0.36 : 0.24,
      });
      const courtPoints = [
        [-3.8, -1.45, 0], [3.8, -1.45, 0], [3.8, 1.45, 0], [-3.8, 1.45, 0], [-3.8, -1.45, 0],
        [0, -1.45, 0], [0, 1.45, 0],
        [-3.8, 0, 0], [3.8, 0, 0],
        [-1.9, -1.45, 0], [-1.9, 1.45, 0],
        [1.9, -1.45, 0], [1.9, 1.45, 0],
      ].map(([x, y, z]) => new THREE.Vector3(x, y, z));
      const courtGeometry = new THREE.BufferGeometry().setFromPoints(courtPoints);
      const court = new THREE.Line(courtGeometry, lineMaterial);
      court.rotation.x = -Math.PI / 2.2;
      court.position.y = -1.2;
      court.position.z = -0.7;
      group.add(court);

      const racketGroup = new THREE.Group();
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.72, 0.035, 18, 70),
        new THREE.MeshStandardMaterial({
          color: 0x0b0f14,
          roughness: 0.48,
          metalness: 0.5,
          emissive: 0x2afa7d,
          emissiveIntensity: 0.14,
        }),
      );
      const core = new THREE.Mesh(
        new THREE.CircleGeometry(0.62, 54),
        new THREE.MeshStandardMaterial({
          color: 0x111827,
          roughness: 0.82,
          metalness: 0.08,
          transparent: true,
          opacity: 0.82,
        }),
      );
      const handle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.085, 0.92, 20),
        new THREE.MeshStandardMaterial({ color: 0x05070c, roughness: 0.7, metalness: 0.3 }),
      );
      handle.rotation.z = Math.PI / 2;
      handle.position.set(0.9, -0.02, 0);
      racketGroup.add(ring, core, handle);
      racketGroup.rotation.set(-0.25, 0.25, -0.35);
      racketGroup.position.set(isHero ? 2.7 : 3.2, isHero ? 0.5 : 0.15, isHero ? -0.2 : -1.3);
      group.add(racketGroup);

      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(isHero ? 0.22 : 0.18, 36, 36),
        new THREE.MeshStandardMaterial({
          color: 0xc9ff4d,
          roughness: 0.42,
          metalness: 0.05,
          emissive: 0xa3ff2e,
          emissiveIntensity: 0.55,
        }),
      );
      ball.position.set(isHero ? -1.35 : -2.5, isHero ? 0.7 : 0.35, isHero ? 0.5 : -0.5);
      group.add(ball);

      const particleCount = isHero ? 58 : 38;
      const positions = new Float32Array(particleCount * 3);
      for (let i = 0; i < particleCount; i += 1) {
        positions[i * 3] = (Math.random() - 0.5) * 8;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 4.2;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 4.6;
      }
      const particlesGeometry = new THREE.BufferGeometry();
      particlesGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const particles = new THREE.Points(
        particlesGeometry,
        new THREE.PointsMaterial({
          color: 0x96ff64,
          size: isHero ? 0.035 : 0.026,
          transparent: true,
          opacity: isHero ? 0.45 : 0.3,
        }),
      );
      group.add(particles);

      group.rotation.x = isHero ? -0.08 : -0.14;
      scene.add(group);

      let raf = 0;
      const resize = () => {
        const width = Math.max(1, mount.clientWidth);
        const height = Math.max(1, mount.clientHeight);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };

      const animate = () => {
        if (disposed) return;
        const time = (performance.now() - startedAt) / 1000;
        group.rotation.y = Math.sin(time * 0.18) * 0.12;
        racketGroup.rotation.y = 0.25 + Math.sin(time * 0.75) * 0.12;
        racketGroup.rotation.z = -0.35 + Math.cos(time * 0.55) * 0.08;
        ball.position.y = (isHero ? 0.7 : 0.35) + Math.sin(time * 1.35) * 0.24;
        ball.position.x = (isHero ? -1.35 : -2.5) + Math.cos(time * 0.9) * 0.26;
        particles.rotation.y = time * 0.035;
        renderer.render(scene, camera);
        if (!reduceMotion) raf = window.requestAnimationFrame(animate);
      };

      resize();
      animate();

      const observer = new ResizeObserver(resize);
      observer.observe(mount);

      cleanup = () => {
        window.cancelAnimationFrame(raf);
        observer.disconnect();
        scene.traverse((object) => {
          if (object.geometry) object.geometry.dispose();
          if (object.material) {
            if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
            else object.material.dispose();
          }
        });
        renderer.dispose();
        renderer.domElement.remove();
      };
    }

    initScene();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [variant]);

  return <div ref={mountRef} aria-hidden="true" className={`pointer-events-none ${className}`} />;
}
