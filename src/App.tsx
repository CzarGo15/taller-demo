import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithCustomToken
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  onSnapshot, 
  orderBy, 
  serverTimestamp,
  doc,
  updateDoc
} from 'firebase/firestore';
import { 
  Save, 
  Printer, 
  Car, 
  Plus, 
  Search, 
  CheckCircle, 
  Trash2,
  Menu,
  X,
  PenTool
} from 'lucide-react';

// --- CONFIGURACIÓN DE FIREBASE ---

// 1. Declaración de variables globales del entorno de prueba
declare const __firebase_config: string;
declare const __app_id: string;
declare const __initial_auth_token: string;

// 2. Lógica Híbrida:
//    - Si estamos en la vista previa, usa __firebase_config.
//    - Si estamos en tu computadora/GitHub, usa tus claves manuales.

let firebaseConfig;
let appIdStr = 'default-app-id';

try {
  // Intenta cargar la configuración automática del entorno
  if (typeof __firebase_config !== 'undefined') {
    firebaseConfig = JSON.parse(__firebase_config);
    appIdStr = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
  } else {
    // -----------------------------------------------------------
    // PARA GITHUB / TU COMPUTADORA:
    // Si __firebase_config no existe (al subirlo a GitHub), 
    // el sistema usará estos datos. REEMPLÁZALOS con los reales.
    // -----------------------------------------------------------
    firebaseConfig = {
      apiKey: "PEGA_AQUI_TU_API_KEY_REAL",
      authDomain: "tu-proyecto.firebaseapp.com",
      projectId: "tu-proyecto",
      storageBucket: "tu-proyecto.appspot.com",
      messagingSenderId: "123456789",
      appId: "1:123456789:web:abcdef"
    };
    appIdStr = "taller-arredondo-prod";
  }
} catch (e) {
  console.error("Error cargando configuración", e);
}

// Inicialización
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = appIdStr;

// --- TIPOS DE DATOS ---
type InventoryItemState = 'si' | 'no' | 'mal';

interface ServiceOrder {
  id?: string;
  orderNumber: string;
  createdAt: any;
  status: 'active' | 'completed';
  
  // Datos Cliente/Seguro
  insurer: string;
  policy: string;
  insured: string;
  deductible: string;
  claimNumber: string; 
  
  // Datos Vehículo
  brand: string;
  model: string;
  type: string;
  color: string;
  plates: string;
  vin: string; 
  mileage: string;
  fuelLevel: number; 
  
  // Extras Vehículo
  transmission: 'auto' | 'std';
  ac: boolean;
  upholstery: 'piel' | 'tela';
  windows: 'electricos' | 'manuales';
  steering: 'hidraulica' | 'mecanica';
  sunroof: boolean;
  
  // Inventario
  inventory: Record<string, InventoryItemState>;
  
  // Daños
  damages: { x: number; y: number; id: number }[]; // Siniestro (Rojo)
  preexistingDamages: { x: number; y: number; id: number }[]; // Preexistentes (Amarillo)
  
  // Observaciones
  damagesDescription: string;
  observations: string;
  
  // Cliente & Firma
  clientName: string;
  clientAddress: string;
  clientPhone: string;
  clientEmail: string;
  clientSignature?: string; // Imagen en base64
}

// --- DATOS DEL FORMULARIO ---
const INVENTORY_GROUPS = {
  interiores: [
    "Tablero", "Func. Indicadores", "Func. A/C", "Controles A/C", "Cenicero", 
    "Encendedor", "Guantera", "Retrovisor", "Luz Interior", "Viseras", 
    "Claxon", "Equipo Audio Orig.", "Equipo Audio Adap.", "Alarma", "Bocinas", 
    "Tapetes", "Tapicería", "Cielo", "Cinturones"
  ],
  motor: [
    "Batería", "Tapón Radiador", "Radiador", "Tapón Aceite", "Bandas", 
    "Bayoneta Motor", "Bayoneta Transm.", "Purificador", "Cables Bujías", 
    "Depósito Agua", "Liq. Frenos", "Computadora"
  ],
  exterior: [
    "Luces Exteriores", "Cuartos", "Emblemas", "Espejo Lateral", "Cristales", 
    "Manijas", "Limpiaparabrisas", "Antena", "Tapa Gasolina", "Tapón Gasolina",
    "Molduras", "Parrilla", "Faros", "Faros Niebla", "Defensa Del.", "Defensa Tras."
  ],
  cajuela: [
    "Refacción", "Gato", "Llave Cruz/L", "Herramienta", "Tapete Cajuela", 
    "Extinguidor", "Cables Corriente", "Señales Carretera"
  ],
  llantas: [
    "Marca", "Vida Util %", "Rines", "Tapones"
  ]
};

