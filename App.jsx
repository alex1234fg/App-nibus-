import React, { useState, useEffect, useMemo, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  MapPin, Clock, Bell, Settings, AlertTriangle, Check,
  ChevronRight, ChevronLeft, ArrowLeftRight, Compass, X,
  Search, Map as MapIcon, Sliders, Navigation, MousePointer, Trash2, Play, Square, List, Plus, RefreshCw, Radio, CircleDot, ShieldCheck, Sparkles, Footprints, Target, Bus
} from "lucide-react";

if (typeof document !== 'undefined') {
  if (!document.getElementById('tailwind-cdn')) {
    const script = document.createElement('script');
    script.id = 'tailwind-cdn';
    script.src = 'https://cdn.tailwindcss.com';
    document.head.appendChild(script);
  }
  if (!document.getElementById('leaflet-css')) {
    const link = document.createElement('link');
    link.id = 'leaflet-css';
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  }
  if (!document.getElementById('leaflet-js')) {
    const script = document.createElement('script');
    script.id = 'leaflet-js';
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    document.head.appendChild(script);
  }
}

const supabaseUrl = "https://ytkmadmrepcshqmjkvju.supabase.co";
const supabaseKey = "sb_publishable_Kiwjlm3cwE64xoBxVGDrvw_QQwA56zL";
const supabase = createClient(supabaseUrl, supabaseKey);

const SIMULATED_TRIP_DURATION = 45; 

const INITIAL_LINES = [
  {
    id: "cv", name: "Rodoviária / Curitiba-Vitória", color: "#2563EB",
    stops: ["Rodoviária", "Centro", "Curitiba-Vitória"],
    directions: [
      { label: "Rodoviária → Curitiba-Vitória", times: ["06:00","07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"] },
      { label: "Curitiba-Vitória → Rodoviária", times: ["06:30","07:30","08:30","09:30","10:30","11:30","12:30","13:30","14:30","15:30","16:30","17:30","18:30"] },
    ],
  },
  {
    id: "pp", name: "Ponta da Praia / Praça dos Maçons", color: "#3B82F6",
    stops: ["Ponta da Praia", "Avenida Beira-Mar", "Passarela do Rocio", "Praça dos Maçons"],
    directions: [
      { label: "Ponta da Praia → Praça dos Maçons", times: ["06:40","10:00","12:00","14:30","16:30","19:30","23:00"] },
      { label: "Praça dos Maçons → Ponta da Praia", times: ["05:40","08:50","11:00","13:00","15:30","18:30","22:00"] },
    ],
  },
  {
    id: "pm", name: "Praça dos Maçons / Pedrinhas", color: "#1D4ED8",
    stops: ["Praça dos Maçons", "Vila Nova", "Pedrinhas"],
    directions: [
      { label: "Praça dos Maçons → Pedrinhas", times: ["05:00","06:30","10:00","12:00","15:00","18:00","20:15","23:00"] },
      { label: "Pedrinhas → Praça dos Maçons", times: ["06:30","08:30","12:00","14:00","16:40","19:30","21:15"] },
    ],
  },
  {
    id: "nt", name: "Noturna Rodoviária / Pedrinhas", color: "#1E40AF",
    stops: ["Rodoviária", "Boqueirão Norte", "Centro", "Pedrinhas"],
    directions: [
      { label: "Rodoviária → Pedrinhas", times: ["20:15", "23:00"] },
      { label: "Pedrinhas → Rodoviária", times: ["21:15", "00:00"] },
    ],
  },
  {
    id: "bq", name: "Pedrinhas / Boqueirão Sul", color: "#1E3A8A",
    stops: ["Pedrinhas", "Avenida Beira-Mar", "Boqueirão Sul", "Balsa"],
    directions: [
      { label: "Pedrinhas → Boqueirão Sul", times: ["08:20", "13:20", "17:00"] },
      { label: "Boqueirão Sul → Pedrinhas", times: ["07:45","12:10","16:10"] },
    ],
  },
  {
    id: "pi", name: "Pedrinhas / Iguape", color: "#60A5FA", 
    stops: ["Pedrinhas", "Balsa de Iguape", "Centro Histórico (Iguape)"],
    directions: [
      { label: "Pedrinhas → Iguape", times: ["06:00", "09:00", "13:00", "17:00"] },
      { label: "Iguape → Pedrinhas", times: ["07:30", "11:00", "15:00", "19:00"] },
    ],
  },
];

function timeToMinutes(str) { 
  if (typeof str !== 'string') return 0;
  const [h, m] = str.split(":").map(Number); 
  return h * 60 + m; 
}
function minutesToTime(mins) {
  mins = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(mins / 60).toString().padStart(2, "0");
  const m = Math.floor(mins % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function getFilteredSortedTimes(times) {
  if (!times || times.length === 0) return [];
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const mapped = times.map(t => typeof t === 'object' ? t.t : t);
  const sorted = mapped.sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
  const future = sorted.filter(t => timeToMinutes(t) >= nowMins);
  return future.length > 0 ? future : sorted;
}

function getDistance(p1, p2) {
  const dx = p1[0] - p2[0], dy = p1[1] - p2[1];
  return Math.sqrt(dx*dx + dy*dy);
}

function getActiveTripProgress(durationMins, liveInfo) {
  if (!liveInfo || liveInfo.status !== "em rota") {
    return { active: false, progress: 0, startTime: null, mode: "parado" };
  }
  if (liveInfo.gpsProgress !== undefined && liveInfo.gpsProgress >= 0) {
    return { active: true, progress: Math.min(liveInfo.gpsProgress, 1), startTime: liveInfo.startTimeMins || 0, mode: "GPS Ao Vivo" };
  }
  if (liveInfo.startTimeMins !== undefined) {
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const startMins = liveInfo.startTimeMins;
    
    if (nowMins >= startMins) {
      const elapsed = nowMins - startMins;
      const progress = elapsed / durationMins;
      if (progress <= 1.5) { 
        return { active: true, progress: Math.min(progress, 1), startTime: startMins, mode: "Previsão por Horário" };
      }
    }
  }
  return { active: false, progress: 0, startTime: null, mode: "parado" };
}

function sendPushNotification(title, body) {
  if (typeof window !== 'undefined' && "Notification" in window) {
    if (Notification.permission === "granted") {
      new Notification(title, { body, icon: "🚌" });
    }
  }
}

function CustomModal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <h3 className="text-base font-extrabold text-gray-900" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 max-h-[70vh] overflow-y-auto space-y-4 text-center">
          {children}
        </div>
      </div>
    </div>
  );
}

