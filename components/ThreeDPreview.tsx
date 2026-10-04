import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
import { Unit, ProfileSystem, WindowNode } from '../types';

export interface ThreeDPreviewHandle {
  captureSnapshot: (whiteBg?: boolean) => string | null;
  resetView: () => void;
  setAngle: (yaw: number, pitch?: number) => void;
  rotateY: (delta: number) => void;
}

interface ThreeDPreviewProps {
  unit: Unit;
  system: ProfileSystem;
  scale?: number;
  backgroundColor?: string;
  onAngleChange?: (yaw: number) => void;
  onSnapshotReady?: (dataUrl: string) => void;
}

const getProfileHexColor = (colorKey?: string, specificColor?: string): number => {
  const combined = `${specificColor || ''} ${colorKey || ''}`.toLowerCase();
  if (combined.includes('9016') || combined.includes('beyaz') || combined.includes('white')) return 0xf8fafc;
  if (combined.includes('7016') || combined.includes('antrasit') || combined.includes('anthracite')) return 0x334155;
  if (combined.includes('9005') || combined.includes('siyah') || combined.includes('black')) return 0x18181b;
  if (combined.includes('bronze') || combined.includes('bronz')) return 0x78553d;
  if (combined.includes('wood') || combined.includes('ahsap') || combined.includes('ahşap')) return 0x854d0e;
  if (combined.includes('pres') || combined.includes('ham') || combined.includes('raw')) return 0x94a3b8;
  if (combined.includes('9006') || combined.includes('silver') || combined.includes('gümüş')) return 0xcfd6dc;
  if (combined.includes('eloxal') || combined.includes('eloksal')) return 0x64748b;
  return 0x475569;
};

