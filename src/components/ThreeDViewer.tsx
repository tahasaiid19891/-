/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Shield, Upload, RotateCw, RefreshCw, Layers, Cpu, Box } from 'lucide-react';

// Custom STL Parsers (ASCII + Binary)
function parseSTL(buffer: ArrayBuffer): THREE.BufferGeometry {
  const isBinary = checkIfBinary(buffer);
  if (isBinary) {
    return parseBinarySTL(buffer);
  } else {
    const text = new TextDecoder().decode(buffer);
    return parseAsciiSTL(text);
  }
}

function checkIfBinary(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 84) return false;
  const reader = new DataView(buffer);
  const numFaces = reader.getUint32(80, true);
  const expectedSize = 80 + 4 + numFaces * 50;
  return buffer.byteLength === expectedSize;
}

function parseBinarySTL(buffer: ArrayBuffer): THREE.BufferGeometry {
  const reader = new DataView(buffer);
  const numFaces = reader.getUint32(80, true);
  
  const positions = new Float32Array(numFaces * 9);
  const normals = new Float32Array(numFaces * 9);
  
  let offset = 84;
  for (let face = 0; face < numFaces; face++) {
    if (offset + 50 > buffer.byteLength) break;
    
    // Read normal
    const nx = reader.getFloat32(offset, true);
    const ny = reader.getFloat32(offset + 4, true);
    const nz = reader.getFloat32(offset + 8, true);
    offset += 12;
    
    // Read 3 vertices
    for (let i = 0; i < 3; i++) {
      const vx = reader.getFloat32(offset, true);
      const vy = reader.getFloat32(offset + 4, true);
      const vz = reader.getFloat32(offset + 8, true);
      offset += 12;
      
      const idx = face * 9 + i * 3;
      positions[idx] = vx;
      positions[idx + 1] = vy;
      positions[idx + 2] = vz;
      
      normals[idx] = nx;
      normals[idx + 1] = ny;
      normals[idx + 2] = nz;
    }
    
    offset += 2; // skip attributes
  }
  
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function parseAsciiSTL(text: string): THREE.BufferGeometry {
  const normalPattern = /facet\s+normal\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)/i;
  const vertexPattern = /vertex\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)/i;
  
  const lines = text.split('\n');
  let currentNormal = [0, 0, 0];
  const positions: number[] = [];
  const normals: number[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('facet normal')) {
      const match = normalPattern.exec(line);
      if (match) {
        currentNormal = [parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3])];
      }
    } else if (line.startsWith('vertex')) {
      const match = vertexPattern.exec(line);
      if (match) {
        positions.push(parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3]));
        normals.push(currentNormal[0], currentNormal[1], currentNormal[2]);
      }
    }
  }
  
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
  geometry.computeVertexNormals();
  return geometry;
}

