"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { BookOpen, Layers, RefreshCw, Sparkles, Move3d } from "lucide-react";

/**
 * Three.js 3D Claymorphic Library Scene
 * Built according to the threejs-skills suite & Hallmark guidelines:
 * - Unified Soft Light Orange ("Màu cam nhạt" #FB923C / #FED7AA) & Warm Cream palette
 * - Real hardware-accelerated WebGL with soft clay PBR materials
 * - OrbitControls: Free 3D drag-to-rotate in any direction with buttery damping
 * - Interactive Objects: Top book flips open, layer explosion, wobbly plant, bounce pencils
 */
export default function Clay3DLibraryScene({ className = "" }) {
  const mountRef = useRef(null);
  const [viewMode, setViewMode] = useState("stacked"); // "stacked" | "open" | "exploded"
  const [autoRotate, setAutoRotate] = useState(false);
  const [activeTip, setActiveTip] = useState("Kéo chuột để xoay 3D 360° tự do • Chạm vào sách để mở");

  // Keep refs for animation and scene control across state changes
  const sceneElementsRef = useRef({
    controls: null,
    topBookGroup: null,
    bottomBookMesh: null,
    innerPagesGroup: null,
    plantGroup: null,
    pencilCupGroup: null,
    stickyMesh: null,
    isExploded: false,
    isOpen: false,
    plantWobble: 0,
    pencilBounce: 0,
  });

  // Synchronize view modes with 3D scene elements
  useEffect(() => {
    const el = sceneElementsRef.current;
    el.isExploded = viewMode === "exploded";
    el.isOpen = viewMode === "open";
    if (el.controls) {
      el.controls.autoRotate = autoRotate;
    }
  }, [viewMode, autoRotate]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let width = container.clientWidth || 540;
    let height = container.clientHeight || 420;

    // 1. SCENE & CAMERA
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(4.2, 3.8, 5.8);

    // 2. RENDERER (Optimized for 60fps & low GPU load)
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(typeof window !== "undefined" ? window.devicePixelRatio : 1, 1.35));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    // 3. CONTROLS
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 3.5;
    controls.maxDistance = 11;
    controls.maxPolarAngle = Math.PI / 2 + 0.05; // Prevent camera from going under table
    controls.target.set(0.2, 0.4, 0);
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 1.5;
    sceneElementsRef.current.controls = controls;

    // 4. LIGHTING - Warm Studio Clay Lighting (Optimized 512 Shadow Map)
    const ambientLight = new THREE.AmbientLight(0xfff7ed, 0.95);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffedd5, 0xfed7aa, 0.65);
    hemiLight.position.set(0, 10, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(6, 8, 7);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 512;
    keyLight.shadow.mapSize.height = 512;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 25;
    keyLight.shadow.camera.left = -5;
    keyLight.shadow.camera.right = 5;
    keyLight.shadow.camera.top = 5;
    keyLight.shadow.camera.bottom = -5;
    keyLight.shadow.bias = -0.0004;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xfed7aa, 1.1);
    fillLight.position.set(-5, 4, -4);
    scene.add(fillLight);

    // Soft Table Disc (Ground) - Seamlessly blends with #FFF6EF background
    const tableGeo = new THREE.CylinderGeometry(4.2, 4.2, 0.15, 64);
    const tableMat = new THREE.MeshStandardMaterial({
      color: 0xfff6ef,
      roughness: 0.85,
      metalness: 0.02,
    });
    const table = new THREE.Mesh(tableGeo, tableMat);
    table.position.y = -0.075;
    table.receiveShadow = true;
    scene.add(table);

    // Subtle table rim ring in soft peach
    const rimGeo = new THREE.TorusGeometry(4.2, 0.04, 16, 64);
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0xfed7aa,
      roughness: 0.6,
    });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0;
    scene.add(rim);

    // ==============================================================
    // 5. CLAY OBJECTS
    // ==============================================================

    // Helper: Rounded Box Function
    function createRoundedBookGeometry(w, h, d, radius = 0.08) {
      const shape = new THREE.Shape();
      const x = -w / 2;
      const y = -d / 2;
      shape.moveTo(x + radius, y);
      shape.lineTo(x + w - radius, y);
      shape.quadraticCurveTo(x + w, y, x + w, y + radius);
      shape.lineTo(x + w, y + d - radius);
      shape.quadraticCurveTo(x + w, y + d, x + w - radius, y + d);
      shape.lineTo(x + radius, y + d);
      shape.quadraticCurveTo(x, y + d, x, y + d - radius);
      shape.lineTo(x, y + radius);
      shape.quadraticCurveTo(x, y, x + radius, y);

      return new THREE.ExtrudeGeometry(shape, {
        depth: h,
        bevelEnabled: true,
        bevelSegments: 4,
        steps: 1,
        bevelSize: radius * 0.7,
        bevelThickness: radius * 0.7,
      });
    }

    // Material definitions for soft clay
    const butterBookMat = new THREE.MeshStandardMaterial({
      color: 0xfde047, // Soft warm butter yellow (Bottom Book)
      roughness: 0.58,
      metalness: 0.04,
    });

    const peachBookMat = new THREE.MeshStandardMaterial({
      color: 0xfb923c, // Soft light peach orange ("Màu cam nhạt" Top Book)
      roughness: 0.56,
      metalness: 0.04,
    });

    const creamPagesMat = new THREE.MeshStandardMaterial({
      color: 0xfffdf7, // Cream Ivory Pages
      roughness: 0.8,
      metalness: 0.0,
    });

    const porcelainMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.35,
      metalness: 0.02,
    });

    const greenPlantMat = new THREE.MeshStandardMaterial({
      color: 0x4ade80, // Fresh Leaf Green Succulent
      roughness: 0.45,
      metalness: 0.05,
    });

    const lilacMat = new THREE.MeshStandardMaterial({
      color: 0xa78bfa, // Lilac crayon
      roughness: 0.6,
    });

    const skyBlueMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8, // Sky blue crayon
      roughness: 0.6,
    });

    const stickyMat = new THREE.MeshStandardMaterial({
      color: 0xfde047, // Bright yellow sticky note
      roughness: 0.7,
    });

    const ribbonMat = new THREE.MeshStandardMaterial({
      color: 0xef4444, // Red bookmark ribbon
      roughness: 0.4,
    });

    // --- A. BOTTOM BOOK (Butter Honey Yellow) ---
    const bottomBookGroup = new THREE.Group();
    bottomBookGroup.position.set(0.3, 0.18, 0.2);
    bottomBookGroup.rotation.y = -0.15;

    // Book Cover base
    const bCoverGeo = createRoundedBookGeometry(2.4, 0.36, 1.8, 0.08);
    bCoverGeo.center();
    const bottomBookMesh = new THREE.Mesh(bCoverGeo, butterBookMat);
    bottomBookMesh.castShadow = true;
    bottomBookMesh.receiveShadow = true;
    bottomBookGroup.add(bottomBookMesh);

    // Book Pages Block
    const bPagesGeo = new THREE.BoxGeometry(2.28, 0.28, 1.68);
    const bottomPagesMesh = new THREE.Mesh(bPagesGeo, creamPagesMat);
    bottomPagesMesh.position.set(0.04, 0, 0.04);
    bottomBookGroup.add(bottomPagesMesh);

    // Bookmark Ribbon
    const bRibbonGeo = new THREE.BoxGeometry(0.12, 0.02, 0.45);
    const bRibbon = new THREE.Mesh(bRibbonGeo, ribbonMat);
    bRibbon.position.set(0.6, -0.12, 0.95);
    bRibbon.rotation.x = 0.25;
    bottomBookGroup.add(bRibbon);

    scene.add(bottomBookGroup);
    sceneElementsRef.current.bottomBookMesh = bottomBookGroup;

    // --- B. TOP BOOK (Soft Light Peach Orange) ---
    const topBookGroup = new THREE.Group();
    topBookGroup.position.set(0.35, 0.58, 0.22);
    topBookGroup.rotation.y = 0.08;

    const tCoverGeo = createRoundedBookGeometry(2.3, 0.34, 1.75, 0.08);
    tCoverGeo.center();
    const topBookMesh = new THREE.Mesh(tCoverGeo, peachBookMat);
    topBookMesh.castShadow = true;
    topBookMesh.receiveShadow = true;
    topBookGroup.add(topBookMesh);

    // Pages
    const tPagesGeo = new THREE.BoxGeometry(2.18, 0.26, 1.62);
    const topPagesMesh = new THREE.Mesh(tPagesGeo, creamPagesMat);
    topPagesMesh.position.set(0.04, 0, 0.04);
    topBookGroup.add(topPagesMesh);

    // Top Bookmark Ribbon
    const tRibbonGeo = new THREE.BoxGeometry(0.12, 0.02, 0.4);
    const tRibbon = new THREE.Mesh(tRibbonGeo, ribbonMat);
    tRibbon.position.set(-0.5, 0.15, -0.9);
    tRibbon.rotation.x = -0.2;
    topBookGroup.add(tRibbon);

    // Architecture Pipeline Nodes inside the top book (visible when opened/exploded)
    const innerPagesGroup = new THREE.Group();
    innerPagesGroup.position.set(0, 0.25, 0);
    innerPagesGroup.visible = false;

    // 3 Mini Nodes (Client -> Gateway -> Database)
    const nodeMat1 = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.3 });
    const nodeMat2 = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.3 });
    const nodeMat3 = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.3 });

    const n1 = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.08, 24), nodeMat1);
    n1.position.set(-0.6, 0, 0);
    const n2 = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 0.35), nodeMat2);
    n2.position.set(0, 0, 0);
    const n3 = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 24), nodeMat3);
    n3.position.set(0.6, 0, 0);

    innerPagesGroup.add(n1, n2, n3);
    topBookGroup.add(innerPagesGroup);

    scene.add(topBookGroup);
    sceneElementsRef.current.topBookGroup = topBookGroup;
    sceneElementsRef.current.innerPagesGroup = innerPagesGroup;

    // --- C. PENCIL HOLDER CUBE (Left) ---
    const pencilCupGroup = new THREE.Group();
    pencilCupGroup.position.set(-1.6, 0.45, -0.6);

    // Ceramic beveled cube
    const cupMesh = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.9, 0.85), porcelainMat);
    cupMesh.castShadow = true;
    cupMesh.receiveShadow = true;
    pencilCupGroup.add(cupMesh);

    // Hollow top hole
    const cupHole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 0.35, 24),
      new THREE.MeshStandardMaterial({ color: 0xfed7aa, roughness: 0.8 })
    );
    cupHole.position.y = 0.32;
    pencilCupGroup.add(cupHole);

    // Lime/Apple green pencil sticking out
    const pencilGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.85, 16);
    const pencilMat = new THREE.MeshStandardMaterial({ color: 0x84cc16, roughness: 0.5 });
    const pencil = new THREE.Mesh(pencilGeo, pencilMat);
    pencil.position.set(0.08, 0.55, 0.04);
    pencil.rotation.z = 0.22;
    pencil.rotation.x = -0.15;
    pencil.castShadow = true;
    pencilCupGroup.add(pencil);

    // Pencil Tip (Wood + Graphite)
    const tipGeo = new THREE.ConeGeometry(0.08, 0.2, 16);
    const tipMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.7 });
    const tip = new THREE.Mesh(tipGeo, tipMat);
    tip.position.set(0.08, 1.05, 0.04);
    tip.rotation.z = 0.22;
    tip.rotation.x = -0.15;
    pencilCupGroup.add(tip);

    scene.add(pencilCupGroup);
    sceneElementsRef.current.pencilCupGroup = pencilCupGroup;

    // --- D. SUCCULENT PLANT IN ROUND CERAMIC POT (Right) ---
    const plantGroup = new THREE.Group();
    plantGroup.position.set(1.9, 0.38, -1.1);

    // White round ceramic pot
    const potGeo = new THREE.SphereGeometry(0.55, 32, 24);
    potGeo.scale(1, 0.8, 1);
    const pot = new THREE.Mesh(potGeo, porcelainMat);
    pot.castShadow = true;
    pot.receiveShadow = true;
    plantGroup.add(pot);

    // Soil
    const soilGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.08, 24);
    const soilMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
    const soil = new THREE.Mesh(soilGeo, soilMat);
    soil.position.y = 0.28;
    plantGroup.add(soil);

    // 4 Succulent Leaves
    for (let i = 0; i < 4; i++) {
      const leafGeo = new THREE.ConeGeometry(0.18, 0.55, 16);
      leafGeo.scale(1, 1, 0.45);
      const leaf = new THREE.Mesh(leafGeo, greenPlantMat);
      const angle = (i * Math.PI) / 2 + Math.PI / 4;
      leaf.position.set(Math.cos(angle) * 0.16, 0.45, Math.sin(angle) * 0.16);
      leaf.rotation.x = Math.sin(angle) * 0.5;
      leaf.rotation.z = -Math.cos(angle) * 0.5;
      leaf.rotation.y = angle;
      leaf.castShadow = true;
      plantGroup.add(leaf);
    }

    scene.add(plantGroup);
    sceneElementsRef.current.plantGroup = plantGroup;

    // --- E. FOREGROUND CRAYONS & STICKY NOTE ---
    // Lilac Crayon
    const lilacGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.95, 20);
    const lilacCrayon = new THREE.Mesh(lilacGeo, lilacMat);
    lilacCrayon.rotation.z = Math.PI / 2;
    lilacCrayon.rotation.y = 0.35;
    lilacCrayon.position.set(1.2, 0.09, 1.25);
    lilacCrayon.castShadow = true;
    scene.add(lilacCrayon);

    // Sky Blue Crayon
    const blueGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.85, 20);
    const blueCrayon = new THREE.Mesh(blueGeo, skyBlueMat);
    blueCrayon.rotation.z = Math.PI / 2;
    blueCrayon.rotation.y = -0.4;
    blueCrayon.position.set(1.1, 0.08, 1.6);
    blueCrayon.castShadow = true;
    scene.add(blueCrayon);

    // Yellow Post-it Sticky Note
    const stickyGeo = new THREE.BoxGeometry(0.7, 0.015, 0.7);
    const stickyMesh = new THREE.Mesh(stickyGeo, stickyMat);
    stickyMesh.position.set(-0.8, 0.01, 1.3);
    stickyMesh.rotation.y = 0.18;
    stickyMesh.castShadow = true;
    stickyMesh.receiveShadow = true;
    scene.add(stickyMesh);
    sceneElementsRef.current.stickyMesh = stickyMesh;

    // ==============================================================
    // 6. RAYCASTING INTERACTION (Pointer clicks)
    // ==============================================================
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const tipsList = [
      "Kiến trúc phân tán: Tối ưu tính sẵn sàng (Availability) và tính nhất quán (Consistency).",
      "Head First Design Patterns: Tư duy thiết kế mẫu hình trực quan và thực chiến.",
      "Database Sharding: Chia để trị dữ liệu lớn mà không nghẽn cổ chai.",
      "Event-Driven Architecture: Xử lý hàng triệu sự kiện phi đồng bộ ổn định.",
    ];
    let tipIdx = 0;

    function handlePointerDown(e) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      if (intersects.length > 0) {
        let obj = intersects[0].object;

        // Check if user clicked on plant
        if (plantGroup && (obj === pot || plantGroup.children.includes(obj))) {
          sceneElementsRef.current.plantWobble = 1.0;
          setActiveTip("🌿 Cây sen đá clay: Tương tác chạm kích hoạt hiệu ứng đàn hồi!");
          return;
        }

        // Check if user clicked on pencil cup
        if (pencilCupGroup && (obj === cupMesh || pencilCupGroup.children.includes(obj))) {
          sceneElementsRef.current.pencilBounce = 1.0;
          setActiveTip("✏️ Ống bút sứ: Bút tự động bật nảy khi tương tác!");
          return;
        }

        // Check if clicked sticky note
        if (obj === stickyMesh) {
          tipIdx = (tipIdx + 1) % tipsList.length;
          setActiveTip(`💡 Ghi chú kiến trúc: ${tipsList[tipIdx]}`);
          return;
        }

        // Check if clicked top book
        if (topBookGroup && (obj === topBookMesh || topBookGroup.children.includes(obj))) {
          setViewMode((prev) => (prev === "stacked" ? "open" : prev === "open" ? "exploded" : "stacked"));
          return;
        }
      }
    }

    renderer.domElement.addEventListener("pointerdown", handlePointerDown);

    // ==============================================================
    // 7. ANIMATION LOOP (Paused when off-screen or tab hidden)
    // ==============================================================
    let animId;
    let clock = new THREE.Clock();
    let isVisible = true;

    // Visibility Observer to completely pause rendering when scrolled past
    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
      },
      { threshold: 0.05 }
    );
    observer.observe(container);

    function onVisibilityChange() {
      if (document.hidden) {
        isVisible = false;
      } else {
        isVisible = true;
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    function animate() {
      animId = requestAnimationFrame(animate);

      // Save 100% GPU / CPU when not in viewport or tab hidden
      if (!isVisible) return;

      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      // Controls update for damping and auto-rotation
      controls.update();

      const el = sceneElementsRef.current;

      // Smooth Transitions for Book States
      if (el.topBookGroup) {
        if (el.isExploded) {
          el.topBookGroup.position.y += (1.45 - el.topBookGroup.position.y) * 0.1;
          el.topBookGroup.rotation.x += (-0.35 - el.topBookGroup.rotation.x) * 0.1;
          if (el.innerPagesGroup) el.innerPagesGroup.visible = true;
          if (el.bottomBookMesh) {
            el.bottomBookMesh.position.y += (-0.05 - el.bottomBookMesh.position.y) * 0.1;
          }
        } else if (el.isOpen) {
          el.topBookGroup.position.y += (0.85 - el.topBookGroup.position.y) * 0.1;
          el.topBookGroup.rotation.x += (-0.65 - el.topBookGroup.rotation.x) * 0.1;
          if (el.innerPagesGroup) el.innerPagesGroup.visible = true;
          if (el.bottomBookMesh) {
            el.bottomBookMesh.position.y += (0.18 - el.bottomBookMesh.position.y) * 0.1;
          }
        } else {
          el.topBookGroup.position.y += (0.58 - el.topBookGroup.position.y) * 0.1;
          el.topBookGroup.rotation.x += (0 - el.topBookGroup.rotation.x) * 0.1;
          if (el.innerPagesGroup) el.innerPagesGroup.visible = false;
          if (el.bottomBookMesh) {
            el.bottomBookMesh.position.y += (0.18 - el.bottomBookMesh.position.y) * 0.1;
          }
        }
      }

      // Spring Wobble on Plant
      if (el.plantWobble > 0.001) {
        const wobble = Math.sin(time * 24) * el.plantWobble * 0.25;
        if (plantGroup) plantGroup.rotation.z = wobble;
        el.plantWobble *= 0.92;
      }

      // Spring Bounce on Pencil
      if (el.pencilBounce > 0.001) {
        const bounce = Math.abs(Math.sin(time * 18)) * el.pencilBounce * 0.2;
        if (pencilCupGroup) pencilCupGroup.position.y = 0.45 + bounce;
        el.pencilBounce *= 0.91;
      }

      // Gentle floating animation for crayons
      lilacCrayon.rotation.z = Math.PI / 2 + Math.sin(time * 1.5) * 0.04;
      blueCrayon.rotation.z = Math.PI / 2 + Math.cos(time * 1.8) * 0.04;

      renderer.render(scene, camera);
    }

    animate();

    // ==============================================================
    // 8. RESIZE LISTENER
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

    // ==============================================================
    // 9. CLEANUP DISPOSAL
    // ==============================================================
    return () => {
      cancelAnimationFrame(animId);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("resize", handleResize);
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);

      controls.dispose();
      renderer.dispose();

      // Dispose geometries and materials
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
    <div className={`relative w-full aspect-[4/3] max-w-[620px] flex flex-col items-center select-none ${className}`}>
      {/* 3D WebGL Canvas Mount */}
      <div
        ref={mountRef}
        className="w-full h-full relative cursor-grab active:cursor-grabbing rounded-3xl overflow-hidden"
        title="Kéo chuột để xoay 3D • Cuộn để phóng to/thu nhỏ"
      />

      {/* Floating Info Pill */}
      <div className="absolute top-3 inset-x-3 pointer-events-none flex justify-center">
        <div className="px-3 py-1.5 rounded-full bg-white/90 dark:bg-slate-900/90 shadow-md text-xs font-medium text-slate-700 dark:text-slate-300 pointer-events-auto border border-orange-100 dark:border-white/10 flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-orange-500 shrink-0" />
          <span className="truncate max-w-[340px] sm:max-w-md">{activeTip}</span>
        </div>
      </div>

      {/* Modern 3D Mode & Rotation Controls */}
      <div className="absolute bottom-3 inset-x-3 flex items-center justify-between px-3.5 py-2 rounded-2xl bg-white/95 dark:bg-slate-900/95 shadow-lg border border-orange-100 dark:border-white/10 z-10">
        {/* View Mode Buttons */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          <button
            type="button"
            onClick={() => setViewMode("stacked")}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
              viewMode === "stacked"
                ? "bg-orange-500 text-white shadow-sm"
                : "bg-orange-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-orange-100"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Xếp chồng</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode("open")}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
              viewMode === "open"
                ? "bg-orange-500 text-white shadow-sm"
                : "bg-orange-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-orange-100"
            }`}
          >
            <Move3d className="w-3.5 h-3.5" />
            <span>Mở sách 3D</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode("exploded")}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
              viewMode === "exploded"
                ? "bg-orange-500 text-white shadow-sm"
                : "bg-orange-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-orange-100"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Bóc tách đa tầng</span>
          </button>
        </div>

        {/* Orbit / Auto-rotate Toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAutoRotate(!autoRotate)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${
              autoRotate
                ? "bg-orange-500 text-white shadow-sm"
                : "bg-orange-50 dark:bg-slate-800 text-orange-600 dark:text-orange-400 hover:bg-orange-100"
            }`}
            title="Bật/Tắt tự động xoay 360°"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${autoRotate ? "animate-spin" : ""}`} />
            <span className="hidden md:inline">Tự xoay 360°</span>
          </button>
        </div>
      </div>
    </div>
  );
}
