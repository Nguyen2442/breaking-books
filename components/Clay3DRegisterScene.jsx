"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Key, RefreshCw, Sparkles, Compass } from "lucide-react";

/**
 * Three.js 3D Claymorphic Architect Studio & Master Key Scene (Sign Up)
 * Exclusively for the Sign Up page - completely distinct from Sign In Workstation:
 * - Floating Terracotta & Peach Orbit Launch Dais with concentric planetary rings
 * - Giant 3D Golden Master Key of Knowledge floating with specular glint
 * - Architect's Wooden Drafting Easel with System Architecture Blueprint
 * - Minted Stack of 3 Leather Books (Mint Green, Lilac, Soft Peach Orange)
 * - Floating 3D Gem Crystals
 * - Full 360° Drag-to-Rotate OrbitControls & Key interactive unlocking
 */
export default function Clay3DRegisterScene({ className = "" }) {
  const mountRef = useRef(null);
  const [autoRotate, setAutoRotate] = useState(false);
  const [keyUnlocked, setKeyUnlocked] = useState(false);
  const [activeHint, setActiveHint] = useState("Kéo chuột để xoay 360° • Chạm Master Key để mở khóa");

  const sceneRefs = useRef({
    controls: null,
    keyGroup: null,
    gemMesh: null,
    keySpinBoost: 0,
  });

  useEffect(() => {
    if (sceneRefs.current.controls) {
      sceneRefs.current.controls.autoRotate = autoRotate;
    }
  }, [autoRotate]);

  useEffect(() => {
    if (sceneRefs.current.keyGroup) {
      sceneRefs.current.keySpinBoost = keyUnlocked ? 3.0 : 0;
    }
  }, [keyUnlocked]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let width = container.clientWidth || 440;
    let height = container.clientHeight || 440;

    // 1. SCENE & CAMERA
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(4.4, 4.2, 5.6);

    // 2. RENDERER
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    // 3. ORBIT CONTROLS
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 3.5;
    controls.maxDistance = 10;
    controls.maxPolarAngle = Math.PI / 2 + 0.05;
    controls.target.set(0, 0.9, 0);
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 1.2;
    sceneRefs.current.controls = controls;

    // 4. LIGHTS
    const ambientLight = new THREE.AmbientLight(0xfff7ed, 0.85);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffedd5, 0xfed7aa, 0.6);
    hemiLight.position.set(0, 10, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(5, 8, 6);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 20;
    keyLight.shadow.camera.left = -4;
    keyLight.shadow.camera.right = 4;
    keyLight.shadow.camera.top = 4;
    keyLight.shadow.camera.bottom = -4;
    keyLight.shadow.bias = -0.0004;
    scene.add(keyLight);

    const goldPointLight = new THREE.PointLight(0xfde047, 2.0, 6, 2);
    goldPointLight.position.set(0, 2.2, 0);
    scene.add(goldPointLight);

    // ==============================================================
    // 5. GEOMETRIES & MATERIALS
    // ==============================================================

    // Terracotta & Peach Platform Dais
    const platformGeo = new THREE.CylinderGeometry(3.2, 3.2, 0.22, 64);
    const platformMat = new THREE.MeshStandardMaterial({
      color: 0xfb923c, // Màu cam nhạt
      roughness: 0.5,
      metalness: 0.05,
    });
    const platform = new THREE.Mesh(platformGeo, platformMat);
    platform.position.y = -0.11;
    platform.receiveShadow = true;
    scene.add(platform);

    // Concentric Inset Disc
    const insetGeo = new THREE.CylinderGeometry(2.9, 2.9, 0.02, 64);
    const insetMat = new THREE.MeshStandardMaterial({
      color: 0xfff7ed,
      roughness: 0.75,
    });
    const inset = new THREE.Mesh(insetGeo, insetMat);
    inset.position.y = 0.01;
    inset.receiveShadow = true;
    scene.add(inset);

    // Orbital Ring Torus
    const ringGeo = new THREE.TorusGeometry(2.5, 0.035, 16, 64);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xfed7aa,
      roughness: 0.4,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.04;
    scene.add(ring);

    // --- A. GIANT 3D GOLDEN MASTER KEY (Center Floating) ---
    const keyGroup = new THREE.Group();
    keyGroup.position.set(0, 1.8, 0.2);

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.85,
      roughness: 0.25,
      emissive: 0xd97706,
      emissiveIntensity: 0.2,
    });

    // Key Ring
    const keyRingGeo = new THREE.TorusGeometry(0.42, 0.09, 24, 48);
    const keyRing = new THREE.Mesh(keyRingGeo, goldMat);
    keyRing.position.y = 0.65;
    keyRing.castShadow = true;
    keyGroup.add(keyRing);

    // Center Star in Key
    const starGeo = new THREE.OctahedronGeometry(0.18);
    const starMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1 });
    const star = new THREE.Mesh(starGeo, starMat);
    star.position.y = 0.65;
    keyGroup.add(star);

    // Key Stem
    const stemGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.2, 24);
    const stem = new THREE.Mesh(stemGeo, goldMat);
    stem.position.y = -0.1;
    stem.castShadow = true;
    keyGroup.add(stem);

    // Key Teeth
    const tooth1 = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.08, 0.08), goldMat);
    tooth1.position.set(0.16, -0.4, 0);
    const tooth2 = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 0.08), goldMat);
    tooth2.position.set(0.21, -0.6, 0);
    tooth1.castShadow = true;
    tooth2.castShadow = true;
    keyGroup.add(tooth1, tooth2);

    scene.add(keyGroup);
    sceneRefs.current.keyGroup = keyGroup;

    // --- B. ARCHITECT DRAFTING EASEL & BLUEPRINT (Right Background) ---
    const easelGroup = new THREE.Group();
    easelGroup.position.set(1.4, 0, -0.9);
    easelGroup.rotation.y = -0.35;

    const woodMat = new THREE.MeshStandardMaterial({ color: 0xfed7aa, roughness: 0.6 });
    // 3 Legs
    const leg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 16), woodMat);
    leg1.position.set(-0.4, 1.1, -0.2);
    leg1.rotation.z = -0.15;
    const leg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 16), woodMat);
    leg2.position.set(0.4, 1.1, -0.2);
    leg2.rotation.z = 0.15;
    const leg3 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.3, 16), woodMat);
    leg3.position.set(0, 1.1, -0.7);
    leg3.rotation.x = -0.25;

    easelGroup.add(leg1, leg2, leg3);

    // Blueprint Board
    const boardMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 0.06), boardMat);
    board.position.set(0, 1.45, -0.18);
    board.rotation.x = -0.12;
    board.castShadow = true;
    easelGroup.add(board);

    // Blueprint Surface (Azure Blue)
    const bpMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x0284c7,
      emissiveIntensity: 0.25,
      roughness: 0.3,
    });
    const bp = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.88, 0.02), bpMat);
    bp.position.set(0, 1.45, -0.14);
    bp.rotation.x = -0.12;
    easelGroup.add(bp);

    scene.add(easelGroup);

    // --- C. TREASURE STACK OF 3 MINTED BOOKS (Left Foreground) ---
    const bookStackGroup = new THREE.Group();
    bookStackGroup.position.set(-1.2, 0, 0.6);
    bookStackGroup.rotation.y = 0.4;

    // Bottom: Mint Green
    const b1Mat = new THREE.MeshStandardMaterial({ color: 0x34d399, roughness: 0.5 });
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.24, 1.1), b1Mat);
    b1.position.y = 0.12;
    b1.castShadow = true;

    // Middle: Lilac Violet
    const b2Mat = new THREE.MeshStandardMaterial({ color: 0xa78bfa, roughness: 0.5 });
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.22, 1.0), b2Mat);
    b2.position.set(0.04, 0.35, 0.02);
    b2.rotation.y = -0.1;
    b2.castShadow = true;

    // Top: Soft Light Orange
    const b3Mat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.5 });
    const b3 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.2, 0.95), b3Mat);
    b3.position.set(0.08, 0.56, 0.04);
    b3.rotation.y = 0.15;
    b3.castShadow = true;

    bookStackGroup.add(b1, b2, b3);
    scene.add(bookStackGroup);

    // --- D. FLOATING 3D GEMS & CRYSTALS ---
    const gemGeo = new THREE.OctahedronGeometry(0.24);
    const gemMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.15,
      metalness: 0.3,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.4,
    });
    const gemMesh = new THREE.Mesh(gemGeo, gemMat);
    gemMesh.position.set(-1.5, 1.9, -0.6);
    scene.add(gemMesh);
    sceneRefs.current.gemMesh = gemMesh;

    // Second Amber Gem
    const gem2Mat = new THREE.MeshStandardMaterial({
      color: 0xfde047,
      roughness: 0.15,
      metalness: 0.3,
      emissive: 0xfde047,
      emissiveIntensity: 0.3,
    });
    const gem2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18), gem2Mat);
    gem2.position.set(1.8, 2.3, 0.4);
    scene.add(gem2);

    // ==============================================================
    // 6. RAYCASTING INTERACTION
    // ==============================================================
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    function handlePointerDown(e) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      if (intersects.length > 0) {
        const obj = intersects[0].object;

        // Click Key
        if (obj === keyRing || obj === star || obj === stem || obj === tooth1 || obj === tooth2) {
          setKeyUnlocked((prev) => !prev);
          setActiveHint("🗝️ Master Key: Đã kích hoạt hiệu ứng xoay năng lượng kiến thức!");
          return;
        }

        // Click Blueprint
        if (obj === bp || obj === board) {
          setActiveHint("📐 Bản vẽ kiến trúc: Sơ đồ thiết kế hệ thống phân tán đa tầng.");
          return;
        }

        // Click Books
        if (obj === b1 || obj === b2 || obj === b3) {
          setActiveHint("📚 Bộ sách tân gia: Tặng trọn bộ kiến trúc khi tạo tài khoản!");
          return;
        }
      }
    }

    renderer.domElement.addEventListener("pointerdown", handlePointerDown);

    // ==============================================================
    // 7. ANIMATION LOOP
    // ==============================================================
    let animId;
    let clock = new THREE.Clock();

    function animate() {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      controls.update();

      const el = sceneRefs.current;

      // Key Floating & Rotating
      if (el.keyGroup) {
        el.keyGroup.position.y = 1.8 + Math.sin(time * 2.5) * 0.12;
        const speed = 0.8 + el.keySpinBoost;
        el.keyGroup.rotation.y += delta * speed;
        if (el.keySpinBoost > 0) {
          el.keySpinBoost *= 0.96;
        }
      }

      // Gems Gentle Spin
      if (gemMesh) {
        gemMesh.rotation.x = time * 0.8;
        gemMesh.rotation.y = time * 1.2;
        gemMesh.position.y = 1.9 + Math.sin(time * 2.0) * 0.1;
      }
      if (gem2) {
        gem2.rotation.x = time * 1.0;
        gem2.rotation.z = time * 0.7;
        gem2.position.y = 2.3 + Math.cos(time * 1.8) * 0.08;
      }

      renderer.render(scene, camera);
    }

    animate();

    // ==============================================================
    // 8. RESIZE & DISPOSAL
    // ==============================================================
    function handleResize() {
      if (!container) return;
      width = container.clientWidth;
      height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    }

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);

      controls.dispose();
      renderer.dispose();

      scene.traverse((obj) => {
        if (obj.isMesh) {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            if (Array.isArray(obj.material)) {
              obj.material.forEach((m) => m.dispose());
            } else {
              obj.material.dispose();
            }
          }
        }
      });

      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className={`relative w-full aspect-square max-w-[480px] flex flex-col items-center select-none ${className}`}>
      <div
        ref={mountRef}
        className="w-full h-full relative cursor-grab active:cursor-grabbing rounded-3xl overflow-hidden"
        title="Kéo chuột để xoay 360° tự do • Cuộn để phóng to"
      />

      {/* Floating Info Pill */}
      <div className="absolute top-2 inset-x-2 pointer-events-none flex justify-center">
        <div className="px-3 py-1 rounded-full bg-white/90 dark:bg-slate-900/90 shadow text-xs font-medium text-slate-700 dark:text-slate-300 pointer-events-auto border border-orange-100 dark:border-white/10 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-orange-500 shrink-0" />
          <span className="truncate max-w-[300px]">{activeHint}</span>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-2 inset-x-2 flex items-center justify-between px-3 py-1.5 rounded-2xl bg-white/95 dark:bg-slate-900/95 shadow-md border border-orange-100 dark:border-white/10 z-10">
        <button
          type="button"
          onClick={() => setKeyUnlocked(!keyUnlocked)}
          className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
            keyUnlocked
              ? "bg-amber-500 text-white"
              : "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 hover:bg-amber-100"
          }`}
        >
          <Key className="w-3.5 h-3.5" />
          <span>{keyUnlocked ? "Master Key: Đang mở" : "Mở khóa Key"}</span>
        </button>

        <button
          type="button"
          onClick={() => setAutoRotate(!autoRotate)}
          className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
            autoRotate
              ? "bg-orange-500 text-white"
              : "bg-orange-50 dark:bg-slate-800 text-orange-600 dark:text-orange-400"
          }`}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${autoRotate ? "animate-spin" : ""}`} />
          <span>Xoay 360°</span>
        </button>
      </div>
    </div>
  );
}
