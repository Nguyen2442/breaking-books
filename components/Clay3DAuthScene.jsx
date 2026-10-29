"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Lightbulb, Key, RefreshCw, Sparkles, Monitor, RotateCcw } from "lucide-react";

/**
 * Unified Three.js 3D Claymorphic Auth Scene with 2 Distinct Styles:
 * - Mode "login": Developer's Engineering Workstation (standing desk, monitor, lamp, coffee, engineer)
 * - Mode "register": Knowledge Studio Launchpad (glowing golden Master Key, blueprint easel, book stack, gems)
 * - Frosted glass backdrop: completely open front, NO blocking wall, perfectly legible
 * - OrbitControls: Free 360° drag-to-rotate, zoom, and interactive click triggers
 */
export default function Clay3DAuthScene({
  mode = "login", // "login" | "register"
  className = "",
}) {
  const mountRef = useRef(null);
  const [lampOn, setLampOn] = useState(true);
  const [keyUnlocked, setKeyUnlocked] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [activeHint, setActiveHint] = useState(
    mode === "login"
      ? "Kéo chuột xoay 360° • Chạm đèn để bật/tắt • Chạm màn hình để đổi code"
      : "Kéo chuột xoay 360° • Chạm Master Key để mở khóa • Chạm bản vẽ kiến trúc"
  );

  const sceneRefs = useRef({
    controls: null,
    camera: null,
    loginGroup: null,
    registerGroup: null,
    lampLight: null,
    lampBulbMat: null,
    screenMat: null,
    keyGroup: null,
    gem1: null,
    gem2: null,
    keySpinBoost: 0,
    screenIdx: 0,
  });

  // Mode change handler: smoothly toggle visibility and turntable position
  useEffect(() => {
    const el = sceneRefs.current;
    if (el.loginGroup && el.registerGroup) {
      el.loginGroup.visible = mode === "login";
      el.registerGroup.visible = mode === "register";
    }
    setActiveHint(
      mode === "login"
        ? "Kéo chuột xoay 360° • Chạm đèn để bật/tắt • Chạm màn hình để đổi code"
        : "Kéo chuột xoay 360° • Chạm Master Key để mở khóa • Chạm bản vẽ kiến trúc"
    );
  }, [mode]);

  // Lamp state update
  useEffect(() => {
    const el = sceneRefs.current;
    if (el.lampLight) {
      el.lampLight.intensity = lampOn ? 2.5 : 0;
    }
    if (el.lampBulbMat) {
      el.lampBulbMat.emissive.set(lampOn ? 0xfef08a : 0x475569);
      el.lampBulbMat.emissiveIntensity = lampOn ? 1.5 : 0.1;
    }
  }, [lampOn]);

  // Key state update
  useEffect(() => {
    const el = sceneRefs.current;
    if (el.keyGroup) {
      el.keySpinBoost = keyUnlocked ? 3.5 : 0;
    }
  }, [keyUnlocked]);

  // Auto-rotate update
  useEffect(() => {
    const el = sceneRefs.current;
    if (el.controls) {
      el.controls.autoRotate = autoRotate;
    }
  }, [autoRotate]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let width = container.clientWidth || 460;
    let height = container.clientHeight || 460;

    // 1. SCENE & CAMERA - Perfectly angled front view, NO obstruction
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0.6, 2.9, 5.5);

    sceneRefs.current.camera = camera;

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

    // 3. CONTROLS
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 3.2;
    controls.maxDistance = 11;
    controls.maxPolarAngle = Math.PI / 2 + 0.05;
    controls.target.set(0, 0.9, 0);
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 1.2;
    sceneRefs.current.controls = controls;

    // 4. LIGHTS
    const ambientLight = new THREE.AmbientLight(0xfff7ed, 0.9);
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

    // Fill light from left
    const fillLight = new THREE.DirectionalLight(0xfed7aa, 1.0);
    fillLight.position.set(-5, 4, -3);
    scene.add(fillLight);

    // Lamp Point Light
    const lampLight = new THREE.PointLight(0xfef08a, lampOn ? 2.5 : 0, 8, 2);
    lampLight.position.set(-1.6, 2.3, 0.6);
    lampLight.castShadow = true;
    scene.add(lampLight);
    sceneRefs.current.lampLight = lampLight;

    // ==============================================================
    // 5. SHARED BASE PLATFORM & FROSTED GLASS BACKDROP (NO BLOCKING WALL)
    // ==============================================================

    // Soft Peach Clay Platform Dais
    const daisMat = new THREE.MeshStandardMaterial({
      color: 0xfb923c, // Màu cam nhạt
      roughness: 0.52,
      metalness: 0.05,
    });
    const dais = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.22, 64), daisMat);
    dais.position.y = -0.11;
    dais.receiveShadow = true;
    scene.add(dais);

    // Inset Cream Surface
    const insetMat = new THREE.MeshStandardMaterial({ color: 0xfff7ed, roughness: 0.75 });
    const inset = new THREE.Mesh(new THREE.CylinderGeometry(2.95, 2.95, 0.02, 64), insetMat);
    inset.position.y = 0.01;
    inset.receiveShadow = true;
    scene.add(inset);

    // Inset Concentric Ring in Soft Peach
    const ringMat = new THREE.MeshStandardMaterial({ color: 0xfed7aa, roughness: 0.5 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.03, 16, 64), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.03;
    scene.add(ring);

    // FROSTED GLASS BACKDROP:
    // Placed strictly in the BACK (z = -1.3) so it NEVER blocks the camera view!
    const frostedGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.15,
      transmission: 0.88,
      thickness: 0.4,
      transparent: true,
      opacity: 0.45,
      ior: 1.45,
    });

    // Sleek architectural frosted glass partition safely in the background
    const glassGeo = new THREE.BoxGeometry(2.6, 1.8, 0.04);
    const glassBackdrop = new THREE.Mesh(glassGeo, frostedGlassMat);
    glassBackdrop.position.set(0, 1.2, -1.3);
    glassBackdrop.receiveShadow = true;
    scene.add(glassBackdrop);

    // Thin metallic glass frame rim
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xfed7aa, metalness: 0.5, roughness: 0.3 });
    const topFrame = new THREE.Mesh(new THREE.BoxGeometry(2.64, 0.05, 0.06), frameMat);
    topFrame.position.set(0, 2.12, -1.3);
    scene.add(topFrame);

    // ==============================================================
    // 6. STYLE 1: SIGN IN WORKSTATION GROUP
    // ==============================================================
    const loginGroup = new THREE.Group();
    loginGroup.visible = mode === "login";

    // A. Wall Shelf with Books (attached behind glass)
    const shelfMat = new THREE.MeshStandardMaterial({ color: 0xfed7aa, roughness: 0.6 });
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.35), shelfMat);
    shelf.position.set(0.6, 2.05, -1.5);
    shelf.castShadow = true;
    loginGroup.add(shelf);

    const shelfColors = [0x38bdf8, 0xa78bfa, 0x4ade80, 0xfbbf24];
    shelfColors.forEach((color, i) => {
      const b = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.32, 0.25),
        new THREE.MeshStandardMaterial({ color, roughness: 0.5 })
      );
      b.position.set(0.1 + i * 0.16, 2.25, -1.5);
      b.castShadow = true;
      loginGroup.add(b);
    });

    // B. Electric Standing Desk (facing forward towards camera)
    const deskMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    const deskTop = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.08, 1.05), deskMat);
    deskTop.position.set(0.05, 1.25, -0.2);
    deskTop.castShadow = true;
    deskTop.receiveShadow = true;
    loginGroup.add(deskTop);

    // Desk Legs & Crossbar
    const legMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.6, roughness: 0.3 });
    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.25, 16), legMat);
    legL.position.set(-0.75, 0.625, -0.2);
    legL.castShadow = true;
    const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.25, 16), legMat);
    legR.position.set(0.85, 0.625, -0.2);
    legR.castShadow = true;
    loginGroup.add(legL, legR);

    // Desk Feet
    const footL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.8), legMat);
    footL.position.set(-0.75, 0.02, -0.2);
    const footR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.8), legMat);
    footR.position.set(0.85, 0.02, -0.2);
    loginGroup.add(footL, footR);

    // C. Ultrawide Computer Monitor (Clearly facing camera)
    const monitorStand = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.28, 16), legMat);
    monitorStand.position.set(0.05, 1.43, -0.4);
    loginGroup.add(monitorStand);

    const monitorFrame = new THREE.Mesh(
      new THREE.BoxGeometry(1.25, 0.62, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3 })
    );
    monitorFrame.position.set(0.05, 1.74, -0.4);
    monitorFrame.castShadow = true;
    loginGroup.add(monitorFrame);

    const screenMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.5,
      roughness: 0.2,
    });
    const screen = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.55, 0.01), screenMat);
    screen.position.set(0.05, 1.74, -0.365);
    loginGroup.add(screen);
    sceneRefs.current.screenMat = screenMat;

    // D. Ceramic Coffee Mug
    const mugMat = new THREE.MeshStandardMaterial({ color: 0xfb923c, roughness: 0.3 });
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.16, 20), mugMat);
    mug.position.set(0.8, 1.37, -0.05);
    mug.castShadow = true;
    loginGroup.add(mug);

    // E. Floor Lamp (Left, completely clear view)
    const lampGroup = new THREE.Group();
    lampGroup.position.set(-1.6, 0, 0.6);

    const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.04, 24), legMat);
    lampBase.position.y = 0.02;
    const lampPole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.2, 16), legMat);
    lampPole.position.y = 1.1;

    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfef08a,
      emissiveIntensity: lampOn ? 1.5 : 0.1,
      roughness: 0.2,
    });
    sceneRefs.current.lampBulbMat = bulbMat;

    const lampShade = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.48, 24, 1, true), bulbMat);
    lampShade.position.y = 2.25;
    lampShade.castShadow = true;

    lampGroup.add(lampBase, lampPole, lampShade);
    loginGroup.add(lampGroup);

    // F. Friendly Engineer Character (Prominently visible in front)
    const charGroup = new THREE.Group();
    charGroup.position.set(0.05, 0, 0.55);

    const pantsMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.7 });
    const leg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.9, 16), pantsMat);
    leg1.position.set(-0.14, 0.45, 0);
    const leg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.9, 16), pantsMat);
    leg2.position.set(0.14, 0.45, 0);
    leg1.castShadow = true;
    leg2.castShadow = true;
    charGroup.add(leg1, leg2);

    const shirtMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.6 });
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 0.65, 20), shirtMat);
    torso.position.y = 1.18;
    torso.castShadow = true;
    charGroup.add(torso);

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xfed7aa, roughness: 0.6 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 24, 20), skinMat);
    head.position.y = 1.62;
    head.castShadow = true;
    charGroup.add(head);

    const hairMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.19, 24, 20), hairMat);
    hair.position.set(0, 1.66, -0.02);
    charGroup.add(hair);

    loginGroup.add(charGroup);
    scene.add(loginGroup);
    sceneRefs.current.loginGroup = loginGroup;

    // ==============================================================
    // 7. STYLE 2: SIGN UP KNOWLEDGE STUDIO & MASTER KEY GROUP
    // ==============================================================
    const registerGroup = new THREE.Group();
    registerGroup.visible = mode === "register";

    // A. GIANT 3D GOLDEN MASTER KEY (Center Floating)
    const keyGroup = new THREE.Group();
    keyGroup.position.set(0, 1.75, 0.2);

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.85,
      roughness: 0.25,
      emissive: 0xd97706,
      emissiveIntensity: 0.25,
    });

    const keyRing = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.09, 24, 48), goldMat);
    keyRing.position.y = 0.65;
    keyRing.castShadow = true;
    keyGroup.add(keyRing);

    const star = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.19),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1 })
    );
    star.position.y = 0.65;
    keyGroup.add(star);

    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.25, 24), goldMat);
    stem.position.y = -0.1;
    stem.castShadow = true;
    keyGroup.add(stem);

    const tooth1 = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.08), goldMat);
    tooth1.position.set(0.17, -0.4, 0);
    const tooth2 = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.08), goldMat);
    tooth2.position.set(0.22, -0.6, 0);
    tooth1.castShadow = true;
    tooth2.castShadow = true;
    keyGroup.add(tooth1, tooth2);

    registerGroup.add(keyGroup);
    sceneRefs.current.keyGroup = keyGroup;

    // B. Architect Drafting Easel & Blueprint (Right, beautifully visible)
    const easelGroup = new THREE.Group();
    easelGroup.position.set(1.4, 0, -0.7);
    easelGroup.rotation.y = -0.3;

    const woodMat = new THREE.MeshStandardMaterial({ color: 0xfed7aa, roughness: 0.6 });
    const eLeg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 16), woodMat);
    eLeg1.position.set(-0.4, 1.1, -0.2);
    eLeg1.rotation.z = -0.15;
    const eLeg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 16), woodMat);
    eLeg2.position.set(0.4, 1.1, -0.2);
    eLeg2.rotation.z = 0.15;
    const eLeg3 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.3, 16), woodMat);
    eLeg3.position.set(0, 1.1, -0.7);
    eLeg3.rotation.x = -0.25;
    easelGroup.add(eLeg1, eLeg2, eLeg3);

    const board = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 1.0, 0.06),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })
    );
    board.position.set(0, 1.45, -0.18);
    board.rotation.x = -0.12;
    board.castShadow = true;
    easelGroup.add(board);

    const bp = new THREE.Mesh(
      new THREE.BoxGeometry(1.28, 0.88, 0.02),
      new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        emissive: 0x0284c7,
        emissiveIntensity: 0.3,
        roughness: 0.3,
      })
    );
    bp.position.set(0, 1.45, -0.14);
    bp.rotation.x = -0.12;
    easelGroup.add(bp);

    registerGroup.add(easelGroup);

    // C. Stack of 3 Minted Leather Books (Left Foreground)
    const bookStack = new THREE.Group();
    bookStack.position.set(-1.2, 0, 0.5);
    bookStack.rotation.y = 0.35;

    const b1 = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.24, 1.1),
      new THREE.MeshStandardMaterial({ color: 0x34d399, roughness: 0.5 })
    );
    b1.position.y = 0.12;
    b1.castShadow = true;

    const b2 = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 0.22, 1.0),
      new THREE.MeshStandardMaterial({ color: 0xa78bfa, roughness: 0.5 })
    );
    b2.position.set(0.04, 0.35, 0.02);
    b2.rotation.y = -0.1;
    b2.castShadow = true;

    const b3 = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.2, 0.95),
      new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.5 })
    );
    b3.position.set(0.08, 0.56, 0.04);
    b3.rotation.y = 0.15;
    b3.castShadow = true;

    bookStack.add(b1, b2, b3);
    registerGroup.add(bookStack);

    // D. Floating Gems
    const gem1 = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.24),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.45,
        roughness: 0.15,
      })
    );
    gem1.position.set(-1.5, 1.9, -0.4);
    registerGroup.add(gem1);
    sceneRefs.current.gem1 = gem1;

    const gem2 = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.18),
      new THREE.MeshStandardMaterial({
        color: 0xfde047,
        emissive: 0xfde047,
        emissiveIntensity: 0.4,
        roughness: 0.15,
      })
    );
    gem2.position.set(1.7, 2.3, 0.3);
    registerGroup.add(gem2);
    sceneRefs.current.gem2 = gem2;

    scene.add(registerGroup);
    sceneRefs.current.registerGroup = registerGroup;

    // ==============================================================
    // 8. RAYCASTING INTERACTION
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

        // Lamp
        if (obj === lampShade || lampGroup.children.includes(obj)) {
          setLampOn((prev) => !prev);
          setActiveHint("💡 Đèn studio: Đã chuyển đổi trạng thái chiếu sáng!");
          return;
        }

        // Screen
        if (obj === screen || obj === monitorFrame) {
          sceneRefs.current.screenIdx = (sceneRefs.current.screenIdx + 1) % screens.length;
          const cur = screens[sceneRefs.current.screenIdx];
          if (screenMat) screenMat.emissive.set(cur.color);
          setActiveHint(`🖥️ Màn hình làm việc: ${cur.name}`);
          return;
        }

        // Master Key
        if (obj === keyRing || obj === star || obj === stem || obj === tooth1 || obj === tooth2) {
          setKeyUnlocked((prev) => !prev);
          setActiveHint("🗝️ Master Key: Đã kích hoạt hiệu ứng quay năng lượng mở khóa!");
          return;
        }

        // Blueprint
        if (obj === bp || obj === board) {
          setActiveHint("📐 Bản vẽ kiến trúc: Sơ đồ hệ thống phân tán đa tầng.");
          return;
        }
      }
    }

    renderer.domElement.addEventListener("pointerdown", handlePointerDown);

    // ==============================================================
    // 9. ANIMATION LOOP
    // ==============================================================
    let animId;
    let clock = new THREE.Clock();

    function animate() {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      controls.update();

      const el = sceneRefs.current;

      // Engineer idle motion
      if (torso && head) {
        torso.position.y = 1.18 + Math.sin(time * 2) * 0.01;
        head.position.y = 1.62 + Math.sin(time * 2) * 0.01;
      }

      // Master Key Floating & Rotating
      if (el.keyGroup) {
        el.keyGroup.position.y = 1.75 + Math.sin(time * 2.5) * 0.12;
        const speed = 0.8 + el.keySpinBoost;
        el.keyGroup.rotation.y += delta * speed;
        if (el.keySpinBoost > 0) el.keySpinBoost *= 0.96;
      }

      // Gems spin
      if (gem1) {
        gem1.rotation.x = time * 0.8;
        gem1.rotation.y = time * 1.2;
        gem1.position.y = 1.9 + Math.sin(time * 2.0) * 0.08;
      }
      if (gem2) {
        gem2.rotation.x = time * 1.0;
        gem2.rotation.z = time * 0.7;
        gem2.position.y = 2.3 + Math.cos(time * 1.8) * 0.06;
      }

      renderer.render(scene, camera);
    }

    animate();

    // ==============================================================
    // 10. RESIZE & DISPOSAL
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
      {/* 3D WebGL Canvas */}
      <div
        ref={mountRef}
        className="w-full h-full relative cursor-grab active:cursor-grabbing rounded-3xl overflow-hidden"
        title="Kéo chuột xoay 360° tự do • Cuộn phóng to/thu nhỏ"
      />

      {/* Floating Info Pill */}
      <div className="absolute top-2 inset-x-2 pointer-events-none flex justify-center">
        <div className="px-3 py-1 rounded-full bg-white/90 dark:bg-slate-900/90 shadow text-xs font-medium text-slate-700 dark:text-slate-300 pointer-events-auto border border-orange-100 dark:border-white/10 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-orange-500 shrink-0" />
          <span className="truncate max-w-[320px]">{activeHint}</span>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-2 inset-x-2 flex items-center justify-between px-3 py-1.5 rounded-2xl bg-white/95 dark:bg-slate-900/95 shadow-md border border-orange-100 dark:border-white/10 z-10">
        {mode === "login" ? (
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
        ) : (
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
            <span>{keyUnlocked ? "Master Key: Mở" : "Mở khóa Key"}</span>
          </button>
        )}

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
