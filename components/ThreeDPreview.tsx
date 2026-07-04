
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Unit, ProfileSystem, WindowNode } from '../types';

interface ThreeDPreviewProps {
  unit: Unit;
  system: ProfileSystem;
  scale?: number;
}

const ThreeDPreview: React.FC<ThreeDPreviewProps> = ({ unit, system, scale = 0.20 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animationFrameRef = useRef<number>(0);
  const groupRef = useRef<THREE.Group | null>(null);

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
    scene.background = new THREE.Color(0xf1f5f9); 
    sceneRef.current = scene;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 100000);
    
    const maxDim = Math.max(unit.width, unit.height);
    camera.position.set(maxDim * 0.6, maxDim * 0.4, maxDim * 2.8);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
    mainLight.position.set(maxDim, maxDim, maxDim);
    mainLight.castShadow = true;
    mainLight.shadow.camera.left = -maxDim;
    mainLight.shadow.camera.right = maxDim;
    mainLight.shadow.camera.top = maxDim;
    mainLight.shadow.camera.bottom = -maxDim;
    scene.add(mainLight);

    const aluminumMaterial = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.9,
      roughness: 0.1,
    });

    const thresholdMaterial = new THREE.MeshStandardMaterial({
      color: 0xeab308, // Bright architectural amber/gold
      metalness: 0.95,
      roughness: 0.1,
      emissive: 0x78350f, // Rich amber/bronze warm glow
    });

    const glassMaterial = new THREE.MeshStandardMaterial({
      color: 0xbae6fd, 
      transparent: true,
      opacity: 0.4,
      metalness: 0.2,
      roughness: 0.05,
      side: THREE.DoubleSide
    });

    // Teknik Kesikli Çizgi Materyali
    const symbolMaterial = new THREE.LineDashedMaterial({ 
      color: 0x1e293b,
      dashSize: 30,
      gapSize: 20,
      linewidth: 1,
    });

    const hardwareMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 1.0,
      roughness: 0.0,
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
      const stepW = isSash ? w - 10 : w - 20; 
      const stepH = isSash ? h - 10 : h - 20;
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
        // TURN (Yan Açılım) - Sola veya Sağa
        if (type.includes('left')) {
          addLine([new THREE.Vector3(-hw, -hh, 0), new THREE.Vector3(hw, 0, 0), new THREE.Vector3(-hw, hh, 0)]);
        } else if (type.includes('right')) {
          addLine([new THREE.Vector3(hw, -hh, 0), new THREE.Vector3(-hw, 0, 0), new THREE.Vector3(hw, hh, 0)]);
        }

        // TILT (Vasistas) - Çift açılım veya tek vasistas durumunda
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

    // Left & Right profiles sitting perfectly on bottom line
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
    const onMouseDown = (e: MouseEvent) => { isDragging = true; prevX = e.clientX; };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      group.rotation.y += (e.clientX - prevX) * 0.01;
      prevX = e.clientX;
    };
    const onMouseUp = () => isDragging = false;

    containerRef.current.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      cancelAnimationFrame(animationFrameRef.current);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
      }
    };
  }, [unit, system]);

  return <div ref={containerRef} className="w-full h-full cursor-move" />;
};

export default ThreeDPreview;