// --- COMPONENTE PRINCIPAL ---
export default function App() {
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [currentOrder, setCurrentOrder] = useState<ServiceOrder | null>(null);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [isPrinting, setIsPrinting] = useState(false);

  // 1. Autenticación (Híbrida para soporte local y remoto)
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          // Autenticación especial para el entorno de prueba
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          // Autenticación estándar para GitHub/Producción
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Error en autenticación:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. Cargar Órdenes en Tiempo Real
  useEffect(() => {
    if (!user) return;
    
    // Usamos 'public/data' para demo pública o 'users/{uid}' para privada.
    // Para esta demo, usaremos una colección pública compartida para facilitar la prueba.
    const collectionPath = typeof __firebase_config !== 'undefined' 
      ? collection(db, 'artifacts', appId, 'public', 'data', 'orders') // Entorno de prueba
      : collection(db, 'service_orders_app', appId, 'orders'); // Entorno producción

    const q = query(
      collectionPath,
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServiceOrder));
      setOrders(data);
    }, (error) => console.error("Error cargando órdenes:", error));
    
    return () => unsubscribe();
  }, [user]);

  // Crear nueva orden vacía
  const createNewOrder = () => {
    const newOrder: ServiceOrder = {
      orderNumber: (orders.length + 4250).toString(), // Simulación de folio
      status: 'active',
      createdAt: null,
      insurer: '', policy: '', insured: '', deductible: '', claimNumber: '',
      brand: '', model: '', type: '', color: '', plates: '', vin: '', mileage: '', fuelLevel: 50,
      transmission: 'auto', ac: true, upholstery: 'tela', windows: 'electricos', steering: 'hidraulica', sunroof: false,
      inventory: {},
      damages: [],
      preexistingDamages: [], 
      damagesDescription: '', observations: '',
      clientName: '', clientAddress: '', clientPhone: '', clientEmail: '',
      clientSignature: ''
    };
    setCurrentOrder(newOrder);
    setView('form');
  };

  // Guardar en Firestore
  const saveOrder = async () => {
    if (!user || !currentOrder) return;
    
    try {
      const collectionPath = typeof __firebase_config !== 'undefined' 
        ? collection(db, 'artifacts', appId, 'public', 'data', 'orders') 
        : collection(db, 'service_orders_app', appId, 'orders');
      
      const orderToSave = JSON.parse(JSON.stringify(currentOrder)); // Limpiar undefineds

      if (currentOrder.id) {
        // Actualizar existente
        // Nota: En producción esto sería doc(db, 'service_orders_app', ...).
        // Aquí simplificamos la lógica de ruta para el ejemplo.
        const docRef = doc(collectionPath, currentOrder.id);
        await updateDoc(docRef, { ...orderToSave });
      } else {
        // Crear nueva
        await addDoc(collectionPath, {
          ...orderToSave,
          createdAt: serverTimestamp()
        });
      }
      alert('Orden guardada correctamente');
      setView('list');
    } catch (e) {
      console.error("Error al guardar:", e);
      alert('Error al guardar. Verifica tu conexión.');
    }
  };

  // Función de impresión
  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 500);
  };

  if (!user) return <div className="flex items-center justify-center h-screen">Conectando al sistema...</div>;

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-800">
      {/* --- VISTA: LISTA DE ÓRDENES --- */}
      {view === 'list' && (
        <div className="p-6 max-w-5xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-blue-900 flex items-center gap-2">
              <Car className="w-8 h-8" />
              Taller Arredondo
            </h1>
            <button 
              onClick={createNewOrder}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 hover:bg-blue-700 transition"
            >
              <Plus className="w-5 h-5" /> Nueva Orden
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
            <div className="p-4 border-b bg-gray-50 flex gap-4">
              <Search className="text-gray-400" />
              <input placeholder="Buscar por placa o cliente..." className="bg-transparent outline-none flex-1" />
            </div>
            {orders.length === 0 ? (
              <div className="p-12 text-center text-gray-400">No hay órdenes registradas aún.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {orders.map(order => (
                  <div key={order.id} className="p-4 hover:bg-blue-50 cursor-pointer transition flex justify-between items-center" onClick={() => { setCurrentOrder(order); setView('form'); }}>
                    <div>
                      <div className="font-bold text-lg">{order.brand} {order.model} <span className="text-gray-400 text-sm">#{order.orderNumber}</span></div>
                      <div className="text-sm text-gray-500">{order.clientName} • {order.plates}</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-xs px-2 py-1 rounded-full ${order.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {order.status === 'active' ? 'En Taller' : 'Entregado'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- VISTA: FORMULARIO DETALLADO --- */}
      {view === 'form' && currentOrder && (
        <div className={`bg-white min-h-screen ${isPrinting ? 'print-mode' : ''}`}>
          
          {/* BARRA SUPERIOR (NO IMPRIMIBLE) */}
          <div className="print:hidden sticky top-0 z-50 bg-white border-b shadow-md p-4 flex justify-between items-center">
            <button onClick={() => setView('list')} className="text-gray-600 hover:bg-gray-100 p-2 rounded flex gap-2 items-center">
              <Menu className="w-5 h-5" /> Volver
            </button>
            <div className="font-bold text-lg hidden md:block">Orden #{currentOrder.orderNumber} - {currentOrder.plates || 'Nueva'}</div>
            <div className="flex gap-2">
              <button onClick={handlePrint} className="bg-gray-700 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-gray-800">
                <Printer className="w-4 h-4" /> Imprimir
              </button>
              <button onClick={saveOrder} className="bg-blue-600 text-white px-6 py-2 rounded flex items-center gap-2 hover:bg-blue-700 shadow-md">
                <Save className="w-4 h-4" /> Guardar
              </button>
            </div>
          </div>

          {/* HOJA DE TRABAJO (SOLO ESTO SE IMPRIME) */}
          <div className="max-w-[21cm] mx-auto bg-white p-4 md:p-8 print:p-0 print:max-w-full">
            
            {/* 1. ENCABEZADO */}
            <div className="border-2 border-blue-900 rounded-lg p-2 mb-2 flex justify-between items-start">
              <div className="w-1/3">
                 <div className="flex items-center gap-2 text-blue-900 font-black italic text-xl">
                   <Car className="w-8 h-8" />
                   <div>
                     <div>MULTISERVICIO</div>
                     <div className="text-sm font-normal">AUTOMOTRIZ ARREDONDO</div>
                   </div>
                 </div>
                 <div className="text-[10px] mt-2 leading-tight text-gray-600">
                   Quevedo 2708 Col. Puerto México<br/>
                   Coatzacoalcos, Ver.<br/>
                   Tels: (921) 21 3 77 98 / 921 569 6614<br/>
                   servicioarredondo@prodigy.net.mx
                 </div>
              </div>
              
              <div className="w-1/3 text-center pt-2">
                <h2 className="text-xl font-bold uppercase border-b-2 border-blue-900 inline-block mb-1">Orden de Trabajo</h2>
                <div className="text-red-600 font-mono text-2xl font-bold">No. {currentOrder.orderNumber}</div>
                <div className="text-[9px] mt-1 text-gray-500">
                  Horario: L-V 8:30 a 18:30<br/>Sáb 8:30 a 14:00
                </div>
              </div>

              <div className="w-1/3 text-[10px] space-y-1 border-l pl-2">
                <InputRow label="Fecha" value={new Date().toLocaleDateString()} readOnly />
                <InputRow label="Aseguradora" value={currentOrder.insurer} onChange={(v:any) => setCurrentOrder({...currentOrder, insurer: v})} />
                <InputRow label="Póliza" value={currentOrder.policy} onChange={(v:any) => setCurrentOrder({...currentOrder, policy: v})} />
                <InputRow label="Siniestro" value={currentOrder.claimNumber} onChange={(v:any) => setCurrentOrder({...currentOrder, claimNumber: v})} />
                <InputRow label="Deducible $" value={currentOrder.deductible} onChange={(v:any) => setCurrentOrder({...currentOrder, deductible: v})} />
              </div>
            </div>

            {/* 2. DATOS VEHÍCULO Y CLIENTE */}
            <div className="grid grid-cols-4 gap-x-2 gap-y-1 text-[11px] mb-2 border border-gray-300 p-2 rounded">
                <InputRow label="Marca" value={currentOrder.brand} onChange={(v:any) => setCurrentOrder({...currentOrder, brand: v})} />
                <InputRow label="Modelo" value={currentOrder.model} onChange={(v:any) => setCurrentOrder({...currentOrder, model: v})} />
                <InputRow label="Tipo" value={currentOrder.type} onChange={(v:any) => setCurrentOrder({...currentOrder, type: v})} />
                <InputRow label="Color" value={currentOrder.color} onChange={(v:any) => setCurrentOrder({...currentOrder, color: v})} />
                
                <InputRow label="Placas" value={currentOrder.plates} onChange={(v:any) => setCurrentOrder({...currentOrder, plates: v})} />
                <InputRow label="No. Serie" value={currentOrder.vin} onChange={(v:any) => setCurrentOrder({...currentOrder, vin: v})} />
                <InputRow label="Kilometraje" value={currentOrder.mileage} onChange={(v:any) => setCurrentOrder({...currentOrder, mileage: v})} />
                
                <div className="col-span-1 flex items-center gap-2">
                  <span className="font-bold">Gasolina:</span>
                  <input 
                    type="range" min="0" max="100" step="25" 
                    value={currentOrder.fuelLevel} 
                    onChange={(e) => setCurrentOrder({...currentOrder, fuelLevel: parseInt(e.target.value)})}
                    className="w-16 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer print:hidden"
                  />
                  <div className="flex text-[9px] gap-1 print:flex">
                     <span>E</span>
                     <div className="w-10 h-3 border border-gray-400 relative">
                        <div className="h-full bg-gray-600 print:bg-black" style={{width: `${currentOrder.fuelLevel}%`}}></div>
                     </div>
                     <span>F</span>
                  </div>
                </div>

                <div className="col-span-4 flex justify-between border-t border-gray-200 pt-1 mt-1">
                   <BooleanCheck label="Trans. Auto" checked={currentOrder.transmission === 'auto'} onChange={() => setCurrentOrder({...currentOrder, transmission: 'auto'})} />
                   <BooleanCheck label="Trans. Std" checked={currentOrder.transmission === 'std'} onChange={() => setCurrentOrder({...currentOrder, transmission: 'std'})} />
                   <BooleanCheck label="A/C" checked={currentOrder.ac} onChange={(v:any) => setCurrentOrder({...currentOrder, ac: v})} />
                   <BooleanCheck label="Vidrios Elec." checked={currentOrder.windows === 'electricos'} onChange={() => setCurrentOrder({...currentOrder, windows: 'electricos'})} />
                   <BooleanCheck label="Quemacocos" checked={currentOrder.sunroof} onChange={(v:any) => setCurrentOrder({...currentOrder, sunroof: v})} />
                   <BooleanCheck label="Interiores Piel" checked={currentOrder.upholstery === 'piel'} onChange={() => setCurrentOrder({...currentOrder, upholstery: 'piel'})} />
                </div>

                <div className="col-span-4 border-t border-gray-200 pt-1 mt-1 grid grid-cols-2 gap-2">
                    <InputRow label="Cliente" value={currentOrder.clientName} onChange={(v:any) => setCurrentOrder({...currentOrder, clientName: v})} fullWidth />
                    <InputRow label="Teléfono" value={currentOrder.clientPhone} onChange={(v:any) => setCurrentOrder({...currentOrder, clientPhone: v})} fullWidth />
                    <InputRow label="Dirección" value={currentOrder.clientAddress} onChange={(v:any) => setCurrentOrder({...currentOrder, clientAddress: v})} fullWidth className="col-span-2" />
                </div>
            </div>

            {/* 3. INVENTARIO */}
            <div className="mb-2">
              <div className="bg-blue-900 text-white text-center text-xs font-bold py-1 uppercase rounded-t">Inventario del Vehículo</div>
              <div className="grid grid-cols-5 gap-0 border border-gray-300 text-[9px] print:text-[8px]">
                {/* Cabeceras */}
                <div className="font-bold p-1 bg-gray-100 border-r border-b">INTERIORES</div>
                <div className="font-bold p-1 bg-gray-100 border-r border-b text-center w-12">Edo.</div>
                
                <div className="font-bold p-1 bg-gray-100 border-r border-b">MOTOR</div>
                <div className="font-bold p-1 bg-gray-100 border-r border-b text-center w-12">Edo.</div>

                <div className="font-bold p-1 bg-gray-100 border-b">EXTERIOR</div>

                {/* Columnas */}
                <div className="col-span-2 border-r border-gray-300">
                   {INVENTORY_GROUPS.interiores.map(item => (
                     <InventoryItem 
                       key={item} 
                       label={item} 
                       value={currentOrder.inventory[item]} 
                       onChange={(val:any) => setCurrentOrder({...currentOrder, inventory: {...currentOrder.inventory, [item]: val}})} 
                     />
                   ))}
                </div>
                
                <div className="col-span-2 border-r border-gray-300">
                   {INVENTORY_GROUPS.motor.map(item => (
                     <InventoryItem 
                       key={item} 
                       label={item} 
                       value={currentOrder.inventory[item]} 
                       onChange={(val:any) => setCurrentOrder({...currentOrder, inventory: {...currentOrder.inventory, [item]: val}})} 
                     />
                   ))}
                   <div className="bg-gray-100 font-bold p-1 border-t border-b">LLANTAS</div>
                   {INVENTORY_GROUPS.llantas.map(item => (
                     <InventoryItem 
                       key={item} 
                       label={item} 
                       value={currentOrder.inventory[item]} 
                       onChange={(val:any) => setCurrentOrder({...currentOrder, inventory: {...currentOrder.inventory, [item]: val}})} 
                     />
                   ))}
                </div>

                <div className="col-span-1">
                   {INVENTORY_GROUPS.exterior.map(item => (
                      <div className="flex justify-between items-center px-1 border-b border-gray-100 h-5" key={item}>
                        <span className="truncate">{item}</span>
                        <SimpleStateToggle 
                          value={currentOrder.inventory[item]}
                          onChange={(val:any) => setCurrentOrder({...currentOrder, inventory: {...currentOrder.inventory, [item]: val}})}
                        />
                      </div>
                   ))}
                   <div className="bg-gray-100 font-bold p-1 border-t border-b">CAJUELA</div>
                   {INVENTORY_GROUPS.cajuela.map(item => (
                      <div className="flex justify-between items-center px-1 border-b border-gray-100 h-5" key={item}>
                        <span className="truncate">{item}</span>
                        <SimpleStateToggle 
                          value={currentOrder.inventory[item]}
                          onChange={(val:any) => setCurrentOrder({...currentOrder, inventory: {...currentOrder.inventory, [item]: val}})}
                        />
                      </div>
                   ))}
                </div>
              </div>
            </div>

            {/* 4. DIAGRAMAS DOBLES Y OBSERVACIONES */}
            <div className="grid grid-cols-2 gap-4 h-auto">
                {/* Lado Izquierdo: Siniestro */}
                <div className="flex flex-col gap-2">
                   <div className="border border-gray-300 rounded relative bg-gray-50 h-40">
                     <div className="absolute top-0 left-0 bg-red-100 text-red-800 px-2 py-0.5 text-[9px] font-bold border-br rounded z-10 pointer-events-none">
                       DAÑOS DEL SINIESTRO (ROJO)
                     </div>
                     <div className="w-full h-full relative cursor-crosshair overflow-hidden" 
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const x = ((e.clientX - rect.left) / rect.width) * 100;
                            const y = ((e.clientY - rect.top) / rect.height) * 100;
                            setCurrentOrder({
                              ...currentOrder,
                              damages: [...currentOrder.damages, { x, y, id: Date.now() }]
                            });
                          }}>
                          <CarDiagram />
                          {currentOrder.damages.map(d => (
                            <div 
                              key={d.id} 
                              className="absolute text-red-600 font-bold transform -translate-x-1/2 -translate-y-1/2 text-sm pointer-events-none"
                              style={{ left: `${d.x}%`, top: `${d.y}%` }}
                            >
                              ❌
                            </div>
                          ))}
                     </div>
                     <button 
                      onClick={(e) => { e.stopPropagation(); setCurrentOrder({...currentOrder, damages: []}); }}
                      className="absolute bottom-1 right-1 p-0.5 px-1 bg-red-100 text-red-600 rounded text-[8px] hover:bg-red-200 print:hidden z-20"
                     >
                       Limpiar
                     </button>
                   </div>
                   
                   <div className="border border-gray-300 rounded p-1 h-20">
                     <div className="text-[9px] font-bold text-gray-500 uppercase mb-1">Descripción de Daños (Siniestro)</div>
                     <textarea 
                       className="w-full h-[calc(100%-1.2rem)] bg-transparent resize-none text-[10px] outline-none" 
                       value={currentOrder.damagesDescription}
                       onChange={e => setCurrentOrder({...currentOrder, damagesDescription: e.target.value})}
                     />
                   </div>
                </div>

                {/* Lado Derecho: Preexistentes */}
                <div className="flex flex-col gap-2">
                   <div className="border border-gray-300 rounded relative bg-gray-50 h-40">
                     <div className="absolute top-0 left-0 bg-yellow-100 text-yellow-800 px-2 py-0.5 text-[9px] font-bold border-br rounded z-10 pointer-events-none">
                       DAÑOS PREEXISTENTES (AMARILLO)
                     </div>
                     <div className="w-full h-full relative cursor-crosshair overflow-hidden" 
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const x = ((e.clientX - rect.left) / rect.width) * 100;
                            const y = ((e.clientY - rect.top) / rect.height) * 100;
                            const currentPre = currentOrder.preexistingDamages || [];
                            setCurrentOrder({
                              ...currentOrder,
                              preexistingDamages: [...currentPre, { x, y, id: Date.now() }]
                            });
                          }}>
                          <CarDiagram />
                          {(currentOrder.preexistingDamages || []).map(d => (
                            <div 
                              key={d.id} 
                              className="absolute text-orange-500 font-bold transform -translate-x-1/2 -translate-y-1/2 text-sm pointer-events-none"
                              style={{ left: `${d.x}%`, top: `${d.y}%` }}
                            >
                              ⚠️
                            </div>
                          ))}
                     </div>
                     <button 
                      onClick={(e) => { e.stopPropagation(); setCurrentOrder({...currentOrder, preexistingDamages: []}); }}
                      className="absolute bottom-1 right-1 p-0.5 px-1 bg-yellow-100 text-yellow-700 rounded text-[8px] hover:bg-yellow-200 print:hidden z-20"
                     >
                       Limpiar
                     </button>
                   </div>

                   <div className="border border-gray-300 rounded p-1 h-20">
                     <div className="text-[9px] font-bold text-gray-500 uppercase mb-1">Daños Preexistentes / Observaciones</div>
                     <textarea 
                       className="w-full h-[calc(100%-1.2rem)] bg-transparent resize-none text-[10px] outline-none"
                       value={currentOrder.observations}
                       onChange={e => setCurrentOrder({...currentOrder, observations: e.target.value})}
                     />
                   </div>
                </div>
            </div>

            {/* 5. FIRMA DIGITAL */}
            <div className="mt-4 border-t-2 border-gray-800 pt-4 text-center">
               <div className="w-full max-w-sm mx-auto">
                 {/* COMPONENTE DE FIRMA */}
                 <div className="h-24 border-b border-gray-400 mb-1 flex items-end justify-center relative">
                   {currentOrder.clientSignature ? (
                     // MODO VISUALIZACIÓN / IMPRESIÓN: Muestra la imagen
                     <div className="relative w-full h-full flex items-center justify-center">
                        <img src={currentOrder.clientSignature} className="max-h-full max-w-full" alt="Firma Cliente" />
                        <button 
                          onClick={() => setCurrentOrder({...currentOrder, clientSignature: ''})}
                          className="absolute top-0 right-0 p-1 bg-gray-200 rounded text-xs print:hidden hover:bg-gray-300"
                        >
                          <X className="w-4 h-4" />
                        </button>
                     </div>
                   ) : (
                     // MODO FIRMA: Canvas Interactivo
                     <SignaturePad 
                       onSave={(signature: string) => setCurrentOrder({...currentOrder, clientSignature: signature})}
                     />
                   )}
                 </div>
                 
                 <div className="font-bold text-[11px]">FIRMA DE CONFORMIDAD CLIENTE</div>
                 <div className="text-[9px] text-gray-400 mt-1 text-justify leading-tight">
                   Reconozco que el vehículo presenta los daños descritos y autorizo la revisión. La empresa no se hace responsable por objetos olvidados no inventariados.
                 </div>
               </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

// --- COMPONENTES AUXILIARES ---

function InputRow({ label, value, onChange, readOnly = false, fullWidth = false, className = '' }: any) {
  return (
    <div className={`flex items-center gap-1 ${fullWidth ? 'w-full' : ''} ${className}`}>
      <span className="font-bold text-gray-700 whitespace-nowrap">{label}:</span>
      {readOnly ? (
        <span className="border-b border-gray-300 px-1 flex-1 truncate">{value}</span>
      ) : (
        <input 
          className="border-b border-gray-300 px-1 outline-none focus:border-blue-500 bg-transparent flex-1 w-full"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

function BooleanCheck({ label, checked, onChange }: any) {
  return (
    <div className="flex items-center gap-1 cursor-pointer" onClick={() => onChange(!checked)}>
      <div className={`w-3 h-3 border border-gray-400 flex items-center justify-center ${checked ? 'bg-blue-900 text-white' : 'bg-white'}`}>
        {checked && <div className="w-2 h-2 bg-blue-900" />}
      </div>
      <span>{label}</span>
    </div>
  );
}

function InventoryItem({ label, value, onChange }: any) {
  return (
    <div className="flex justify-between items-center px-1 border-b border-gray-100 h-5">
      <span className="truncate w-24">{label}</span>
      <div className="flex gap-0.5 print:hidden">
        <button onClick={() => onChange('si')} className={`px-1 rounded ${value==='si'?'bg-green-200 text-green-800 font-bold': 'bg-gray-100 text-gray-400'}`}>Si</button>
        <button onClick={() => onChange('no')} className={`px-1 rounded ${value==='no'?'bg-gray-200 text-gray-800 font-bold': 'bg-gray-100 text-gray-400'}`}>No</button>
        <button onClick={() => onChange('mal')} className={`px-1 rounded ${value==='mal'?'bg-red-200 text-red-800 font-bold': 'bg-gray-100 text-gray-400'}`}>M</button>
      </div>
      <div className="hidden print:block font-bold w-6 text-center border-l border-gray-200">
        {value === 'si' ? 'SI' : value === 'no' ? 'NO' : value === 'mal' ? 'M' : '-'}
      </div>
    </div>
  );
}

function SimpleStateToggle({ value, onChange }: any) {
  const states = [undefined, 'si', 'no', 'mal'];
  const labels: any = { undefined: '-', si: 'SI', no: 'NO', mal: 'M' };
  const colors: any = { undefined: 'text-gray-300', si: 'text-green-600', no: 'text-gray-500', mal: 'text-red-600' };
  
  const toggle = () => {
    const currIdx = states.indexOf(value);
    const nextIdx = (currIdx + 1) % states.length;
    onChange(states[nextIdx]);
  };

  return (
    <div onClick={toggle} className={`cursor-pointer font-bold font-mono ${colors[value]} print:text-black`}>
      {labels[value]}
    </div>
  );
}

function SignaturePad({ onSave }: { onSave: (data: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const startDrawing = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Soporte táctil y mouse
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    setIsDrawing(true);
    setHasSignature(true);
  };

  const draw = (e: any) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
  };

  const saveSignature = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    onSave(dataUrl);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      // Ajustar resolución para que no se vea borroso
      canvas.width = canvas.parentElement?.offsetWidth || 300;
      canvas.height = 96;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
      }
    }
  }, []);

  return (
    <div className="w-full h-full relative group print:hidden">
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-gray-300 pointer-events-none text-xs flex flex-col items-center">
        {!hasSignature && (
           <>
             <PenTool className="w-6 h-6 mb-1 opacity-50" />
             <span>Firmar Aquí</span>
           </>
        )}
      </div>
      
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
        className="w-full h-full cursor-crosshair touch-none bg-gray-50 hover:bg-gray-100 transition-colors"
      />

      {hasSignature && (
        <div className="absolute top-0 right-0 flex gap-1 p-1">
          <button onClick={clearSignature} className="bg-red-100 text-red-600 p-1 rounded hover:bg-red-200" title="Borrar">
            <Trash2 className="w-4 h-4" />
          </button>
          <button onClick={saveSignature} className="bg-green-100 text-green-600 p-1 rounded hover:bg-green-200" title="Confirmar">
            <CheckCircle className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function CarDiagram() {
  return (
    <div className="w-full h-full flex items-center justify-center p-2">
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