export default function ThreeDViewer() {
  const mountRef = useRef<HTMLDivElement>(null);
  
  // Custom states
  const [modelName, setModelName] = useState<string>('طائرة الاستطلاع DJI (طراز محاكاة)');
  const [trianglesCount, setTrianglesCount] = useState<number>(0);
  const [themeMode, setThemeMode] = useState<'hologram' | 'solid'>('hologram');
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  
  // ThreeJS refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const modelGroupRef = useRef<THREE.Group | null>(null);
  const customModelRef = useRef<THREE.Mesh | null>(null);
  const defaultDroneRef = useRef<THREE.Group | null>(null);
  const rotorsRef = useRef<THREE.Mesh[]>([]);

  // Drag interaction variables
  const isMouseDown = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });

  // 1. Build and Maintain Three Scene
  useEffect(() => {
    if (!mountRef.current) return;

    // SCENE
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#040e0a');
    sceneRef.current = scene;

    // CAMERA
    const width = mountRef.current.clientWidth || 500;
    const height = mountRef.current.clientHeight || 400;
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 15, 30);
    cameraRef.current = camera;

    // RENDERER
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // LIGHTS
    const ambientLight = new THREE.AmbientLight('#1b4332', 1.5);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight('#52b788', 2);
    dirLight1.position.set(20, 40, 20);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight('#4ade80', 1);
    dirLight2.position.set(-20, -10, -20);
    scene.add(dirLight2);

    // TACTICAL GRID & HELPERS
    const gridHelper = new THREE.GridHelper(50, 50, '#2d6a4f', '#1b4332');
    gridHelper.position.y = -5;
    scene.add(gridHelper);

    // MAIN GROUP
    const mainGroup = new THREE.Group();
    scene.add(mainGroup);
    modelGroupRef.current = mainGroup;

    // DEFAULT DJI DRONE PRIMITIVE MODEL
    const defaultDrone = buildDefaultDrone();
    mainGroup.add(defaultDrone);
    defaultDroneRef.current = defaultDrone;

    // CAMERA FOCUS
    camera.lookAt(new THREE.Vector3(0, 0, 0));

    // ANIMATION LOOP
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);

      // Spin propellers
      if (rotorsRef.current.length > 0) {
        rotorsRef.current.forEach((rotor) => {
          rotor.rotation.y += 0.3;
        });
      }

      // Auto rotation
      if (autoRotate && !isMouseDown.current) {
        mainGroup.rotation.y += 0.005;
      }

      renderer.render(scene, camera);
    };
    animate();

    // Native Drag and Touch interaction listeners
    const element = mountRef.current;

    const onMouseDown = (e: MouseEvent) => {
      isMouseDown.current = true;
      setIsDragging(true);
      previousMousePosition.current = {
        x: e.clientX,
        y: e.clientY
      };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isMouseDown.current || !modelGroupRef.current) return;
      const deltaMove = {
        x: e.clientX - previousMousePosition.current.x,
        y: e.clientY - previousMousePosition.current.y
      };

      modelGroupRef.current.rotation.y += deltaMove.x * 0.007;
      modelGroupRef.current.rotation.x += deltaMove.y * 0.007;

      previousMousePosition.current = {
        x: e.clientX,
        y: e.clientY
      };
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      isMouseDown.current = true;
      setIsDragging(true);
      previousMousePosition.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      };
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isMouseDown.current || !modelGroupRef.current || e.touches.length === 0) return;
      const deltaMove = {
        x: e.touches[0].clientX - previousMousePosition.current.x,
        y: e.touches[0].clientY - previousMousePosition.current.y
      };

      modelGroupRef.current.rotation.y += deltaMove.x * 0.007;
      modelGroupRef.current.rotation.x += deltaMove.y * 0.007;

      previousMousePosition.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      };
    };

    const onDragEnd = () => {
      isMouseDown.current = false;
      setIsDragging(false);
    };

    if (element) {
      element.addEventListener('mousedown', onMouseDown);
      element.addEventListener('mousemove', onMouseMove);
      element.addEventListener('mouseup', onDragEnd);
      element.addEventListener('mouseleave', onDragEnd);

      element.addEventListener('touchstart', onTouchStart, { passive: true });
      element.addEventListener('touchmove', onTouchMove, { passive: true });
      element.addEventListener('touchend', onDragEnd);
      element.addEventListener('touchcancel', onDragEnd);
    }

    // RESIZE OBSERVER
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0 || !rendererRef.current || !cameraRef.current) return;
      const entry = entries[0];
      const w = entry.contentRect.width;
      const h = entry.contentRect.height;
      
      rendererRef.current.setSize(w, h);
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
    });
    if (mountRef.current) {
      resizeObserver.observe(mountRef.current);
    }

    return () => {
      cancelAnimationFrame(animationId);
      if (rendererRef.current && mountRef.current) {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        mountRef.current.removeChild(rendererRef.current.domElement);
      }
      
      if (element) {
        element.removeEventListener('mousedown', onMouseDown);
        element.removeEventListener('mousemove', onMouseMove);
        element.removeEventListener('mouseup', onDragEnd);
        element.removeEventListener('mouseleave', onDragEnd);

        element.removeEventListener('touchstart', onTouchStart);
        element.removeEventListener('touchmove', onTouchMove);
        element.removeEventListener('touchend', onDragEnd);
        element.removeEventListener('touchcancel', onDragEnd);
      }
      resizeObserver.disconnect();
    };
  }, []);

  // Update theme material
  useEffect(() => {
    if (!sceneRef.current) return;

    const applyMaterialToMesh = (mesh: THREE.Mesh) => {
      if (themeMode === 'hologram') {
        mesh.material = new THREE.MeshBasicMaterial({
          color: 0x52b788,
          wireframe: true,
          transparent: true,
          opacity: 0.8
        });
      } else {
        mesh.material = new THREE.MeshStandardMaterial({
          color: 0x2d6a4f,
          roughness: 0.3,
          metalness: 0.8,
          flatShading: true
        });
      }
    };

    // Apply to custom STL model if loaded
    if (customModelRef.current) {
      applyMaterialToMesh(customModelRef.current);
    }

    // Apply to default DJI primitive components
    if (defaultDroneRef.current) {
      defaultDroneRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          applyMaterialToMesh(child);
        }
      });
    }
  }, [themeMode]);

  // Default Drone builder helper
  const buildDefaultDrone = (): THREE.Group => {
    const droneGroup = new THREE.Group();
    rotorsRef.current = [];

    // Body Material
    const mat = new THREE.MeshStandardMaterial({
      color: 0x1b4332,
      roughness: 0.4,
      metalness: 0.7,
      flatShading: true
    });

    // Central Quadcopter body
    const bodyGeom = new THREE.BoxGeometry(4, 1.2, 5);
    const bodyMesh = new THREE.Mesh(bodyGeom, mat);
    droneGroup.add(bodyMesh);

    // Front Camera / Gimbal housing
    const cameraGeom = new THREE.SphereGeometry(0.8, 16, 16);
    const cameraMesh = new THREE.Mesh(cameraGeom, new THREE.MeshBasicMaterial({ color: 0x52b788 }));
    cameraMesh.position.set(0, -0.4, 2.5);
    droneGroup.add(cameraMesh);

    // 4 Diagonal Motor Arms
    const armGeom = new THREE.CylinderGeometry(0.2, 0.2, 6);
    armGeom.rotateX(Math.PI / 2); // align horizontally

    const angles = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4];
    let defaultTriangles = bodyGeom.getAttribute('position').count / 3 + cameraGeom.getAttribute('position').count / 3;

    angles.forEach((angle) => {
      const armGroup = new THREE.Group();
      
      const armMesh = new THREE.Mesh(armGeom, mat);
      armMesh.position.set(0, 0, 3);
      armGroup.add(armMesh);

      // Motor cylinder
      const motorGeom = new THREE.CylinderGeometry(0.4, 0.4, 0.8, 12);
      const motorMesh = new THREE.Mesh(motorGeom, mat);
      motorMesh.position.set(0, 0.5, 6);
      armGroup.add(motorMesh);

      // Propeller (Rotor)
      const rotorGeom = new THREE.BoxGeometry(3.5, 0.05, 0.2);
      const rotorMesh = new THREE.Mesh(rotorGeom, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
      rotorMesh.position.set(0, 0.9, 6);
      armGroup.add(rotorMesh);
      rotorsRef.current.push(rotorMesh);

      armGroup.rotation.y = angle;
      droneGroup.add(armGroup);

      defaultTriangles += armGeom.getAttribute('position').count / 3 + motorGeom.getAttribute('position').count / 3 + rotorGeom.getAttribute('position').count / 3;
    });

    setTrianglesCount(Math.round(defaultTriangles));
    return droneGroup;
  };

  // 2. Mouse interactions for orbit control
  const handleMouseDown = (e: React.MouseEvent) => {
    isMouseDown.current = true;
    setIsDragging(true);
    previousMousePosition.current = {
      x: e.clientX,
      y: e.clientY
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown.current || !modelGroupRef.current) return;
    const deltaMove = {
      x: e.clientX - previousMousePosition.current.x,
      y: e.clientY - previousMousePosition.current.y
    };

    modelGroupRef.current.rotation.y += deltaMove.x * 0.007;
    modelGroupRef.current.rotation.x += deltaMove.y * 0.007;

    previousMousePosition.current = {
      x: e.clientX,
      y: e.clientY
    };
  };

  const handleMouseUpOrLeave = () => {
    isMouseDown.current = false;
    setIsDragging(false);
  };

  // 3. STL File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    loadSTLFile(file);
  };

  const loadSTLFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (!event.target?.result || !modelGroupRef.current) return;

      try {
        const arrayBuffer = event.target.result as ArrayBuffer;
        const geometry = parseSTL(arrayBuffer);

        // Remove old objects
        if (customModelRef.current) {
          modelGroupRef.current.remove(customModelRef.current);
        }
        if (defaultDroneRef.current) {
          modelGroupRef.current.remove(defaultDroneRef.current);
          defaultDroneRef.current = null;
          rotorsRef.current = [];
        }

        // Set materials
        let material;
        if (themeMode === 'hologram') {
          material = new THREE.MeshBasicMaterial({
            color: 0x52b788,
            wireframe: true,
            transparent: true,
            opacity: 0.8
          });
        } else {
          material = new THREE.MeshStandardMaterial({
            color: 0x2d6a4f,
            roughness: 0.3,
            metalness: 0.8,
            flatShading: true
          });
        }

        const mesh = new THREE.Mesh(geometry, material);
        
        // Center the geometry and scale it properly
        geometry.computeBoundingBox();
        const boundingBox = geometry.boundingBox;
        if (boundingBox) {
          const center = new THREE.Vector3();
          boundingBox.getCenter(center);
          geometry.translate(-center.x, -center.y, -center.z);

          const size = new THREE.Vector3();
          boundingBox.getSize(size);
          const maxDim = Math.max(size.x, size.y, size.z);
          if (maxDim > 0) {
            const scale = 12 / maxDim; // scale to fit comfortably in view
            mesh.scale.set(scale, scale, scale);
          }
        }

        modelGroupRef.current.add(mesh);
        customModelRef.current = mesh;

        setModelName(file.name);
        const count = geometry.getAttribute('position').count / 3;
        setTrianglesCount(Math.round(count));

        // Reset rotation
        modelGroupRef.current.rotation.set(0, 0, 0);
      } catch (err) {
        console.error('Error parsing STL file:', err);
        alert('حدث خطأ أثناء قراءة ملف الـ STL. يرجى التأكد من سلامة الملف وصيغته.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleReset = () => {
    if (!modelGroupRef.current || !sceneRef.current) return;

    // Restore default drone if custom exists
    if (customModelRef.current) {
      modelGroupRef.current.remove(customModelRef.current);
      customModelRef.current = null;
    }

    if (!defaultDroneRef.current) {
      const defaultDrone = buildDefaultDrone();
      modelGroupRef.current.add(defaultDrone);
      defaultDroneRef.current = defaultDrone;
    }

    // Reset camera position and object rotation
    if (cameraRef.current) {
      cameraRef.current.position.set(0, 15, 30);
      cameraRef.current.lookAt(0, 0, 0);
    }
    modelGroupRef.current.rotation.set(0, 0, 0);
    setModelName('طائرة الاستطلاع DJI (طراز محاكاة)');
  };

  return (
    <div className="flex flex-col h-full bg-[#040e0a] text-gray-100 font-sans border border-[#2d6a4f]/30 rounded-lg shadow-2xl overflow-hidden" id="three-d-viewer-root">
      
      {/* Top controls header */}
      <div className="p-4 bg-[#071911] border-b border-[#2d6a4f]/40 flex flex-wrap gap-4 items-center justify-between" id="three-d-header">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#52b788]" />
          <span className="font-bold text-sm md:text-base text-emerald-400">محاكي الهياكل والمجسمات ثلاثية الأبعاد (3D Drone Viewer)</span>
        </div>

        <div className="flex flex-wrap gap-2 items-center" id="three-d-controls">
          {/* Upload STL Button at the top */}
          <label
            className="px-3 py-1.5 rounded text-xs font-bold bg-[#52b788] text-[#040e0a] hover:bg-[#4ade80] transition flex items-center gap-1.5 cursor-pointer border border-[#52b788] shadow-lg"
            id="btn-upload-stl-header"
            title="تحميل ملف STL ثلاثي الأبعاد للفحص"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>تحميل ملف STL</span>
            <input
              type="file"
              accept=".stl"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          {/* Theme Toggle */}
          <button
            onClick={() => setThemeMode(themeMode === 'hologram' ? 'solid' : 'hologram')}
            className="px-3 py-1.5 rounded text-xs font-semibold bg-[#1b4332] border border-[#2d6a4f] hover:bg-[#2d6a4f] transition flex items-center gap-1.5"
            id="btn-toggle-theme"
          >
            <Layers className="w-3.5 h-3.5" />
            {themeMode === 'hologram' ? 'وضع العرض: مجسم مصمت' : 'وضع العرض: هولوجرام شبكي'}
          </button>

          {/* Auto Rotate Toggle */}
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition border ${
              autoRotate 
                ? 'bg-emerald-800 text-white border-emerald-500' 
                : 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700'
            }`}
            id="btn-toggle-rotate"
          >
            <RotateCw className="w-3.5 h-3.5 inline mr-1" />
            {autoRotate ? 'دوران تلقائي نشط' : 'إيقاف الدوران تلقائياً'}
          </button>

          {/* Reset button */}
          <button
            onClick={handleReset}
            className="p-1.5 rounded bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 transition"
            title="إعادة تهيئة العرض والعودة للافتراضي"
            id="btn-reset-three"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row relative" id="three-d-layout">
        
        {/* Canvas Element */}
        <div className="flex-1 min-h-[300px] lg:min-h-0 relative overflow-hidden" id="canvas-area">
          <div
            ref={mountRef}
            className={`w-full h-full cursor-grab ${isDragging ? 'cursor-grabbing' : ''}`}
            style={{ minHeight: "400px" }}
            id="threejs-canvas"
          />
          
          {/* Tactical Hud overlays */}
          <div className="absolute top-4 left-4 bg-[#081c15]/90 border border-[#2d6a4f]/50 p-3 rounded shadow-xl pointer-events-none" id="model-stats">
            <h4 className="text-[10px] font-bold text-[#52b788] uppercase tracking-wider mb-2 flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5" />
              مواصفات المجسم الحالي
            </h4>
            <div className="space-y-1 text-xs">
              <div className="text-gray-400">الاسم: <span className="text-gray-200 font-semibold">{modelName}</span></div>
              <div className="text-gray-400">عدد الأوجه (Triangles): <span className="text-[#52b788] font-mono font-bold">{trianglesCount}</span></div>
              <div className="text-gray-400">المنظومة النشطة: <span className="text-emerald-400 font-semibold">تصفح تفاعلي 360°</span></div>
            </div>
          </div>

          <div className="absolute bottom-4 right-4 text-[10px] text-gray-500 font-mono bg-black/40 px-2 py-1 rounded">
            انقر واسحب بالفأرة أو المس الشاشة لتدوير واستعراض المجسم
          </div>
        </div>

        {/* Upload and details Panel */}
        <div className="w-full lg:w-80 bg-[#091510] border-t lg:border-t-0 lg:border-r border-[#2d6a4f]/30 p-5 flex flex-col justify-between" id="upload-panel">
          <div className="space-y-5">
            <div className="border-b border-[#2d6a4f]/30 pb-3">
              <h3 className="text-sm font-bold text-[#52b788] flex items-center gap-1.5">
                <Box className="w-4.5 h-4.5" />
                تحميل ملفات الهياكل STL
              </h3>
              <p className="text-xs text-gray-400 mt-1">تتيح لك هذه المنصة تحميل وفحص ملفات النماذج ثلاثية الأبعاد (STL) لقطع غيار وطائرات DJI لتفقدها فنياً وعسكرياً.</p>
            </div>

            {/* Drag & Drop Upload Zone */}
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-[#2d6a4f]/50 hover:border-[#52b788] bg-[#071911]/40 rounded-lg p-6 cursor-pointer transition group" id="upload-zone">
              <Upload className="w-10 h-10 text-[#2d6a4f] group-hover:text-[#52b788] group-hover:scale-110 transition duration-300" />
              <span className="text-xs font-bold text-gray-300 mt-3 text-center">انقر أو اسحب ملف STL هنا</span>
              <span className="text-[10px] text-gray-500 mt-1">يدعم ملفات STL الثنائية والنصية (ASCII)</span>
              <input
                type="file"
                accept=".stl"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            {/* Tactical Instructions */}
            <div className="space-y-2 text-xs text-gray-300 bg-[#081c15] p-3 rounded border border-[#2d6a4f]/20" id="three-instructions">
              <h5 className="font-bold text-[#52b788]">إرشادات الفحص الفني:</h5>
              <ul className="list-disc list-inside space-y-1 text-gray-400 pr-1">
                <li>تفقد الهيكل الشبكي (الهولوجرام) للتأكد من انسيابية تصميم أذرع الدفع ومقاومة الرياح.</li>
                <li>تأكد من مطابقة نقاط التثبيت وعقد توزيع المحركات والمروحة مع معايير الطائرة الأصلية.</li>
                <li>اضغط على زر "مجسم مصمت" لمشاهدة المظهر الخارجي الحقيقي وتقدير انعكاسات الإضاءة.</li>
              </ul>
            </div>
          </div>

          <div className="pt-4 border-t border-[#2d6a4f]/20 mt-4 text-[10px] text-gray-500 font-mono text-center">
            وحدة الاستطلاع والتشويش - القاطع الأول
          </div>
        </div>

      </div>
    </div>
  );
}
