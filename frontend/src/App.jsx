import { useState, useEffect, useCallback, useMemo, useRef } from "react";

/* ═══════ STORAGE (local fallback + API auth) ═══════ */
const API_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '';
const hasAPI = API_URL.length > 0;

async function apiRequest(path, options = {}) {
  const token = localStorage.getItem('checkcar_token');
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) },
  });
  if (res.status === 401) { localStorage.removeItem('checkcar_token'); localStorage.removeItem('checkcar_user'); localStorage.removeItem('checkcar_tenant'); window.location.reload(); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error');
  return data;
}

async function loadS(){try{const r=await window.storage.get("checkcar-v3");if(r?.value)return JSON.parse(r.value);}catch{}return null;}
async function saveS(d){try{await window.storage.set("checkcar-v3",JSON.stringify(d));}catch{}}

const INIT={users:[{username:"admin",password:"admin123",role:"admin",name:"Administrador"},{username:"vendedor",password:"venta123",role:"vendedor",name:"Vendedor"}],vehicles:[],clients:[],activityLog:[],customMarcas:[],publications:[],portalCredentials:{},nextVId:1,nextCId:1,nextPubId:1};
const DEF_MARCAS=["Toyota","Ford","Chevrolet","Volkswagen","Fiat","Renault","Peugeot","Honda","Nissan","Hyundai","Kia","BMW","Mercedes-Benz","Audi","Citroën","Jeep","Ram","Dodge","Mitsubishi","Suzuki","Subaru","Mazda","Volvo","Land Rover","Porsche","Lexus","Jaguar","Alfa Romeo","DS","Chery","Geely","GWM","BAIC"];
const TRANS=["Manual","Automática","CVT","Secuencial"];
const COND=["0km","Usado"];
const EST_V=["Disponible","Reservado","Vendido","En preparación"];
const PROC=["Compra directa","Tomado en parte de pago","Consignación"];
const UBIC=["Salón principal","Depósito","Sucursal 1","Sucursal 2","Sucursal 3"];
const EST_C=["Excelente","Muy Bueno","Bueno","Regular","Malo"];
const PORTALES=[{id:"mercadolibre",name:"MercadoLibre",color:"#FFE600",textColor:"#333"},{id:"facebook",name:"Facebook Marketplace",color:"#1877F2",textColor:"#fff"},{id:"v6",name:"V6 Autos",color:"#e53e3e",textColor:"#fff"},{id:"motordil",name:"Motordil",color:"#1a1a2e",textColor:"#fff"}];
const ALERT_DAYS=45;

function fmt$(n){if(!n&&n!==0)return"-";return new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(n);}
function fmtD(d){if(!d)return"-";const p=d.split("-");return`${p[2]}/${p[1]}/${p[0]}`;}
function dDiff(a,b){if(!a||!b)return null;return Math.round((new Date(b)-new Date(a))/864e5);}
function td(){return new Date().toISOString().slice(0,10);}
function cProfit(v){const c=+(v.precioCompra)||0,s=+(v.precioVenta)||0,g=(v.gastos||[]).reduce((a,x)=>a+(+x.monto||0),0);const p=s-c-g,pct=c+g>0?((p/(c+g))*100):0;return{profit:p,pct,tg:g,inv:c+g};}
function eColor(e){return{"Excelente":"#16a34a","Muy Bueno":"#22c55e","Bueno":"#eab308","Regular":"#f97316","Malo":"#ef4444"}[e]||"#6b7280";}
function sColor(s){return{"Disponible":"#2563eb","Reservado":"#f59e0b","Vendido":"#16a34a","En preparación":"#8b5cf6"}[s]||"#6b7280";}

const emptyV=()=>({id:0,titulo:"",marca:"",modelo:"",anio:"",motor:"",version:"",transmision:"Manual",condicion:"Usado",kilometros:"",fechaIngreso:td(),fechaVenta:"",patente:"",chasis:"",nroMotor:"",precioCompra:"",precioVenta:"",precioMinimo:"",descripcion:"",anotaciones:"",estado:"Disponible",procedencia:"Compra directa",ubicacion:"Salón principal",estadoCubiertas:"Bueno",estadoPintura:"Bueno",estadoMotor:"Bueno",estadoInterior:"Bueno",fotos:[],gastos:[],historial:[],vendido:false});

/* ═══════ ICONS ═══════ */
const Ic={
Car:()=><svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M5 17h14M5 17a2 2 0 01-2-2v-3a1 1 0 011-1h1l2-4h10l2 4h1a1 1 0 011 1v3a2 2 0 01-2 2M5 17a2 2 0 002 2h1a2 2 0 002-2M14 17a2 2 0 002 2h1a2 2 0 002-2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
Chart:()=><svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M3 3v18h18M7 16l4-4 4 4 5-6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
Users:()=><svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M15 19c0-2.21-2.69-4-6-4s-6 1.79-6 4m6-7a4 4 0 100-8 4 4 0 000 8zm10 7c0-1.66-1.79-3.07-4.28-3.74M15 3.29a4 4 0 010 7.42" strokeLinecap="round" strokeLinejoin="round"/></svg>,
Plus:()=><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 5v14m-7-7h14" strokeLinecap="round"/></svg>,
Trash:()=><svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m2 0v14a2 2 0 01-2 2H8a2 2 0 01-2-2V6h12z" strokeLinecap="round" strokeLinejoin="round"/></svg>,
Edit:()=><svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round"/></svg>,
Search:()=><svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" strokeLinecap="round"/></svg>,
X:()=><svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/></svg>,
Cam:()=><svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="13" r="4"/></svg>,
Home:()=><svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V10" strokeLinecap="round" strokeLinejoin="round"/></svg>,
Eye:()=><svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>,
Dollar:()=><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 1v22m5-18H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H7" strokeLinecap="round" strokeLinejoin="round"/></svg>,
Alert:()=><svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4m0 4h.01" strokeLinecap="round" strokeLinejoin="round"/></svg>,
Log:()=><svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
Lock:()=><svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
Logout:()=><svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round"/></svg>,
Clock:()=><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
Down:()=><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
Share:()=><svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" strokeLinecap="round" strokeLinejoin="round"/></svg>,
Download:()=><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round"/></svg>,
Globe:()=><svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" strokeLinecap="round" strokeLinejoin="round"/></svg>,
};