function OnboardingScreen({ onComplete }) {
  const [loading, setLoading] = useState(false);
  const [permStatus, setPermStatus] = useState({ loc: false, notif: false });

  const handleRequestAll = async () => {
    setLoading(true);
    let notifGranted = false;
    let locGranted = false;

    if (typeof window !== 'undefined' && "Notification" in window) {
      const res = await Notification.requestPermission();
      if (res === "granted") notifGranted = true;
    }

    if (typeof navigator !== 'undefined' && "geolocation" in navigator) {
      await new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => { locGranted = true; resolve(); },
          () => resolve(),
          { timeout: 5000, enableHighAccuracy: true }
        );
      });
    }

    setPermStatus({ loc: locGranted, notif: notifGranted });
    setLoading(false);
    setTimeout(() => {
      onComplete();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-between p-6 text-white text-center animate-in fade-in duration-500">
      <div className="w-full flex justify-end">
        <span className="text-[11px] uppercase tracking-widest text-blue-400 font-bold bg-blue-950/60 px-3 py-1.5 rounded-full border border-blue-500/35 shadow-sm">Configuração Inicial</span>
      </div>

      <div className="space-y-6 my-auto max-w-sm w-full">
        <div className="w-24 h-24 bg-gradient-to-tr from-blue-600 to-indigo-400 rounded-3xl mx-auto flex items-center justify-center shadow-[0_0_35px_rgba(37,99,235,0.4)] animate-bounce">
          <Bus size={42} className="text-white" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Ilha Comprida Ônibus
          </h1>
          <p className="text-slate-300 text-xs leading-relaxed">
            Rastreamento híbrido inteligente, detecção de linha mais próxima e avisos ativos.
          </p>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl text-left space-y-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl shrink-0 ${permStatus.loc ? 'bg-blue-500 text-slate-950' : 'bg-slate-800 text-blue-400'}`}><Navigation size={16} /></div>
            <div className="flex-1">
              <p className="text-xs font-bold text-white">Geolocalização & Segundo Plano</p>
              <p className="text-[10px] text-slate-400">Identifica a linha mais próxima e opera o GPS continuamente.</p>
            </div>
            {permStatus.loc && <Check size={16} className="text-blue-400" />}
          </div>

          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl shrink-0 ${permStatus.notif ? 'bg-blue-500 text-slate-950' : 'bg-slate-800 text-blue-400'}`}><Bell size={16} /></div>
            <div className="flex-1">
              <p className="text-xs font-bold text-white">Notificações Push</p>
              <p className="text-[10px] text-slate-400">Alertas em tempo real quando o autocarro se aproxima.</p>
            </div>
            {permStatus.notif && <Check size={16} className="text-blue-400" />}
          </div>
        </div>
      </div>

      <div className="w-full max-w-sm pb-6">
        <button 
          onClick={handleRequestAll}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-extrabold py-4 rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-transform active:scale-95 text-sm"
        >
          {loading ? <RefreshCw className="animate-spin" size={18} /> : <Sparkles size={18} />} 
          {loading ? "A configurar..." : "Permitir e Iniciar Aplicação"}
        </button>
      </div>
    </div>
  );
}

function StatusDot({ status, color }) {
  const pulsing = status === "em rota";
  return (
    <span className="relative flex h-3 w-3">
      {pulsing && <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ backgroundColor: color || "#2563EB" }} />}
      <span className="relative inline-flex rounded-full h-3 w-3" style={{ backgroundColor: color || "#2563EB" }} />
    </span>
  );
}

