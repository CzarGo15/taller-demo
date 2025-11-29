# --- SCRIPT DE REPARACIÓN TALLER ARREDONDO ---
Write-Host "🚀 Iniciando reconstrucción total del proyecto..." -ForegroundColor Cyan

# 1. Limpiar carpetas antiguas para evitar conflictos
Remove-Item -Path "src" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "public" -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path "public" | Out-Null
New-Item -ItemType Directory -Force -Path "src" | Out-Null

# 2. Crear package.json
$pkg = @'
{
  "name": "taller-demo",
  "version": "0.1.0",
  "private": true,
  "homepage": "https://CzarGo15.github.io/taller-demo",
  "dependencies": {
    "@testing-library/dom": "^10.4.1",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^13.5.0",
    "firebase": "^11.3.1",
    "gh-pages": "^6.3.0",
    "lucide-react": "^0.475.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-scripts": "5.0.1",
    "web-vitals": "^2.1.4"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject",
    "predeploy": "npm run build",
    "deploy": "gh-pages -d build"
  },
  "eslintConfig": { "extends": [ "react-app", "react-app/jest" ] },
  "browserslist": {
    "production": [ ">0.2%", "not dead", "not op_mini all" ],
    "development": [ "last 1 chrome version", "last 1 firefox version", "last 1 safari version" ]
  },
  "devDependencies": {
    "autoprefixer": "^10.4.20",
    "postcss": "^8.5.3",
    "tailwindcss": "^3.4.17"
  }
}
'@
Set-Content "package.json" $pkg -Encoding UTF8
Write-Host "✅ package.json creado" -ForegroundColor Green

# 3. Crear public/index.html
$html = @'
<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Taller Arredondo</title>
    <style>
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
      .loading-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        color: #333;
        background-color: #f5f5f5;
      }
      .loader {
        border: 5px solid #f3f3f3;
        border-top: 5px solid #3498db;
        border-radius: 50%;
        width: 50px;
        height: 50px;
        animation: spin 1s linear infinite;
        margin-bottom: 20px;
      }
      @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
  </head>
  <body>
    <noscript>Necesitas activar JavaScript para usar esta aplicación.</noscript>
    <div id="root">
      <div class="loading-container">
        <div class="loader"></div>
        <h2>Iniciando Sistema...</h2>
        <p>Si esto tarda, intenta recargar la página.</p>
      </div>
    </div>
  </body>
</html>
'@
Set-Content "public/index.html" $html -Encoding UTF8
Write-Host "✅ public/index.html creado" -ForegroundColor Green

# 4. Crear src/index.css
$css = @'
@tailwind base;
@tailwind components;
@tailwind utilities;

@media print {
  body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  .print\:hidden { display: none !important; }
  .print\:block { display: block !important; }
  .print\:flex { display: flex !important; }
  @page { margin: 0.5cm; size: letter portrait; }
  .print-mode { width: 100%; max-width: 100%; background: white; position: absolute; top: 0; left: 0; margin: 0; padding: 0; font-size: 10pt; }
}
'@
Set-Content "src/index.css" $css -Encoding UTF8
Write-Host "✅ src/index.css creado" -ForegroundColor Green

# 5. Crear src/index.js
$idxjs = @'
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const container = document.getElementById('root');
if (container) {
  const root = ReactDOM.createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  console.error("ERROR FATAL: No se encontró el elemento root en el HTML");
}
'@
Set-Content "src/index.js" $idxjs -Encoding UTF8
Write-Host "✅ src/index.js creado" -ForegroundColor Green

# 6. Configs
Set-Content "tailwind.config.js" "module.exports = { content: ['./src/**/*.{js,jsx,ts,tsx}'], theme: { extend: {} }, plugins: [] }" -Encoding UTF8
Set-Content "postcss.config.js" "module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } }" -Encoding UTF8
Write-Host "✅ Configs creadas" -ForegroundColor Green

