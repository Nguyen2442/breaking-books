"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Lightbulb, RefreshCw, Sparkles, Monitor } from "lucide-react";

/**
 * Three.js 3D Claymorphic Tech Workstation Scene (Sign In)
 * Built according to threejs-skills suite & Hallmark guidelines:
 * - Developer at electric standing desk with monitor, shelf, coffee mug, and floor lamp
 * - Soft Light Orange ("Màu cam nhạt" #FB923C / #FED7AA) platform dais & warm cream studio
 * - True Three.js WebGL with OrbitControls for free 360° drag-to-rotate
 * - Interactive: Click lamp to toggle illumination, click monitor to change code screen
 */
export default function Clay3DWorkstationScene({ className = "" }) {
  const mountRef = useRef(null);
  const [lampOn, setLampOn] = useState(true);
  const [autoRotate, setAutoRotate] = useState(false);
  const [activeHint, setActiveHint] = useState("Kéo chuột để xoay 360° • Chạm đèn để bật/tắt");

  const sceneRefs = useRef({
    controls: null,
    lampLight: null,
    lampBulbMat: null,
    monitorScreenMat: null,
    screenIdx: 0,
  });

  useEffect(() => {
    if (sceneRefs.current.lampLight) {
      sceneRefs.current.lampLight.intensity = lampOn ? 2.5 : 0;
    }
    if (sceneRefs.current.lampBulbMat) {
      sceneRefs.current.lampBulbMat.emissive.set(lampOn ? 0xfef08a : 0x475569);
      sceneRefs.current.lampBulbMat.emissiveIntensity = lampOn ? 1.5 : 0.1;
    }
    if (sceneRefs.current.controls) {
      sceneRefs.current.controls.autoRotate = autoRotate;
    }
  }, [lampOn, autoRotate]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let width = container.clientWidth || 440;
    let height = container.clientHeight || 440;

    // 1. SCENE & CAMERA
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(4.5, 4.0, 5.5);

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

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
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

    // Interactive Floor Lamp PointLight
    const lampLight = new THREE.PointLight(0xfef08a, lampOn ? 2.5 : 0, 8, 2);
    lampLight.position.set(-1.6, 2.4, 0.8);
    lampLight.castShadow = true;
    scene.add(lampLight);
    sceneRefs.current.lampLight = lampLight;

    // ==============================================================
    // 5. GEOMETRIES & MATERIALS
    // ==============================================================

    // Soft Peach Dais Platform
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

    // Platform Top Inset Disk (Warm Cream)
    const insetGeo = new THREE.CylinderGeometry(2.95, 2.95, 0.02, 64);
    const insetMat = new THREE.MeshStandardMaterial({
      color: 0xfff7ed,
      roughness: 0.75,
    });
    const inset = new THREE.Mesh(insetGeo, insetMat);
    inset.position.y = 0.01;
    inset.receiveShadow = true;
    scene.add(inset);

    // Studio Curved Back Wall
    const wallGeo = new THREE.CylinderGeometry(2.8, 2.8, 2.8, 32, 1, true, -Math.PI / 2, Math.PI);
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.8,
      side: THREE.DoubleSide,
    });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.set(0, 1.4, 0);
    wall.receiveShadow = true;
    scene.add(wall);

    // Wall Shelf with Books
    const shelfGeo = new THREE.BoxGeometry(1.6, 0.08, 0.4);
    const shelfMat = new THREE.MeshStandardMaterial({ color: 0xfed7aa, roughness: 0.6 });
    const shelf = new THREE.Mesh(shelfGeo, shelfMat);
    shelf.position.set(0.6, 2.2, -1.8);
    shelf.castShadow = true;
    shelf.receiveShadow = true;
    scene.add(shelf);

    // Shelf Books
    const bookColors = [0x38bdf8, 0xa78bfa, 0x4ade80, 0xfbbf24];
    bookColors.forEach((color, i) => {
      const bookMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.35, 0.28),
        new THREE.MeshStandardMaterial({ color, roughness: 0.5 })
      );
      bookMesh.position.set(0.1 + i * 0.16, 2.42, -1.8);
      bookMesh.castShadow = true;
      scene.add(bookMesh);
    });

    // Studio Window on Left Wall
    const winGeo = new THREE.BoxGeometry(0.08, 1.2, 0.9);
    const winMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.3,
      roughness: 0.2,
    });
    const winMesh = new THREE.Mesh(winGeo, winMat);
    winMesh.position.set(-1.9, 1.8, -0.6);
    scene.add(winMesh);

    // Electric Standing Desk
    const desktopGeo = new THREE.BoxGeometry(2.0, 0.08, 1.0);
    const desktopMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    const desktop = new THREE.Mesh(desktopGeo, desktopMat);
    desktop.position.set(0.1, 1.25, -0.3);
    desktop.castShadow = true;
    desktop.receiveShadow = true;
    scene.add(desktop);

    // Desk Metal Legs & Crossbar
    const legMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.6, roughness: 0.3 });
    const leg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.25, 16), legMat);
    leg1.position.set(-0.7, 0.625, -0.3);
    leg1.castShadow = true;
    const leg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.25, 16), legMat);
    leg2.position.set(0.9, 0.625, -0.3);
    leg2.castShadow = true;
    scene.add(leg1, leg2);

    // Desk Feet
    const foot1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.8), legMat);
    foot1.position.set(-0.7, 0.02, -0.3);
    const foot2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.8), legMat);
    foot2.position.set(0.9, 0.02, -0.3);
    scene.add(foot1, foot2);

    // Ultrawide Computer Monitor
    const monitorStand = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 16), legMat);
    monitorStand.position.set(0.1, 1.44, -0.5);
    scene.add(monitorStand);

    const monitorFrame = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.6, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3 })
    );
    monitorFrame.position.set(0.1, 1.74, -0.5);
    monitorFrame.castShadow = true;
    scene.add(monitorFrame);

    // Screen with code lines
    const screenMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.45,
      roughness: 0.2,
    });
    const screen = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.54, 0.01), screenMat);
    screen.position.set(0.1, 1.74, -0.465);
    scene.add(screen);
    sceneRefs.current.monitorScreenMat = screenMat;

    // Ceramic Coffee Mug
    const mugMat = new THREE.MeshStandardMaterial({ color: 0xfb923c, roughness: 0.3 });
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.16, 20), mugMat);
    mug.position.set(0.85, 1.37, -0.15);
    mug.castShadow = true;
    scene.add(mug);

    // Floor Lamp (Clickable!)
    const lampGroup = new THREE.Group();
    lampGroup.position.set(-1.6, 0, 0.8);

    const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.04, 24), legMat);
    lampBase.position.y = 0.02;
    const lampPole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.3, 16), legMat);
    lampPole.position.y = 1.15;

    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfef08a,
      emissiveIntensity: lampOn ? 1.5 : 0.1,
      roughness: 0.2,
    });
    sceneRefs.current.lampBulbMat = bulbMat;

    const lampShade = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.5, 24, 1, true), bulbMat);
    lampShade.position.y = 2.3;
    lampShade.castShadow = true;

    lampGroup.add(lampBase, lampPole, lampShade);
    scene.add(lampGroup);

    // Friendly Engineer Character
    const charGroup = new THREE.Group();
    charGroup.position.set(0.1, 0, 0.45);

    // Pants / Legs
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.7 });
    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.9, 16), pantsMat);
    legL.position.set(-0.14, 0.45, 0);
    const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.9, 16), pantsMat);
    legR.position.set(0.14, 0.45, 0);
    legL.castShadow = true;
    legR.castShadow = true;
    charGroup.add(legL, legR);

    // Orange Shirt / Torso
    const shirtMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.6 });
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 0.65, 20), shirtMat);
    torso.position.y = 1.18;
    torso.castShadow = true;
    charGroup.add(torso);

    // Character Head & Hair
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xfed7aa, roughness: 0.6 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 24, 20), skinMat);
    head.position.y = 1.62;
    head.castShadow = true;
    charGroup.add(head);

    const hairMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.19, 24, 20), hairMat);
    hair.position.set(0, 1.66, -0.02);
    charGroup.add(hair);

    scene.add(charGroup);

    // ==============================================================
    // 6. RAYCASTING INTERACTION
    // ==============================================================
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const screens = [
      { color: 0x38bdf8, name: "System Architecture Live Metric" },
      { color: 0x4ade80, name: "Distributed Cache Hit Ratio: 99.4%" },
      { color: 0xfbbf24, name: "Event Stream Latency: 4ms" },
    ];

    function handlePointerDown(e) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      if (intersects.length > 0) {
        const obj = intersects[0].object;

        // Click Lamp
        if (obj === lampShade || lampGroup.children.includes(obj)) {
          setLampOn((prev) => !prev);
          setActiveTipHint("💡 Đèn studio: Đã chuyển đổi trạng thái chiếu sáng!");
          return;
        }

        // Click Monitor / Screen
        if (obj === screen || obj === monitorFrame) {
          sceneRefs.current.screenIdx = (sceneRefs.current.screenIdx + 1) % screens.length;
          const current = screens[sceneRefs.current.screenIdx];
          if (screenMat) {
            screenMat.emissive.set(current.color);
          }
          setActiveTipHint(`🖥️ Màn hình làm việc: ${current.name}`);
          return;
        }
      }
    }

    function setActiveTipHint(msg) {
      setActiveHint(msg);
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

      // Subtle breathing idle motion on engineer character
      torso.position.y = 1.18 + Math.sin(time * 2) * 0.01;
      head.position.y = 1.62 + Math.sin(time * 2) * 0.01;

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
          onClick={() => setLampOn(!lampOn)}
          className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
            lampOn
              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
          }`}
        >
          <Lightbulb className="w-3.5 h-3.5" />
          <span>{lampOn ? "Đèn: Bật" : "Đèn: Tắt"}</span>
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