const ThreeDPreview = forwardRef<ThreeDPreviewHandle, ThreeDPreviewProps>(({
  unit,
  system,
  scale = 0.20,
  backgroundColor = '#f8fafc',
  onAngleChange,
  onSnapshotReady
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animationFrameRef = useRef<number>(0);
  const groupRef = useRef<THREE.Group | null>(null);

  useImperativeHandle(ref, () => ({
    captureSnapshot: (whiteBg = true): string | null => {
      if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return null;
      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      const prevBg = scene.background;
      
      if (whiteBg) {
        scene.background = new THREE.Color(0xffffff);
      }
      renderer.render(scene, camera);
      const dataUrl = renderer.domElement.toDataURL('image/png', 1.0);
      
      scene.background = prevBg;
      renderer.render(scene, camera);
      return dataUrl;
    },
    resetView: () => {
      if (groupRef.current && cameraRef.current) {
        groupRef.current.rotation.set(0, 0, 0);
        const maxDim = Math.max(unit.width, unit.height);
        cameraRef.current.position.set(maxDim * 0.55, maxDim * 0.35, maxDim * 2.8);
        cameraRef.current.lookAt(0, 0, 0);
        onAngleChange?.(0);
      }
    },
    setAngle: (yaw: number, pitch = 0) => {
      if (groupRef.current) {
        groupRef.current.rotation.y = yaw;
        groupRef.current.rotation.x = pitch;
        onAngleChange?.(yaw);
      }
    },
    rotateY: (delta: number) => {
      if (groupRef.current) {
        groupRef.current.rotation.y += delta;
        onAngleChange?.(groupRef.current.rotation.y);
      }
    }
  }));

  useEffect(() => {
    if (groupRef.current) {
      const s = scale * 5; 
      const isExterior = unit.viewPerspective === 'exterior';
      groupRef.current.scale.set(isExterior ? -s : s, s, s);
    }
  }, [scale, unit.viewPerspective]);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(backgroundColor); 
    sceneRef.current = scene;

    const width = containerRef.current.clientWidth || 600;
    const height = containerRef.current.clientHeight || 500;
    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 100000);
    
    const maxDim = Math.max(unit.width, unit.height);
    camera.position.set(maxDim * 0.55, maxDim * 0.35, maxDim * 2.8);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true, 
      preserveDrawingBuffer: true 
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.3);
    mainLight.position.set(maxDim * 1.2, maxDim * 1.5, maxDim * 1.8);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 1024;
    mainLight.shadow.mapSize.height = 1024;
    mainLight.shadow.camera.left = -maxDim * 1.2;
    mainLight.shadow.camera.right = maxDim * 1.2;
    mainLight.shadow.camera.top = maxDim * 1.2;
    mainLight.shadow.camera.bottom = -maxDim * 1.2;
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0xe0f2fe, 0.6);
    fillLight.position.set(-maxDim, -maxDim * 0.5, maxDim);
    scene.add(fillLight);

    const backLight = new THREE.DirectionalLight(0xffffff, 0.4);
    backLight.position.set(0, maxDim, -maxDim);
    scene.add(backLight);

    const aluHex = getProfileHexColor(unit.color, unit.specificColor);
    const aluminumMaterial = new THREE.MeshStandardMaterial({
      color: aluHex,
      metalness: 0.85,
      roughness: 0.22,
    });

    const thresholdMaterial = new THREE.MeshStandardMaterial({
      color: 0xd97706, // Architectural satin amber/gold
      metalness: 0.95,
      roughness: 0.15,
      emissive: 0x451a03,
    });

    const glassMaterial = new THREE.MeshStandardMaterial({
      color: 0x38bdf8, 
      transparent: true,
      opacity: 0.35,
      metalness: 0.25,
      roughness: 0.05,
      side: THREE.DoubleSide
    });

    // Technical Dashed Lines for Opening direction
    const symbolMaterial = new THREE.LineDashedMaterial({ 
      color: 0x0f172a,
      dashSize: 30,
      gapSize: 20,
      linewidth: 2,
    });

    const hardwareMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.95,
      roughness: 0.1,
    });

    const group = new THREE.Group();
    groupRef.current = group;
    const s = scale * 5;
    const isExterior = unit.viewPerspective === 'exterior';
    group.scale.set(isExterior ? -s : s, s, s);

    const centerX = unit.width / 2;
    const centerY = unit.height / 2;

    const createProfile = (w: number, h: number, d: number, x: number, y: number, z: number, isSash = false, isThresholdProfile = false) => {
      const pGroup = new THREE.Group();
      
      const currentMat = isThresholdProfile ? thresholdMaterial : aluminumMaterial;
      const bodyGeo = new THREE.BoxGeometry(w, h, d);
      const body = new THREE.Mesh(bodyGeo, currentMat);
      body.castShadow = true;
      body.receiveShadow = true;
      pGroup.add(body);

      const stepD = d * 0.4;
      const stepW = isSash ? Math.max(1, w - 10) : Math.max(1, w - 20); 
      const stepH = isSash ? Math.max(1, h - 10) : Math.max(1, h - 20);
      const stepGeo = new THREE.BoxGeometry(stepW, stepH, stepD);
      const step = new THREE.Mesh(stepGeo, currentMat);
      step.position.z = d/2 + stepD/2 - 2; 
      pGroup.add(step);

      pGroup.position.set(x, y, z);
      return pGroup;
    };

    const createHandle = (x: number, y: number, z: number, isLeft: boolean) => {
      const hGroup = new THREE.Group();
      const baseGeo = new THREE.BoxGeometry(15, 45, 8);
      const base = new THREE.Mesh(baseGeo, hardwareMaterial);
      hGroup.add(base);
      const handleGeo = new THREE.BoxGeometry(isLeft ? 50 : -50, 10, 10);
      const handle = new THREE.Mesh(handleGeo, hardwareMaterial);
      handle.position.set(isLeft ? 15 : -15, 0, 15);
      hGroup.add(handle);
      const connGeo = new THREE.CylinderGeometry(4, 4, 15, 12);
      const conn = new THREE.Mesh(connGeo, hardwareMaterial);
      conn.rotation.x = Math.PI / 2;
      conn.position.z = 8;
      hGroup.add(conn);
      hGroup.position.set(x, y, z);
      return hGroup;
    };

    const createHinge = (x: number, y: number, z: number) => {
      const hingeGeo = new THREE.CylinderGeometry(5, 5, 30, 16);
      const hinge = new THREE.Mesh(hingeGeo, hardwareMaterial);
      hinge.position.set(x, y, z);
      return hinge;
    };

    const createOpeningSymbol = (gw: number, gh: number, type: string, x: number, y: number, z: number) => {
      const sGroup = new THREE.Group();
      const dashZ = z + 2.5; 
      const hw = gw / 2;
      const hh = gh / 2;

      const addLine = (points: THREE.Vector3[], dashed = true) => {
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, symbolMaterial);
        if (dashed) line.computeLineDistances();
        sGroup.add(line);
      };

      if (type.includes('sliding')) {
        const arrowLen = gw * 0.3;
        addLine([
          new THREE.Vector3(-arrowLen/2, 0, 0),
          new THREE.Vector3(arrowLen/2, 0, 0),
          new THREE.Vector3(arrowLen/2 - 20, 15, 0),
          new THREE.Vector3(arrowLen/2, 0, 0),
          new THREE.Vector3(arrowLen/2 - 20, -15, 0)
        ], false);
      } else {
        if (type.includes('left')) {
          addLine([new THREE.Vector3(-hw, -hh, 0), new THREE.Vector3(hw, 0, 0), new THREE.Vector3(-hw, hh, 0)]);
        } else if (type.includes('right')) {
          addLine([new THREE.Vector3(hw, -hh, 0), new THREE.Vector3(-hw, 0, 0), new THREE.Vector3(hw, hh, 0)]);
        }

        if (type.includes('tilt')) {
          addLine([new THREE.Vector3(-hw, -hh, 0), new THREE.Vector3(0, hh, 0), new THREE.Vector3(hw, -hh, 0)]);
        }
      }

      sGroup.position.set(x, y, dashZ);
      return sGroup;
    };

    const buildModel = (node: WindowNode, xOffset: number, yOffset: number, w: number, h: number) => {
      const profileDepth = 65; 
      const frameW = system.frameWidth;

      if (node.type === 'container' && node.children && node.children.length === 2 && node.splitRatio) {
        const isVert = node.direction === 'vertical';
        const avail = isVert ? w - frameW : h - frameW;
        const s1 = avail * node.splitRatio[0];
        const s2 = avail * node.splitRatio[1];
        const mx = isVert ? xOffset + s1 : xOffset;
        const my = isVert ? yOffset : yOffset + s1;
        const mw = isVert ? frameW : w;
        const mh = isVert ? h : frameW;
        group.add(createProfile(mw, mh, profileDepth, mx + mw/2 - centerX, centerY - (my + mh/2), 0));
        buildModel(node.children[0], xOffset, yOffset, isVert ? s1 : w, isVert ? h : s1);
        buildModel(node.children[1], isVert ? xOffset + s1 + frameW : xOffset, isVert ? yOffset : yOffset + s1 + frameW, isVert ? s2 : w, isVert ? h : s2);
      } else {
        if (node.type === 'void') return;
        const isOpening = node.openingType && node.openingType !== 'fixed';
        
        const leftFw = xOffset === 0 ? frameW : 0;
        const rightFw = (xOffset + w >= unit.width - 1) ? frameW : 0;
        const topFw = yOffset === 0 ? frameW : 0;
        const currentBottomFw = (yOffset + h >= unit.height - 1) 
          ? (unit.hasThreshold ? bottomFw : frameW) 
          : 0;

        const daylightX = xOffset + leftFw;
        const daylightY = yOffset + topFw;
        const daylightW = Math.max(0, w - leftFw - rightFw);
        const daylightH = Math.max(0, h - topFw - currentBottomFw);

        if (isOpening) {
          const sashW = 65;
          const zPos = 15; 
          group.add(createProfile(daylightW, sashW, profileDepth, daylightX + daylightW/2 - centerX, centerY - (daylightY + sashW/2), zPos, true));
          group.add(createProfile(daylightW, sashW, profileDepth, daylightX + daylightW/2 - centerX, centerY - (daylightY + daylightH - sashW/2), zPos, true));
          group.add(createProfile(sashW, daylightH, profileDepth, daylightX + sashW/2 - centerX, centerY - (daylightY + daylightH/2), zPos, true));
          group.add(createProfile(sashW, daylightH, profileDepth, daylightX + daylightW - sashW/2 - centerX, centerY - (daylightY + daylightH/2), zPos, true));
          
          const gw = daylightW - 2 * sashW;
          const gh = daylightH - 2 * sashW;
          const glassGeo = new THREE.BoxGeometry(gw + 5, gh + 5, 10);
          const glass = new THREE.Mesh(glassGeo, glassMaterial);
          const gx = daylightX + daylightW/2 - centerX;
          const gy = centerY - (daylightY + daylightH/2);
          const gz = zPos + profileDepth/2;
          glass.position.set(gx, gy, gz);
          group.add(glass);

          if (node.openingType) {
            group.add(createOpeningSymbol(gw, gh, node.openingType, gx, gy, gz + 6));
          }

          if (node.openingType.includes('sliding')) {
            group.add(createHandle(gx - gw/2 + 20, gy, gz + 15, false));
          } else if (node.openingType.includes('left')) {
            group.add(createHandle(gx + gw/2 - 10, gy, gz + 15, true));
            group.add(createHinge(gx - gw/2 - 20, gy + gh/2 - 40, gz));
            group.add(createHinge(gx - gw/2 - 20, gy - gh/2 + 40, gz));
          } else if (node.openingType.includes('right')) {
            group.add(createHandle(gx - gw/2 + 10, gy, gz + 15, false));
            group.add(createHinge(gx + gw/2 + 20, gy + gh/2 - 40, gz));
            group.add(createHinge(gx + gw/2 + 20, gy - gh/2 + 40, gz));
          } else if (node.openingType === 'tilt') {
            group.add(createHandle(gx, gy - gh/2 + 10, gz + 15, false));
            group.add(createHinge(gx - gw/2 + 40, gy - gh/2 - 20, gz));
            group.add(createHinge(gx + gw/2 - 40, gy - gh/2 - 20, gz));
          }
        } else {
          const glassGeo = new THREE.BoxGeometry(daylightW + 5, daylightH + 5, 10);
          const glass = new THREE.Mesh(glassGeo, glassMaterial);
          const gx = daylightX + daylightW/2 - centerX;
          const gy = centerY - (daylightY + daylightH/2);
          const gz = profileDepth/2 - 5;
          glass.position.set(gx, gy, gz);
          group.add(glass);
        }
      }
    };

    const frameW = system.frameWidth;
    const profileDepth = 65; 
    const bottomFw = unit.hasThreshold ? 15 : frameW;

    // Top profile
    group.add(createProfile(unit.width, frameW, profileDepth, 0, centerY - frameW/2, 0));

    // Bottom profile (Standard or Threshold)
    if (unit.hasThreshold) {
      group.add(createProfile(unit.width, bottomFw, profileDepth, 0, -(centerY - bottomFw/2), 0, false, true));
    } else {
      group.add(createProfile(unit.width, frameW, profileDepth, 0, -(centerY - frameW/2), 0));
    }

    // Left & Right profiles
    const lrHeight = unit.hasThreshold ? unit.height - bottomFw : unit.height;
    const lrY = unit.hasThreshold ? (bottomFw / 2) : 0;
    group.add(createProfile(frameW, lrHeight, profileDepth, -(centerX - frameW/2), lrY, 0));
    group.add(createProfile(frameW, lrHeight, profileDepth, (centerX - frameW/2), lrY, 0));

    buildModel(unit.rootNode, 0, 0, unit.width, unit.height);
    scene.add(group);

    const animate = () => {
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animate();

    let isDragging = false;
    let prevX = 0;
    let prevY = 0;
    const onMouseDown = (e: MouseEvent) => { 
      isDragging = true; 
      prevX = e.clientX; 
      prevY = e.clientY; 
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = (e.clientX - prevX) * 0.01;
      const deltaY = (e.clientY - prevY) * 0.005;
      group.rotation.y += deltaX;
      group.rotation.x = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, group.rotation.x + deltaY));
      prevX = e.clientX;
      prevY = e.clientY;
      onAngleChange?.(group.rotation.y);
    };
    const onMouseUp = () => { isDragging = false; };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (cameraRef.current) {
        cameraRef.current.position.z += e.deltaY * 0.6;
        const maxLimit = maxDim * 6;
        const minLimit = maxDim * 0.8;
        cameraRef.current.position.z = Math.max(minLimit, Math.min(maxLimit, cameraRef.current.position.z));
      }
    };

    const containerEl = containerRef.current;
    containerEl.addEventListener('mousedown', onMouseDown);
    containerEl.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // Initial render
    renderer.render(scene, camera);

    let snapTimer: any = null;
    if (onSnapshotReady) {
      snapTimer = setTimeout(() => {
        if (rendererRef.current && sceneRef.current && cameraRef.current) {
          const prevBg = sceneRef.current.background;
          sceneRef.current.background = new THREE.Color(0xffffff);
          rendererRef.current.render(sceneRef.current, cameraRef.current);
          const snap = rendererRef.current.domElement.toDataURL('image/png', 1.0);
          sceneRef.current.background = prevBg;
          rendererRef.current.render(sceneRef.current, cameraRef.current);
          if (snap && snap.length > 100) {
            onSnapshotReady(snap);
          }
        }
      }, 250);
    }

    return () => {
      if (snapTimer) clearTimeout(snapTimer);
      cancelAnimationFrame(animationFrameRef.current);
      containerEl.removeEventListener('mousedown', onMouseDown);
      containerEl.removeEventListener('wheel', onWheel);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (rendererRef.current && containerEl) {
        try {
          containerEl.removeChild(rendererRef.current.domElement);
          rendererRef.current.dispose();
        } catch (e) {
          // ignore cleanup errors
        }
      }
    };
  }, [unit, system, backgroundColor]);

  return <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing select-none" />;
});

ThreeDPreview.displayName = 'ThreeDPreview';

export default ThreeDPreview;
