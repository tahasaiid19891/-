/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Shield, Plane, Radio, Battery, Milestone, Navigation, AlertTriangle, RefreshCw, X } from 'lucide-react';

// Haversine formula to calculate distance between two coordinates in meters
function getHaversineDistance(coords1: [number, number], coords2: [number, number]): number {
  const R = 6371e3; // Earth radius in meters
  const lat1 = (coords1[0] * Math.PI) / 180;
  const lat2 = (coords2[0] * Math.PI) / 180;
  const deltaLat = ((coords2[0] - coords1[0]) * Math.PI) / 180;
  const deltaLng = ((coords2[1] - coords1[1]) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export default function InteractiveMap() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  
  // Layers
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const [mapLayer, setMapLayer] = useState<'streets' | 'satellite'>('satellite');
  const [hideLabels, setHideLabels] = useState<boolean>(false);
  
  // Placement Mode
  const [isPlacingDrone, setIsPlacingDrone] = useState<boolean>(false);
  
  // Drone State
  const [hasDeployed, setHasDeployed] = useState<boolean>(false);
  const [rcCoords, setRcCoords] = useState<[number, number] | null>(null);
  const [droneCoords, setDroneCoords] = useState<[number, number] | null>(null);
  
  // Simulated flight metrics
  const [straightDistance, setStraightDistance] = useState<number>(0); // in meters
  const [cumulativeDistance, setCumulativeDistance] = useState<number>(0); // in meters
  const [battery, setBattery] = useState<number>(100); // 0-100%
  const [isReturningToHome, setIsReturningToHome] = useState<boolean>(false);

  // Flight time is calculated as an estimated time based on cumulative distance covered
  // Assuming a typical DJI drone average speed of 12 meters per second
  const flightTime = Math.round(cumulativeDistance / 12);

  // Warnings types and states for dismissal
  const isBatteryLow = battery > 0 && battery <= 25;
  const isDistanceMaxed = straightDistance >= 3400;

  const currentAlertType = 
    battery <= 0 ? 'battery_empty' :
    isDistanceMaxed ? 'distance_maxed' :
    isBatteryLow ? 'battery_low' :
    'none';

  const [lastAlertType, setLastAlertType] = useState<'none' | 'battery_empty' | 'distance_maxed' | 'battery_low'>('none');
  const [isAlertDismissed, setIsAlertDismissed] = useState<boolean>(false);

  useEffect(() => {
    if (currentAlertType !== lastAlertType) {
      setIsAlertDismissed(false);
      setLastAlertType(currentAlertType);
    }
  }, [currentAlertType, lastAlertType]);
  
  // Leaflet markers & lines stored in refs
  const rcMarkerRef = useRef<L.Marker | null>(null);
  const droneMarkerRef = useRef<L.Marker | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const flightPathPointsRef = useRef<[number, number][]>([]);

  // Timers
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Tile layer configs
  const tileLayers = {
    streets: {
      withLabels: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      noLabels: 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png'
    },
    satellite: {
      withLabels: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      noLabels: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' // Esri doesn't have built-in easy toggle labels unless we use overlay, which is fine
    }
  };

  // 1. Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Center on Tripoli, Libya
    const initialCenter: [number, number] = [32.8872, 13.1913];
    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 13,
      zoomControl: true
    });

    mapInstanceRef.current = map;

    // Load initial satellite layer
    const layerUrl = tileLayers.satellite.withLabels;
    const tileLayer = L.tileLayer(layerUrl, {
      attribution: '© Esri World Imagery / OpenStreetMap'
    }).addTo(map);

    tileLayerRef.current = tileLayer;

    // Click handler for placing drone
    map.on('click', (e: L.LeafletMouseEvent) => {
      // Check if we are in placing mode
      setIsPlacingDrone((placing) => {
        if (placing) {
          const latlng: [number, number] = [e.latlng.lat, e.latlng.lng];
          deployDroneAndRc(latlng, map);
          return false;
        }
        return placing;
      });
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // 2. Handle Layer changes
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;

    let url = '';
    if (mapLayer === 'satellite') {
      url = tileLayers.satellite.withLabels;
    } else {
      url = hideLabels ? tileLayers.streets.noLabels : tileLayers.streets.withLabels;
    }

    tileLayerRef.current.setUrl(url);
  }, [mapLayer, hideLabels]);

  // 3. Flight timer when active - handles tiny slow idle battery drain if drone is active
  useEffect(() => {
    if (hasDeployed && battery > 0 && !isReturningToHome) {
      timerRef.current = setInterval(() => {
        setBattery((b) => Math.max(0, b - 0.05)); // Slow idle drain over time
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [hasDeployed, battery, isReturningToHome]);

  // Deployment handler
  const deployDroneAndRc = (coords: [number, number], map: L.Map) => {
    // Reset previous
    resetSimulationState();

    setRcCoords(coords);
    setDroneCoords(coords);
    setHasDeployed(true);
    setBattery(100);
    setStraightDistance(0);
    setCumulativeDistance(0);
    setIsAlertDismissed(false);
    setLastAlertType('none');

    // Initial point for the polyline
    flightPathPointsRef.current = [coords];

    // Create custom icons
    const rcIcon = L.icon({
      iconUrl: 'https://cdn-icons-png.flaticon.com/512/90/90848.png',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    const droneIcon = L.icon({
      iconUrl: 'https://static.thenounproject.com/png/1085023-200.png',
      iconSize: [38, 38],
      iconAnchor: [19, 19],
    });

    // Add Remote Control Marker
    const rcMarker = L.marker(coords, {
      icon: rcIcon,
      zIndexOffset: 500
    }).addTo(map);
    rcMarker.bindTooltip('نقطة الإقلاع والتحكم (Home Point)', { permanent: false, direction: 'top' });
    rcMarkerRef.current = rcMarker;

    // Add Draggable Drone Marker
    const droneMarker = L.marker(coords, {
      icon: droneIcon,
      draggable: true,
      zIndexOffset: 1000
    }).addTo(map);
    
    droneMarker.bindTooltip('طائرة الاستطلاع DJI', { permanent: true, direction: 'bottom' });
    droneMarkerRef.current = droneMarker;

    // Add Polyline for tracking trail
    const polyline = L.polyline([coords], {
      color: '#4ade80',
      weight: 3,
      opacity: 0.8,
      dashArray: '5, 5'
    }).addTo(map);
    polylineRef.current = polyline;

    // Handle dragging the drone
    droneMarker.on('dragstart', () => {
      map.dragging.disable();
    });

    droneMarker.on('drag', (e: L.LeafletEvent) => {
      const marker = e.target as L.Marker;
      const currentPos = marker.getLatLng();
      const currentCoords: [number, number] = [currentPos.lat, currentPos.lng];

      // Calculate straight line distance
      const dist = getHaversineDistance(coords, currentCoords);

      if (dist > 3500) {
        // GEOFENCE CAPPING at 3.5km (3500m)
        const fraction = 3500 / dist;
        const cappedLat = coords[0] + (currentCoords[0] - coords[0]) * fraction;
        const cappedLng = coords[1] + (currentCoords[1] - coords[1]) * fraction;
        const cappedCoords: [number, number] = [cappedLat, cappedLng];

        marker.setLatLng(cappedCoords);
        updateFlightPath(coords, cappedCoords, 3500);
      } else {
        updateFlightPath(coords, currentCoords, dist);
      }
    });

    droneMarker.on('dragend', () => {
      map.dragging.enable();
    });

    // Zoom slightly on deploy
    map.setView(coords, 14);
  };

  const updateFlightPath = (origin: [number, number], current: [number, number], dist: number) => {
    setDroneCoords(current);
    setStraightDistance(Math.round(dist));

    // Update cumulative distance (approx 10 meters per update or calculate from previous)
    const lastPoint = flightPathPointsRef.current[flightPathPointsRef.current.length - 1];
    if (lastPoint) {
      const segmentDist = getHaversineDistance(lastPoint, current);
      if (segmentDist > 2) { // Only record significant changes
        flightPathPointsRef.current.push(current);
        setCumulativeDistance((prev) => prev + segmentDist);
        setBattery((b) => Math.max(0, parseFloat((b - (segmentDist * 0.015)).toFixed(1)))); // Deplete battery based on distance moved
        
        if (polylineRef.current) {
          polylineRef.current.setLatLngs(flightPathPointsRef.current);
        }
      }
    }
  };

  const resetSimulationState = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Remove markers & lines
    if (rcMarkerRef.current && mapInstanceRef.current) mapInstanceRef.current.removeLayer(rcMarkerRef.current);
    if (droneMarkerRef.current && mapInstanceRef.current) mapInstanceRef.current.removeLayer(droneMarkerRef.current);
    if (polylineRef.current && mapInstanceRef.current) mapInstanceRef.current.removeLayer(polylineRef.current);

    rcMarkerRef.current = null;
    droneMarkerRef.current = null;
    polylineRef.current = null;
    flightPathPointsRef.current = [];

    setHasDeployed(false);
    setRcCoords(null);
    setDroneCoords(null);
    setStraightDistance(0);
    setCumulativeDistance(0);
    setBattery(100);
    setIsReturningToHome(false);
    setIsAlertDismissed(false);
    setLastAlertType('none');
  };

  // Auto Return To Home (RTH) simulation
  const initiateRTH = () => {
    if (!hasDeployed || !rcCoords || !droneCoords || !droneMarkerRef.current || isReturningToHome || battery <= 0) return;

    setIsReturningToHome(true);
    let steps = 40;
    const interval = 100; // ms
    const latStep = (rcCoords[0] - droneCoords[0]) / steps;
    const lngStep = (rcCoords[1] - droneCoords[1]) / steps;
    let currentStep = 0;

    const rthTimer = setInterval(() => {
      currentStep++;
      if (currentStep >= steps || !droneMarkerRef.current) {
        clearInterval(rthTimer);
        // Completed RTH
        if (droneMarkerRef.current) {
          droneMarkerRef.current.setLatLng(rcCoords);
        }
        setDroneCoords(rcCoords);
        setStraightDistance(0);
        setIsReturningToHome(false);
        setBattery((b) => Math.max(0, b - 1)); // Deduct final cost
      } else {
        const nextLat = droneCoords[0] + latStep * currentStep;
        const nextLng = droneCoords[1] + lngStep * currentStep;
        const nextCoords: [number, number] = [nextLat, nextLng];

        if (droneMarkerRef.current) {
          droneMarkerRef.current.setLatLng(nextCoords);
        }
        setDroneCoords(nextCoords);
        
        const dist = getHaversineDistance(rcCoords, nextCoords);
        setStraightDistance(Math.round(dist));
        
        flightPathPointsRef.current.push(nextCoords);
        if (polylineRef.current) {
          polylineRef.current.setLatLngs(flightPathPointsRef.current);
        }
        setBattery((b) => Math.max(0, parseFloat((b - 0.2).toFixed(1)))); // battery usage during RTH autopilot
      }
    }, interval);
  };

  return (
    <div className="flex flex-col h-full bg-[#081c15] text-gray-100 font-sans border border-[#2d6a4f]/30 rounded-lg shadow-2xl overflow-hidden" id="interactive-map-root">
      
      {/* Tactical Top Bar Controls */}
      <div className="p-4 bg-[#0d2118] border-b border-[#2d6a4f]/40 flex flex-wrap gap-3 items-center justify-between" id="map-control-bar">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#52b788] animate-pulse" />
          <span className="font-bold tracking-wide text-sm md:text-base text-emerald-400">منظومة الاستطلاع الجوي التكتيكية - طرابلس</span>
        </div>

        <div className="flex flex-wrap gap-2 items-center" id="map-button-group">
          {/* Map Style Toggle */}
          <button
            onClick={() => setMapLayer(mapLayer === 'satellite' ? 'streets' : 'satellite')}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition-all border ${
              mapLayer === 'satellite' 
                ? 'bg-[#2d6a4f] text-white border-[#52b788]' 
                : 'bg-[#1b4332] text-gray-300 border-[#2d6a4f] hover:bg-[#2d6a4f]'
            }`}
            id="btn-toggle-layer"
          >
            {mapLayer === 'satellite' ? 'وضع الخريطة: قمر صناعي' : 'وضع الخريطة: مخطط طرق'}
          </button>

          {/* Toggle Labels */}
          {mapLayer === 'streets' && (
            <button
              onClick={() => setHideLabels(!hideLabels)}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-all border ${
                hideLabels 
                  ? 'bg-amber-800 text-white border-amber-500' 
                  : 'bg-[#1b4332] text-gray-300 border-[#2d6a4f] hover:bg-[#2d6a4f]'
              }`}
              id="btn-toggle-labels"
            >
              {hideLabels ? 'إظهار أسماء الشوارع' : 'إخفاء أسماء الشوارع'}
            </button>
          )}

          {/* Deploy Drone Button */}
          <button
            onClick={() => {
              if (hasDeployed) {
                resetSimulationState();
              } else {
                setIsPlacingDrone(!isPlacingDrone);
              }
            }}
            className={`px-4 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-2 border ${
              hasDeployed 
                ? 'bg-rose-900/80 hover:bg-rose-900 text-rose-100 border-rose-600' 
                : isPlacingDrone 
                  ? 'bg-yellow-800/90 text-yellow-100 border-yellow-500 animate-pulse'
                  : 'bg-emerald-800 hover:bg-emerald-700 text-emerald-50 border-emerald-500'
            }`}
            id="btn-deploy-drone"
          >
            <Plane className="w-4 h-4" />
            {hasDeployed ? 'إزالة الطائرة وإعادة تعيين' : isPlacingDrone ? 'انقر على الخريطة لتحديد الإقلاع' : 'إضافة درون'}
          </button>

          {/* Manual Reset */}
          {hasDeployed && (
            <button
              onClick={resetSimulationState}
              className="p-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-600 transition"
              title="إعادة تعيين بالكامل"
              id="btn-reset-map"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row relative" id="map-simulation-layout">
        
        {/* Real-time Tactical HUD overlay */}
        {hasDeployed && (
          <div className="absolute top-4 right-4 z-[999] bg-[#081c15]/95 border border-[#2d6a4f]/60 rounded p-4 shadow-xl w-64 backdrop-blur-md" id="simulation-hud">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#52b788] mb-3 border-b border-[#2d6a4f]/40 pb-1.5 flex items-center gap-2">
              <Navigation className="w-4 h-4" />
              مؤشرات الطيران الفورية (FPV HUD)
            </h3>

            <div className="space-y-3" id="hud-metrics">
              {/* Battery */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-400">طاقة البطارية الذكية:</span>
                  <span className={`font-mono font-bold ${isBatteryLow ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}>
                    {Math.round(battery)}%
                  </span>
                </div>
                <div className="w-full bg-gray-900 rounded-full h-1.5 overflow-hidden border border-gray-800">
                  <div 
                    className={`h-full rounded-full transition-all duration-300 ${isBatteryLow ? 'bg-red-500' : 'bg-emerald-500'}`}
                    style={{ width: `${battery}%` }}
                  />
                </div>
              </div>

              {/* Straight line Distance */}
              <div className="flex justify-between items-center py-1 border-b border-[#1b4332]/50">
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Radio className="w-3.5 h-3.5 text-[#52b788]" />
                  المسافة المباشرة:
                </span>
                <span className={`font-mono text-xs font-bold ${isDistanceMaxed ? 'text-red-400 animate-pulse' : 'text-gray-200'}`}>
                  {(straightDistance / 1000).toFixed(2)} كم / 3.50 كم
                </span>
              </div>

              {/* Cumulative Flight Trail */}
              <div className="flex justify-between items-center py-1 border-b border-[#1b4332]/50">
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Milestone className="w-3.5 h-3.5 text-[#52b788]" />
                  إجمالي مسار التحليق:
                </span>
                <span className="font-mono text-xs font-bold text-gray-200">
                  {(cumulativeDistance / 1000).toFixed(2)} كم
                </span>
              </div>

              {/* Flight Time */}
              <div className="flex justify-between items-center py-1">
                <span className="text-xs text-gray-400">زمن التحليق الكلي:</span>
                <span className="font-mono text-xs font-bold text-[#52b788]">
                  {Math.floor(flightTime / 60)}د {flightTime % 60}ث
                </span>
              </div>

              {/* Return to Home autopilot trigger */}
              <button
                disabled={isReturningToHome || battery <= 0}
                onClick={initiateRTH}
                className="w-full mt-2 py-1.5 px-3 bg-[#1b4332] hover:bg-[#2d6a4f] disabled:bg-gray-800 disabled:text-gray-600 disabled:border-gray-700 text-emerald-100 text-xs font-bold rounded border border-[#52b788]/40 transition flex items-center justify-center gap-2"
                id="btn-hud-rth"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isReturningToHome ? 'animate-spin' : ''}`} />
                {isReturningToHome ? 'جاري العودة التلقائية...' : 'تفعيل العودة التلقائية (RTH)'}
              </button>
            </div>
          </div>
        )}

        {/* Leaflet Map Div */}
        <div className="flex-1 min-h-[350px] md:min-h-0 relative" id="map-canvas-container">
          <div ref={mapContainerRef} className="w-full h-full" style={{ minHeight: "450px" }} id="map-canvas" />
          
          {/* Tactical Overlay Map grid for military style */}
          <div className="absolute inset-0 pointer-events-none tactical-grid z-[400] opacity-30" />

          {/* Alerts / Tactical Notifications panel */}
          {currentAlertType !== 'none' && !isAlertDismissed && (
            <div className="absolute bottom-4 left-4 right-4 md:right-auto md:w-96 z-[999] bg-[#1a0f0d]/95 border border-red-500/50 rounded-lg p-4 shadow-2xl backdrop-blur-md animate-bounce" id="map-alert-panel">
              {/* Close Button */}
              <button 
                onClick={() => setIsAlertDismissed(true)}
                className="absolute top-2 left-2 text-red-400 hover:text-red-200 hover:bg-red-950/40 p-1 rounded-full transition cursor-pointer"
                title="إغلاق التنبيه"
                id="btn-close-alert"
              >
                <X className="w-4 h-4" />
              </button>
              
              <div className="flex gap-3">
                <div className="p-2 rounded bg-red-950/80 border border-red-500/40 text-red-400">
                  <AlertTriangle className="w-5 h-5 animate-pulse" />
                </div>
                <div className="flex-1 pr-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wide text-red-400 mb-1">
                    ⚠️ تحذير تكتيكي طارئ - اللاسلكي والتشويش
                  </h4>
                  <p className="text-xs text-red-200 leading-relaxed font-semibold">
                    {battery <= 0 ? (
                      'عاجل: نفاد كامل للطاقة! سقطت طائرة الاستطلاع اضطرارياً وفُقدت الإشارة تماماً في آخر إحداثيات مرصودة.'
                    ) : isDistanceMaxed ? (
                      'تجاوز الحد الأقصى للمسافة المسموحة (3.5 كم)! طاقة بطارية الدرون لن تضمن العودة الآمنة، وقوة الإرسال اللاسلكي RC معرضة لفقدان السيطرة الكلي والتداخل.'
                    ) : (
                      'بطارية حرجة (أقل من 25%)! بروتوكول سلامة الطيران العسكري يُلزم ببدء إجراءات العودة الى نقطة الإقلاع RTH فوراً لتلافي السقوط الاضطراري وخسارة المعدة الجوية.'
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Help */}
        <div className="w-full md:w-72 bg-[#091510] border-t md:border-t-0 md:border-r border-[#2d6a4f]/30 p-4 flex flex-col justify-between" id="map-guide-sidebar">
          <div className="space-y-4">
            <div className="border-b border-[#2d6a4f]/30 pb-2">
              <h3 className="text-sm font-bold text-[#52b788] flex items-center gap-1.5">
                <Shield className="w-4 h-4" />
                دليل مشغل المحاكاة
              </h3>
              <p className="text-xs text-gray-400 mt-1">امتحان عملي لتقدير المسافات والتحليق بموجبات السلامة العسكرية.</p>
            </div>

            <div className="space-y-2 text-xs text-gray-300 leading-relaxed" id="map-instructions-list">
              <p className="border-r-2 border-emerald-500 pr-2">
                1. انقر على زر <strong className="text-[#52b788]">إضافة درون</strong>، ثم اختر نقطة على الخريطة لنشر وحدة الاستطلاع.
              </p>
              <p className="border-r-2 border-emerald-500 pr-2">
                2. اضغط مطولاً على <strong className="text-amber-400">أيقونة الدرون</strong> واسحبها لتغيير موقع الطيران الاستطلاعي.
              </p>
              <p className="border-r-2 border-emerald-500 pr-2">
                3. سيتم رسم <strong className="text-emerald-400">خط تتبع متقطع</strong> ليمثل مسار تحليق الطائرة اللحظي الفعلي.
              </p>
              <p className="border-r-2 border-emerald-500 pr-2">
                4. لا تتجاوز نطاق الأمان البالغ <strong className="text-red-400">3.5 كيلومتر</strong> لضمان حماية قنوات اللاسلكي.
              </p>
              <p className="border-r-2 border-emerald-500 pr-2">
                5. راقب <strong className="text-[#52b788]">نسبة شحن البطارية</strong>، وتأكد من العودة قبل هبوطها دون 25%.
              </p>
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
