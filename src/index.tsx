import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

console.log("🚀 El sistema está intentando arrancar...");

const container = document.getElementById('root');

if (container) {
console.log("✅ Contenedor encontrado. Montando React...");
// @ts-ignore
const root = ReactDOM.createRoot(container);
root.render(
<React.StrictMode>
<App />
</React.StrictMode>
);
} else {
console.error("❌ ERROR FATAL: No se encontró el elemento 'root' en el HTML");
}