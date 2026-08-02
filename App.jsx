import React, { useState, useEffect, useMemo, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  MapPin, Clock, Bell, Settings, AlertTriangle, Check,
  ChevronRight, ChevronLeft, ArrowLeftRight, X,
  Search, Navigation, List, Sparkles, Footprints, Target, Bus
} from "lucide-react";

// Injeta o Tailwind e o Leaflet automaticamente
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

// --- 1. LIGAÇÃO AO SUPABASE ---
const supabaseUrl = "https://ytkmadmrepcshqmjkvju.supabase.co";
const supabaseKey = "sb_publishable_Kiwjlm3cwE64xoBxVGDrvw_QQwA56zL";
const supabase = createClient(supabaseUrl, supabaseKey);

// --- 2. TODAS AS LINHAS OFICIAIS DE ILHA COMPRIDA ---
const SIMULATED_TRIP_DURATION = 45; 

const INITIAL_LINES = [
  {
    id: "cv", name: "Rodoviária / Curitiba-Vitória", color: "#1D4ED8",
    stops: ["Rodoviária", "Centro", "Curitiba-Vitória"],
    directions: [
      { label: "Rodoviária → Curitiba-Vitória", times: ["06:00","07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"] },
      { label: "Curitiba-Vitória → Rodoviária", times: ["06:30","07:30","08:30","09:30","10:30","11:30","12:30","13:30","14:30","15:30","16:30","17:30","18:30"] },
    ],
  },
  {
    id: "pp", name: "Ponta da Praia / Praça dos Maçons", color: "#2563EB",
    stops: ["Ponta da Praia", "Avenida Beira-Mar", "Passarela do Rocio", "Praça dos Maçons"],
    directions: [
      { label: "Ponta da Praia → Praça dos Maçons", times: ["06:40","10:00","12:00","14:30","16:30","19:30","23:00"] },
      { label: "Praça dos Maçons → Ponta da Praia", times: ["05:40","08:50","11:00","13:00","15:30","18:30","22:00"] },
    ],
  },
  {
    id: "pm", name: "Praça dos Maçons / Pedrinhas", color: "#3B82F6",
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
    id: "pi", name: "Pedrinhas / Iguape", color: "#38BDF8", 
    stops: ["Pedrinhas", "Balsa de Iguape", "Centro Histórico (Iguape)"],
    directions: [
      { label: "Pedrinhas → Iguape", times: ["06:00", "09:00", "13:00", "17:00"] },
      { label: "Iguape → Pedrinhas", times: ["07:30", "11:00", "15:00", "19:00"] },
    ],
  },
];

// --- FUNÇÕES DE TEMPO E CÁLCULO ---
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