function StatusLabel({ status, mode }) {
  const map = {
    "em rota": { text: mode === "GPS Ao Vivo" ? "Ao Vivo (GPS)" : "Previsão (Horário)", cls: "text-blue-700 bg-blue-50 border border-blue-200" },
    parado: { text: "Aguardando", cls: "text-amber-700 bg-amber-50 border border-amber-200" },
    problema: { text: "Aviso na via", cls: "text-red-700 bg-red-50 border border-red-200" },
  };
  const s = map[status] || { text: status, cls: "text-gray-700 bg-gray-50 border border-gray-200" };
  return <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase ${s.cls}`}>{s.text}</span>;
}

function LineBadgeImage({ line, size = 44 }) {
  return (
    <div className="rounded-full flex items-center justify-center text-white font-bold shrink-0 shadow-md transition-transform hover:scale-105"
      style={{ backgroundColor: line.color || "#2563EB", width: size, height: size }}>
      <Bus size={size * 0.48} className="text-white drop-shadow" />
    </div>
  );
}

function ScreenHeader({ title, subtitle, onBack, color }) {
  return (
    <div className="px-4 py-3 bg-white shadow-sm flex items-center gap-3 z-10 shrink-0">
      <button onClick={onBack} className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-900 transition-colors">
        <ChevronLeft size={18} />
      </button>
      <div>
        {subtitle && <p className="text-[10px] tracking-widest uppercase font-bold" style={{ color: color || "#2563EB" }}>{subtitle}</p>}
        <h1 className="text-base font-extrabold text-gray-900 leading-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{title}</h1>
      </div>
    </div>
  );
}

function LeafletMap({ points, isConfig, onAddPoint, busProgress = -1, lineColor }) {
  const mapId = useMemo(() => "map-" + Math.random().toString(36).substring(2, 9), []);
  
  const pathData = useMemo(() => {
    if (!points || points.length < 2) return null;
    let totalDist = 0;
    const dists = [0];
    for (let i = 1; i < points.length; i++) {
      totalDist += getDistance(points[i-1], points[i]);
      dists.push(totalDist);
    }
    return { totalDist, dists, validPoints: points };
  }, [points]);

  useEffect(() => {
    const checkL = setInterval(() => {
      if (window.L && document.getElementById(mapId)) {
        clearInterval(checkL);
        const container = document.getElementById(mapId);
        
        if (!container._mapInstance) {
          container._mapInstance = window.L.map(mapId, { zoomControl: false }).setView([-24.7253, -47.5342], 12);
          window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { attribution: '© CartoDB' }).addTo(container._mapInstance);
        }
        
        const map = container._mapInstance;
        
        if (container._clickEventFn) {
          map.off('click', container._clickEventFn);
        }

        if (isConfig && onAddPoint) {
          container._clickEventFn = (e) => onAddPoint([e.latlng.lat, e.latlng.lng]);
          map.on('click', container._clickEventFn);
        }
        
        if (container._routeLayer) map.removeLayer(container._routeLayer);
        if (container._redLayer) map.removeLayer(container._redLayer);
        if (container._busMarker) map.removeLayer(container._busMarker);

        if (pathData) {
          container._routeLayer = window.L.polyline(pathData.validPoints, { color: lineColor || '#2563EB', weight: 4, opacity: 0.7, dashArray: '5, 10' }).addTo(map);
          
          if (busProgress < 0) {
            map.fitBounds(container._routeLayer.getBounds(), { padding: [20, 20] });
          } else {
            const targetDist = pathData.totalDist * Math.min(Math.max(busProgress, 0), 1);
            let pLat = pathData.validPoints[0][0], pLng = pathData.validPoints[0][1];
            let lastIndex = 0;

            for (let i = 1; i < pathData.validPoints.length; i++) {
              if (pathData.dists[i] >= targetDist) {
                const segLen = pathData.dists[i] - pathData.dists[i-1];
                const segProg = segLen === 0 ? 0 : (targetDist - pathData.dists[i-1]) / segLen;
                const p1 = pathData.validPoints[i-1];
                const p2 = pathData.validPoints[i];
                pLat = p1[0] + (p2[0] - p1[0]) * segProg;
                pLng = p1[1] + (p2[1] - p1[1]) * segProg;
                lastIndex = i - 1;
                break;
              }
            }

            const currentPoint = [pLat, pLng];
            const traversedPoints = [...pathData.validPoints.slice(0, lastIndex + 1), currentPoint];
            
            container._redLayer = window.L.polyline(traversedPoints, { color: '#EF4444', weight: 5 }).addTo(map);
            
            const busHtml = `<div style="background-color: white; border: 3px solid #EF4444; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.5); font-size: 14px;">🚌</div>`;
            const busIcon = window.L.divIcon({ html: busHtml, className: '', iconSize: [28, 28], iconAnchor: [14, 14] });
            container._busMarker = window.L.marker(currentPoint, { icon: busIcon }).addTo(map);
            
            map.panTo(currentPoint, { animate: true, duration: 0.8 });
          }
        }
      }
    }, 100);

    return () => clearInterval(checkL);
  }, [pathData, busProgress, isConfig, mapId, lineColor, onAddPoint]); 

  return <div id={mapId} style={{ width: '100%', height: '100%', zIndex: 1, backgroundColor: '#e5e7eb' }}></div>;
}

function LineDetailScreen({ line, initialDir, onBack, customRoutes, liveStatus, customStops }) {
  const [dir, setDir] = useState(initialDir ?? 0);
  const activeDirection = line.directions[dir] || line.directions[0];
  const [simulatedProgress, setSimulatedProgress] = useState(-1);
  const [activeTripInfo, setActiveTripInfo] = useState(null);
  
  const [alertTargetStop, setAlertTargetStop] = useState(null);
  const alertedStopsRef = useRef(new Set());

  const routeKey = `${line.id}_dir_${dir}`;
  const routeData = customRoutes[routeKey];
  const currentRoutePoints = useMemo(() => {
    if (!routeData) return [];
    if (Array.isArray(routeData)) return routeData;
    return routeData.reverse ? [...(routeData.points || [])].reverse() : (routeData.points || []);
  }, [routeData]);

  const stopsKey = `${line.id}_dir_${dir}_stops`;
  const activeStops = customStops[stopsKey] || line.stops;
  const liveInfo = liveStatus[line.id] || {};

  useEffect(() => {
    const updateSimulation = () => {
      const trip = getActiveTripProgress(SIMULATED_TRIP_DURATION, liveInfo);
      if (trip.active) {
        setSimulatedProgress(trip.progress);
        setActiveTripInfo(trip);

        if (alertTargetStop !== null) {
          const stopPercentage = alertTargetStop / Math.max(1, activeStops.length - 1);
          const diff = stopPercentage - trip.progress;
          if (diff >= 0 && diff <= 0.07 && !alertedStopsRef.current.has(alertTargetStop)) {
            alertedStopsRef.current.add(alertTargetStop);
            const stopName = activeStops[alertTargetStop];
            sendPushNotification("🚌 Alerta de Proximidade", `O autocarro está a chegar a ${stopName} em aproximadamente 2 minutos!`);
          }
        }
      } else {
        setSimulatedProgress(-1);
        setActiveTripInfo(null);
      }
    };
    updateSimulation();
    const timer = setInterval(updateSimulation, 1000);
    return () => clearInterval(timer);
  }, [liveInfo, alertTargetStop, activeStops]);

  return (
    <div className="flex flex-col h-full bg-gray-50 pb-20">
      <ScreenHeader title={line.name} subtitle="Mapa & Previsão em Tempo Real" onBack={onBack} color={line.color} />
      
      <div className="px-3 py-2 bg-white border-b border-gray-100 flex items-center justify-between gap-2 shrink-0 z-10 shadow-sm relative">
        <button onClick={() => setDir(dir === 0 ? 1 : 0)} className="flex-1 flex items-center justify-between bg-gray-50 rounded-lg border border-gray-200 px-3 py-2 text-[12px] font-bold text-gray-800 active:bg-gray-100">
          <span className="truncate">{activeDirection.label}</span>
          <ArrowLeftRight size={13} className="text-blue-600 shrink-0 ml-2" />
        </button>
      </div>

      <div className="h-[35vh] w-full relative z-0 border-b border-gray-200 shadow-sm">
        {simulatedProgress >= 0 ? (
           <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full shadow-md z-[1000] flex items-center gap-2 border border-blue-100">
             <span className="relative flex h-2 w-2"><span className="animate-ping absolute h-full w-full rounded-full opacity-60 bg-blue-500"></span><span className="relative rounded-full h-2 w-2 bg-blue-500"></span></span>
             <span className="text-[10px] font-bold text-blue-800 uppercase">{activeTripInfo?.mode || "Em Viagem"}</span>
           </div>
        ) : (
           <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full shadow-md z-[1000] border border-amber-100">
             <span className="text-[10px] font-bold text-amber-800 uppercase flex items-center gap-1"><Clock size={12}/> Aguardando Partida</span>
           </div>
        )}
        <LeafletMap points={currentRoutePoints} isConfig={false} busProgress={simulatedProgress} lineColor={line.color} />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 bg-white space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-bold text-gray-900 flex items-center gap-1.5"><List size={16} /> Paragens e Alerta (2 min)</h3>
          {alertTargetStop !== null && (
            <button onClick={() => setAlertTargetStop(null)} className="text-[10px] font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-full border border-red-200">
              Desativar Alerta
            </button>
          )}
        </div>
        
        <div className="relative ml-3 space-y-5 pb-4">
          {activeStops.map((stop, idx) => {
             const stopPercentage = idx / Math.max(1, activeStops.length - 1);
             const hasPassed = simulatedProgress >= stopPercentage || (simulatedProgress >= 0 && idx === 0);
             const isNext = simulatedProgress >= (idx - 1) / Math.max(1, activeStops.length - 1) && !hasPassed;
             const isTarget = alertTargetStop === idx;
             
             let timeText = "--:--";
             let statusColor = "text-gray-400";
             
             if (activeTripInfo) {
                const stopTimeMins = activeTripInfo.startTime + (SIMULATED_TRIP_DURATION * stopPercentage);
                timeText = minutesToTime(stopTimeMins);
                if (hasPassed) statusColor = "text-gray-400";
                else if (isNext) statusColor = "text-blue-600 font-extrabold";
                else statusColor = "text-gray-900";
             }

             let segmentFillPercent = 0;
             if (simulatedProgress >= 0 && idx < activeStops.length - 1) {
                const nextStopPercentage = (idx + 1) / Math.max(1, activeStops.length - 1);
                if (simulatedProgress >= nextStopPercentage) {
                   segmentFillPercent = 100;
                } else if (simulatedProgress > stopPercentage) {
                   segmentFillPercent = ((simulatedProgress - stopPercentage) / (nextStopPercentage - stopPercentage)) * 100;
                }
             }

             return (
               <div key={idx} className="relative pl-7">
                 {idx < activeStops.length - 1 && (
                   <div className="absolute left-[7px] top-5 w-[3px] h-full bg-gray-200 overflow-hidden z-0">
                     <div 
                       className="w-full bg-blue-600 transition-all duration-500" 
                       style={{ height: `${segmentFillPercent}%` }} 
                     />
                   </div>
                 )}

                 <div className={`absolute -left-[1px] top-1 w-4 h-4 rounded-full border-2 flex items-center justify-center bg-white z-10 ${hasPassed ? 'border-blue-600 bg-blue-50' : isNext ? 'border-blue-500 shadow-[0_0_8px_rgba(37,99,235,0.6)]' : 'border-gray-300'}`}>
                    {hasPassed && <Check size={10} className="text-blue-700 stroke-[3]" />}
                    {isNext && <span className="absolute w-2 h-2 bg-blue-500 rounded-full animate-pulse" />}
                 </div>
                 
                 <div className="flex justify-between items-center bg-gray-50/80 p-2.5 rounded-xl border border-gray-100 shadow-sm">
                   <div>
                     <p className={`text-[13px] ${isNext ? 'font-bold text-blue-900' : hasPassed ? 'text-gray-700 font-medium' : 'text-gray-500'}`}>{stop}</p>
                     {isNext && <p className="text-[10px] text-blue-600 font-bold">Autocarro próximo!</p>}
                   </div>
                   <div className="flex items-center gap-2">
                     <span className={`text-[13px] ${statusColor}`}>{timeText}</span>
                     <button 
                       onClick={() => {
                         setAlertTargetStop(idx);
                         sendPushNotification("Alerta Programado", `Avisaremos quando o autocarro estiver a 2 min de ${stop}.`);
                       }}
                       className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-sm transition-colors ${isTarget ? 'bg-amber-500 text-white' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                     >
                       <Bell size={12} /> {isTarget ? "Ativo" : "Alerta 2m"}
                     </button>
                   </div>
                 </div>
               </div>
             );
          })}
        </div>
      </div>
    </div>
  );
}

function TripPlannerScreen({ lines, customStops, onSelectRoute }) {
  const [destinationQuery, setDestinationQuery] = useState("");
  const [selectedResult, setSelectedResult] = useState(null);

  const popularDestinations = [
    { name: "Praia do Boqueirão Norte", lineId: "cv", stop: "Centro", walkMins: 12, distanceKm: "0.9 km" },
    { name: "Prefeitura Municipal", lineId: "cv", stop: "Centro", walkMins: 5, distanceKm: "0.4 km" },
    { name: "Píer de Pedrinhas", lineId: "pm", stop: "Pedrinhas", walkMins: 3, distanceKm: "0.2 km" },
    { name: "Mercado Municipal de Iguape", lineId: "pi", stop: "Centro Histórico (Iguape)", walkMins: 8, distanceKm: "0.6 km" },
    { name: "Mirante da Ponta da Praia", lineId: "pp", stop: "Ponta da Praia", walkMins: 4, distanceKm: "0.3 km" }
  ];

  const filteredDestinations = popularDestinations.filter(d => 
    d.name.toLowerCase().includes(destinationQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-gray-50 pb-20">
      <div className="px-5 pt-7 pb-3 bg-white shadow-sm z-10 shrink-0">
        <p className="text-[11px] tracking-wider uppercase text-blue-600 font-bold">Assistente de Viagem</p>
        <h1 className="text-xl font-extrabold text-gray-900 mt-0.5" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Para onde quer ir?</h1>
      </div>

      <div className="p-4 space-y-4 flex-1 overflow-y-auto">
        <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-2">
          <Search size={18} className="text-gray-400 shrink-0" />
          <input 
            type="text" 
            value={destinationQuery} 
            onChange={e => setDestinationQuery(e.target.value)} 
            placeholder="Digite praia, mercado, bairro..." 
            className="flex-1 text-[13px] text-gray-900 outline-none bg-transparent"
          />
        </div>

        {selectedResult ? (
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-blue-800 bg-blue-100 px-2.5 py-1 rounded-full">Melhor Rota Encontrada</span>
              <button onClick={() => setSelectedResult(null)} className="text-gray-400 hover:text-gray-600"><X size={16}/></button>
            </div>
            
            <div>
              <p className="text-base font-extrabold text-gray-900">{selectedResult.name}</p>
              <p className="text-xs text-gray-600 mt-0.5">Desembarque recomendado na paragem: <b>{selectedResult.stop}</b></p>
            </div>

            <div className="bg-white p-3 rounded-xl border border-blue-100 flex items-center gap-3 shadow-sm">
              <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl"><Footprints size={18} /></div>
              <div>
                <p className="text-xs font-bold text-gray-900">Caminhada até ao destino</p>
                <p className="text-[11px] text-gray-500">{selectedResult.walkMins} minutes ({selectedResult.distanceKm}) a pé a partir da paragem.</p>
              </div>
            </div>

            <button 
              onClick={() => onSelectRoute(selectedResult.lineId)} 
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl text-[13px] shadow flex items-center justify-center gap-2"
            >
              <Navigation size={15} /> Ver Linha e Seguir Viagem
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[12px] font-bold text-gray-500 px-1">Destinos Populares em Ilha Comprida:</p>
            <div className="space-y-2">
              {filteredDestinations.map((dest, idx) => (
                <div 
                  key={idx} 
                  onClick={() => setSelectedResult(dest)}
                  className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between cursor-pointer hover:border-blue-500 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><Target size={16} /></div>
                    <div>
                      <p className="text-[14px] font-bold text-gray-900">{dest.name}</p>
                      <p className="text-[11px] text-gray-500">Paragem ideal: {dest.stop}</p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-gray-300" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminHubScreen({ lines, onSaveRoute, existingRoutes, onUpdateLines, onUpdateStatus, liveStatus, customStops, onSaveStops }) {
  const [activeTab, setActiveTab] = useState("board"); 
  const [selectedLineId, setSelectedLineId] = useState(lines[0]?.id || "");
  const [selectedDir, setSelectedDir] = useState(0); 
  const [adminDirs, setAdminDirs] = useState({});

  const line = lines.find(l => l.id === selectedLineId) || lines[0];
  const currentKey = `${line?.id}_dir_${selectedDir}`;
  
  const [rawPoints, setRawPoints] = useState([]);
  const [isReversed, setIsReversed] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [modalSavedOpen, setModalSavedOpen] = useState(false);

  const [isRecordingRoute, setIsRecordingRoute] = useState(false);
  const routeWatchRef = useRef(null);

  const stopsKey = `${line?.id}_dir_${selectedDir}_stops`;
  const [currentStops, setCurrentStops] = useState(line?.stops || []);
  const [newStopName, setNewStopName] = useState("");

  const getAdminDir = (id) => adminDirs[id] ?? 0;
  const toggleAdminDir = (id) => setAdminDirs(prev => ({ ...prev, [id]: prev[id] === 1 ? 0 : 1 }));

  useEffect(() => {
    if (line) {
      const data = existingRoutes[currentKey];
      if (Array.isArray(data)) {
        setRawPoints(data);
        setIsReversed(false);
      } else if (data && typeof data === 'object') {
        setRawPoints(data.points || []);
        setIsReversed(!!data.reverse);
      } else {
        setRawPoints([]);
        setIsReversed(false);
      }
      const savedStops = customStops[stopsKey];
      setCurrentStops(savedStops || line.stops);
    }
  }, [selectedLineId, selectedDir, existingRoutes, customStops]);

  const activeDisplayPoints = useMemo(() => {
    return isReversed ? [...rawPoints].reverse() : rawPoints;
  }, [rawPoints, isReversed]);

  const toggleRouteRecording = () => {
    if (!isRecordingRoute) {
      if (!("geolocation" in navigator)) return;
      setIsRecordingRoute(true);
      sendPushNotification("Gravação Iniciada", "O autocarro está a registar o percurso.");
      routeWatchRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setRawPoints(prev => [...prev, [latitude, longitude]]);
        },
        (err) => console.error(err),
        { enableHighAccuracy: true, distanceFilter: 4 }
      );
    } else {
      setIsRecordingRoute(false);
      if (routeWatchRef.current !== null) {
        navigator.geolocation.clearWatch(routeWatchRef.current);
        routeWatchRef.current = null;
      }
    }
  };

  const addCurrentWaypoint = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const { latitude, longitude } = pos.coords;
        setRawPoints(prev => [...prev, [latitude, longitude]]);
      });
    }
  };

  const handleSaveRouteToDb = () => {
    const payload = { points: rawPoints, reverse: isReversed };
    onSaveRoute(currentKey, payload);
    setModalSavedOpen(true);
  };

  const handleAddManualPoint = () => {
    try {
      const parts = manualInput.split(",").map(s => parseFloat(s.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        setRawPoints(prev => [...prev, parts]);
        setManualInput("");
      } else {
        alert("Formato inválido. Use: -24.72, -47.53");
      }
    } catch {
      alert("Erro ao ler coordenadas.");
    }
  };

  const handleAddStop = () => {
    if (!newStopName.trim()) return;
    const updated = [...currentStops, newStopName.trim()];
    setCurrentStops(updated);
    onSaveStops(stopsKey, updated);
    setNewStopName("");
  };

  const handleRemoveStop = (idx) => {
    const updated = currentStops.filter((_, i) => i !== idx);
    setCurrentStops(updated);
    onSaveStops(stopsKey, updated);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 pb-20 text-white overflow-hidden">
      <CustomModal isOpen={modalSavedOpen} onClose={() => setModalSavedOpen(false)} title="Sucesso">
        <div className="text-center space-y-3 py-2">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto"><Check size={24} /></div>
          <p className="text-sm font-bold text-gray-900">Trajeto guardado com sucesso no servidor!</p>
          <button onClick={() => setModalSavedOpen(false)} className="w-full bg-blue-600 text-white font-bold py-2.5 rounded-xl text-xs">OK</button>
        </div>
      </CustomModal>

      <div className="px-5 pt-6 pb-2 shrink-0 border-b border-slate-800">
        <p className="text-[11px] tracking-wider uppercase text-slate-400 font-bold">Painel de Controle ADM</p>
        <h1 className="text-lg font-extrabold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Gestão & Controlo Operacional</h1>
        
        <div className="flex gap-1.5 mt-3 overflow-x-auto hide-scrollbar">
          <button onClick={() => setActiveTab("board")} className={`py-1.5 px-3 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${activeTab === "board" ? "bg-blue-600 text-white shadow" : "bg-slate-800 text-slate-400"}`}>🚍 Controlador</button>
          <button onClick={() => setActiveTab("routes")} className={`py-1.5 px-3 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${activeTab === "routes" ? "bg-blue-600 text-white shadow" : "bg-slate-800 text-slate-400"}`}>🗺️ Traçado Manual</button>
          <button onClick={() => setActiveTab("stops")} className={`py-1.5 px-3 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${activeTab === "stops" ? "bg-blue-600 text-white shadow" : "bg-slate-800 text-slate-400"}`}>🚏 Paragens</button>
        </div>
      </div>

      {activeTab === "board" && (
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {lines.map((l) => {
            const currentDir = getAdminDir(l.id);
            const liveInfo = liveStatus[l.id] || { status: "parado", mensagem: "" };
            return (
              <div key={l.id} className="rounded-2xl bg-slate-800 border border-slate-700 p-3.5 space-y-2.5 shadow-sm">
                 <div className="flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <LineBadgeImage line={l} size={38} />
                      <div>
                         <p className="text-white font-bold text-[13px]">{l.name}</p>
                         <StatusLabel status={liveInfo.status} mode={liveInfo.mode} />
                      </div>
                   </div>
                 </div>

                 <button onClick={() => toggleAdminDir(l.id)} className="w-full flex items-center justify-between bg-slate-700/60 rounded-xl px-3 py-2 border border-slate-600 text-left">
                    <span className="text-[11px] font-bold text-slate-200 truncate pr-2">📍 {l.directions[currentDir]?.label || "Sentido"}</span>
                    <ArrowLeftRight size={12} className="text-blue-400 shrink-0" />
                 </button>
                 
                 <div className="grid grid-cols-3 gap-1.5">
                    <button onClick={() => {
                            const now = new Date();
                            const nowMins = now.getHours() * 60 + now.getMinutes();
                            const times = l.directions[currentDir]?.times || [];
                            const validTimes = getFilteredSortedTimes(times);
                            const activeTime = validTimes[0] || times[0];
                            onUpdateStatus(l.id, "em rota", `Saiu às ${activeTime}`, currentDir, nowMins, 0, activeTime);
                            sendPushNotification(`Partida Registada (${l.id.toUpperCase()})`, `Viagem iniciada com previsão por horário.`);
                          }} className="bg-blue-500/20 text-blue-400 border border-blue-500/50 rounded-xl py-2 text-[10px] font-bold uppercase transition-colors hover:bg-blue-500/30">Iniciar</button>
                    <button onClick={() => onUpdateStatus(l.id, "parado", "Aguardando horário.", currentDir, null)} className="bg-amber-500/20 text-amber-400 border border-amber-500/50 rounded-xl py-2 text-[10px] font-bold uppercase transition-colors hover:bg-amber-500/30">Parar</button>
                    <button onClick={() => onUpdateStatus(l.id, "problema", "Atraso reportado.", currentDir)} className="bg-red-500/20 text-red-400 border border-red-500/50 rounded-xl py-2 text-[10px] font-bold uppercase transition-colors hover:bg-red-500/30">Aviso</button>
                 </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === "routes" && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="px-4 py-2 bg-slate-800 border-b border-slate-700 flex items-center gap-2 shrink-0">
            <span className="text-[12px] font-bold text-slate-300">Linha:</span>
            <select 
              value={selectedLineId} 
              onChange={(e) => { setSelectedLineId(e.target.value); setSelectedDir(0); }} 
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-[12px] font-bold text-white outline-none"
            >
              {lines.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>

          <div className="bg-slate-800/80 px-4 py-2 border-b border-slate-700 flex gap-2 overflow-x-auto shrink-0 hide-scrollbar">
            {line?.directions?.map((dirObj, idx) => (
              <button 
                key={idx} 
                onClick={() => setSelectedDir(idx)} 
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${selectedDir === idx ? 'bg-blue-600 text-white shadow' : 'bg-slate-900 text-slate-400'}`}
              >
                {dirObj.label}
              </button>
            ))}
          </div>

          <div className="h-40 shrink-0 w-full relative z-0 border-b border-slate-700 bg-slate-800">
            <LeafletMap 
              points={activeDisplayPoints} 
              isConfig={true} 
              onAddPoint={(pt) => setRawPoints(p => [...p, pt])} 
              busProgress={-1} 
              lineColor="#60A5FA" 
            />
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-900">
            <div className="bg-blue-950/40 border border-blue-500/40 p-3 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-bold text-blue-300">📍 Adicionar Pontos Manualmente</p>
                  <p className="text-[10px] text-slate-300">Clique diretamente no mapa acima ou digite lat,lng:</p>
                </div>
                <button 
                  onClick={toggleRouteRecording} 
                  className={`px-3 py-2 rounded-xl text-[11px] font-bold transition-all shadow-md flex items-center gap-1.5 ${isRecordingRoute ? 'bg-red-600 text-white animate-pulse' : 'bg-blue-600 text-white hover:bg-blue-500'}`}
                >
                  <Radio size={13} /> {isRecordingRoute ? "A Gravar GPS" : "Gravar com GPS"}
                </button>
              </div>

              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={manualInput}
                  onChange={e => setManualInput(e.target.value)}
                  placeholder="-24.7253, -47.5342"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white outline-none"
                />
                <button onClick={handleAddManualPoint} className="bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-xl text-xs font-bold">Adicionar</button>
              </div>

              {isRecordingRoute && (
                <button 
                  onClick={addCurrentWaypoint}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 shadow"
                >
                  <CircleDot size={13} /> + Marcar Ponto Atual
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => setRawPoints([])} 
                className="flex-1 bg-red-500/20 text-red-400 border border-red-500/40 py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1"
              >
                <Trash2 size={13} /> Limpar Trajeto
              </button>
              <button 
                onClick={() => setIsReversed(!isReversed)} 
                className={`flex-1 py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 border ${isReversed ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800 text-slate-300 border-slate-700'}`}
              >
                <ArrowLeftRight size={13} /> {isReversed ? "Invertido (ON)" : "Inverter Sentido"}
              </button>
            </div>

            <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700 space-y-1">
              <p className="text-[11px] font-bold text-slate-300">Pontos Registados: {rawPoints.length}</p>
              <div className="max-h-24 overflow-y-auto text-[10px] text-slate-400 font-mono space-y-0.5">
                {rawPoints.map((pt, i) => (
                  <div key={i} className="flex justify-between items-center bg-slate-900 px-2 py-1 rounded">
                    <span>{i+1}. [{pt[0].toFixed(4)}, {pt[1].toFixed(4)}]</span>
                    <button onClick={() => setRawPoints(p => p.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-300"><Trash2 size={10}/></button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-800 shrink-0 border-t border-slate-700">
            <button onClick={handleSaveRouteToDb} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl text-[12px] flex items-center justify-center gap-2 shadow-md">
              <Check size={15} /> Guardar Trajeto no Servidor
            </button>
          </div>
        </div>
      )}

      {activeTab === "stops" && (
        <div className="flex flex-col flex-1 p-4 space-y-4 overflow-y-auto bg-slate-900">
          <div className="bg-slate-800 p-3.5 rounded-2xl border border-slate-700 space-y-3">
            <p className="text-xs font-bold text-slate-200">Adicionar Paragem à Linha</p>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={newStopName} 
                onChange={e => setNewStopName(e.target.value)} 
                placeholder="Nome da paragem..." 
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
              />
              <button onClick={handleAddStop} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1">
                <Plus size={14} /> Adicionar
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-400">Paragens Atuais:</p>
            {currentStops.map((stop, idx) => (
              <div key={idx} className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex justify-between items-center text-xs">
                <span>{idx + 1}. {stop}</span>
                <button onClick={() => handleRemoveStop(idx)} className="text-red-400 hover:text-red-300"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HomeScreen({ lines, onSelectLine, userDirs, toggleDir, liveStatus, customStops, onOpenPlanner, customRoutes }) {
  const [timeOffsets, setTimeOffsets] = useState({});
  const [nearestLineId, setNearestLineId] = useState(null);
  const [alertModalInfo, setAlertModalInfo] = useState({ isOpen: false, title: "", body: "" });

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          let minD = Infinity;
          let foundId = null;
          
          Object.keys(customRoutes).forEach(key => {
            const rData = customRoutes[key];
            const pts = Array.isArray(rData) ? rData : (rData.points || []);
            pts.forEach(pt => {
              const d = getDistance(pt, [latitude, longitude]);
              if (d < minD) {
                minD = d;
                foundId = key.split("_")[0];
              }
            });
          });
          if (foundId) setNearestLineId(foundId);
        },
        () => {},
        { enableHighAccuracy: true }
      );
    }
  }, [customRoutes]);

  const sortedLines = useMemo(() => {
    if (!nearestLineId) return lines;
    const copy = [...lines];
    const idx = copy.findIndex(l => l.id === nearestLineId);
    if (idx > 0) {
      const [item] = copy.splice(idx, 1);
      copy.unshift(item);
    }
    return copy;
  }, [lines, nearestLineId]);

  const handleOffsetTime = (lineId, dir, delta, filteredLen) => {
    setTimeOffsets(prev => {
      const key = `${lineId}_${dir}`;
      const current = prev[key] || 0;
      let next = current + delta;
      if (next < 0) next = 0; 
      if (next >= filteredLen) next = filteredLen - 1;
      return { ...prev, [key]: next };
    });
  };

  const handleProgramAlert = (line, timeStr, isThisTripRunning) => {
    if (isThisTripRunning) {
      sendPushNotification(`🔔 Alerta (${line.name})`, `O autocarro das ${timeStr} está em rota.`);
      setAlertModalInfo({
        isOpen: true,
        title: "Alerta de Aproximação",
        body: `Alerta ativado com sucesso para o autocarro da linha ${line.name} às ${timeStr}!`
      });
    } else {
      sendPushNotification(`🔔 Alerta Programado (${line.name})`, `Avisaremos 15 minutos antes da viagem das ${timeStr}.`);
      setAlertModalInfo({
        isOpen: true,
        title: "Alerta Programado",
        body: `Avisaremos 15 minutos antes da partida das ${timeStr} para a linha ${line.name}.`
      });
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 relative pb-20">
      <CustomModal isOpen={alertModalInfo.isOpen} onClose={() => setAlertModalInfo({ ...alertModalInfo, isOpen: false })} title={alertModalInfo.title}>
        <div className="space-y-4">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto shadow-inner"><Bell size={24} /></div>
          <p className="text-sm font-medium text-gray-700 leading-relaxed">{alertModalInfo.body}</p>
          <button 
            onClick={() => setAlertModalInfo({ ...alertModalInfo, isOpen: false })} 
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-2xl text-xs shadow-md transition-all"
          >
            Entendido
          </button>
        </div>
      </CustomModal>

      <div className="px-5 pt-7 pb-3 bg-white shadow-sm z-10 shrink-0 space-y-3">
        <div>
          <p className="text-[11px] tracking-wider uppercase text-blue-600 font-bold">Ilha Comprida</p>
          <h1 className="text-xl font-extrabold text-gray-900 mt-0.5" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Ônibus Ao Vivo</h1>
        </div>

        <button 
          onClick={onOpenPlanner}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-3.5 rounded-2xl shadow-md flex items-center justify-between active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center"><Navigation size={16} /></div>
            <div className="text-left">
              <p className="text-[13px] font-bold">Para onde vai hoje?</p>
              <p className="text-[10px] text-blue-100">Encontre a melhor rota e paragem ideal</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-blue-100" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {nearestLineId && (
          <div className="bg-blue-50 border border-blue-200 p-3 rounded-2xl flex items-center gap-3 shadow-sm animate-in fade-in">
            <div className="p-2 bg-blue-600 text-white rounded-xl"><Sparkles size={16} /></div>
            <div>
              <p className="text-xs font-bold text-blue-900">Linha mais próxima detetada por GPS</p>
              <p className="text-[11px] text-blue-700">A linha <b>{lines.find(l => l.id === nearestLineId)?.name}</b> foi colocada no topo.</p>
            </div>
          </div>
        )}

        {sortedLines.map((line) => {
          const dir = userDirs[line.id] ?? 0;
          const liveInfo = liveStatus[line.id] || { status: "parado", mensagem: "" };
          const rawTimes = line.directions[dir]?.times || [];
          const validTimes = getFilteredSortedTimes(rawTimes);
          
          const offsetKey = `${line.id}_${dir}`;
          const currentOffset = timeOffsets[offsetKey] || 0;
          const safeIndex = Math.min(currentOffset, validTimes.length - 1);
          const currentTime = validTimes[safeIndex] || "--:--";

          const activeTripTime = liveInfo.activeTime || validTimes[0];
          const isThisTripRunning = liveInfo.status === "em rota" && currentTime === activeTripTime;
          const isNearest = nearestLineId === line.id;

          return (
            <div key={line.id} className={`bg-white rounded-2xl shadow-sm border ${isNearest ? 'border-blue-600 ring-2 ring-blue-500/20' : 'border-gray-100'} overflow-hidden transition-all`}>
              <div className="w-full flex items-center justify-between px-4 py-2 bg-gray-50/80 border-b border-gray-100">
                <span className="text-[11px] font-bold text-gray-600 truncate pr-2">
                  {isNearest ? "⭐ Linha Mais Próxima de Si" : "Sentido Atual"}
                </span>
                <button onClick={(e) => { e.stopPropagation(); toggleDir(line.id); }} className="flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg shadow-sm transition-colors hover:bg-blue-100">
                  <ArrowLeftRight size={12} /> Inverter Sentido
                </button>
              </div>
              
              <div onClick={() => onSelectLine(line.id, dir)} className="p-3.5 cursor-pointer hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <LineBadgeImage line={line} size={44} />
                    <div>
                      <p className="text-[14px] font-bold text-gray-900 leading-tight">{line.directions[dir]?.label || "Sentido"}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <StatusDot status={isThisTripRunning ? "em rota" : "parado"} color={line.color} />
                        <StatusLabel status={isThisTripRunning ? "em rota" : "parado"} mode={liveInfo.mode} />
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-gray-300" />
                </div>

                <div className="mt-2.5 bg-gray-50 rounded-xl p-2.5 border border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-blue-500" />
                    <span className="text-[12px] text-gray-700 font-medium">Partida:</span>
                    <span className="text-[13px] font-extrabold text-gray-900">{currentTime}</span>
                  </div>

                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <button 
                      onClick={() => handleOffsetTime(line.id, dir, -1, validTimes.length)} 
                      disabled={safeIndex === 0}
                      className={`w-7 h-7 rounded-lg border flex items-center justify-center font-bold ${safeIndex === 0 ? 'bg-gray-100 text-gray-300 border-gray-100 cursor-not-allowed' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'}`}
                    >
                      ‹
                    </button>
                    <button 
                      onClick={() => handleOffsetTime(line.id, dir, 1, validTimes.length)} 
                      disabled={safeIndex >= validTimes.length - 1}
                      className={`w-7 h-7 rounded-lg border flex items-center justify-center font-bold ${safeIndex >= validTimes.length - 1 ? 'bg-gray-100 text-gray-300 border-gray-100 cursor-not-allowed' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'}`}
                    >
                      ›
                    </button>
                  </div>
                </div>
              </div>

              <div className="px-3.5 pb-3 flex gap-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); handleProgramAlert(line, currentTime, isThisTripRunning); }} 
                  className={`flex-1 py-2.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm ${isThisTripRunning ? 'bg-blue-50 hover:bg-blue-100 text-blue-700' : 'bg-blue-50 hover:bg-blue-100 text-blue-700'}`}
                >
                  <Bell size={13} /> {isThisTripRunning ? "Alerta de Aproximação" : "Programar Alerta (15m)"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SchedulesScreen({ lines, liveStatus }) {
  const [activeLineIdx, setActiveLineIdx] = useState(0);
  const [dir, setDir] = useState(0);

  const active = lines[activeLineIdx] || lines[0];
  const direction = active?.directions[dir] || active?.directions[0];
  
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const liveInfo = liveStatus[active?.id] || { status: "parado" };

  const handlePrevLine = () => {
    setActiveLineIdx((prev) => (prev === 0 ? lines.length - 1 : prev - 1));
    setDir(0);
  };

  const handleNextLine = () => {
    setActiveLineIdx((prev) => (prev === lines.length - 1 ? 0 : prev + 1));
    setDir(0);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 pb-20">
      <div className="px-5 pt-7 pb-3 bg-white shadow-sm z-10 shrink-0">
        <p className="text-[11px] tracking-wider uppercase text-blue-600 font-bold">Quadro da Prefeitura</p>
        <h1 className="text-xl font-extrabold text-gray-900 mt-0.5" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Horários Fixos</h1>
      </div>

      <div className="px-4 py-3 bg-white border-b border-gray-100 shrink-0 flex items-center justify-between shadow-sm">
        <button 
          onClick={handlePrevLine}
          className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700 transition-colors active:scale-95"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="flex items-center gap-2 text-center">
          <LineBadgeImage line={active} size={32} />
          <span className="text-[13px] font-extrabold text-gray-900 truncate max-w-[200px]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {active.name}
          </span>
        </div>

        <button 
          onClick={handleNextLine}
          className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700 transition-colors active:scale-95"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="px-4 my-2.5 shrink-0">
        {active?.directions && active.directions.length > 1 && (
          <button 
            onClick={() => setDir(dir === 0 ? 1 : 0)} 
            className="w-full flex items-center justify-between bg-white rounded-xl border border-gray-200 px-3.5 py-3 shadow-sm active:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <ArrowLeftRight size={15} className="text-blue-600" />
              <span className="text-[12px] font-bold text-gray-800">{direction?.label}</span>
            </div>
            <span className="text-[10px] uppercase font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">Inverter Sentido</span>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
          {(direction?.times || []).map((t, i) => {
            const timeStr = typeof t === "object" ? t.t : t;
            const tMins = timeToMinutes(timeStr);
            const isDelayed = liveInfo.status === "parado" && nowMins > tMins;

            return (
              <div key={i} className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                    <Clock size={14} className={isDelayed ? "text-red-500" : "text-gray-500"} />
                  </div>
                  <span className={`text-[15px] font-bold ${isDelayed ? "text-red-600" : "text-gray-900"}`}>{timeStr}</span>
                </div>
                {isDelayed && (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-full border border-red-200">
                    <AlertTriangle size={12} /> Atrasado
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AlertsScreen() {
  return (
    <div className="flex flex-col h-full bg-gray-50 pb-20">
      <div className="px-5 pt-7 pb-3 bg-white shadow-sm z-10 shrink-0">
        <p className="text-[11px] tracking-wider uppercase text-blue-600 font-bold">Notificações</p>
        <h1 className="text-xl font-extrabold text-gray-900 mt-0.5" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Meus Alertas</h1>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="bg-white rounded-2xl p-6 text-center border border-gray-200 shadow-sm">
          <Bell size={28} className="text-blue-500 mx-auto mb-2" />
          <p className="text-[14px] font-bold text-gray-900">Nenhum alerta ativo</p>
        </div>
      </div>
    </div>
  );
}

const TABS = [
  { id: "home", label: "Rotas", icon: MapPin },
  { id: "schedules", label: "Horários", icon: Clock },
  { id: "alerts", label: "Alertas", icon: Bell },
  { id: "admin", label: "Motorista", icon: Settings },
];

export default function App() {
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [tab, setTab] = useState("home");
  const [overlay, setOverlay] = useState(null);
  const [lines, setLines] = useState(INITIAL_LINES);
  const [liveStatus, setLiveStatus] = useState({});
  const [userDirs, setUserDirs] = useState({});
  const [customRoutes, setCustomRoutes] = useState({});
  const [customStops, setCustomStops] = useState({});

  useEffect(() => {
    const hasSeen = localStorage.getItem("onboarding_seen");
    if (hasSeen) setShowOnboarding(false);
  }, []);

  const handleFinishOnboarding = () => {
    localStorage.setItem("onboarding_seen", "true");
    setShowOnboarding(false);
  };

  const toggleUserDir = (id) => setUserDirs((prev) => ({ ...prev, [id]: (prev[id] ?? 0) === 0 ? 1 : 0 }));

  useEffect(() => {
    const fetchDados = async () => {
      const { data: statusData } = await supabase.from("linhas_onibus").select("*");
      if (statusData) {
        const mapa = {};
        statusData.forEach(item => {
          mapa[item.id] = {
            status: item.status,
            mensagem: item.mensagem,
            direcao_ativa: item.direcao_ativa,
            startTimeMins: item.start_time_mins !== undefined ? item.start_time_mins : undefined,
            gpsProgress: item.gps_progress !== undefined ? item.gps_progress : undefined,
            activeTime: item.active_time || undefined,
            mode: item.gps_progress !== undefined && item.gps_progress >= 0 ? "GPS Ao Vivo" : "Previsão por Horário"
          };
        });
        setLiveStatus(mapa);
      }
      const { data: rotasData } = await supabase.from("geometria_linhas").select("*");
      if (rotasData) {
        const rotasMapa = {};
        rotasData.forEach(r => rotasMapa[r.linha_id] = r.pontos);
        setCustomRoutes(rotasMapa);
      }
    };
    fetchDados();
  }, []);

  useEffect(() => {
    if (!showOnboarding && "geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const { latitude, longitude, speed } = position.coords;
          const currentSpeedKmH = speed ? speed * 3.6 : 0;

          if (currentSpeedKmH > 15) {
            const lineId = "cv";
            const routeKey = `${lineId}_dir_0`;
            const routeData = customRoutes[routeKey];
            const pts = Array.isArray(routeData) ? routeData : (routeData?.points || []);

            if (pts.length >= 2) {
              let minDist = Infinity;
              let closestIdx = 0;
              pts.forEach((pt, idx) => {
                const dist = getDistance(pt, [latitude, longitude]);
                if (dist < minDist) {
                  minDist = dist;
                  closestIdx = idx;
                }
              });

              if (minDist < 0.0015) {
                const progress = closestIdx / (pts.length - 1);
                const now = new Date();
                const nowMins = now.getHours() * 60 + now.getMinutes();
                const lineObj = lines.find(l => l.id === lineId);
                const validTimes = getFilteredSortedTimes(lineObj?.directions[0]?.times || []);
                const activeTime = validTimes[0] || "06:00";

                const payload = {
                  status: "em rota",
                  last_update: `hoje às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
                  mensagem: "Partilha Colaborativa Ativa",
                  direcao_ativa: 0,
                  start_time_mins: nowMins,
                  gps_progress: progress,
                  active_time: activeTime
                };

                setLiveStatus(prev => ({
                  ...prev,
                  [lineId]: { status: "em rota", startTimeMins: nowMins, gpsProgress: progress, activeTime: activeTime, mode: "GPS Ao Vivo" }
                }));
                await supabase.from("linhas_onibus").update(payload).eq("id", lineId);
              }
            }
          }
        },
        (error) => console.error("Erro GPS inteligente:", error),
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 5000 }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [showOnboarding, customRoutes, lines]);

  const salvarRotaNoSupabase = async (routeKey, routePayload) => {
    setCustomRoutes(prev => ({ ...prev, [routeKey]: routePayload }));
    await supabase.from("geometria_linhas").upsert({ linha_id: routeKey, pontos: routePayload });
  };

  const salvarParagensNoSupabase = async (stopsKey, stopsArray) => {
    setCustomStops(prev => ({ ...prev, [stopsKey]: stopsArray }));
    await supabase.from("geometria_linhas").upsert({ linha_id: stopsKey, pontos: stopsArray });
  };

  const atualizarStatusBD = async (id, novoStatus, novaMensagem, direcaoSelecionada, startTimeMins = null, gpsProgress = null, activeTime = null) => {
    const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const payload = { 
      status: novoStatus, 
      last_update: `hoje às ${hora}`, 
      mensagem: novaMensagem, 
      direcao_ativa: direcaoSelecionada 
    };
    if (startTimeMins !== null) payload.start_time_mins = startTimeMins;
    if (gpsProgress !== null) payload.gps_progress = gpsProgress;
    if (activeTime !== null) payload.active_time = activeTime;

    setLiveStatus((prev) => ({
      ...prev,
      [id]: { 
        ...prev[id], 
        ...payload, 
        startTimeMins: startTimeMins !== null ? startTimeMins : (novoStatus === "parado" ? undefined : prev[id]?.startTimeMins),
        gpsProgress: gpsProgress !== null ? gpsProgress : prev[id]?.gpsProgress,
        activeTime: activeTime !== null ? activeTime : (novoStatus === "parado" ? undefined : prev[id]?.activeTime),
        mode: gpsProgress !== null && gpsProgress >= 0 ? "GPS Ao Vivo" : "Previsão por Horário"
      }
    }));
    await supabase.from("linhas_onibus").update(payload).eq("id", id);
  };

  if (showOnboarding) {
    return <OnboardingScreen onComplete={handleFinishOnboarding} />;
  }

  const isAdmin = tab === "admin" && !overlay;

  let content;
  if (overlay?.type === "detail") {
    const line = lines.find((l) => l.id === overlay.lineId);
    content = <LineDetailScreen line={line} initialDir={userDirs[line.id]} onBack={() => setOverlay(null)} customRoutes={customRoutes} liveStatus={liveStatus} customStops={customStops} />;
  } else if (overlay?.type === "planner") {
    content = <TripPlannerScreen lines={lines} customStops={customStops} onSelectRoute={(lineId) => setOverlay({ type: "detail", lineId })} />;
  } else if (tab === "home") {
    content = <HomeScreen lines={lines} onSelectLine={(id, dir) => { setUserDirs((p) => ({ ...p, [id]: dir })); setOverlay({ type: "detail", lineId: id }); }} userDirs={userDirs} toggleDir={toggleUserDir} liveStatus={liveStatus} customStops={customStops} onOpenPlanner={() => setOverlay({ type: "planner" })} customRoutes={customRoutes} />;
  } else if (tab === "schedules") {
    content = <SchedulesScreen lines={lines} liveStatus={liveStatus} />;
  } else if (tab === "alerts") {
    content = <AlertsScreen />;
  } else {
    content = <AdminHubScreen lines={lines} onSaveRoute={salvarRotaNoSupabase} existingRoutes={customRoutes} onUpdateLines={setLines} onUpdateStatus={atualizarStatusBD} liveStatus={liveStatus} customStops={customStops} onSaveStops={salvarParagensNoSupabase} />;
  }

  return (
    <div className="h-[100dvh] w-full flex flex-col font-sans overflow-hidden bg-white">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700;800&display=swap');
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
      <div className="flex-1 w-full relative overflow-hidden bg-gray-50">{content}</div>
      <div className={`fixed bottom-0 left-0 right-0 w-full flex items-center justify-around px-2 pt-2.5 pb-5 border-t z-50 transition-colors ${isAdmin ? "bg-slate-900 border-slate-800" : "bg-white border-gray-100"}`}>
        {TABS.map((t) => {
          const Icon = t.icon;
          const activeTab = !overlay && tab === t.id;
          const color = activeTab ? (isAdmin ? "#60A5FA" : "#2563EB") : (isAdmin ? "#64748B" : "#9CA3AF");
          return (
            <button key={t.id} onClick={() => { setTab(t.id); setOverlay(null); }} className="flex flex-col items-center gap-1 px-4 py-1 active:scale-90 transition-transform">
              <Icon size={20} color={color} />
              <span className="text-[10px] font-bold" style={{ color }}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