# 7. Crear src/App.js (Lógica completa)
$app = @'
import React, { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, addDoc, query, onSnapshot, orderBy, serverTimestamp, doc, updateDoc } from "firebase/firestore";
import { Save, Printer, Car, Plus, Search, CheckCircle, Trash2, Menu, X, PenTool } from "lucide-react";

const firebaseConfig = {
  apiKey: "AIzaSyC8gfIHJ1yrF0BYo8eIxcc-3YWHn3jjong",
  authDomain: "desayunos-685c6.firebaseapp.com",
  projectId: "desayunos-685c6",
  storageBucket: "desayunos-685c6.firebasestorage.app",
  messagingSenderId: "1019036287793",
  appId: "1:1019036287793:web:125da6f4009275c491e610",
  measurementId: "G-RCMS88889V"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const COLLECTION_NAME = "taller-arredondo-ordenes";

function InputRow({ label, value, onChange = () => {}, readOnly = false, fullWidth = false }) {
  return (
    <div className={`flex items-center gap-1 ${fullWidth ? "w-full" : ""}`}>
      <span className="font-bold text-gray-700 whitespace-nowrap">{label}:</span>
      {readOnly ? (
        <span className="border-b border-gray-300 px-1 flex-1 truncate">{value}</span>
      ) : (
        <input className="border-b border-gray-300 px-1 outline-none focus:border-blue-500 bg-transparent flex-1 w-full" value={value || ""} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

function BooleanCheck({ label, checked, onChange }) {
  return (
    <div className="flex items-center gap-1 cursor-pointer" onClick={() => onChange && onChange(!checked)}>
      <div className={`w-3 h-3 border border-gray-400 flex items-center justify-center ${checked ? "bg-blue-900 text-white" : "bg-white"}`}>{checked && <div className="w-2 h-2 bg-blue-900" />}</div><span>{label}</span>
    </div>
  );
}

function InventoryItem({ label, value, onChange }) {
  return (
    <div className="flex justify-between items-center px-1 border-b border-gray-100 h-5">
      <span className="truncate w-24">{label}</span>
      <div className="flex gap-0.5 print:hidden">
        <button onClick={() => onChange("si")} className={`px-1 rounded ${value === "si" ? "bg-green-200 text-green-800 font-bold" : "bg-gray-100 text-gray-400"}`}>Si</button>
        <button onClick={() => onChange("no")} className={`px-1 rounded ${value === "no" ? "bg-gray-200 text-gray-800 font-bold" : "bg-gray-100 text-gray-400"}`}>No</button>
        <button onClick={() => onChange("mal")} className={`px-1 rounded ${value === "mal" ? "bg-red-200 text-red-800 font-bold" : "bg-gray-100 text-gray-400"}`}>M</button>
      </div>
      <div className="hidden print:block font-bold w-6 text-center border-l border-gray-200">{value === "si" ? "SI" : value === "no" ? "NO" : value === "mal" ? "M" : "-"}</div>
    </div>
  );
}

function SimpleStateToggle({ value, onChange }) {
  const labels = { undefined: "-", si: "SI", no: "NO", mal: "M" };
  const colors = { undefined: "text-gray-300", si: "text-green-600", no: "text-gray-500", mal: "text-red-600" };
  const toggle = () => {
    const states = [undefined, "si", "no", "mal"];
    const currIdx = states.indexOf(value);
    const nextIdx = (currIdx + 1) % states.length;
    onChange(states[nextIdx]);
  };
  return (<div onClick={toggle} className={`cursor-pointer font-bold font-mono ${colors[value]} print:text-black`}>{labels[value] || "-"}</div>);
}

function SignaturePad({ onSave }) {
  const canvasRef = useRef(null);
  const [hasSignature, setHasSignature] = useState(false);
  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    ctx.beginPath(); ctx.moveTo(x, y); setHasSignature(true);
  };
  const draw = (e) => {
    if (e.buttons !== 1 && e.type !== "touchmove") return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    ctx.lineTo(x, y); ctx.stroke();
  };
  const save = () => { if (canvasRef.current) onSave(canvasRef.current.toDataURL("image/png")); };
  const clear = () => { const ctx = canvasRef.current?.getContext("2d"); if (ctx) { ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height); setHasSignature(false); } };
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) { canvas.width = canvas.parentElement?.offsetWidth || 300; canvas.height = 96; const ctx = canvas.getContext("2d"); ctx.strokeStyle = "#000"; ctx.lineWidth = 2; ctx.lineCap = "round"; }
  }, []);
  return (
    <div className="w-full h-full relative group print:hidden bg-gray-50 border border-gray-200">
      {!hasSignature && <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300 pointer-events-none"><PenTool className="w-6 h-6 mb-1 opacity-50" /><span className="text-xs">Firmar Aquí</span></div>}
      <canvas ref={canvasRef} onMouseDown={startDrawing} onMouseMove={draw} onTouchStart={startDrawing} onTouchMove={draw} className="w-full h-full cursor-crosshair touch-none" />
      {hasSignature && <div className="absolute top-0 right-0 flex gap-1 p-1"><button onClick={clear} className="bg-red-100 text-red-600 p-1 rounded hover:bg-red-200"><Trash2 className="w-4 h-4" /></button><button onClick={save} className="bg-green-100 text-green-600 p-1 rounded hover:bg-green-200"><CheckCircle className="w-4 h-4" /></button></div>}
    </div>
  );
}

function CarDiagram() {
  return (
    <div className="w-full h-full flex items-center justify-center p-2 pointer-events-none">
      <svg viewBox="0 0 300 200" className="w-full h-full opacity-50">
        <rect x="100" y="40" width="100" height="120" rx="10" fill="none" stroke="currentColor" strokeWidth="2" />
        <line x1="100" y1="80" x2="200" y2="80" stroke="currentColor" strokeWidth="2" />
        <line x1="100" y1="130" x2="200" y2="130" stroke="currentColor" strokeWidth="2" />
        <path d="M 110,40 L 110,10 L 190,10 L 190,40" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M 110,160 L 110,190 L 190,190 L 190,160" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M 100,50 L 50,50 L 50,150 L 100,150" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="75" cy="70" r="12" fill="none" stroke="currentColor" />
        <circle cx="75" cy="130" r="12" fill="none" stroke="currentColor" />
        <path d="M 200,50 L 250,50 L 250,150 L 200,150" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="225" cy="70" r="12" fill="none" stroke="currentColor" />
        <circle cx="225" cy="130" r="12" fill="none" stroke="currentColor" />
        <text x="150" y="30" textAnchor="middle" fontSize="10">FRENTE</text>
        <text x="150" y="180" textAnchor="middle" fontSize="10">ATRÁS</text>
        <text x="30" y="100" textAnchor="middle" fontSize="10" transform="rotate(-90 30,100)">IZQ</text>
        <text x="270" y="100" textAnchor="middle" fontSize="10" transform="rotate(90 270,100)">DER</text>
      </svg>
    </div>
  );
}

const INVENTORY_GROUPS = {
  interiores: ["Tablero", "Func. Indicadores", "Func. A/C", "Controles A/C", "Cenicero", "Encendedor", "Guantera", "Retrovisor", "Luz Interior", "Viseras", "Claxon", "Equipo Audio Orig.", "Equipo Audio Adap.", "Alarma", "Bocinas", "Tapetes", "Tapicería", "Cielo", "Cinturones"],
  motor: ["Batería", "Tapón Radiador", "Radiador", "Tapón Aceite", "Bandas", "Bayoneta Motor", "Bayoneta Transm.", "Purificador", "Cables Bujías", "Depósito Agua", "Liq. Frenos", "Computadora"],
  exterior: ["Luces Exteriores", "Cuartos", "Emblemas", "Espejo Lateral", "Cristales", "Manijas", "Limpiaparabrisas", "Antena", "Tapa Gasolina", "Tapón Gasolina", "Molduras", "Parrilla", "Faros", "Faros Niebla", "Defensa Del.", "Defensa Tras."],
  cajuela: ["Refacción", "Gato", "Llave Cruz/L", "Herramienta", "Tapete Cajuela", "Extinguidor", "Cables Corriente", "Señales Carretera"],
  llantas: ["Marca", "Vida Util %", "Rines", "Tapones"]
};

export default function App() {
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [view, setView] = useState("list");
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, COLLECTION_NAME), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user]);

  const createNewOrder = () => {
    const newId = (orders.length + 4250).toString();
    setCurrentOrder({
      orderNumber: newId, status: "active", createdAt: null, insurer: "", policy: "", insured: "", deductible: "", claimNumber: "",
      brand: "", model: "", type: "", color: "", plates: "", vin: "", mileage: "", fuelLevel: 50,
      transmission: "auto", ac: true, upholstery: "tela", windows: "electricos", steering: "hidraulica", sunroof: false,
      inventory: {}, damages: [], preexistingDamages: [], damagesDescription: "", observations: "",
      clientName: "", clientAddress: "", clientPhone: "", clientEmail: "", clientSignature: ""
    });
    setView("form");
  };

  const saveOrder = async () => {
    if (!user || !currentOrder) return;
    try {
      const colRef = collection(db, COLLECTION_NAME);
      const dataToSave = JSON.parse(JSON.stringify(currentOrder));
      if (currentOrder.id) {
        await updateDoc(doc(colRef, currentOrder.id), dataToSave);
      } else {
        await addDoc(colRef, { ...dataToSave, createdAt: serverTimestamp() });
      }
      alert("Orden guardada!");
      setView("list");
    } catch (e) { alert("Error: " + e.message); }
  };

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => { window.print(); setIsPrinting(false); }, 500);
  };

  const addDamage = (e, type) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setCurrentOrder(prev => ({ ...prev, [type]: [...(prev[type] || []), { x, y, id: Date.now() }] }));
  };

  if (!user) return <div className="h-screen flex items-center justify-center font-bold text-xl text-blue-800">Cargando sistema...</div>;

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 font-sans">
      {view === "list" && (
        <div className="p-6 max-w-5xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-blue-900 flex items-center gap-2"><Car /> Taller Arredondo</h1>
            <button onClick={createNewOrder} className="bg-blue-600 text-white px-6 py-3 rounded-lg shadow flex items-center gap-2 hover:bg-blue-700"><Plus /> Nueva Orden</button>
          </div>
          <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
            {orders.length === 0 ? <div className="p-12 text-center text-gray-400">No hay órdenes registradas.</div> : 
              <div className="divide-y divide-gray-100">{orders.map(o => (
                  <div key={o.id} onClick={() => { setCurrentOrder(o); setView("form"); }} className="p-4 hover:bg-blue-50 cursor-pointer flex justify-between items-center">
                    <div><div className="font-bold text-lg">{o.brand} {o.model} <span className="text-gray-400 text-sm">#{o.orderNumber}</span></div><div className="text-sm text-gray-500">{o.clientName} • {o.plates}</div></div>
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full font-bold">{o.status === "active" ? "En Taller" : "Entregado"}</span>
                  </div>
              ))}</div>
            }
          </div>
        </div>
      )}

      {view === "form" && currentOrder && (
        <div className={`bg-white min-h-screen ${isPrinting ? "print-mode" : ""}`}>
          <div className="print:hidden sticky top-0 z-50 bg-white border-b shadow p-4 flex justify-between items-center">
            <button onClick={() => setView("list")} className="flex items-center gap-2 text-gray-600 hover:bg-gray-100 px-3 py-2 rounded"><Menu size={18}/> Volver</button>
            <div className="flex gap-2"><button onClick={handlePrint} className="flex items-center gap-2 bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-800"><Printer size={18}/> Imprimir</button><button onClick={saveOrder} className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 shadow"><Save size={18}/> Guardar</button></div>
          </div>
          <div className="max-w-[21cm] mx-auto bg-white p-8 print:p-0">
            <div className="flex border-2 border-blue-900 rounded-lg p-2 mb-2">
              <div className="w-1/3 text-[10px] leading-tight"><div className="text-blue-900 font-black italic text-xl flex items-center gap-2"><Car className="w-8 h-8" /><div><div>MULTISERVICIO</div><div className="text-sm font-normal">AUTOMOTRIZ ARREDONDO</div></div></div><div className="mt-2 text-gray-600">Quevedo 2708 Col. Puerto México<br/>Coatzacoalcos, Ver.<br/>Tels: (921) 21 3 77 98 / 921 569 6614</div></div>
              <div className="w-1/3 text-center pt-2"><h2 className="text-xl font-bold uppercase border-b-2 border-blue-900 inline-block mb-1">Orden de Trabajo</h2><div className="text-red-600 font-mono text-2xl font-bold">No. {currentOrder.orderNumber}</div><div className="text-[9px] text-gray-500">Horario: L-V 8:30 a 18:30 | Sáb 8:30 a 14:00</div></div>
              <div className="w-1/3 text-[10px] pl-2 border-l border-gray-200 flex flex-col justify-center space-y-1">
                <InputRow label="Fecha" value={new Date().toLocaleDateString()} readOnly />
                <InputRow label="Aseguradora" value={currentOrder.insurer} onChange={(v) => setCurrentOrder({...currentOrder, insurer: v})} />
                <InputRow label="Póliza" value={currentOrder.policy} onChange={(v) => setCurrentOrder({...currentOrder, policy: v})} />
                <InputRow label="Siniestro" value={currentOrder.claimNumber} onChange={(v) => setCurrentOrder({...currentOrder, claimNumber: v})} />
                <InputRow label="Deducible" value={currentOrder.deductible} onChange={(v) => setCurrentOrder({...currentOrder, deductible: v})} />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-x-2 gap-y-1 text-[11px] border border-gray-300 p-2 rounded mb-2">
              <InputRow label="Marca" value={currentOrder.brand} onChange={(v) => setCurrentOrder({...currentOrder, brand: v})} />
              <InputRow label="Modelo" value={currentOrder.model} onChange={(v) => setCurrentOrder({...currentOrder, model: v})} />
              <InputRow label="Tipo" value={currentOrder.type} onChange={(v) => setCurrentOrder({...currentOrder, type: v})} />
              <InputRow label="Color" value={currentOrder.color} onChange={(v) => setCurrentOrder({...currentOrder, color: v})} />
              <InputRow label="Placas" value={currentOrder.plates} onChange={(v) => setCurrentOrder({...currentOrder, plates: v})} />
              <InputRow label="No. Serie" value={currentOrder.vin} onChange={(v) => setCurrentOrder({...currentOrder, vin: v})} />
              <InputRow label="Kms" value={currentOrder.mileage} onChange={(v) => setCurrentOrder({...currentOrder, mileage: v})} />
              <div className="flex items-center gap-1">
                <span className="font-bold">Gasolina:</span>
                <input type="range" min="0" max="100" step="25" className="w-16 h-2 print:hidden" value={currentOrder.fuelLevel} onChange={(e) => setCurrentOrder({...currentOrder, fuelLevel: parseInt(e.target.value)})} />
                <div className="flex w-16 h-3 border border-gray-400 relative text-[8px] justify-between px-1"><div className="absolute top-0 left-0 h-full bg-gray-600" style={{width: `${currentOrder.fuelLevel}%`}}></div><span className="z-10 text-white mix-blend-difference">E</span><span className="z-10 text-white mix-blend-difference">F</span></div>
              </div>
              <div className="col-span-4 flex justify-between border-t pt-1 mt-1">
                <BooleanCheck label="Automática" checked={currentOrder.transmission === "auto"} onChange={() => setCurrentOrder({...currentOrder, transmission: "auto"})} />
                <BooleanCheck label="Estándar" checked={currentOrder.transmission === "std"} onChange={() => setCurrentOrder({...currentOrder, transmission: "std"})} />
                <BooleanCheck label="A/C" checked={currentOrder.ac} onChange={(v) => setCurrentOrder({...currentOrder, ac: v})} />
                <BooleanCheck label="Vidrios Elec." checked={currentOrder.windows === "electricos"} onChange={() => setCurrentOrder({...currentOrder, windows: "electricos"})} />
                <BooleanCheck label="Quemacocos" checked={currentOrder.sunroof} onChange={(v) => setCurrentOrder({...currentOrder, sunroof: v})} />
                <BooleanCheck label="Piel" checked={currentOrder.upholstery === "piel"} onChange={() => setCurrentOrder({...currentOrder, upholstery: "piel"})} />
              </div>
              <div className="col-span-4 border-t pt-1 mt-1 grid grid-cols-2 gap-2">
                <InputRow label="Cliente" value={currentOrder.clientName} onChange={(v) => setCurrentOrder({...currentOrder, clientName: v})} fullWidth />
                <InputRow label="Tel" value={currentOrder.clientPhone} onChange={(v) => setCurrentOrder({...currentOrder, clientPhone: v})} fullWidth />
                <InputRow className="col-span-2" label="Dirección" value={currentOrder.clientAddress} onChange={(v) => setCurrentOrder({...currentOrder, clientAddress: v})} fullWidth />
              </div>
            </div>
            <div className="mb-2 border border-gray-300 text-[9px]">
              <div className="bg-blue-900 text-white text-center font-bold uppercase py-0.5">Inventario del Vehículo</div>
              <div className="grid grid-cols-5">
                <div className="col-span-2 border-r border-gray-300"><div className="font-bold bg-gray-100 p-1 border-b">INTERIORES</div>{INVENTORY_GROUPS.interiores.map(i => <InventoryItem key={i} label={i} value={currentOrder.inventory[i]} onChange={(v) => setCurrentOrder(prev => ({...prev, inventory: {...prev.inventory, [i]: v}}))} />)}</div>
                <div className="col-span-2 border-r border-gray-300"><div className="font-bold bg-gray-100 p-1 border-b">MOTOR / LLANTAS</div>{INVENTORY_GROUPS.motor.map(i => <InventoryItem key={i} label={i} value={currentOrder.inventory[i]} onChange={(v) => setCurrentOrder(prev => ({...prev, inventory: {...prev.inventory, [i]: v}}))} />)}<div className="bg-gray-100 font-bold p-1 border-y">LLANTAS</div>{INVENTORY_GROUPS.llantas.map(i => <InventoryItem key={i} label={i} value={currentOrder.inventory[i]} onChange={(v) => setCurrentOrder(prev => ({...prev, inventory: {...prev.inventory, [i]: v}}))} />)}</div>
                <div className="col-span-1"><div className="font-bold bg-gray-100 p-1 border-b">EXTERIOR</div>{INVENTORY_GROUPS.exterior.map(i => <div key={i} className="flex justify-between px-1 border-b h-5 items-center"><span className="truncate">{i}</span><SimpleStateToggle value={currentOrder.inventory[i]} onChange={(v) => setCurrentOrder(prev => ({...prev, inventory: {...prev.inventory, [i]: v}}))} /></div>)}<div className="bg-gray-100 font-bold p-1 border-y">CAJUELA</div>{INVENTORY_GROUPS.cajuela.map(i => <div key={i} className="flex justify-between px-1 border-b h-5 items-center"><span className="truncate">{i}</span><SimpleStateToggle value={currentOrder.inventory[i]} onChange={(v) => setCurrentOrder(prev => ({...prev, inventory: {...prev.inventory, [i]: v}}))} /></div>)}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 h-48 mb-2">
              <div className="flex flex-col border border-gray-300 rounded p-1">
                <div className="text-[10px] font-bold bg-red-100 text-red-800 px-1 rounded mb-1 text-center">DAÑOS DEL SINIESTRO (ROJO)</div>
                <div className="relative flex-1 cursor-crosshair overflow-hidden border border-gray-100" onClick={(e) => addDamage(e, "damages")}>
                  <CarDiagram />
                  {(currentOrder.damages || []).map(d => <div key={d.id} className="absolute text-red-600 font-bold transform -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{left: `${d.x}%`, top: `${d.y}%`}}>❌</div>)}
                </div>
                <div className="flex justify-between items-end mt-1 h-12">
                  <textarea className="w-full h-full text-[10px] bg-transparent resize-none border-t border-gray-200 outline-none p-1" placeholder="Descripción..." value={currentOrder.damagesDescription} onChange={(e) => setCurrentOrder({...currentOrder, damagesDescription: e.target.value})} />
                  <button onClick={() => setCurrentOrder({...currentOrder, damages: []})} className="text-red-500 text-[10px] px-1 print:hidden hover:bg-red-50 rounded">Borrar</button>
                </div>
              </div>
              <div className="flex flex-col border border-gray-300 rounded p-1">
                <div className="text-[10px] font-bold bg-yellow-100 text-yellow-800 px-1 rounded mb-1 text-center">DAÑOS PREEXISTENTES (AMARILLO)</div>
                <div className="relative flex-1 cursor-crosshair overflow-hidden border border-gray-100" onClick={(e) => addDamage(e, "preexistingDamages")}>
                  <CarDiagram />
                  {(currentOrder.preexistingDamages || []).map(d => <div key={d.id} className="absolute text-orange-500 font-bold transform -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{left: `${d.x}%`, top: `${d.y}%`}}>⚠️</div>)}
                </div>
                <div className="flex justify-between items-end mt-1 h-12">
                  <textarea className="w-full h-full text-[10px] bg-transparent resize-none border-t border-gray-200 outline-none p-1" placeholder="Observaciones..." value={currentOrder.observations} onChange={(e) => setCurrentOrder({...currentOrder, observations: e.target.value})} />
                  <button onClick={() => setCurrentOrder({...currentOrder, preexistingDamages: []})} className="text-yellow-600 text-[10px] px-1 print:hidden hover:bg-yellow-50 rounded">Borrar</button>
                </div>
              </div>
            </div>
            <div className="mt-4 border-t-2 border-gray-800 pt-2 flex justify-center">
              <div className="w-64 text-center">
                <div className="h-20 border-b border-gray-400 mb-1 flex items-end justify-center">
                  {currentOrder.clientSignature ? (
                    <div className="relative w-full h-full flex items-center justify-center"><img src={currentOrder.clientSignature} className="max-h-full" alt="Firma" /><button onClick={() => setCurrentOrder({...currentOrder, clientSignature: ""})} className="absolute top-0 right-0 p-1 bg-gray-100 rounded-full print:hidden"><X size={12}/></button></div>
                  ) : <SignaturePad onSave={(s) => setCurrentOrder({...currentOrder, clientSignature: s})} />}
                </div>
                <div className="font-bold text-[10px]">FIRMA DE CONFORMIDAD</div>
                <div className="text-[8px] text-gray-500 text-justify leading-tight mt-1">Reconozco que el vehículo presenta los daños descritos y autorizo la revisión. La empresa no se hace responsable por objetos olvidados.</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
'@
Set-Content -Path "src/App.js" -Value $appContent -Encoding UTF8
Write-Host "✅ src/App.js creado" -ForegroundColor Green

Write-Host "`n🎉 REPARACIÓN COMPLETADA. Ahora ejecuta:" -ForegroundColor Yellow
Write-Host "1. git add ."
Write-Host "2. git commit -m 'Reparacion final'"
Write-Host "3. git push"
Write-Host "4. npm run deploy"