/* ═══════ UI COMPONENTS ═══════ */
function Badge({children,color="#3b82f6"}){return <span style={{display:"inline-block",padding:"2px 9px",borderRadius:99,fontSize:10,fontWeight:600,background:color+"15",color,border:`1px solid ${color}25`}}>{children}</span>;}
function Inp({label,...p}){return(<div style={{display:"flex",flexDirection:"column",gap:3}}>{label&&<label style={{fontSize:11,fontWeight:600,color:"#4b5563"}}>{label}</label>}<input {...p} style={{padding:"8px 11px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:13,background:"#fafbfc",color:"#1f2937",outline:"none",...(p.style||{})}} onFocus={e=>e.target.style.borderColor="#0ea5e9"} onBlur={e=>e.target.style.borderColor="#e5e7eb"}/></div>);}
function Sel({label,options,...p}){return(<div style={{display:"flex",flexDirection:"column",gap:3}}>{label&&<label style={{fontSize:11,fontWeight:600,color:"#4b5563"}}>{label}</label>}<select {...p} style={{padding:"8px 11px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:13,background:"#fafbfc",color:"#1f2937",outline:"none",...(p.style||{})}}>{options.map(o=><option key={typeof o==="string"?o:o.value} value={typeof o==="string"?o:o.value}>{typeof o==="string"?o:o.label}</option>)}</select></div>);}
function Txa({label,...p}){return(<div style={{display:"flex",flexDirection:"column",gap:3}}>{label&&<label style={{fontSize:11,fontWeight:600,color:"#4b5563"}}>{label}</label>}<textarea {...p} style={{padding:"8px 11px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:13,background:"#fafbfc",color:"#1f2937",outline:"none",resize:"vertical",minHeight:50,...(p.style||{})}} onFocus={e=>e.target.style.borderColor="#0ea5e9"} onBlur={e=>e.target.style.borderColor="#e5e7eb"}/></div>);}
function Btn({children,variant="primary",size="md",...p}){const base={border:"none",borderRadius:8,cursor:"pointer",fontWeight:600,display:"inline-flex",alignItems:"center",gap:5,transition:"all .15s",letterSpacing:.2,lineHeight:1,fontFamily:"inherit"};const sz={sm:{padding:"5px 10px",fontSize:11},md:{padding:"9px 16px",fontSize:12},lg:{padding:"11px 22px",fontSize:13}};const vr={primary:{background:"#0284c7",color:"#fff"},secondary:{background:"#f3f4f6",color:"#374151",border:"1px solid #e5e7eb"},danger:{background:"#fef2f2",color:"#dc2626",border:"1px solid #fecaca"},success:{background:"#16a34a",color:"#fff"},ghost:{background:"transparent",color:"#6b7280"}};return <button {...p} style={{...base,...sz[size],...vr[variant],...(p.style||{})}}>{children}</button>;}
function Card({children,style,...p}){return <div style={{background:"#fff",borderRadius:12,border:"1px solid #e5e7eb",padding:20,...style}} {...p}>{children}</div>;}
function StatCard({label,value,sub,icon,color="#0284c7"}){return(<Card style={{display:"flex",alignItems:"center",gap:14,padding:"18px 20px"}}><div style={{width:44,height:44,borderRadius:11,display:"flex",alignItems:"center",justifyContent:"center",background:color+"12",color,flexShrink:0}}>{icon}</div><div style={{minWidth:0}}><div style={{fontSize:20,fontWeight:700,color:"#111827",letterSpacing:-.5,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{value}</div><div style={{fontSize:12,color:"#6b7280",marginTop:1}}>{label}</div>{sub&&<div style={{fontSize:10,color:"#9ca3af",marginTop:1}}>{sub}</div>}</div></Card>);}
function Modal({children,onClose,width=780}){return(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",zIndex:1000,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"30px 16px",overflowY:"auto"}} onClick={onClose}><div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:16,width:"100%",maxWidth:width,maxHeight:"88vh",overflowY:"auto",padding:28,boxShadow:"0 25px 60px rgba(0,0,0,.18)"}}>{children}</div></div>);}
function Sec({children}){return <div style={{fontSize:13,fontWeight:700,color:"#0284c7",marginTop:18,marginBottom:8,paddingBottom:5,borderBottom:"2px solid #e0f2fe",letterSpacing:.3}}>{children}</div>;}

/* ═══════ EXCEL EXPORT ═══════ */
function exportToExcel(data, columns, filename) {
  let csv = "\uFEFF"; // BOM for UTF-8
  csv += columns.map(c => `"${c.label}"`).join(",") + "\n";
  data.forEach(row => {
    csv += columns.map(c => {
      let val = typeof c.get === "function" ? c.get(row) : (row[c.key] || "");
      val = String(val).replace(/"/g, '""');
      return `"${val}"`;
    }).join(",") + "\n";
  });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename + ".csv"; a.click();
  URL.revokeObjectURL(url);
}

function exportVehiclesXLS(vehicles) {
  exportToExcel(vehicles, [
    {label:"Título",get:v=>v.titulo||`${v.marca} ${v.modelo}`},
    {label:"Marca",key:"marca"},{label:"Modelo",key:"modelo"},
    {label:"Año",key:"anio"},{label:"Versión",key:"version"},
    {label:"Motor",key:"motor"},{label:"Transmisión",key:"transmision"},
    {label:"Condición",key:"condicion"},{label:"Km",key:"kilometros"},
    {label:"Patente",key:"patente"},{label:"Chasis",key:"chasis"},
    {label:"Estado",key:"estado"},{label:"Procedencia",key:"procedencia"},
    {label:"Ubicación",key:"ubicacion"},
    {label:"Precio Compra",key:"precioCompra"},{label:"Precio Venta",key:"precioVenta"},
    {label:"Precio Mínimo",key:"precioMinimo"},
    {label:"Gastos",get:v=>(v.gastos||[]).reduce((s,g)=>s+(+g.monto||0),0)},
    {label:"Ganancia",get:v=>cProfit(v).profit},
    {label:"% Ganancia",get:v=>cProfit(v).pct.toFixed(1)+"%"},
    {label:"Fecha Ingreso",key:"fechaIngreso"},{label:"Fecha Venta",key:"fechaVenta"},
    {label:"Cubiertas",key:"estadoCubiertas"},{label:"Pintura",key:"estadoPintura"},
    {label:"Motor Est.",key:"estadoMotor"},{label:"Interior",key:"estadoInterior"},
  ], "checkcar-vehiculos");
}

function exportClientsXLS(clients, vehicles) {
  exportToExcel(clients, [
    {label:"Nombre",key:"nombre"},{label:"Teléfono",key:"telefono"},
    {label:"Email",key:"email"},{label:"DNI",key:"dni"},
    {label:"Dirección",key:"direccion"},
    {label:"Vehículo",get:c=>{const v=vehicles.find(x=>x.id===Number(c.vehiculoId));return v?`${v.titulo||v.marca+" "+v.modelo}`:"—";}},
    {label:"Notas",key:"notas"},
  ], "checkcar-clientes");
}

function exportSalesXLS(vehicles) {
  const sold = vehicles.filter(v=>v.vendido);
  exportToExcel(sold, [
    {label:"Vehículo",get:v=>v.titulo||`${v.marca} ${v.modelo}`},
    {label:"Marca",key:"marca"},{label:"Modelo",key:"modelo"},
    {label:"Año",key:"anio"},{label:"Transmisión",key:"transmision"},
    {label:"Fecha Venta",key:"fechaVenta"},
    {label:"Días en Stock",get:v=>dDiff(v.fechaIngreso,v.fechaVenta)||""},
    {label:"Precio Compra",key:"precioCompra"},{label:"Precio Venta",key:"precioVenta"},
    {label:"Gastos",get:v=>cProfit(v).tg},
    {label:"Ganancia",get:v=>cProfit(v).profit},
    {label:"% Ganancia",get:v=>cProfit(v).pct.toFixed(1)+"%"},
  ], "checkcar-ventas");
}

/* ═══════ PDF CATALOG ═══════ */
function downloadPDF(vehicles){
  const rows=vehicles.map(v=>`<tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:600;font-size:11px;">${v.titulo||v.marca+" "+v.modelo}</td><td style="padding:8px;border-bottom:1px solid #eee;font-size:11px;">${v.marca}</td><td style="padding:8px;border-bottom:1px solid #eee;font-size:11px;">${v.anio||"-"}</td><td style="padding:8px;border-bottom:1px solid #eee;font-size:11px;">${v.kilometros?Number(v.kilometros).toLocaleString()+" km":"-"}</td><td style="padding:8px;border-bottom:1px solid #eee;font-size:11px;">${v.transmision||"-"}</td><td style="padding:8px;border-bottom:1px solid #eee;font-size:11px;">${v.estado||"-"}</td><td style="padding:8px;border-bottom:1px solid #eee;font-size:11px;font-weight:700;color:#0284c7;">${v.precioVenta?fmt$(v.precioVenta):"-"}</td></tr>`).join("");
  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>CheckCar - Catálogo</title><style>@page{size:landscape;margin:12mm;}body{font-family:Helvetica,Arial,sans-serif;color:#333;margin:0;padding:16px;}h1{color:#0284c7;font-size:20px;margin:0 0 4px;}p.sub{color:#6b7280;font-size:11px;margin:0 0 16px;}table{width:100%;border-collapse:collapse;}th{background:#0284c7;color:#fff;padding:8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px;}tr:nth-child(even){background:#f9fafb;}</style></head><body><h1>CheckCar — Catálogo de Vehículos</h1><p class="sub">${new Date().toLocaleDateString("es-AR")} · ${vehicles.length} vehículo(s)</p><table><thead><tr><th>Vehículo</th><th>Marca</th><th>Año</th><th>Km</th><th>Trans.</th><th>Estado</th><th>Precio</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
  const w=window.open("","_blank");if(w){w.document.write(html);w.document.close();setTimeout(()=>w.print(),600);}
}

/* ═══════ PHOTO / GASTOS / HISTORIAL EDITORS ═══════ */
function PhotoUp({photos,onChange}){const ref=useRef();const add=e=>{if(!e.target.files)return;Array.from(e.target.files).forEach(f=>{const r=new FileReader();r.onload=ev=>onChange([...(photos||[]),ev.target.result]);r.readAsDataURL(f);});e.target.value="";};return(<div><label style={{fontSize:11,fontWeight:600,color:"#4b5563",marginBottom:6,display:"block"}}>Fotos</label><div style={{display:"flex",flexWrap:"wrap",gap:8}}>{(photos||[]).map((p,i)=>(<div key={i} style={{position:"relative",width:75,height:75,borderRadius:8,overflow:"hidden",border:"1px solid #e5e7eb"}}><img src={p} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/><button onClick={()=>onChange(photos.filter((_,j)=>j!==i))} style={{position:"absolute",top:2,right:2,background:"rgba(0,0,0,.6)",color:"#fff",border:"none",borderRadius:"50%",width:16,height:16,cursor:"pointer",fontSize:10,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button></div>))}<button onClick={()=>ref.current?.click()} style={{width:75,height:75,borderRadius:8,border:"2px dashed #d1d5db",background:"#f9fafb",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:"#9ca3af",gap:2,fontSize:9}}><Ic.Cam/>Agregar</button></div><input ref={ref} type="file" accept="image/*" multiple onChange={add} style={{display:"none"}}/></div>);}

function GastosEd({gastos,onChange}){const add=()=>onChange([...(gastos||[]),{descripcion:"",monto:""}]);const upd=(i,f,v)=>{const g=[...gastos];g[i]={...g[i],[f]:v};onChange(g);};const del=i=>onChange(gastos.filter((_,j)=>j!==i));return(<div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><label style={{fontSize:11,fontWeight:600,color:"#4b5563"}}>Gastos</label><Btn variant="secondary" size="sm" onClick={add}><Ic.Plus/> Agregar</Btn></div>{(gastos||[]).map((g,i)=>(<div key={i} style={{display:"flex",gap:6,marginBottom:4,alignItems:"center"}}><input placeholder="Descripción" value={g.descripcion} onChange={e=>upd(i,"descripcion",e.target.value)} style={{flex:1,padding:"6px 9px",border:"1px solid #e5e7eb",borderRadius:6,fontSize:12,background:"#fafbfc"}}/><input placeholder="$" type="number" value={g.monto} onChange={e=>upd(i,"monto",e.target.value)} style={{width:100,padding:"6px 9px",border:"1px solid #e5e7eb",borderRadius:6,fontSize:12,background:"#fafbfc"}}/><button onClick={()=>del(i)} style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer",padding:2}}><Ic.Trash/></button></div>))}</div>);}

function HistEd({historial,onChange}){const add=()=>onChange([...(historial||[]),{fecha:td(),detalle:""}]);const upd=(i,f,v)=>{const h=[...historial];h[i]={...h[i],[f]:v};onChange(h);};const del=i=>onChange(historial.filter((_,j)=>j!==i));return(<div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><label style={{fontSize:11,fontWeight:600,color:"#4b5563"}}>Historial</label><Btn variant="secondary" size="sm" onClick={add}><Ic.Plus/> Agregar</Btn></div>{(historial||[]).map((h,i)=>(<div key={i} style={{display:"flex",gap:6,marginBottom:4,alignItems:"center"}}><input type="date" value={h.fecha} onChange={e=>upd(i,"fecha",e.target.value)} style={{width:130,padding:"6px 9px",border:"1px solid #e5e7eb",borderRadius:6,fontSize:12,background:"#fafbfc"}}/><input placeholder="Detalle..." value={h.detalle} onChange={e=>upd(i,"detalle",e.target.value)} style={{flex:1,padding:"6px 9px",border:"1px solid #e5e7eb",borderRadius:6,fontSize:12,background:"#fafbfc"}}/><button onClick={()=>del(i)} style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer",padding:2}}><Ic.Trash/></button></div>))}</div>);}

/* ═══════ VEHICLE FORM ═══════ */
function VForm({vehicle,allMarcas,onSave,onCancel,onAddMarca}){
  const [f,setF]=useState(vehicle?{...vehicle,gastos:[...(vehicle.gastos||[])],historial:[...(vehicle.historial||[])],fotos:[...(vehicle.fotos||[])]}:emptyV());
  const [nm,setNm]=useState("");const [snm,setSnm]=useState(false);
  const set=(k,v)=>setF(o=>({...o,[k]:v}));
  return(<Modal onClose={onCancel}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><h2 style={{fontSize:18,fontWeight:700,color:"#111827",margin:0}}>{vehicle?"Editar":"Nuevo"} vehículo</h2><button onClick={onCancel} style={{background:"none",border:"none",cursor:"pointer",color:"#9ca3af"}}><Ic.X/></button></div>
    <Sec>Información general</Sec>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
      <div style={{gridColumn:"1/3"}}><Inp label="Título" placeholder="Ej: Toyota Corolla XEi 2020" value={f.titulo} onChange={e=>set("titulo",e.target.value)}/></div>
      <div><Sel label="Marca" value={f.marca} onChange={e=>set("marca",e.target.value)} options={[{value:"",label:"Seleccionar..."},...allMarcas.map(m=>({value:m,label:m}))]}/><button onClick={()=>setSnm(!snm)} style={{fontSize:10,color:"#0284c7",background:"none",border:"none",cursor:"pointer",marginTop:3,fontWeight:600}}>+ Nueva marca</button>{snm&&<div style={{display:"flex",gap:4,marginTop:4}}><input placeholder="Marca" value={nm} onChange={e=>setNm(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&nm.trim()){onAddMarca(nm.trim());set("marca",nm.trim());setNm("");setSnm(false);}}} style={{flex:1,padding:"5px 8px",border:"1px solid #bae6fd",borderRadius:6,fontSize:12}}/><Btn size="sm" variant="secondary" onClick={()=>{if(nm.trim()){onAddMarca(nm.trim());set("marca",nm.trim());setNm("");setSnm(false);}}}>OK</Btn></div>}</div>
      <Inp label="Modelo" value={f.modelo} onChange={e=>set("modelo",e.target.value)}/>
      <Inp label="Año" type="number" value={f.anio} onChange={e=>set("anio",e.target.value)}/>
      <Inp label="Versión" value={f.version} onChange={e=>set("version",e.target.value)}/>
      <Inp label="Motor" value={f.motor} onChange={e=>set("motor",e.target.value)}/>
      <Sel label="Transmisión" value={f.transmision} onChange={e=>set("transmision",e.target.value)} options={TRANS}/>
      <Sel label="Condición" value={f.condicion} onChange={e=>set("condicion",e.target.value)} options={COND}/>
      <Inp label="Km" type="number" value={f.kilometros} onChange={e=>set("kilometros",e.target.value)}/>
      <Inp label="Patente" value={f.patente} onChange={e=>set("patente",e.target.value)}/>
      <Inp label="N° Chasis" value={f.chasis} onChange={e=>set("chasis",e.target.value)}/>
      <Inp label="N° Motor" value={f.nroMotor} onChange={e=>set("nroMotor",e.target.value)}/>
    </div>
    <Txa label="Descripción" value={f.descripcion} onChange={e=>set("descripcion",e.target.value)} style={{marginTop:10}}/>
    <Sec>Clasificación</Sec>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
      <Sel label="Estado" value={f.estado} onChange={e=>{set("estado",e.target.value);set("vendido",e.target.value==="Vendido");}} options={EST_V}/>
      <Sel label="Procedencia" value={f.procedencia} onChange={e=>set("procedencia",e.target.value)} options={PROC}/>
      <Sel label="Ubicación" value={f.ubicacion} onChange={e=>set("ubicacion",e.target.value)} options={UBIC}/>
    </div>
    <Sec>Fechas</Sec>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
      <Inp label="Ingreso" type="date" value={f.fechaIngreso} onChange={e=>set("fechaIngreso",e.target.value)}/>
      <Inp label="Venta" type="date" value={f.fechaVenta} onChange={e=>set("fechaVenta",e.target.value)}/>
      <div style={{display:"flex",flexDirection:"column",gap:3}}><label style={{fontSize:11,fontWeight:600,color:"#4b5563"}}>Días en stock</label><div style={{padding:"8px 11px",background:"#f0f9ff",borderRadius:8,fontSize:13,fontWeight:700,color:"#0284c7",border:"1px solid #bae6fd"}}>{f.fechaIngreso?(f.fechaVenta?dDiff(f.fechaIngreso,f.fechaVenta)+"d":dDiff(f.fechaIngreso,td())+"d (stock)"):"-"}</div></div>
    </div>
    <Sec>Estado componentes</Sec>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10}}>{[["estadoCubiertas","Cubiertas"],["estadoPintura","Pintura"],["estadoMotor","Motor"],["estadoInterior","Interior"]].map(([k,l])=><Sel key={k} label={l} value={f[k]} onChange={e=>set(k,e.target.value)} options={EST_C}/>)}</div>
    <Sec>Fotos</Sec><PhotoUp photos={f.fotos} onChange={p=>set("fotos",p)}/>
    <Sec>Finanzas</Sec>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
      <Inp label="Compra ($)" type="number" value={f.precioCompra} onChange={e=>set("precioCompra",e.target.value)}/>
      <Inp label="Venta ($)" type="number" value={f.precioVenta} onChange={e=>set("precioVenta",e.target.value)}/>
      <Inp label="Mínimo ($)" type="number" value={f.precioMinimo} onChange={e=>set("precioMinimo",e.target.value)}/>
    </div>
    <div style={{marginTop:10}}><GastosEd gastos={f.gastos} onChange={g=>set("gastos",g)}/></div>
    {(f.precioCompra&&f.precioVenta)&&(()=>{const{profit:pr,pct,tg}=cProfit(f);return(<Card style={{marginTop:14,background:pr>=0?"#f0fdf4":"#fef2f2",border:`1px solid ${pr>=0?"#bbf7d0":"#fecaca"}`,padding:14}}><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,textAlign:"center"}}><div><div style={{fontSize:10,color:"#6b7280"}}>Inversión</div><div style={{fontSize:15,fontWeight:700,color:"#374151"}}>{fmt$(+(f.precioCompra)+tg)}</div></div><div><div style={{fontSize:10,color:"#6b7280"}}>Ganancia</div><div style={{fontSize:15,fontWeight:700,color:pr>=0?"#16a34a":"#dc2626"}}>{fmt$(pr)}</div></div><div><div style={{fontSize:10,color:"#6b7280"}}>%</div><div style={{fontSize:15,fontWeight:700,color:pr>=0?"#16a34a":"#dc2626"}}>{pct.toFixed(1)}%</div></div></div></Card>);})()}
    <Sec>Historial</Sec><HistEd historial={f.historial} onChange={h=>set("historial",h)}/>
    <Sec>Anotaciones</Sec><Txa value={f.anotaciones} onChange={e=>set("anotaciones",e.target.value)} placeholder="Notas internas..."/>
    <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:20,paddingTop:14,borderTop:"1px solid #e5e7eb"}}><Btn variant="secondary" onClick={onCancel}>Cancelar</Btn><Btn variant="primary" onClick={()=>onSave(f)}>{vehicle?"Guardar":"Agregar"}</Btn></div>
  </Modal>);
}

/* ═══════ VEHICLE DETAIL ═══════ */
function VDetail({vehicle:v,onClose,onEdit,publications,onPublish,onUnpublish}){
  const{profit:pr,pct,tg}=cProfit(v);const[pi,setPi]=useState(0);
  const dias=v.fechaIngreso?(v.fechaVenta?dDiff(v.fechaIngreso,v.fechaVenta):dDiff(v.fechaIngreso,td())):null;
  const vPubs=(publications||[]).filter(p=>p.vehiculoId===v.id);
  return(<Modal onClose={onClose}>
    {v.fotos?.length>0&&<div style={{position:"relative",height:240,borderRadius:12,overflow:"hidden",background:"#111",marginBottom:20}}><img src={v.fotos[pi]} alt="" style={{width:"100%",height:"100%",objectFit:"contain"}}/>{v.fotos.length>1&&<div style={{position:"absolute",bottom:10,left:"50%",transform:"translateX(-50%)",display:"flex",gap:5}}>{v.fotos.map((_,i)=><button key={i} onClick={()=>setPi(i)} style={{width:8,height:8,borderRadius:"50%",border:"2px solid #fff",background:i===pi?"#fff":"transparent",cursor:"pointer"}}/>)}</div>}</div>}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
      <div><h2 style={{fontSize:20,fontWeight:700,color:"#111827",margin:0}}>{v.titulo||`${v.marca} ${v.modelo}`}</h2><div style={{display:"flex",gap:5,marginTop:6,flexWrap:"wrap"}}><Badge color={sColor(v.estado)}>{v.estado}</Badge>{v.condicion&&<Badge color={v.condicion==="0km"?"#8b5cf6":"#6b7280"}>{v.condicion}</Badge>}{v.anio&&<Badge color="#6b7280">{v.anio}</Badge>}{v.transmision&&<Badge color="#6b7280">{v.transmision}</Badge>}{v.kilometros&&<Badge color="#6b7280">{Number(v.kilometros).toLocaleString()} km</Badge>}</div></div>
      <div style={{display:"flex",gap:5}}><Btn variant="secondary" size="sm" onClick={()=>onEdit(v)}><Ic.Edit/></Btn><button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:"#9ca3af"}}><Ic.X/></button></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:"8px 18px",marginBottom:18}}>{[["Marca",v.marca],["Modelo",v.modelo],["Versión",v.version],["Motor",v.motor],["Transmisión",v.transmision],["Condición",v.condicion],["Patente",v.patente],["Chasis",v.chasis],["N° Motor",v.nroMotor],["Procedencia",v.procedencia],["Ubicación",v.ubicacion],["Ingreso",fmtD(v.fechaIngreso)],["Venta",fmtD(v.fechaVenta)]].filter(([_,val])=>val).map(([l,val])=><div key={l}><div style={{fontSize:10,color:"#9ca3af",fontWeight:600,textTransform:"uppercase",letterSpacing:.5}}>{l}</div><div style={{fontSize:13,color:"#374151",fontWeight:500,marginTop:1}}>{val}</div></div>)}{dias!==null&&<div><div style={{fontSize:10,color:"#9ca3af",fontWeight:600,textTransform:"uppercase",letterSpacing:.5}}>Días stock</div><div style={{fontSize:13,color:"#0284c7",fontWeight:700,marginTop:1}}>{dias}d</div></div>}</div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:18}}>{[["Cubiertas",v.estadoCubiertas],["Pintura",v.estadoPintura],["Motor",v.estadoMotor],["Interior",v.estadoInterior]].map(([l,e])=><div key={l} style={{textAlign:"center",padding:"8px 4px",background:"#f9fafb",borderRadius:8}}><div style={{fontSize:10,color:"#9ca3af",fontWeight:600,marginBottom:2}}>{l}</div><div style={{fontSize:12,fontWeight:700,color:eColor(e)}}>{e}</div></div>)}</div>
    {(v.precioCompra||v.precioVenta)&&<Card style={{background:"#f8fafc",marginBottom:16,padding:14}}><div style={{fontSize:11,fontWeight:700,color:"#0284c7",marginBottom:8}}>Finanzas</div><div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,textAlign:"center"}}><div><div style={{fontSize:10,color:"#9ca3af"}}>Compra</div><div style={{fontSize:14,fontWeight:700,color:"#374151"}}>{fmt$(v.precioCompra)}</div></div><div><div style={{fontSize:10,color:"#9ca3af"}}>Gastos</div><div style={{fontSize:14,fontWeight:700,color:"#f59e0b"}}>{fmt$(tg)}</div></div><div><div style={{fontSize:10,color:"#9ca3af"}}>Venta</div><div style={{fontSize:14,fontWeight:700,color:"#374151"}}>{fmt$(v.precioVenta)}</div></div><div><div style={{fontSize:10,color:"#9ca3af"}}>Mín</div><div style={{fontSize:14,fontWeight:700,color:"#6b7280"}}>{fmt$(v.precioMinimo)}</div></div><div><div style={{fontSize:10,color:"#9ca3af"}}>Ganancia</div><div style={{fontSize:14,fontWeight:700,color:pr>=0?"#16a34a":"#dc2626"}}>{fmt$(pr)} ({pct.toFixed(1)}%)</div></div></div></Card>}
    {/* PUBLICACIONES */}
    <Card style={{marginBottom:16,padding:14,background:"#fafbfc"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><div style={{fontSize:11,fontWeight:700,color:"#0284c7"}}>Publicaciones en portales</div></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        {PORTALES.map(portal=>{
          const pub=vPubs.find(p=>p.plataforma===portal.id);
          return(<div key={portal.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",borderRadius:8,border:"1px solid #e5e7eb",background:"#fff"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:28,height:28,borderRadius:6,background:portal.color,display:"flex",alignItems:"center",justifyContent:"center",color:portal.textColor,fontSize:10,fontWeight:800}}>{portal.name.charAt(0)}</div>
              <div><div style={{fontSize:12,fontWeight:600,color:"#374151"}}>{portal.name}</div>{pub&&<div style={{fontSize:10,color:"#16a34a"}}>ID: {pub.externalId||"—"} · {fmtD(pub.fecha)}</div>}</div>
            </div>
            {pub?<Btn variant="danger" size="sm" onClick={()=>onUnpublish(pub.id)}>Despublicar</Btn>:<Btn variant="primary" size="sm" onClick={()=>onPublish(v.id,portal.id)}>Publicar</Btn>}
          </div>);
        })}
      </div>
    </Card>
    {v.historial?.length>0&&<div style={{marginBottom:14}}><div style={{fontSize:11,fontWeight:700,color:"#0284c7",marginBottom:5}}>Historial</div><div style={{borderLeft:"2px solid #bae6fd",paddingLeft:12}}>{[...v.historial].sort((a,b)=>a.fecha>b.fecha?-1:1).map((h,i)=><div key={i} style={{marginBottom:6}}><div style={{fontSize:10,color:"#0284c7",fontWeight:600}}>{fmtD(h.fecha)}</div><div style={{fontSize:12,color:"#4b5563"}}>{h.detalle}</div></div>)}</div></div>}
    {v.anotaciones&&<div><div style={{fontSize:11,fontWeight:700,color:"#0284c7",marginBottom:4}}>Anotaciones</div><p style={{fontSize:12,color:"#4b5563",lineHeight:1.5,margin:0,whiteSpace:"pre-wrap"}}>{v.anotaciones}</p></div>}
  </Modal>);
}

/* ═══════ VEHICLE CARD ═══════ */
function VCard({vehicle:v,onView,onEdit,onDelete,pubCount}){const{profit:pr}=cProfit(v);const dias=v.fechaIngreso&&!v.vendido?dDiff(v.fechaIngreso,td()):null;const isA=dias!==null&&dias>=ALERT_DAYS;return(<Card style={{padding:0,overflow:"hidden",position:"relative"}}>{isA&&<div style={{position:"absolute",top:6,left:6,zIndex:2,background:"#fef2f2",border:"1px solid #fecaca",borderRadius:6,padding:"2px 6px",fontSize:9,fontWeight:700,color:"#dc2626",display:"flex",alignItems:"center",gap:2}}><Ic.Alert/>{dias}d</div>}{pubCount>0&&<div style={{position:"absolute",top:6,right:6,zIndex:2,background:"#0284c7",borderRadius:6,padding:"2px 6px",fontSize:9,fontWeight:700,color:"#fff",display:"flex",alignItems:"center",gap:2}}><Ic.Globe/>{pubCount}</div>}<div onClick={()=>onView(v)} style={{height:120,background:"#f3f4f6",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",cursor:"pointer"}}>{v.fotos?.length>0?<img src={v.fotos[0]} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<div style={{color:"#d1d5db"}}><Ic.Cam/></div>}</div><div style={{padding:11}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}><div style={{minWidth:0,flex:1}}><div style={{fontSize:13,fontWeight:700,color:"#111827",lineHeight:1.3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v.titulo||`${v.marca} ${v.modelo}`}</div><div style={{fontSize:10,color:"#9ca3af",marginTop:1}}>{[v.anio,v.transmision,v.kilometros?Number(v.kilometros).toLocaleString()+" km":null].filter(Boolean).join(" · ")}</div></div><Badge color={sColor(v.estado)}>{v.estado}</Badge></div><div style={{display:"flex",gap:3,marginBottom:5,flexWrap:"wrap"}}>{v.condicion&&<span style={{fontSize:9,fontWeight:600,color:v.condicion==="0km"?"#8b5cf6":"#6b7280",background:v.condicion==="0km"?"#8b5cf615":"#f3f4f6",padding:"1px 5px",borderRadius:4}}>{v.condicion}</span>}<span style={{fontSize:9,fontWeight:600,color:"#6b7280",background:"#f3f4f6",padding:"1px 5px",borderRadius:4}}>{v.ubicacion}</span></div>{v.precioVenta&&<div style={{fontSize:16,fontWeight:700,color:"#0284c7"}}>{fmt$(v.precioVenta)}</div>}{v.vendido&&v.precioVenta&&v.precioCompra&&<div style={{fontSize:10,color:pr>=0?"#16a34a":"#dc2626",fontWeight:600,marginTop:1}}>Ganancia: {fmt$(pr)}</div>}<div style={{display:"flex",gap:4,marginTop:8,paddingTop:8,borderTop:"1px solid #f3f4f6"}}><Btn variant="secondary" size="sm" onClick={()=>onView(v)} style={{flex:1}}><Ic.Eye/></Btn><Btn variant="secondary" size="sm" onClick={()=>onEdit(v)} style={{flex:1}}><Ic.Edit/></Btn><Btn variant="danger" size="sm" onClick={()=>onDelete(v.id)}><Ic.Trash/></Btn></div></div></Card>);}

/* ═══════ CLIENT FORM ═══════ */
function CForm({client,vehicles,onSave,onCancel}){const [f,setF]=useState(client||{id:0,nombre:"",telefono:"",email:"",dni:"",direccion:"",vehiculoId:"",notas:""});const set=(k,v)=>setF(o=>({...o,[k]:v}));return(<Modal onClose={onCancel} width={520}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><h2 style={{fontSize:18,fontWeight:700,color:"#111827",margin:0}}>{client?"Editar":"Nuevo"} cliente</h2><button onClick={onCancel} style={{background:"none",border:"none",cursor:"pointer",color:"#9ca3af"}}><Ic.X/></button></div><div style={{display:"flex",flexDirection:"column",gap:10}}><Inp label="Nombre completo" value={f.nombre} onChange={e=>set("nombre",e.target.value)}/><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><Inp label="Teléfono" value={f.telefono} onChange={e=>set("telefono",e.target.value)}/><Inp label="DNI" value={f.dni} onChange={e=>set("dni",e.target.value)}/></div><Inp label="Email" type="email" value={f.email} onChange={e=>set("email",e.target.value)}/><Inp label="Dirección" value={f.direccion} onChange={e=>set("direccion",e.target.value)}/><Sel label="Vehículo comprado" value={f.vehiculoId} onChange={e=>set("vehiculoId",e.target.value)} options={[{value:"",label:"Seleccionar..."},...vehicles.map(v=>({value:String(v.id),label:`${v.titulo||v.marca+" "+v.modelo} (${v.patente||"S/P"})`}))]}/><Txa label="Notas" value={f.notas} onChange={e=>set("notas",e.target.value)}/></div><div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:20,paddingTop:14,borderTop:"1px solid #e5e7eb"}}><Btn variant="secondary" onClick={onCancel}>Cancelar</Btn><Btn variant="primary" onClick={()=>onSave(f)}>{client?"Guardar":"Agregar"}</Btn></div></Modal>);}

/* ═══════ LOGIN ═══════ */
function Login({users,onLogin}){const [u,setU]=useState("");const [p,setP]=useState("");const [err,setErr]=useState("");const [mode,setMode]=useState("login");const [regForm,setRegForm]=useState({concesionario:"",nombre:"",email:"",password:""});const [loading,setLd]=useState(false);
  const goLocal=()=>{const f=users.find(x=>x.username===u&&x.password===p);if(f)onLogin(f);else setErr("Credenciales incorrectas");};
  const goAPI=async()=>{setLd(true);setErr("");try{if(mode==="login"){const d=await apiRequest('/auth/login',{method:'POST',body:JSON.stringify({email:u,password:p})});localStorage.setItem('checkcar_token',d.token);localStorage.setItem('checkcar_user',JSON.stringify(d.user));localStorage.setItem('checkcar_tenant',JSON.stringify(d.tenant));onLogin({name:d.user.nombre,role:d.user.rol,username:d.user.email});}else{if(!regForm.concesionario||!regForm.nombre||!regForm.email||!regForm.password){setErr("Completá todos los campos");setLd(false);return;}const d=await apiRequest('/auth/register',{method:'POST',body:JSON.stringify(regForm)});localStorage.setItem('checkcar_token',d.token);localStorage.setItem('checkcar_user',JSON.stringify(d.user));localStorage.setItem('checkcar_tenant',JSON.stringify(d.tenant));onLogin({name:d.user.nombre,role:d.user.rol,username:d.user.email});}}catch(e){setErr(e.message);}setLd(false);};
  const go=hasAPI?goAPI:goLocal;const setR=(k,v)=>setRegForm(f=>({...f,[k]:v}));
  const iS={padding:"10px 14px",border:"1px solid #e5e7eb",borderRadius:10,fontSize:14,background:"#fafbfc",outline:"none",width:"100%",boxSizing:"border-box",color:"#1f2937"};
  return(<div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg,#f0f9ff 0%,#e0f2fe 50%,#bae6fd 100%)",fontFamily:"'DM Sans',system-ui,sans-serif"}}><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/><div style={{background:"#fff",borderRadius:20,padding:44,width:420,boxShadow:"0 20px 60px rgba(2,132,199,.12)"}}>
    <div style={{textAlign:"center",marginBottom:28}}><div style={{width:56,height:56,borderRadius:16,background:"linear-gradient(135deg,#0284c7,#38bdf8)",display:"inline-flex",alignItems:"center",justifyContent:"center",color:"#fff",marginBottom:12,fontSize:22,fontWeight:800}}>✓</div><h1 style={{fontSize:26,fontWeight:800,color:"#111827",margin:"0 0 2px",letterSpacing:-.5}}>CheckCar</h1><p style={{fontSize:12,color:"#6b7280",margin:0}}>Sistema de gestión para concesionarios</p></div>
    {hasAPI&&<div style={{display:"flex",gap:8,marginBottom:20}}>{["login","register"].map(m=><button key={m} onClick={()=>{setMode(m);setErr("");}} style={{flex:1,padding:8,border:"none",borderRadius:8,background:mode===m?"#0284c7":"#f3f4f6",color:mode===m?"#fff":"#6b7280",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>{m==="login"?"Iniciar sesión":"Registrarme"}</button>)}</div>}
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {hasAPI&&mode==="register"?<>
        <div><label style={{fontSize:12,fontWeight:600,color:"#4b5563",display:"block",marginBottom:4}}>Nombre del concesionario</label><input style={iS} placeholder="Ej: Automotores López" value={regForm.concesionario} onChange={e=>setR("concesionario",e.target.value)}/></div>
        <div><label style={{fontSize:12,fontWeight:600,color:"#4b5563",display:"block",marginBottom:4}}>Tu nombre</label><input style={iS} placeholder="Nombre completo" value={regForm.nombre} onChange={e=>setR("nombre",e.target.value)}/></div>
        <div><label style={{fontSize:12,fontWeight:600,color:"#4b5563",display:"block",marginBottom:4}}>Email</label><input style={iS} type="email" placeholder="tu@email.com" value={regForm.email} onChange={e=>setR("email",e.target.value)}/></div>
        <div><label style={{fontSize:12,fontWeight:600,color:"#4b5563",display:"block",marginBottom:4}}>Contraseña</label><input style={iS} type="password" placeholder="Mínimo 6 caracteres" value={regForm.password} onChange={e=>setR("password",e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()}/></div>
      </>:<>
        <Inp label={hasAPI?"Email":"Usuario"} value={u} onChange={e=>{setU(e.target.value);setErr("");}} placeholder={hasAPI?"tu@email.com":"Tu usuario"} onKeyDown={e=>e.key==="Enter"&&go()}/>
        <Inp label="Contraseña" type="password" value={p} onChange={e=>{setP(e.target.value);setErr("");}} placeholder="Tu contraseña" onKeyDown={e=>e.key==="Enter"&&go()}/>
      </>}
      {err&&<div style={{fontSize:12,color:"#dc2626",background:"#fef2f2",padding:"8px 12px",borderRadius:8,border:"1px solid #fecaca"}}>{err}</div>}
      <Btn variant="primary" size="lg" onClick={go} style={{width:"100%",justifyContent:"center",marginTop:4,opacity:loading?.7:1}} disabled={loading}><Ic.Lock/> {loading?"Cargando...":(mode==="register"?"Crear cuenta":"Ingresar")}</Btn>
    </div>
    {!hasAPI&&<div style={{marginTop:20,paddingTop:14,borderTop:"1px solid #f3f4f6",textAlign:"center"}}><p style={{fontSize:11,color:"#9ca3af",margin:0}}>Demo: <b>admin</b>/admin123 · <b>vendedor</b>/venta123</p></div>}
  </div></div>);}

/* ═══════ PAGES ═══════ */
function DashPage({data}){const stk=data.vehicles.filter(v=>!v.vendido);const sld=data.vehicles.filter(v=>v.vendido);const tp=sld.reduce((s,v)=>s+cProfit(v).profit,0);const ad=sld.length?Math.round(sld.reduce((s,v)=>s+(dDiff(v.fechaIngreso,v.fechaVenta)||0),0)/sld.length):0;const alerts=stk.filter(v=>v.fechaIngreso&&dDiff(v.fechaIngreso,td())>=ALERT_DAYS);const totalPubs=(data.publications||[]).filter(p=>p.estado==="activa").length;return(<div><h1 style={{fontSize:24,fontWeight:800,color:"#111827",margin:"0 0 20px",letterSpacing:-.5}}>Dashboard</h1><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(185px,1fr))",gap:12,marginBottom:20}}><StatCard label="En stock" value={stk.length} icon={<Ic.Car/>} color="#0284c7"/><StatCard label="Vendidos" value={sld.length} icon={<Ic.Chart/>} color="#16a34a"/><StatCard label="Ganancia total" value={fmt$(tp)} icon={<Ic.Dollar/>} color="#16a34a"/><StatCard label="Prom. días stock" value={ad+"d"} icon={<Ic.Home/>} color="#f59e0b" sub={data.clients.length+" clientes"}/><StatCard label="Publicaciones activas" value={totalPubs} icon={<Ic.Globe/>} color="#8b5cf6"/></div>{alerts.length>0&&<Card style={{marginBottom:16,background:"#fffbeb",border:"1px solid #fde68a",padding:14}}><div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}><span style={{color:"#f59e0b"}}><Ic.Alert/></span><span style={{fontSize:13,fontWeight:700,color:"#92400e"}}>{alerts.length} vehículo(s) con +{ALERT_DAYS} días sin vender</span></div>{alerts.map(v=><div key={v.id} style={{fontSize:12,color:"#78350f",padding:"3px 0",display:"flex",justifyContent:"space-between"}}><span style={{fontWeight:600}}>{v.titulo||`${v.marca} ${v.modelo}`}</span><span>{dDiff(v.fechaIngreso,td())}d — {v.ubicacion}</span></div>)}</Card>}{sld.length>0&&<Card><h3 style={{fontSize:13,fontWeight:700,color:"#111827",margin:"0 0 10px"}}>Últimas ventas</h3><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}><thead><tr style={{borderBottom:"2px solid #e5e7eb"}}>{["Vehículo","Compra","Venta","Gastos","Ganancia","%"].map(h=><th key={h} style={{padding:"6px 8px",textAlign:"left",fontWeight:600,color:"#6b7280",fontSize:10,textTransform:"uppercase"}}>{h}</th>)}</tr></thead><tbody>{sld.slice(-5).reverse().map(v=>{const p=cProfit(v);return<tr key={v.id} style={{borderBottom:"1px solid #f3f4f6"}}><td style={{padding:"7px 8px",fontWeight:600,color:"#111827"}}>{v.titulo||`${v.marca} ${v.modelo}`}</td><td style={{padding:"7px 8px",color:"#6b7280"}}>{fmt$(v.precioCompra)}</td><td style={{padding:"7px 8px",color:"#6b7280"}}>{fmt$(v.precioVenta)}</td><td style={{padding:"7px 8px",color:"#f59e0b"}}>{fmt$(p.tg)}</td><td style={{padding:"7px 8px",fontWeight:700,color:p.profit>=0?"#16a34a":"#dc2626"}}>{fmt$(p.profit)}</td><td style={{padding:"7px 8px",fontWeight:600,color:p.profit>=0?"#16a34a":"#dc2626"}}>{p.pct.toFixed(1)}%</td></tr>;})}</tbody></table></div></Card>}</div>);}

function VehPage({data,setData,user,allMarcas,addMarca}){const [sf,setSf]=useState(false);const [ev,setEv]=useState(null);const [vv,setVv]=useState(null);const [fl,setFl]=useState({search:"",marca:"",estado:"all",sort:"recent",precioMin:"",precioMax:"",kmMin:"",kmMax:"",anioMin:"",anioMax:"",condicion:"",ubicacion:"",transmision:""});const [sfl,setSfl]=useState(false);
  const filt=useMemo(()=>{let l=[...data.vehicles];if(fl.search){const q=fl.search.toLowerCase();l=l.filter(v=>[v.titulo,v.marca,v.modelo,v.patente,v.version].some(f=>(f||"").toLowerCase().includes(q)));}if(fl.marca)l=l.filter(v=>v.marca===fl.marca);if(fl.estado==="stock")l=l.filter(v=>!v.vendido);else if(fl.estado==="vendido")l=l.filter(v=>v.vendido);else if(fl.estado&&fl.estado!=="all")l=l.filter(v=>v.estado===fl.estado);if(fl.condicion)l=l.filter(v=>v.condicion===fl.condicion);if(fl.ubicacion)l=l.filter(v=>v.ubicacion===fl.ubicacion);if(fl.transmision)l=l.filter(v=>v.transmision===fl.transmision);if(fl.precioMin)l=l.filter(v=>+(v.precioVenta)>=+fl.precioMin);if(fl.precioMax)l=l.filter(v=>+(v.precioVenta)<=+fl.precioMax);if(fl.kmMin)l=l.filter(v=>+(v.kilometros)>=+fl.kmMin);if(fl.kmMax)l=l.filter(v=>+(v.kilometros)<=+fl.kmMax);if(fl.anioMin)l=l.filter(v=>+(v.anio)>=+fl.anioMin);if(fl.anioMax)l=l.filter(v=>+(v.anio)<=+fl.anioMax);const sorts={recent:(a,b)=>b.id-a.id,price_asc:(a,b)=>(+(a.precioVenta)||0)-(+(b.precioVenta)||0),price_desc:(a,b)=>(+(b.precioVenta)||0)-(+(a.precioVenta)||0),km_asc:(a,b)=>(+(a.kilometros)||0)-(+(b.kilometros)||0),km_desc:(a,b)=>(+(b.kilometros)||0)-(+(a.kilometros)||0),year_desc:(a,b)=>(+(b.anio)||0)-(+(a.anio)||0),year_asc:(a,b)=>(+(a.anio)||0)-(+(b.anio)||0)};if(sorts[fl.sort])l.sort(sorts[fl.sort]);return l;},[data.vehicles,fl]);
  const save=f=>{const nd={...data};const now=new Date().toLocaleString("es-AR");if(f.id){nd.vehicles=data.vehicles.map(v=>v.id===f.id?f:v);nd.activityLog=[{date:now,user:user.name,action:`Editó vehículo: ${f.titulo||f.marca+" "+f.modelo}`},...(data.activityLog||[])];}else{f.id=data.nextVId;nd.nextVId=data.nextVId+1;nd.vehicles=[...data.vehicles,f];nd.activityLog=[{date:now,user:user.name,action:`Agregó vehículo: ${f.titulo||f.marca+" "+f.modelo}`},...(data.activityLog||[])];}setData(nd);setSf(false);setEv(null);};
  const del=id=>{if(!confirm("¿Eliminar?"))return;const v=data.vehicles.find(x=>x.id===id);const now=new Date().toLocaleString("es-AR");setData({...data,vehicles:data.vehicles.filter(x=>x.id!==id),activityLog:[{date:now,user:user.name,action:`Eliminó vehículo: ${v?.titulo||v?.marca+" "+v?.modelo}`},...(data.activityLog||[])]});};
  const publish=(vid,platform)=>{const now=new Date().toLocaleString("es-AR");const pub={id:data.nextPubId,vehiculoId:vid,plataforma:platform,externalId:"SIM-"+Math.random().toString(36).slice(2,8).toUpperCase(),estado:"activa",fecha:td()};setData({...data,nextPubId:data.nextPubId+1,publications:[...(data.publications||[]),pub],activityLog:[{date:now,user:user.name,action:`Publicó vehículo en ${platform}`},...(data.activityLog||[])]});};
  const unpub=pid=>{const now=new Date().toLocaleString("es-AR");setData({...data,publications:(data.publications||[]).filter(p=>p.id!==pid),activityLog:[{date:now,user:user.name,action:`Despublicó de portal`},...(data.activityLog||[])]});};
  const marcas=[...new Set(data.vehicles.map(v=>v.marca).filter(Boolean))].sort();
  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}><h1 style={{fontSize:24,fontWeight:800,color:"#111827",margin:0,letterSpacing:-.5}}>Vehículos</h1><div style={{display:"flex",gap:6}}><Btn variant="secondary" size="sm" onClick={()=>exportVehiclesXLS(filt)}><Ic.Download/> Excel</Btn><Btn variant="secondary" size="sm" onClick={()=>downloadPDF(filt)}><Ic.Download/> PDF</Btn><Btn variant="primary" onClick={()=>{setEv(null);setSf(true);}}><Ic.Plus/> Nuevo</Btn></div></div>
    <Card style={{marginBottom:14,padding:12}}><div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}><div style={{position:"relative",flex:1,minWidth:160}}><span style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",color:"#9ca3af"}}><Ic.Search/></span><input placeholder="Buscar..." value={fl.search} onChange={e=>setFl(f=>({...f,search:e.target.value}))} style={{width:"100%",padding:"7px 9px 7px 28px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:12,background:"#fafbfc",outline:"none",boxSizing:"border-box"}}/></div><select value={fl.marca} onChange={e=>setFl(f=>({...f,marca:e.target.value}))} style={{padding:"7px 9px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:11,background:"#fafbfc"}}><option value="">Marcas</option>{marcas.map(m=><option key={m}>{m}</option>)}</select><select value={fl.estado} onChange={e=>setFl(f=>({...f,estado:e.target.value}))} style={{padding:"7px 9px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:11,background:"#fafbfc"}}><option value="all">Todos</option><option value="stock">Stock</option><option value="vendido">Vendidos</option>{EST_V.map(e=><option key={e} value={e}>{e}</option>)}</select><select value={fl.sort} onChange={e=>setFl(f=>({...f,sort:e.target.value}))} style={{padding:"7px 9px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:11,background:"#fafbfc"}}><option value="recent">Reciente</option><option value="price_asc">Precio ↑</option><option value="price_desc">Precio ↓</option><option value="km_asc">Km ↑</option><option value="km_desc">Km ↓</option><option value="year_desc">Año ↓</option><option value="year_asc">Año ↑</option></select><Btn variant="ghost" size="sm" onClick={()=>setSfl(!sfl)}>{sfl?"Menos":"Filtros"} <Ic.Down/></Btn></div>{sfl&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:6,marginTop:8,paddingTop:8,borderTop:"1px solid #f3f4f6"}}><Inp label="$ mín" type="number" value={fl.precioMin} onChange={e=>setFl(f=>({...f,precioMin:e.target.value}))}/><Inp label="$ máx" type="number" value={fl.precioMax} onChange={e=>setFl(f=>({...f,precioMax:e.target.value}))}/><Inp label="Km mín" type="number" value={fl.kmMin} onChange={e=>setFl(f=>({...f,kmMin:e.target.value}))}/><Inp label="Km máx" type="number" value={fl.kmMax} onChange={e=>setFl(f=>({...f,kmMax:e.target.value}))}/><Inp label="Año ≥" type="number" value={fl.anioMin} onChange={e=>setFl(f=>({...f,anioMin:e.target.value}))}/><Inp label="Año ≤" type="number" value={fl.anioMax} onChange={e=>setFl(f=>({...f,anioMax:e.target.value}))}/><Sel label="Condición" value={fl.condicion} onChange={e=>setFl(f=>({...f,condicion:e.target.value}))} options={[{value:"",label:"Todas"},...COND]}/><Sel label="Ubicación" value={fl.ubicacion} onChange={e=>setFl(f=>({...f,ubicacion:e.target.value}))} options={[{value:"",label:"Todas"},...UBIC]}/><Sel label="Trans." value={fl.transmision} onChange={e=>setFl(f=>({...f,transmision:e.target.value}))} options={[{value:"",label:"Todas"},...TRANS]}/></div>}</Card>
    <div style={{fontSize:11,color:"#6b7280",marginBottom:8}}>{filt.length} vehículo{filt.length!==1?"s":""}</div>
    {filt.length>0?<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12}}>{filt.map(v=><VCard key={v.id} vehicle={v} onView={setVv} onEdit={v=>{setEv(v);setSf(true);}} onDelete={del} pubCount={(data.publications||[]).filter(p=>p.vehiculoId===v.id&&p.estado==="activa").length}/>)}</div>:<Card style={{textAlign:"center",padding:36,color:"#9ca3af"}}><p style={{margin:0}}>Sin resultados.</p></Card>}
    {sf&&<VForm vehicle={ev} allMarcas={allMarcas} onSave={save} onCancel={()=>{setSf(false);setEv(null);}} onAddMarca={addMarca}/>}
    {vv&&<VDetail vehicle={vv} onClose={()=>setVv(null)} onEdit={v=>{setVv(null);setEv(v);setSf(true);}} publications={data.publications} onPublish={publish} onUnpublish={unpub}/>}
  </div>);
}

function SalesPage({data}){const sld=data.vehicles.filter(v=>v.vendido);const mc={},mdc={};sld.forEach(v=>{mc[v.marca]=(mc[v.marca]||0)+1;mdc[`${v.marca} ${v.modelo}`]=(mdc[`${v.marca} ${v.modelo}`]||0)+1;});const tm=Object.entries(mc).sort((a,b)=>b[1]-a[1]);const tmd=Object.entries(mdc).sort((a,b)=>b[1]-a[1]);const tp=sld.reduce((s,v)=>s+cProfit(v).profit,0);const ap=sld.length?tp/sld.length:0;const mx=tm[0]?tm[0][1]:1;const [q,setQ]=useState("");const fs=sld.filter(v=>{if(!q)return true;const s=q.toLowerCase();return[v.titulo,v.marca,v.modelo].some(f=>(f||"").toLowerCase().includes(s));});
  return(<div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><h1 style={{fontSize:24,fontWeight:800,color:"#111827",margin:0,letterSpacing:-.5}}>Ventas</h1><Btn variant="secondary" size="sm" onClick={()=>exportSalesXLS(data.vehicles)}><Ic.Download/> Excel ventas</Btn></div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,marginBottom:16}}><StatCard label="Vendidos" value={sld.length} icon={<Ic.Car/>} color="#16a34a"/><StatCard label="Ganancia total" value={fmt$(tp)} icon={<Ic.Dollar/>} color="#0284c7"/><StatCard label="Gan. promedio" value={fmt$(ap)} icon={<Ic.Chart/>} color="#f59e0b"/></div>{sld.length===0?<Card style={{textAlign:"center",padding:36,color:"#9ca3af"}}><p style={{margin:0}}>Sin ventas.</p></Card>:<><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}><Card><h3 style={{fontSize:12,fontWeight:700,color:"#111827",margin:"0 0 10px"}}>Marcas más vendidas</h3>{tm.slice(0,8).map(([m,c])=><div key={m} style={{marginBottom:7}}><div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:2}}><span style={{fontWeight:600,color:"#374151"}}>{m}</span><span style={{color:"#6b7280"}}>{c}</span></div><div style={{height:6,borderRadius:3,background:"#f3f4f6",overflow:"hidden"}}><div style={{height:"100%",width:`${(c/mx)*100}%`,borderRadius:3,background:"linear-gradient(90deg,#0284c7,#0ea5e9)"}}/></div></div>)}</Card><Card><h3 style={{fontSize:12,fontWeight:700,color:"#111827",margin:"0 0 10px"}}>Modelos más vendidos</h3>{tmd.slice(0,8).map(([m,c],i)=><div key={m} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 8px",background:i%2===0?"#f9fafb":"#fff",borderRadius:6,marginBottom:2}}><div style={{display:"flex",alignItems:"center",gap:6}}><span style={{width:20,height:20,borderRadius:"50%",background:"#0284c7",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700}}>{i+1}</span><span style={{fontSize:11,fontWeight:600,color:"#374151"}}>{m}</span></div><Badge color="#6b7280">{c}</Badge></div>)}</Card></div><Card><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><h3 style={{fontSize:12,fontWeight:700,color:"#111827",margin:0}}>Historial</h3><div style={{position:"relative",width:180}}><span style={{position:"absolute",left:7,top:"50%",transform:"translateY(-50%)",color:"#9ca3af"}}><Ic.Search/></span><input placeholder="Buscar..." value={q} onChange={e=>setQ(e.target.value)} style={{width:"100%",padding:"5px 7px 5px 24px",border:"1px solid #e5e7eb",borderRadius:6,fontSize:11,background:"#fafbfc",outline:"none",boxSizing:"border-box"}}/></div></div><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}><thead><tr style={{borderBottom:"2px solid #e5e7eb"}}>{["Vehículo","Marca","Año","Trans.","Venta","Días","Compra","Precio","Ganancia","%"].map(h=><th key={h} style={{padding:"5px 7px",textAlign:"left",fontWeight:600,color:"#6b7280",fontSize:9,textTransform:"uppercase"}}>{h}</th>)}</tr></thead><tbody>{fs.map(v=>{const p=cProfit(v);return<tr key={v.id} style={{borderBottom:"1px solid #f3f4f6"}}><td style={{padding:"6px 7px",fontWeight:600,color:"#111827"}}>{v.titulo||`${v.marca} ${v.modelo}`}</td><td style={{padding:"6px 7px",color:"#6b7280"}}>{v.marca}</td><td style={{padding:"6px 7px",color:"#6b7280"}}>{v.anio}</td><td style={{padding:"6px 7px",color:"#6b7280"}}>{v.transmision}</td><td style={{padding:"6px 7px",color:"#6b7280"}}>{fmtD(v.fechaVenta)}</td><td style={{padding:"6px 7px",color:"#0284c7",fontWeight:600}}>{dDiff(v.fechaIngreso,v.fechaVenta)??"-"}</td><td style={{padding:"6px 7px",color:"#6b7280"}}>{fmt$(v.precioCompra)}</td><td style={{padding:"6px 7px",color:"#6b7280"}}>{fmt$(v.precioVenta)}</td><td style={{padding:"6px 7px",fontWeight:700,color:p.profit>=0?"#16a34a":"#dc2626"}}>{fmt$(p.profit)}</td><td style={{padding:"6px 7px",fontWeight:600,color:p.profit>=0?"#16a34a":"#dc2626"}}>{p.pct.toFixed(1)}%</td></tr>;})}</tbody></table></div></Card></>}</div>);
}

function CliPage({data,setData,user}){const [sf,setSf]=useState(false);const [ec,setEc]=useState(null);const [q,setQ]=useState("");const filt=data.clients.filter(c=>{if(!q)return true;const s=q.toLowerCase();return[c.nombre,c.telefono,c.email,c.dni].some(f=>(f||"").toLowerCase().includes(s));});const save=f=>{const nd={...data};const now=new Date().toLocaleString("es-AR");if(f.id){nd.clients=data.clients.map(c=>c.id===f.id?f:c);nd.activityLog=[{date:now,user:user.name,action:`Editó cliente: ${f.nombre}`},...(data.activityLog||[])];}else{f.id=data.nextCId;nd.nextCId=data.nextCId+1;nd.clients=[...data.clients,f];nd.activityLog=[{date:now,user:user.name,action:`Agregó cliente: ${f.nombre}`},...(data.activityLog||[])];}setData(nd);setSf(false);setEc(null);};const del=id=>{if(!confirm("¿Eliminar?"))return;const c=data.clients.find(x=>x.id===id);const now=new Date().toLocaleString("es-AR");setData({...data,clients:data.clients.filter(x=>x.id!==id),activityLog:[{date:now,user:user.name,action:`Eliminó cliente: ${c?.nombre}`},...(data.activityLog||[])]});};const gV=id=>data.vehicles.find(v=>v.id===Number(id));
  return(<div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}><h1 style={{fontSize:24,fontWeight:800,color:"#111827",margin:0,letterSpacing:-.5}}>Clientes</h1><div style={{display:"flex",gap:6}}><Btn variant="secondary" size="sm" onClick={()=>exportClientsXLS(data.clients,data.vehicles)}><Ic.Download/> Excel</Btn><Btn variant="primary" onClick={()=>{setEc(null);setSf(true);}}><Ic.Plus/> Nuevo</Btn></div></div><Card style={{marginBottom:14,padding:12}}><div style={{position:"relative"}}><span style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",color:"#9ca3af"}}><Ic.Search/></span><input placeholder="Buscar..." value={q} onChange={e=>setQ(e.target.value)} style={{width:"100%",padding:"7px 9px 7px 28px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:12,background:"#fafbfc",outline:"none",boxSizing:"border-box"}}/></div></Card>{filt.length>0?<Card style={{padding:0,overflow:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr style={{borderBottom:"2px solid #e5e7eb"}}>{["Nombre","Teléfono","Email","DNI","Vehículo","Acc."].map(h=><th key={h} style={{padding:"9px 12px",textAlign:"left",fontWeight:600,color:"#6b7280",fontSize:10,textTransform:"uppercase"}}>{h}</th>)}</tr></thead><tbody>{filt.map(c=>{const vh=gV(c.vehiculoId);return<tr key={c.id} style={{borderBottom:"1px solid #f3f4f6"}}><td style={{padding:"9px 12px",fontWeight:600,color:"#111827"}}>{c.nombre}</td><td style={{padding:"9px 12px",color:"#6b7280"}}>{c.telefono||"-"}</td><td style={{padding:"9px 12px",color:"#6b7280"}}>{c.email||"-"}</td><td style={{padding:"9px 12px",color:"#6b7280"}}>{c.dni||"-"}</td><td style={{padding:"9px 12px"}}>{vh?<Badge color="#0284c7">{vh.titulo||`${vh.marca} ${vh.modelo}`}</Badge>:<span style={{color:"#9ca3af"}}>—</span>}</td><td style={{padding:"9px 12px"}}><div style={{display:"flex",gap:4}}><Btn variant="secondary" size="sm" onClick={()=>{setEc(c);setSf(true);}}><Ic.Edit/></Btn><Btn variant="danger" size="sm" onClick={()=>del(c.id)}><Ic.Trash/></Btn></div></td></tr>;})}</tbody></table></Card>:<Card style={{textAlign:"center",padding:36,color:"#9ca3af"}}><p style={{margin:0}}>Sin clientes.</p></Card>}{sf&&<CForm client={ec} vehicles={data.vehicles} onSave={save} onCancel={()=>{setSf(false);setEc(null);}}/>}</div>);
}

/* ═══════ PUBLICATIONS PAGE ═══════ */
function PubPage({data,setData,user}){
  const pubs=(data.publications||[]);
  const byPortal={};PORTALES.forEach(p=>{byPortal[p.id]=pubs.filter(x=>x.plataforma===p.id&&x.estado==="activa");});
  const unpub=pid=>{const now=new Date().toLocaleString("es-AR");setData({...data,publications:pubs.filter(p=>p.id!==pid),activityLog:[{date:now,user:user.name,action:`Despublicó de portal`},...(data.activityLog||[])]});};
  const getV=id=>data.vehicles.find(v=>v.id===id);
  return(<div>
    <h1 style={{fontSize:24,fontWeight:800,color:"#111827",margin:"0 0 16px",letterSpacing:-.5}}>Publicaciones</h1>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:14,marginBottom:20}}>
      {PORTALES.map(portal=>(
        <Card key={portal.id} style={{padding:16}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
            <div style={{width:36,height:36,borderRadius:10,background:portal.color,display:"flex",alignItems:"center",justifyContent:"center",color:portal.textColor,fontSize:14,fontWeight:800}}>{portal.name.charAt(0)}</div>
            <div><div style={{fontSize:14,fontWeight:700,color:"#111827"}}>{portal.name}</div><div style={{fontSize:11,color:"#6b7280"}}>{byPortal[portal.id].length} publicación(es) activa(s)</div></div>
          </div>
          {byPortal[portal.id].length===0?<div style={{fontSize:12,color:"#9ca3af",textAlign:"center",padding:12}}>Sin publicaciones activas</div>:
            byPortal[portal.id].map(pub=>{const v=getV(pub.vehiculoId);return v?(
              <div key={pub.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",border:"1px solid #f3f4f6",borderRadius:8,marginBottom:4}}>
                <div><div style={{fontSize:12,fontWeight:600,color:"#374151"}}>{v.titulo||`${v.marca} ${v.modelo}`}</div><div style={{fontSize:10,color:"#9ca3af"}}>ID: {pub.externalId} · {fmtD(pub.fecha)}</div></div>
                <Btn variant="danger" size="sm" onClick={()=>unpub(pub.id)}>×</Btn>
              </div>
            ):null;})
          }
        </Card>
      ))}
    </div>
    <Card style={{background:"#f0f9ff",border:"1px solid #bae6fd",padding:20}}>
      <h3 style={{fontSize:14,fontWeight:700,color:"#0284c7",margin:"0 0 10px"}}>Integración con portales</h3>
      <p style={{fontSize:13,color:"#4b5563",lineHeight:1.6,margin:"0 0 12px"}}>Para conectar las publicaciones automáticas con los portales reales, se necesita configurar las APIs de cada plataforma en el backend del SaaS. El sistema está preparado para soportar:</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        {[["MercadoLibre","API REST oficial — POST /items con OAuth2. Requiere APP_ID + CLIENT_SECRET de developers.mercadolibre.com"],["Facebook Marketplace","API de Commerce. Requiere app de Facebook Business verificada"],["V6 Autos","XML feed o API directa según convenio comercial"],["Motordil","CSV/XML feed con actualización periódica"]].map(([name,desc])=>(
          <div key={name} style={{padding:"10px 12px",background:"#fff",borderRadius:8,border:"1px solid #e5e7eb"}}>
            <div style={{fontSize:12,fontWeight:700,color:"#111827",marginBottom:3}}>{name}</div>
            <div style={{fontSize:11,color:"#6b7280",lineHeight:1.4}}>{desc}</div>
          </div>
        ))}
      </div>
    </Card>
  </div>);
}

function ActPage({data}){const [q,setQ]=useState("");const log=(data.activityLog||[]).filter(l=>{if(!q)return true;const s=q.toLowerCase();return l.action.toLowerCase().includes(s)||l.user.toLowerCase().includes(s);});return(<div><h1 style={{fontSize:24,fontWeight:800,color:"#111827",margin:"0 0 16px",letterSpacing:-.5}}>Actividad</h1><Card style={{marginBottom:14,padding:12}}><div style={{position:"relative"}}><span style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",color:"#9ca3af"}}><Ic.Search/></span><input placeholder="Buscar..." value={q} onChange={e=>setQ(e.target.value)} style={{width:"100%",padding:"7px 9px 7px 28px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:12,background:"#fafbfc",outline:"none",boxSizing:"border-box"}}/></div></Card>{log.length>0?<Card style={{padding:0}}><div style={{maxHeight:550,overflowY:"auto"}}>{log.map((l,i)=><div key={i} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 16px",borderBottom:"1px solid #f3f4f6"}}><div style={{width:28,height:28,borderRadius:"50%",background:"#f0f9ff",display:"flex",alignItems:"center",justifyContent:"center",color:"#0284c7",flexShrink:0,marginTop:2}}><Ic.Log/></div><div style={{flex:1}}><div style={{fontSize:12,color:"#111827",fontWeight:500}}>{l.action}</div><div style={{display:"flex",gap:8,marginTop:2}}><span style={{fontSize:10,color:"#6b7280"}}>{l.user}</span><span style={{fontSize:10,color:"#9ca3af"}}>{l.date}</span></div></div></div>)}</div></Card>:<Card style={{textAlign:"center",padding:36,color:"#9ca3af"}}><p style={{margin:0}}>Sin actividad.</p></Card>}</div>);}

/* ═══════ MAIN APP ═══════ */
export default function App(){
  const [data,setDR]=useState(INIT);const [page,setPage]=useState("dashboard");const [loaded,setLoaded]=useState(false);const [user,setUser]=useState(null);
  useEffect(()=>{(async()=>{
    // Try to restore API session
    if(hasAPI){const t=localStorage.getItem('checkcar_token');const u=localStorage.getItem('checkcar_user');if(t&&u){try{const d=await apiRequest('/auth/me');setUser({name:d.user.nombre,role:d.user.rol,username:d.user.email});}catch{localStorage.removeItem('checkcar_token');localStorage.removeItem('checkcar_user');}}setLoaded(true);return;}
    // Local storage fallback
    const s=await loadS();if(s){if(!s.activityLog)s.activityLog=[];if(!s.customMarcas)s.customMarcas=[];if(!s.publications)s.publications=[];if(!s.nextPubId)s.nextPubId=1;setDR(s);}setLoaded(true);})();},[]);
  const setData=useCallback(nd=>{setDR(nd);saveS(nd);},[]);
  const allMarcas=useMemo(()=>[...new Set([...DEF_MARCAS,...(data.customMarcas||[])])].sort(),[data.customMarcas]);
  const addMarca=useCallback(m=>{if(!m||allMarcas.includes(m))return;setData({...data,customMarcas:[...(data.customMarcas||[]),m]});},[data,allMarcas,setData]);
  const handleLogout=()=>{if(hasAPI){localStorage.removeItem('checkcar_token');localStorage.removeItem('checkcar_user');localStorage.removeItem('checkcar_tenant');}setUser(null);};
  const nav=[{id:"dashboard",label:"Dashboard",icon:<Ic.Home/>},{id:"vehicles",label:"Vehículos",icon:<Ic.Car/>},{id:"sales",label:"Ventas",icon:<Ic.Chart/>},{id:"clients",label:"Clientes",icon:<Ic.Users/>},{id:"publications",label:"Publicaciones",icon:<Ic.Globe/>},{id:"activity",label:"Actividad",icon:<Ic.Log/>}];
  if(!loaded)return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#fff",fontFamily:"'DM Sans',system-ui,sans-serif"}}><div style={{color:"#6b7280"}}>Cargando...</div></div>;
  if(!user)return <Login users={data.users} onLogin={setUser}/>;
  const alerts=data.vehicles.filter(v=>!v.vendido&&v.fechaIngreso&&dDiff(v.fechaIngreso,td())>=ALERT_DAYS);
  return(<div style={{display:"flex",minHeight:"100vh",background:"#f8fafc",fontFamily:"'DM Sans','Segoe UI',system-ui,sans-serif"}}><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
    <nav style={{width:215,background:"#fff",borderRight:"1px solid #e5e7eb",padding:"18px 8px",display:"flex",flexDirection:"column",position:"sticky",top:0,height:"100vh",boxSizing:"border-box",flexShrink:0}}>
      <div style={{padding:"0 10px",marginBottom:24}}><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:32,height:32,borderRadius:9,background:"linear-gradient(135deg,#0284c7,#38bdf8)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:14,fontWeight:800,flexShrink:0}}>✓</div><div><div style={{fontSize:15,fontWeight:800,color:"#111827",letterSpacing:-.5,lineHeight:1.2}}>{(hasAPI&&localStorage.getItem('checkcar_tenant'))?JSON.parse(localStorage.getItem('checkcar_tenant')).nombre:"CheckCar"}</div><div style={{fontSize:9,color:"#9ca3af",fontWeight:500,letterSpacing:.5,textTransform:"uppercase"}}>Concesionario</div></div></div></div>
      <div style={{display:"flex",flexDirection:"column",gap:2}}>{nav.map(item=><button key={item.id} onClick={()=>setPage(item.id)} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 11px",border:"none",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:600,background:page===item.id?"#f0f9ff":"transparent",color:page===item.id?"#0284c7":"#6b7280",transition:"all .15s",fontFamily:"inherit",textAlign:"left",position:"relative"}}>{item.icon}{item.label}{item.id==="dashboard"&&alerts.length>0&&<span style={{marginLeft:"auto",minWidth:16,height:16,borderRadius:8,background:"#ef4444",color:"#fff",fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 3px"}}>{alerts.length}</span>}</button>)}</div>
      <div style={{marginTop:"auto",padding:8,borderTop:"1px solid #f3f4f6"}}><div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}><div style={{width:26,height:26,borderRadius:"50%",background:"#f0f9ff",display:"flex",alignItems:"center",justifyContent:"center",color:"#0284c7",fontSize:10,fontWeight:700,flexShrink:0}}>{user.name.charAt(0)}</div><div style={{minWidth:0}}><div style={{fontSize:11,fontWeight:600,color:"#374151",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.name}</div><div style={{fontSize:9,color:"#9ca3af"}}>{user.role}</div></div></div><button onClick={handleLogout} style={{display:"flex",alignItems:"center",gap:4,padding:"5px 8px",background:"none",border:"1px solid #e5e7eb",borderRadius:6,cursor:"pointer",fontSize:10,color:"#6b7280",fontWeight:600,width:"100%",fontFamily:"inherit",justifyContent:"center"}}><Ic.Logout/> Salir</button><div style={{fontSize:9,color:"#d1d5db",textAlign:"center",marginTop:6}}>{data.vehicles.filter(v=>!v.vendido).length} stock · {data.vehicles.filter(v=>v.vendido).length} vendidos</div></div>
    </nav>
    <main style={{flex:1,padding:"24px 32px",maxWidth:1200,overflowX:"hidden"}}>
      {page==="dashboard"&&<DashPage data={data}/>}
      {page==="vehicles"&&<VehPage data={data} setData={setData} user={user} allMarcas={allMarcas} addMarca={addMarca}/>}
      {page==="sales"&&<SalesPage data={data}/>}
      {page==="clients"&&<CliPage data={data} setData={setData} user={user}/>}
      {page==="publications"&&<PubPage data={data} setData={setData} user={user}/>}
      {page==="activity"&&<ActPage data={data}/>}
    </main>
  </div>);
}