// CORREÇÃO AQUI: Agora a viagem continua a mostrar progresso no mapa se o status for "problema"
function getActiveTripProgress(durationMins, liveInfo) {
  if (!liveInfo || (liveInfo.status !== "em rota" && liveInfo.status !== "problema")) {
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

// --- MODAL REUTILIZÁVEL ---
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

// --- ONBOARDING COM PERMISSÕES ---
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
    setTimeout(() => { onComplete(); }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 bg-blue-950 flex flex-col items-center justify-between p-6 text-white text-center animate-in fade-in duration-500">
      <div className="w-full flex justify-end">
        <span className="text-[11px] uppercase tracking-widest text-blue-300 font-bold bg-blue-900/60 px-3 py-1.5 rounded-full border border-blue-500/30">Configuração Inicial</span>
      </div>

      <div className="space-y-6 my-auto max-w-sm w-full">
        <div className="w-24 h-24 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-3xl mx-auto flex items-center justify-center shadow-[0_0_35px_rgba(37,99,235,0.4)] animate-bounce">
          <Bus size={42} className="text-white" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Ilha Comprida Ônibus
          </h1>
          <p className="text-blue-200 text-xs leading-relaxed">
            Permita o acesso à localização e notificações em segundo plano para rastreamento em tempo real.
          </p>
        </div>

        <div className="bg-blue-900/90 border border-blue-800 p-4 rounded-2xl text-left space-y-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl shrink-0 ${permStatus.loc ? 'bg-blue-400 text-slate-950' : 'bg-blue-800 text-blue-200'}`}><Navigation size={16} /></div>
            <div className="flex-1">
              <p className="text-xs font-bold text-white">Geolocalização & Segundo Plano</p>
              <p className="text-[10px] text-blue-300">Identifica a linha mais próxima de si.</p>
            </div>
            {permStatus.loc && <Check size={16} className="text-blue-300" />}
          </div>

          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl shrink-0 ${permStatus.notif ? 'bg-blue-400 text-slate-950' : 'bg-blue-800 text-blue-200'}`}><Bell size={16} /></div>
            <div className="flex-1">
              <p className="text-xs font-bold text-white">Notificações Push</p>
              <p className="text-[10px] text-blue-300">Avisos atempados de aproximação.</p>
            </div>
            {permStatus.notif && <Check size={16} className="text-blue-300" />}
          </div>
        </div>
      </div>

      <div className="w-full max-w-sm pb-6">
        <button 
          onClick={handleRequestAll}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-extrabold py-4 rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-transform active:scale-95 text-sm"
        >
          <Sparkles size={18} /> {loading ? "A configurar..." : "Permitir e Iniciar Aplicação"}
        </button>
      </div>
    </div>
  );
}

// CORREÇÃO: Ponto de Status com suporte a cor de aviso (vermelho)
function StatusDot({ status, color }) {
  const isProblem = status === "problema";
  const pulsing = status === "em rota";
  const dotColor = isProblem ? "#EF4444" : color;
  
  return (
    <span className="relative flex h-3 w-3">
      {pulsing && <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ backgroundColor: dotColor }} />}
      <span className="relative inline-flex rounded-full h-3 w-3" style={{ backgroundColor: dotColor }} />
    </span>
  );
}

function StatusLabel({ status, mode }) {
  const map = {
    "em rota": { text: mode === "GPS Ao Vivo" ? "Ao Vivo (GPS)" : "Previsão (Horário)", cls: "text-blue-700 bg-blue-50 border border-blue-200" },
    parado: { text: "Aguardando Partida", cls: "text-amber-700 bg-amber-50 border border-amber-200" },
    problema: { text: "Aviso na via / Atraso", cls: "text-red-700 bg-red-50 border border-red-200 font-extrabold" },
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

// --- MAPA LEAFLET NATIVO ---
function LeafletMap({ points, busProgress = -1, lineColor, hasProblem = false }) {
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
            
            // Se houver problema, a linha fica vermelha
            const progressColor = hasProblem ? '#EF4444' : '#2563EB';
            container._redLayer = window.L.polyline(traversedPoints, { color: progressColor, weight: 5 }).addTo(map);
            
            const busHtml = `<div style="background-color: white; border: 3px solid ${progressColor}; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.5); font-size: 14px;">${hasProblem ? '⚠️' : '🚌'}</div>`;
            const busIcon = window.L.divIcon({ html: busHtml, className: '', iconSize: [28, 28], iconAnchor: [14, 14] });
            container._busMarker = window.L.marker(currentPoint, { icon: busIcon }).addTo(map);
            
            map.panTo(currentPoint, { animate: true, duration: 0.8 });
          }
        }
      }
    }, 100);

    return () => clearInterval(checkL);
  }, [pathData, busProgress, mapId, lineColor, hasProblem]); 

  return <div id={mapId} style={{ width: '100%', height: '100%', zIndex: 1, backgroundColor: '#e5e7eb' }}></div>;
}

// --- TELA DE DETALHE DA LINHA ---
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
  const userAlertTime = parseInt(localStorage.getItem('notif_minutes') || '10', 10);

  // CORREÇÃO: O alerta vermelho agora sobrepõe o mapa caso o status seja problema
  useEffect(() => {
    const updateSimulation = () => {
      const trip = getActiveTripProgress(SIMULATED_TRIP_DURATION, liveInfo);
      if (trip.active) {
        setSimulatedProgress(trip.progress);
        setActiveTripInfo(trip);

        if (alertTargetStop !== null && liveInfo.status === "em rota") {
          const stopPercentage = alertTargetStop / Math.max(1, activeStops.length - 1);
          const diff = stopPercentage - trip.progress;
          if (diff >= 0 && diff <= 0.08 && !alertedStopsRef.current.has(alertTargetStop)) {
            alertedStopsRef.current.add(alertTargetStop);
            const stopName = activeStops[alertTargetStop];
            sendPushNotification("🚌 Alerta de Proximidade", `O autocarro está a aproximar-se de ${stopName}!`);
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
      
      <div className="px-3 py-2 bg-white border-b border-gray-100 flex items-center justify-between gap-2 shrink-0 z-10 shadow-sm">
        <button onClick={() => setDir(dir === 0 ? 1 : 0)} className="flex-1 flex items-center justify-between bg-gray-50 rounded-lg border border-gray-200 px-3 py-2 text-[12px] font-bold text-gray-800 active:bg-gray-100">
          <span className="truncate">{activeDirection.label}</span>
          <ArrowLeftRight size={13} className="text-blue-600 shrink-0 ml-2" />
        </button>
      </div>

      <div className="h-[35vh] w-full relative z-0 border-b border-gray-200 shadow-sm">
        {simulatedProgress >= 0 && liveInfo.status === "em rota" ? (
           <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full shadow-md z-[1000] flex items-center gap-2 border border-blue-100">
             <span className="relative flex h-2 w-2"><span className="animate-ping absolute h-full w-full rounded-full opacity-60 bg-blue-500"></span><span className="relative rounded-full h-2 w-2 bg-blue-500"></span></span>
             <span className="text-[10px] font-bold text-blue-800 uppercase">{activeTripInfo?.mode || "Em Viagem"}</span>
           </div>
        ) : liveInfo.status === "problema" ? (
           <div className="absolute top-2 right-2 bg-red-600/95 backdrop-blur-md px-3 py-1.5 rounded-full shadow-lg z-[1000] border border-red-700 flex items-center gap-2">
             <AlertTriangle size={14} className="text-white animate-pulse" />
             <span className="text-[10px] font-bold text-white uppercase">{liveInfo.mensagem || "Aviso Reportado"}</span>
           </div>
        ) : (
           <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full shadow-md z-[1000] border border-amber-100">
             <span className="text-[10px] font-bold text-amber-800 uppercase flex items-center gap-1"><Clock size={12}/> Aguardando Partida</span>
           </div>
        )}
        <LeafletMap points={currentRoutePoints} busProgress={simulatedProgress} lineColor={line.color} hasProblem={liveInfo.status === "problema"} />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 bg-white space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-bold text-gray-900 flex items-center gap-1.5"><List size={16} /> Paragens e Alerta ({userAlertTime} min)</h3>
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
                else if (liveInfo.status === "problema") statusColor = "text-red-600 font-extrabold";
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

             const linhaProgressoCor = liveInfo.status === "problema" ? "bg-red-500" : "bg-blue-600";

             return (
               <div key={idx} className="relative pl-7">
                 {idx < activeStops.length - 1 && (
                   <div className="absolute left-[7px] top-5 w-[3px] h-full bg-gray-200 overflow-hidden z-0">
                     <div 
                       className={`w-full transition-all duration-500 ${linhaProgressoCor}`} 
                       style={{ height: `${segmentFillPercent}%` }} 
                     />
                   </div>
                 )}

                 <div className={`absolute -left-[1px] top-1 w-4 h-4 rounded-full border-2 flex items-center justify-center bg-white z-10 ${hasPassed ? (liveInfo.status === 'problema' ? 'border-red-500 bg-red-50' : 'border-blue-600 bg-blue-50') : isNext ? 'border-blue-500 shadow-[0_0_8px_rgba(37,99,235,0.6)]' : 'border-gray-300'}`}>
                    {hasPassed && <Check size={10} className={liveInfo.status === 'problema' ? "text-red-500 stroke-[3]" : "text-blue-600 stroke-[3]"} />}
                    {isNext && <span className={`absolute w-2 h-2 rounded-full animate-pulse ${liveInfo.status === 'problema' ? 'bg-red-500' : 'bg-blue-600'}`} />}
                 </div>
                 
                 <div className="flex justify-between items-center bg-gray-50/80 p-2.5 rounded-xl border border-gray-100 shadow-sm">
                   <div>
                     <p className={`text-[13px] ${isNext ? 'font-bold text-blue-900' : hasPassed ? 'text-gray-700 font-medium' : 'text-gray-500'}`}>{stop}</p>
                   </div>
                   <div className="flex items-center gap-2">
                     <span className={`text-[13px] ${statusColor}`}>{timeText}</span>
                     <button 
                       onClick={() => {
                         setAlertTargetStop(idx);
                         sendPushNotification("Alerta Programado", `Avisaremos quando o autocarro estiver a ${userAlertTime} min de ${stop}.`);
                       }}
                       className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-sm transition-colors ${isTarget ? 'bg-amber-500 text-white' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                     >
                       <Bell size={12} /> {isTarget ? "Ativo" : `Alerta ${userAlertTime}m`}
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

// --- TELA DE PLANEAMENTO DE DESTINO ---
function TripPlannerScreen({ lines, onSelectRoute }) {
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
                <p className="text-[11px] text-gray-500">{selectedResult.walkMins} minutos ({selectedResult.distanceKm}) a pé a partir da paragem.</p>
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

// --- TELA DE DEFINIÇÕES ---
function ClientSettingsScreen() {
  const [notifMinutes, setNotifMinutes] = useState(() => localStorage.getItem('notif_minutes') || '10');
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('notif_sound') === 'true' || true);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    localStorage.setItem('notif_minutes', notifMinutes);
    localStorage.setItem('notif_sound', soundEnabled);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 pb-20">
      <div className="px-5 pt-7 pb-3 bg-white shadow-sm z-10 shrink-0">
        <p className="text-[11px] tracking-wider uppercase text-blue-600 font-bold">Preferências do Utilizador</p>
        <h1 className="text-xl font-extrabold text-gray-900 mt-0.5" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Definições</h1>
      </div>

      <div className="p-4 flex-1 overflow-y-auto space-y-4">
        {saveSuccess && (
          <div className="bg-blue-50 border border-blue-200 text-blue-900 p-3 rounded-2xl text-xs flex items-center gap-2 shadow-sm animate-in fade-in">
            <Check size={16} className="text-blue-600 shrink-0" /> Definições guardadas com sucesso!
          </div>
        )}

        <form onSubmit={handleSave} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-gray-800 flex items-center gap-1.5">
              <Bell size={15} className="text-blue-600" /> Tempo de Antecedência do Alerta:
            </label>
            <select 
              value={notifMinutes}
              onChange={(e) => setNotifMinutes(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs bg-gray-50 font-bold text-gray-800 focus:outline-none focus:border-blue-600 mt-1"
            >
              <option value="3">3 minutos antes</option>
              <option value="5">5 minutos antes</option>
              <option value="10">10 minutos antes (Padrão)</option>
              <option value="15">15 minutos antes</option>
              <option value="20">20 minutos antes</option>
            </select>
          </div>

          <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-200">
            <div>
              <p className="text-xs font-bold text-gray-900">Som de Notificação Ativo</p>
              <p className="text-[10px] text-gray-500">Emitir alerta sonoro ao aproximar</p>
            </div>
            <input 
              type="checkbox" 
              checked={soundEnabled}
              onChange={(e) => setSoundEnabled(e.target.checked)}
              className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 accent-blue-600 cursor-pointer"
            />
          </div>

          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl text-xs shadow-md transition-all active:scale-95">
            Guardar Configurações
          </button>
        </form>
      </div>
    </div>
  );
}

// --- TELA INICIAL COM DETEÇÃO DE GPS OTIMIZADA ---
function HomeScreen({ lines, onSelectLine, userDirs, toggleDir, liveStatus, onOpenPlanner, customRoutes }) {
  const [timeOffsets, setTimeOffsets] = useState({});
  const [nearestLineId, setNearestLineId] = useState(null);
  const [alertModalInfo, setAlertModalInfo] = useState({ isOpen: false, title: "", body: "" });

  // CORREÇÃO: Olheiro contínuo de GPS para detetar aproximação de forma inteligente
  useEffect(() => {
    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          let minD = Infinity;
          let foundId = null;
          
          Object.keys(customRoutes).forEach(key => {
            const rData = customRoutes[key];
            const pts = Array.isArray(rData) ? rData : (rData.points || []);
            pts.forEach(pt => {
              const d = getDistance(pt, [latitude, longitude]);
              if (d < minD) { minD = d; foundId = key.split("_")[0]; }
            });
          });
          
          // Se a distância for razoavelmente curta, destaca a linha
          if (foundId && minD < 0.05) { 
            setNearestLineId(foundId); 
          }
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
      );
      
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [customRoutes]);

  const sortedLines = useMemo(() => {
    if (!nearestLineId) return lines;
    const copy = [...lines];
    const idx = copy.findIndex(l => l.id === nearestLineId);
    if (idx > 0) { const [item] = copy.splice(idx, 1); copy.unshift(item); }
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

  const userAlertTime = parseInt(localStorage.getItem('notif_minutes') || '10', 10);

  const handleProgramAlert = (line, timeStr, isThisTripRunning) => {
    if (isThisTripRunning) {
      sendPushNotification(`🔔 Alerta (${line.name})`, `O autocarro das ${timeStr} está em rota.`);
      setAlertModalInfo({
        isOpen: true,
        title: "Alerta de Aproximação",
        body: `Alerta ativado com sucesso para o autocarro da linha ${line.name} às ${timeStr}!`
      });
    } else {
      sendPushNotification(`🔔 Alerta Programado (${line.name})`, `Avisaremos ${userAlertTime} minutos antes da viagem das ${timeStr}.`);
      setAlertModalInfo({
        isOpen: true,
        title: "Alerta Programado",
        body: `Avisaremos ${userAlertTime} minutos antes da partida das ${timeStr} para a linha ${line.name}.`
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
              <p className="text-xs font-bold text-blue-900">Linha detetada por GPS</p>
              <p className="text-[11px] text-blue-700">Você está perto da linha <b>{lines.find(l => l.id === nearestLineId)?.name}</b>.</p>
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
          // CORREÇÃO: Tratamos 'problema' como uma viagem que ainda está a ocorrer (foi iniciada)
          const isThisTripRunning = (liveInfo.status === "em rota" || liveInfo.status === "problema") && currentTime === activeTripTime;
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
                        <StatusDot status={isThisTripRunning ? liveInfo.status : "parado"} color={line.color} />
                        <StatusLabel status={isThisTripRunning ? liveInfo.status : "parado"} mode={liveInfo.mode} />
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-gray-300" />
                </div>

                <div className="mt-2.5 bg-gray-50 rounded-xl p-2.5 border border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-amber-500" />
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
                  <Bell size={13} /> {isThisTripRunning ? "Alerta de Aproximação" : `Programar Alerta (${userAlertTime}m)`}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- TELA DE HORÁRIOS FIXOS ---
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
        <div className="bg-white rounded-2xl p-6 text-center border border-gray-200 shadow-sm space-y-2">
          <Bell size={28} className="text-blue-600 mx-auto" />
          <p className="text-[14px] font-bold text-gray-900">Nenhum alerta ativo no momento</p>
          <p className="text-xs text-gray-500">Programe alertas nas suas linhas favoritas para ser notificado em segundo plano.</p>
        </div>
      </div>
    </div>
  );
}

// --- APP PRINCIPAL DO CLIENTE ---
const TABS = [
  { id: "home", label: "Rotas", icon: MapPin },
  { id: "schedules", label: "Horários", icon: Clock },
  { id: "alerts", label: "Alertas", icon: Bell },
  { id: "settings", label: "Definições", icon: Settings },
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
    if (localStorage.getItem("onboarding_seen")) setShowOnboarding(false);
  }, []);

  const handleFinishOnboarding = () => {
    localStorage.setItem("onboarding_seen", "true");
    setShowOnboarding(false);
  };

  const toggleUserDir = (id) => setUserDirs((prev) => ({ ...prev, [id]: (prev[id] ?? 0) === 0 ? 1 : 0 }));

  // --- BUSCA E REALTIME DO SUPABASE ---
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

    // SUBSCRIÇÃO REALTIME: Atualiza o app cliente instantaneamente
    const channel = supabase
      .channel('public:linhas_onibus')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'linhas_onibus' }, (payload) => {
        const item = payload.new;
        if (item && item.id) {
          setLiveStatus(prev => ({
            ...prev,
            [item.id]: {
              status: item.status,
              mensagem: item.mensagem,
              direcao_ativa: item.direcao_ativa,
              startTimeMins: item.start_time_mins !== undefined ? item.start_time_mins : undefined,
              gpsProgress: item.gps_progress !== undefined ? item.gps_progress : undefined,
              activeTime: item.active_time || undefined,
              mode: item.gps_progress !== undefined && item.gps_progress >= 0 ? "GPS Ao Vivo" : "Previsão por Horário"
            }
          }));
        }
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  if (showOnboarding) {
    return <OnboardingScreen onComplete={handleFinishOnboarding} />;
  }

  let content;
  if (overlay?.type === "detail") {
    const line = lines.find((l) => l.id === overlay.lineId);
    content = <LineDetailScreen line={line} initialDir={userDirs[line.id]} onBack={() => setOverlay(null)} customRoutes={customRoutes} liveStatus={liveStatus} customStops={customStops} />;
  } else if (overlay?.type === "planner") {
    content = <TripPlannerScreen lines={lines} onSelectRoute={(lineId) => setOverlay({ type: "detail", lineId })} />;
  } else if (tab === "home") {
    content = <HomeScreen lines={lines} onSelectLine={(id, dir) => { setUserDirs((p) => ({ ...p, [id]: dir })); setOverlay({ type: "detail", lineId: id }); }} userDirs={userDirs} toggleDir={toggleUserDir} liveStatus={liveStatus} onOpenPlanner={() => setOverlay({ type: "planner" })} customRoutes={customRoutes} />;
  } else if (tab === "schedules") {
    content = <SchedulesScreen lines={lines} liveStatus={liveStatus} />;
  } else if (tab === "alerts") {
    content = <AlertsScreen />;
  } else if (tab === "settings") {
    content = <ClientSettingsScreen />;
  }

  return (
    <div className="h-[100dvh] w-full flex flex-col font-sans overflow-hidden bg-white">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700;800&display=swap');
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
      <div className="flex-1 w-full relative overflow-hidden bg-gray-50">{content}</div>
      <div className="fixed bottom-0 left-0 right-0 w-full flex items-center justify-around px-2 pt-2.5 pb-5 border-t z-50 bg-white border-gray-100 shadow-lg">
        {TABS.map((t) => {
          const Icon = t.icon;
          const activeTab = !overlay && tab === t.id;
          const color = activeTab ? "#2563EB" : "#9CA3AF";
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
