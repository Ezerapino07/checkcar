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

const INIT={users:[{username:"admin",password:"admin123",role:"admin",name:"Administrador"},{username:"vendedor",password:"venta123",role:"vendedor",name:"Vendedor"}],vehicles:[],clients:[],activityLog:[],customMarcas:[],nextVId:1,nextCId:1};
const DEF_MARCAS=["Toyota","Ford","Chevrolet","Volkswagen","Fiat","Renault","Peugeot","Honda","Nissan","Hyundai","Kia","BMW","Mercedes-Benz","Audi","Citroën","Jeep","Ram","Dodge","Mitsubishi","Suzuki","Subaru","Mazda","Volvo","Land Rover","Porsche","Lexus","Jaguar","Alfa Romeo","DS","Chery","Geely","GWM","BAIC"];
const TRANS=["Manual","Automática","CVT","Secuencial"];
const COND=["0km","Usado"];
const EST_V=["Disponible","Reservado","Vendido","En preparación"];
const PROC=["Compra directa","Tomado en parte de pago","Consignación"];
const UBIC=["Salón principal","Depósito","Sucursal 1","Sucursal 2","Sucursal 3"];
const EST_C=["Excelente","Muy Bueno","Bueno","Regular","Malo"];
const ALERT_DAYS=45;

function fmt$(n){if(!n&&n!==0)return"-";return new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(n);}
function fmtD(d){if(!d)return"-";const p=d.split("-");return`${p[2]}/${p[1]}/${p[0]}`;}
function dDiff(a,b){if(!a||!b)return null;return Math.round((new Date(b)-new Date(a))/864e5);}
function td(){return new Date().toISOString().slice(0,10);}
function cProfit(v){const c=+(v.precioCompra)||0,s=+(v.precioVenta)||0,g=(v.gastos||[]).reduce((a,x)=>a+(+x.monto||0),0);const p=s-c-g,pct=c+g>0?((p/(c+g))*100):0;return{profit:p,pct,tg:g,inv:c+g};}
function eColor(e){return{"Excelente":"#16a34a","Muy Bueno":"#22c55e","Bueno":"#eab308","Regular":"#f97316","Malo":"#ef4444"}[e]||"#6b7280";}
function sColor(s){return{"Disponible":"#2563eb","Reservado":"#f59e0b","Vendido":"#16a34a","En preparación":"#8b5cf6"}[s]||"#6b7280";}

const emptyV=()=>({id:0,titulo:"",marca:"",modelo:"",anio:"",motor:"",version:"",transmision:"Manual",condicion:"Usado",kilometros:"",fechaIngreso:td(),fechaVenta:"",patente:"",chasis:"",nroMotor:"",precioCompra:"",precioVenta:"",precioMinimo:"",descripcion:"",anotaciones:"",estado:"Disponible",procedencia:"Compra directa",ubicacion:"Salón principal",estadoCubiertas:"Bueno",estadoPintura:"Bueno",estadoMotor:"Bueno",estadoInterior:"Bueno",fotos:[],gastos:[],historial:[],vendido:false,vendedor:"",clienteVentaId:""});

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
function VForm({vehicle,allMarcas,onSave,onCancel,onAddMarca,clients}){
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
      <Inp label="Ubicación" placeholder="Ej: Salón principal, Depósito..." value={f.ubicacion} onChange={e=>set("ubicacion",e.target.value)}/>
    </div>
    {f.estado==="Vendido"&&<><Sec>Datos de la venta</Sec>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
      <Inp label="Vendedor (nombre y apellido)" placeholder="Ej: Juan Pérez" value={f.vendedor||""} onChange={e=>set("vendedor",e.target.value)}/>
      <Sel label="Cliente comprador" value={f.clienteVentaId||""} onChange={e=>set("clienteVentaId",e.target.value)} options={[{value:"",label:"Seleccionar cliente..."},...(clients||[]).map(c=>({value:String(c.id),label:`${c.nombre} (${c.dni||c.telefono||"S/D"})`}))]}/>
    </div></>}
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
function VDetail({vehicle:v,onClose,onEdit}){
  const{profit:pr,pct,tg}=cProfit(v);const[pi,setPi]=useState(0);
  const dias=v.fechaIngreso?(v.fechaVenta?dDiff(v.fechaIngreso,v.fechaVenta):dDiff(v.fechaIngreso,td())):null;
  return(<Modal onClose={onClose}>
    {v.fotos?.length>0&&<div style={{position:"relative",height:240,borderRadius:12,overflow:"hidden",background:"#111",marginBottom:20}}><img src={v.fotos[pi]} alt="" style={{width:"100%",height:"100%",objectFit:"contain"}}/>{v.fotos.length>1&&<div style={{position:"absolute",bottom:10,left:"50%",transform:"translateX(-50%)",display:"flex",gap:5}}>{v.fotos.map((_,i)=><button key={i} onClick={()=>setPi(i)} style={{width:8,height:8,borderRadius:"50%",border:"2px solid #fff",background:i===pi?"#fff":"transparent",cursor:"pointer"}}/>)}</div>}</div>}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
      <div><h2 style={{fontSize:20,fontWeight:700,color:"#111827",margin:0}}>{v.titulo||`${v.marca} ${v.modelo}`}</h2><div style={{display:"flex",gap:5,marginTop:6,flexWrap:"wrap"}}><Badge color={sColor(v.estado)}>{v.estado}</Badge>{v.condicion&&<Badge color={v.condicion==="0km"?"#8b5cf6":"#6b7280"}>{v.condicion}</Badge>}{v.anio&&<Badge color="#6b7280">{v.anio}</Badge>}{v.transmision&&<Badge color="#6b7280">{v.transmision}</Badge>}{v.kilometros&&<Badge color="#6b7280">{Number(v.kilometros).toLocaleString()} km</Badge>}</div></div>
      <div style={{display:"flex",gap:5}}><Btn variant="secondary" size="sm" onClick={()=>onEdit(v)}><Ic.Edit/></Btn><button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:"#9ca3af"}}><Ic.X/></button></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:"8px 18px",marginBottom:18}}>{[["Marca",v.marca],["Modelo",v.modelo],["Versión",v.version],["Motor",v.motor],["Transmisión",v.transmision],["Condición",v.condicion],["Patente",v.patente],["Chasis",v.chasis],["N° Motor",v.nroMotor],["Procedencia",v.procedencia],["Ubicación",v.ubicacion],["Ingreso",fmtD(v.fechaIngreso)],["Venta",fmtD(v.fechaVenta)],["Vendedor",v.vendedor]].filter(([_,val])=>val).map(([l,val])=><div key={l}><div style={{fontSize:10,color:"#9ca3af",fontWeight:600,textTransform:"uppercase",letterSpacing:.5}}>{l}</div><div style={{fontSize:13,color:"#374151",fontWeight:500,marginTop:1}}>{val}</div></div>)}{dias!==null&&<div><div style={{fontSize:10,color:"#9ca3af",fontWeight:600,textTransform:"uppercase",letterSpacing:.5}}>Días stock</div><div style={{fontSize:13,color:"#0284c7",fontWeight:700,marginTop:1}}>{dias}d</div></div>}</div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:18}}>{[["Cubiertas",v.estadoCubiertas],["Pintura",v.estadoPintura],["Motor",v.estadoMotor],["Interior",v.estadoInterior]].map(([l,e])=><div key={l} style={{textAlign:"center",padding:"8px 4px",background:"#f9fafb",borderRadius:8}}><div style={{fontSize:10,color:"#9ca3af",fontWeight:600,marginBottom:2}}>{l}</div><div style={{fontSize:12,fontWeight:700,color:eColor(e)}}>{e}</div></div>)}</div>
    {(v.precioCompra||v.precioVenta)&&<Card style={{background:"#f8fafc",marginBottom:16,padding:14}}><div style={{fontSize:11,fontWeight:700,color:"#0284c7",marginBottom:8}}>Finanzas</div><div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,textAlign:"center"}}><div><div style={{fontSize:10,color:"#9ca3af"}}>Compra</div><div style={{fontSize:14,fontWeight:700,color:"#374151"}}>{fmt$(v.precioCompra)}</div></div><div><div style={{fontSize:10,color:"#9ca3af"}}>Gastos</div><div style={{fontSize:14,fontWeight:700,color:"#f59e0b"}}>{fmt$(tg)}</div></div><div><div style={{fontSize:10,color:"#9ca3af"}}>Venta</div><div style={{fontSize:14,fontWeight:700,color:"#374151"}}>{fmt$(v.precioVenta)}</div></div><div><div style={{fontSize:10,color:"#9ca3af"}}>Mín</div><div style={{fontSize:14,fontWeight:700,color:"#6b7280"}}>{fmt$(v.precioMinimo)}</div></div><div><div style={{fontSize:10,color:"#9ca3af"}}>Ganancia</div><div style={{fontSize:14,fontWeight:700,color:pr>=0?"#16a34a":"#dc2626"}}>{fmt$(pr)} ({pct.toFixed(1)}%)</div></div></div></Card>}
    {v.historial?.length>0&&<div style={{marginBottom:14}}><div style={{fontSize:11,fontWeight:700,color:"#0284c7",marginBottom:5}}>Historial</div><div style={{borderLeft:"2px solid #bae6fd",paddingLeft:12}}>{[...v.historial].sort((a,b)=>a.fecha>b.fecha?-1:1).map((h,i)=><div key={i} style={{marginBottom:6}}><div style={{fontSize:10,color:"#0284c7",fontWeight:600}}>{fmtD(h.fecha)}</div><div style={{fontSize:12,color:"#4b5563"}}>{h.detalle}</div></div>)}</div></div>}
    {v.anotaciones&&<div><div style={{fontSize:11,fontWeight:700,color:"#0284c7",marginBottom:4}}>Anotaciones</div><p style={{fontSize:12,color:"#4b5563",lineHeight:1.5,margin:0,whiteSpace:"pre-wrap"}}>{v.anotaciones}</p></div>}
  </Modal>);
}

/* ═══════ VEHICLE CARD ═══════ */
function VCard({vehicle:v,onView,onEdit,onDelete}){const{profit:pr}=cProfit(v);const dias=v.fechaIngreso&&!v.vendido?dDiff(v.fechaIngreso,td()):null;const isA=dias!==null&&dias>=ALERT_DAYS;return(<Card style={{padding:0,overflow:"hidden",position:"relative"}}>{isA&&<div style={{position:"absolute",top:6,left:6,zIndex:2,background:"#fef2f2",border:"1px solid #fecaca",borderRadius:6,padding:"2px 6px",fontSize:9,fontWeight:700,color:"#dc2626",display:"flex",alignItems:"center",gap:2}}><Ic.Alert/>{dias}d</div>}<div onClick={()=>onView(v)} style={{height:120,background:"#f3f4f6",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",cursor:"pointer"}}>{v.fotos?.length>0?<img src={v.fotos[0]} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<div style={{color:"#d1d5db"}}><Ic.Cam/></div>}</div><div style={{padding:11}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}><div style={{minWidth:0,flex:1}}><div style={{fontSize:13,fontWeight:700,color:"#111827",lineHeight:1.3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v.titulo||`${v.marca} ${v.modelo}`}</div><div style={{fontSize:10,color:"#9ca3af",marginTop:1}}>{[v.anio,v.transmision,v.kilometros?Number(v.kilometros).toLocaleString()+" km":null].filter(Boolean).join(" · ")}</div></div><Badge color={sColor(v.estado)}>{v.estado}</Badge></div><div style={{display:"flex",gap:3,marginBottom:5,flexWrap:"wrap"}}>{v.condicion&&<span style={{fontSize:9,fontWeight:600,color:v.condicion==="0km"?"#8b5cf6":"#6b7280",background:v.condicion==="0km"?"#8b5cf615":"#f3f4f6",padding:"1px 5px",borderRadius:4}}>{v.condicion}</span>}<span style={{fontSize:9,fontWeight:600,color:"#6b7280",background:"#f3f4f6",padding:"1px 5px",borderRadius:4}}>{v.ubicacion}</span></div>{v.precioVenta&&<div style={{fontSize:16,fontWeight:700,color:"#0284c7"}}>{fmt$(v.precioVenta)}</div>}{v.vendido&&v.precioVenta&&v.precioCompra&&<div style={{fontSize:10,color:pr>=0?"#16a34a":"#dc2626",fontWeight:600,marginTop:1}}>Ganancia: {fmt$(pr)}</div>}<div style={{display:"flex",gap:4,marginTop:8,paddingTop:8,borderTop:"1px solid #f3f4f6"}}><Btn variant="secondary" size="sm" onClick={()=>onView(v)} style={{flex:1}}><Ic.Eye/></Btn><Btn variant="secondary" size="sm" onClick={()=>onEdit(v)} style={{flex:1}}><Ic.Edit/></Btn><Btn variant="danger" size="sm" onClick={()=>onDelete(v.id)}><Ic.Trash/></Btn></div></div></Card>);}

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
function DashPage({data}){
  const [df,setDf]=useState({mes:"",marca:"",modelo:""});
  const stk=data.vehicles.filter(v=>!v.vendido);
  const allSold=data.vehicles.filter(v=>v.vendido);
  const sld=allSold.filter(v=>{
    if(df.mes&&v.fechaVenta){const m=v.fechaVenta.slice(0,7);if(m!==df.mes)return false;}
    if(df.marca&&v.marca!==df.marca)return false;
    if(df.modelo&&v.modelo!==df.modelo)return false;
    return true;
  });
  const tp=sld.reduce((s,v)=>s+cProfit(v).profit,0);const ad=sld.length?Math.round(sld.reduce((s,v)=>s+(dDiff(v.fechaIngreso,v.fechaVenta)||0),0)/sld.length):0;
  const alerts=stk.filter(v=>v.fechaIngreso&&dDiff(v.fechaIngreso,td())>=ALERT_DAYS);
  const meses=[...new Set(allSold.map(v=>v.fechaVenta?.slice(0,7)).filter(Boolean))].sort().reverse();
  const marcasV=[...new Set(allSold.map(v=>v.marca).filter(Boolean))].sort();
  const modelosV=[...new Set(allSold.filter(v=>!df.marca||v.marca===df.marca).map(v=>v.modelo).filter(Boolean))].sort();
  const selS={padding:"7px 9px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:11,background:"#fafbfc",outline:"none"};
  return(<div><h1 style={{fontSize:24,fontWeight:800,color:"#111827",margin:"0 0 20px",letterSpacing:-.5}}>Dashboard</h1>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(185px,1fr))",gap:12,marginBottom:20}}><StatCard label="En stock" value={stk.length} icon={<Ic.Car/>} color="#0284c7"/><StatCard label="Vendidos (filtrado)" value={sld.length} icon={<Ic.Chart/>} color="#16a34a"/><StatCard label="Ganancia (filtrado)" value={fmt$(tp)} icon={<Ic.Dollar/>} color="#16a34a"/><StatCard label="Prom. días stock" value={ad+"d"} icon={<Ic.Home/>} color="#f59e0b" sub={data.clients.length+" clientes"}/></div>
    {alerts.length>0&&<Card style={{marginBottom:16,background:"#fffbeb",border:"1px solid #fde68a",padding:14}}><div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}><span style={{color:"#f59e0b"}}><Ic.Alert/></span><span style={{fontSize:13,fontWeight:700,color:"#92400e"}}>{alerts.length} vehículo(s) con +{ALERT_DAYS} días sin vender</span></div>{alerts.map(v=><div key={v.id} style={{fontSize:12,color:"#78350f",padding:"3px 0",display:"flex",justifyContent:"space-between"}}><span style={{fontWeight:600}}>{v.titulo||`${v.marca} ${v.modelo}`}</span><span>{dDiff(v.fechaIngreso,td())}d — {v.ubicacion}</span></div>)}</Card>}
    <Card style={{marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><h3 style={{fontSize:13,fontWeight:700,color:"#111827",margin:0}}>Ventas recientes</h3></div>
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        <select value={df.mes} onChange={e=>setDf(f=>({...f,mes:e.target.value}))} style={selS}><option value="">Todos los meses</option>{meses.map(m=><option key={m} value={m}>{m}</option>)}</select>
        <select value={df.marca} onChange={e=>setDf(f=>({...f,marca:e.target.value,modelo:""}))} style={selS}><option value="">Todas las marcas</option>{marcasV.map(m=><option key={m}>{m}</option>)}</select>
        <select value={df.modelo} onChange={e=>setDf(f=>({...f,modelo:e.target.value}))} style={selS}><option value="">Todos los modelos</option>{modelosV.map(m=><option key={m}>{m}</option>)}</select>
        {(df.mes||df.marca||df.modelo)&&<Btn variant="ghost" size="sm" onClick={()=>setDf({mes:"",marca:"",modelo:""})}>Limpiar filtros</Btn>}
      </div>
      {sld.length>0?<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}><thead><tr style={{borderBottom:"2px solid #e5e7eb"}}>{["Vehículo","Marca","Modelo","Compra","Venta","Gastos","Ganancia","%"].map(h=><th key={h} style={{padding:"6px 8px",textAlign:"left",fontWeight:600,color:"#6b7280",fontSize:10,textTransform:"uppercase"}}>{h}</th>)}</tr></thead><tbody>{sld.slice().reverse().map(v=>{const p=cProfit(v);return<tr key={v.id} style={{borderBottom:"1px solid #f3f4f6"}}><td style={{padding:"7px 8px",fontWeight:600,color:"#111827"}}>{v.titulo||`${v.marca} ${v.modelo}`}</td><td style={{padding:"7px 8px",color:"#6b7280"}}>{v.marca}</td><td style={{padding:"7px 8px",color:"#6b7280"}}>{v.modelo}</td><td style={{padding:"7px 8px",color:"#6b7280"}}>{fmt$(v.precioCompra)}</td><td style={{padding:"7px 8px",color:"#6b7280"}}>{fmt$(v.precioVenta)}</td><td style={{padding:"7px 8px",color:"#f59e0b"}}>{fmt$(p.tg)}</td><td style={{padding:"7px 8px",fontWeight:700,color:p.profit>=0?"#16a34a":"#dc2626"}}>{fmt$(p.profit)}</td><td style={{padding:"7px 8px",fontWeight:600,color:p.profit>=0?"#16a34a":"#dc2626"}}>{p.pct.toFixed(1)}%</td></tr>;})}</tbody></table></div>:<div style={{textAlign:"center",padding:20,color:"#9ca3af",fontSize:12}}>No hay ventas con estos filtros.</div>}
    </Card>
  </div>);
}

function VehPage({data,setData,user,allMarcas,addMarca}){const [sf,setSf]=useState(false);const [ev,setEv]=useState(null);const [vv,setVv]=useState(null);const [fl,setFl]=useState({search:"",marca:"",estado:"all",sort:"recent",precioMin:"",precioMax:"",kmMin:"",kmMax:"",anioMin:"",anioMax:"",condicion:"",ubicacion:"",transmision:""});const [sfl,setSfl]=useState(false);
  const filt=useMemo(()=>{let l=data.vehicles.filter(v=>!v.vendido);if(fl.search){const q=fl.search.toLowerCase();l=l.filter(v=>[v.titulo,v.marca,v.modelo,v.patente,v.version].some(f=>(f||"").toLowerCase().includes(q)));}if(fl.marca)l=l.filter(v=>v.marca===fl.marca);if(fl.estado&&fl.estado!=="all")l=l.filter(v=>v.estado===fl.estado);if(fl.condicion)l=l.filter(v=>v.condicion===fl.condicion);if(fl.ubicacion)l=l.filter(v=>(v.ubicacion||"").toLowerCase().includes(fl.ubicacion.toLowerCase()));if(fl.transmision)l=l.filter(v=>v.transmision===fl.transmision);if(fl.precioMin)l=l.filter(v=>+(v.precioVenta)>=+fl.precioMin);if(fl.precioMax)l=l.filter(v=>+(v.precioVenta)<=+fl.precioMax);if(fl.kmMin)l=l.filter(v=>+(v.kilometros)>=+fl.kmMin);if(fl.kmMax)l=l.filter(v=>+(v.kilometros)<=+fl.kmMax);if(fl.anioMin)l=l.filter(v=>+(v.anio)>=+fl.anioMin);if(fl.anioMax)l=l.filter(v=>+(v.anio)<=+fl.anioMax);const sorts={recent:(a,b)=>b.id-a.id,price_asc:(a,b)=>(+(a.precioVenta)||0)-(+(b.precioVenta)||0),price_desc:(a,b)=>(+(b.precioVenta)||0)-(+(a.precioVenta)||0),km_asc:(a,b)=>(+(a.kilometros)||0)-(+(b.kilometros)||0),km_desc:(a,b)=>(+(b.kilometros)||0)-(+(a.kilometros)||0),year_desc:(a,b)=>(+(b.anio)||0)-(+(a.anio)||0),year_asc:(a,b)=>(+(a.anio)||0)-(+(b.anio)||0)};if(sorts[fl.sort])l.sort(sorts[fl.sort]);return l;},[data.vehicles,fl]);
  const save=f=>{const nd={...data};const now=new Date().toLocaleString("es-AR");if(f.id){nd.vehicles=data.vehicles.map(v=>v.id===f.id?f:v);nd.activityLog=[{date:now,user:user.name,action:`Editó vehículo: ${f.titulo||f.marca+" "+f.modelo}`},...(data.activityLog||[])];}else{f.id=data.nextVId;nd.nextVId=data.nextVId+1;nd.vehicles=[...data.vehicles,f];nd.activityLog=[{date:now,user:user.name,action:`Agregó vehículo: ${f.titulo||f.marca+" "+f.modelo}`},...(data.activityLog||[])];}setData(nd);setSf(false);setEv(null);};
  const del=id=>{if(!confirm("¿Eliminar?"))return;const v=data.vehicles.find(x=>x.id===id);const now=new Date().toLocaleString("es-AR");setData({...data,vehicles:data.vehicles.filter(x=>x.id!==id),activityLog:[{date:now,user:user.name,action:`Eliminó vehículo: ${v?.titulo||v?.marca+" "+v?.modelo}`},...(data.activityLog||[])]});};
  const marcas=[...new Set(data.vehicles.map(v=>v.marca).filter(Boolean))].sort();
  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}><h1 style={{fontSize:24,fontWeight:800,color:"#111827",margin:0,letterSpacing:-.5}}>Catálogo de Vehículos</h1><div style={{display:"flex",gap:6}}><Btn variant="secondary" size="sm" onClick={()=>exportVehiclesXLS(filt)}><Ic.Download/> Excel</Btn><Btn variant="secondary" size="sm" onClick={()=>downloadPDF(filt)}><Ic.Download/> PDF</Btn><Btn variant="primary" onClick={()=>{setEv(null);setSf(true);}}><Ic.Plus/> Nuevo</Btn></div></div>
    <Card style={{marginBottom:14,padding:12}}><div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}><div style={{position:"relative",flex:1,minWidth:160}}><span style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",color:"#9ca3af"}}><Ic.Search/></span><input placeholder="Buscar..." value={fl.search} onChange={e=>setFl(f=>({...f,search:e.target.value}))} style={{width:"100%",padding:"7px 9px 7px 28px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:12,background:"#fafbfc",outline:"none",boxSizing:"border-box"}}/></div><select value={fl.marca} onChange={e=>setFl(f=>({...f,marca:e.target.value}))} style={{padding:"7px 9px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:11,background:"#fafbfc"}}><option value="">Marcas</option>{marcas.map(m=><option key={m}>{m}</option>)}</select><select value={fl.estado} onChange={e=>setFl(f=>({...f,estado:e.target.value}))} style={{padding:"7px 9px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:11,background:"#fafbfc"}}><option value="all">Todos</option>{EST_V.filter(e=>e!=="Vendido").map(e=><option key={e} value={e}>{e}</option>)}</select><select value={fl.sort} onChange={e=>setFl(f=>({...f,sort:e.target.value}))} style={{padding:"7px 9px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:11,background:"#fafbfc"}}><option value="recent">Reciente</option><option value="price_asc">Precio ↑</option><option value="price_desc">Precio ↓</option><option value="km_asc">Km ↑</option><option value="km_desc">Km ↓</option><option value="year_desc">Año ↓</option><option value="year_asc">Año ↑</option></select><Btn variant="ghost" size="sm" onClick={()=>setSfl(!sfl)}>{sfl?"Menos":"Filtros"} <Ic.Down/></Btn></div>{sfl&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:6,marginTop:8,paddingTop:8,borderTop:"1px solid #f3f4f6"}}><Inp label="$ mín" type="number" value={fl.precioMin} onChange={e=>setFl(f=>({...f,precioMin:e.target.value}))}/><Inp label="$ máx" type="number" value={fl.precioMax} onChange={e=>setFl(f=>({...f,precioMax:e.target.value}))}/><Inp label="Km mín" type="number" value={fl.kmMin} onChange={e=>setFl(f=>({...f,kmMin:e.target.value}))}/><Inp label="Km máx" type="number" value={fl.kmMax} onChange={e=>setFl(f=>({...f,kmMax:e.target.value}))}/><Inp label="Año ≥" type="number" value={fl.anioMin} onChange={e=>setFl(f=>({...f,anioMin:e.target.value}))}/><Inp label="Año ≤" type="number" value={fl.anioMax} onChange={e=>setFl(f=>({...f,anioMax:e.target.value}))}/><Sel label="Condición" value={fl.condicion} onChange={e=>setFl(f=>({...f,condicion:e.target.value}))} options={[{value:"",label:"Todas"},...COND]}/><Inp label="Ubicación" placeholder="Filtrar ubicación..." value={fl.ubicacion} onChange={e=>setFl(f=>({...f,ubicacion:e.target.value}))}/><Sel label="Trans." value={fl.transmision} onChange={e=>setFl(f=>({...f,transmision:e.target.value}))} options={[{value:"",label:"Todas"},...TRANS]}/></div>}</Card>
    <div style={{fontSize:11,color:"#6b7280",marginBottom:8}}>{filt.length} vehículo{filt.length!==1?"s":""}</div>
    {filt.length>0?<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12}}>{filt.map(v=><VCard key={v.id} vehicle={v} onView={setVv} onEdit={v=>{setEv(v);setSf(true);}} onDelete={del}/>)}</div>:<Card style={{textAlign:"center",padding:36,color:"#9ca3af"}}><p style={{margin:0}}>Sin resultados.</p></Card>}
    {sf&&<VForm vehicle={ev} allMarcas={allMarcas} onSave={save} onCancel={()=>{setSf(false);setEv(null);}} onAddMarca={addMarca} clients={data.clients}/>}
    {vv&&<VDetail vehicle={vv} onClose={()=>setVv(null)} onEdit={v=>{setVv(null);setEv(v);setSf(true);}}/>}
  </div>);
}

/* ═══════ SOLD VEHICLES PAGE ═══════ */
function SoldPage({data,setData,user}){
  const [mes,setMes]=useState("");const [marca,setMarca]=useState("");const [vendedorF,setVendedorF]=useState("");const [search,setSearch]=useState("");const [vv,setVv]=useState(null);const [sf2,setSf2]=useState(false);const [ev2,setEv2]=useState(null);
  const allSold=data.vehicles.filter(v=>v.vendido);
  const meses=[...new Set(allSold.map(v=>v.fechaVenta?.slice(0,7)).filter(Boolean))].sort().reverse();
  const marcasV=[...new Set(allSold.map(v=>v.marca).filter(Boolean))].sort();
  const vendedores=[...new Set(allSold.map(v=>v.vendedor).filter(Boolean))].sort();
  const filt=allSold.filter(v=>{
    if(mes&&v.fechaVenta&&v.fechaVenta.slice(0,7)!==mes)return false;
    if(marca&&v.marca!==marca)return false;
    if(vendedorF&&v.vendedor!==vendedorF)return false;
    if(search){const q=search.toLowerCase();if(![v.titulo,v.marca,v.modelo,v.patente,v.vendedor].some(f=>(f||"").toLowerCase().includes(q)))return false;}
    return true;
  });
  const tp=filt.reduce((s,v)=>s+cProfit(v).profit,0);
  const getCliente=id=>data.clients.find(c=>c.id===Number(id));
  // Vendedor stats
  const vendedorStats={};allSold.forEach(v=>{if(v.vendedor){if(!vendedorStats[v.vendedor])vendedorStats[v.vendedor]={count:0,profit:0};vendedorStats[v.vendedor].count++;vendedorStats[v.vendedor].profit+=cProfit(v).profit;}});
  const topVendedores=Object.entries(vendedorStats).sort((a,b)=>b[1].count-a[1].count);
  const downloadSoldPDF=(list)=>{
    const mesLabel=mes||"Todos";
    const rows=list.map(v=>{const p=cProfit(v);const cli=getCliente(v.clienteVentaId);return`<tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:600;font-size:11px;">${v.titulo||v.marca+" "+v.modelo}</td><td style="padding:8px;border-bottom:1px solid #eee;font-size:11px;">${v.marca}</td><td style="padding:8px;border-bottom:1px solid #eee;font-size:11px;">${v.anio||"-"}</td><td style="padding:8px;border-bottom:1px solid #eee;font-size:11px;">${fmtD(v.fechaVenta)}</td><td style="padding:8px;border-bottom:1px solid #eee;font-size:11px;">${v.vendedor||"-"}</td><td style="padding:8px;border-bottom:1px solid #eee;font-size:11px;">${cli?cli.nombre:"-"}</td><td style="padding:8px;border-bottom:1px solid #eee;font-size:11px;">${fmt$(v.precioCompra)}</td><td style="padding:8px;border-bottom:1px solid #eee;font-size:11px;font-weight:700;color:#0284c7;">${fmt$(v.precioVenta)}</td><td style="padding:8px;border-bottom:1px solid #eee;font-size:11px;font-weight:700;color:${p.profit>=0?"#16a34a":"#dc2626"};">${fmt$(p.profit)}</td></tr>`;}).join("");
    const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>CheckCar - Vendidos</title><style>@page{size:landscape;margin:12mm;}body{font-family:Helvetica,Arial,sans-serif;color:#333;margin:0;padding:16px;}h1{color:#0284c7;font-size:20px;margin:0 0 4px;}p.sub{color:#6b7280;font-size:11px;margin:0 0 16px;}table{width:100%;border-collapse:collapse;}th{background:#16a34a;color:#fff;padding:8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px;}tr:nth-child(even){background:#f9fafb;}</style></head><body><h1>CheckCar — Vehículos Vendidos</h1><p class="sub">${new Date().toLocaleDateString("es-AR")} · Período: ${mesLabel}${vendedorF?" · Vendedor: "+vendedorF:""} · ${list.length} vehículo(s) · Ganancia: ${fmt$(tp)}</p><table><thead><tr><th>Vehículo</th><th>Marca</th><th>Año</th><th>Fecha</th><th>Vendedor</th><th>Cliente</th><th>Compra</th><th>Venta</th><th>Ganancia</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
    const w=window.open("","_blank");if(w){w.document.write(html);w.document.close();setTimeout(()=>w.print(),600);}
  };
  const selS={padding:"7px 9px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:11,background:"#fafbfc",outline:"none"};
  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
      <h1 style={{fontSize:24,fontWeight:800,color:"#111827",margin:0,letterSpacing:-.5}}>Vendidos</h1>
      <div style={{display:"flex",gap:6}}>
        <Btn variant="secondary" size="sm" onClick={()=>{exportToExcel(filt,[{label:"Título",get:v=>v.titulo||`${v.marca} ${v.modelo}`},{label:"Marca",key:"marca"},{label:"Modelo",key:"modelo"},{label:"Año",key:"anio"},{label:"Fecha Venta",key:"fechaVenta"},{label:"Vendedor",key:"vendedor"},{label:"Cliente",get:v=>{const c=getCliente(v.clienteVentaId);return c?c.nombre:"—";}},{label:"Compra",key:"precioCompra"},{label:"Venta",key:"precioVenta"},{label:"Ganancia",get:v=>cProfit(v).profit},{label:"%",get:v=>cProfit(v).pct.toFixed(1)+"%"}],"checkcar-vendidos");}}><Ic.Download/> Excel</Btn>
        <Btn variant="secondary" size="sm" onClick={()=>downloadSoldPDF(filt)}><Ic.Download/> PDF</Btn>
      </div>
    </div>
    <Card style={{marginBottom:14,padding:12}}>
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
        <select value={mes} onChange={e=>setMes(e.target.value)} style={selS}><option value="">Todos los meses</option>{meses.map(m=><option key={m} value={m}>{m}</option>)}</select>
        <select value={marca} onChange={e=>setMarca(e.target.value)} style={selS}><option value="">Todas las marcas</option>{marcasV.map(m=><option key={m}>{m}</option>)}</select>
        <select value={vendedorF} onChange={e=>setVendedorF(e.target.value)} style={selS}><option value="">Todos los vendedores</option>{vendedores.map(v=><option key={v}>{v}</option>)}</select>
        <div style={{position:"relative",flex:1,minWidth:140}}><span style={{position:"absolute",left:7,top:"50%",transform:"translateY(-50%)",color:"#9ca3af"}}><Ic.Search/></span><input placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)} style={{width:"100%",padding:"7px 9px 7px 24px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:11,background:"#fafbfc",outline:"none",boxSizing:"border-box"}}/></div>
        {(mes||marca||vendedorF||search)&&<Btn variant="ghost" size="sm" onClick={()=>{setMes("");setMarca("");setVendedorF("");setSearch("");}}>Limpiar</Btn>}
      </div>
    </Card>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,marginBottom:16}}>
      <StatCard label="Vendidos" value={filt.length} icon={<Ic.Chart/>} color="#16a34a"/>
      <StatCard label="Ganancia total" value={fmt$(tp)} icon={<Ic.Dollar/>} color="#0284c7"/>
      <StatCard label="Gan. promedio" value={fmt$(filt.length?tp/filt.length:0)} icon={<Ic.Chart/>} color="#f59e0b"/>
    </div>
    {/* Ranking vendedores */}
    {topVendedores.length>0&&<Card style={{marginBottom:16}}>
      <h3 style={{fontSize:13,fontWeight:700,color:"#111827",margin:"0 0 10px"}}>Ranking de vendedores</h3>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:8}}>
        {topVendedores.map(([name,st],i)=>(
          <div key={name} onClick={()=>setVendedorF(vendedorF===name?"":name)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:8,border:vendedorF===name?"2px solid #0284c7":"1px solid #e5e7eb",background:vendedorF===name?"#f0f9ff":"#fff",cursor:"pointer",transition:"all .15s"}}>
            <div style={{width:28,height:28,borderRadius:"50%",background:i===0?"#16a34a":i===1?"#0284c7":"#f59e0b",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,flexShrink:0}}>{i+1}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:700,color:"#111827",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</div>
              <div style={{fontSize:10,color:"#6b7280"}}>{st.count} venta{st.count>1?"s":""} · {fmt$(st.profit)} ganancia</div>
            </div>
          </div>
        ))}
      </div>
    </Card>}
    {filt.length>0?<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>{filt.map(v=>{const p=cProfit(v);const cli=getCliente(v.clienteVentaId);return(
      <Card key={v.id} style={{padding:0,overflow:"hidden"}}>
        <div onClick={()=>setVv(v)} style={{height:120,background:"#f3f4f6",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",cursor:"pointer"}}>{v.fotos?.length>0?<img src={v.fotos[0]} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<div style={{color:"#d1d5db"}}><Ic.Cam/></div>}</div>
        <div style={{padding:11}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
            <div style={{minWidth:0,flex:1}}><div style={{fontSize:13,fontWeight:700,color:"#111827",lineHeight:1.3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v.titulo||`${v.marca} ${v.modelo}`}</div><div style={{fontSize:10,color:"#9ca3af",marginTop:1}}>{[v.anio,v.transmision,fmtD(v.fechaVenta)].filter(Boolean).join(" · ")}</div></div>
            <Badge color="#16a34a">Vendido</Badge>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:6}}>
            <div style={{fontSize:15,fontWeight:700,color:"#0284c7"}}>{fmt$(v.precioVenta)}</div>
            <div style={{fontSize:12,fontWeight:700,color:p.profit>=0?"#16a34a":"#dc2626"}}>{fmt$(p.profit)} <span style={{fontSize:10}}>({p.pct.toFixed(1)}%)</span></div>
          </div>
          {v.vendedor&&<div style={{fontSize:10,color:"#374151",marginTop:4,display:"flex",alignItems:"center",gap:3}}><Ic.Users/> <span style={{fontWeight:600}}>{v.vendedor}</span></div>}
          {cli&&<div style={{fontSize:10,color:"#0284c7",marginTop:2}}>Comprador: <span style={{fontWeight:600}}>{cli.nombre}</span>{cli.telefono?` · ${cli.telefono}`:""}</div>}
          {v.fechaIngreso&&v.fechaVenta&&<div style={{fontSize:10,color:"#6b7280",marginTop:2}}>{dDiff(v.fechaIngreso,v.fechaVenta)} días en stock</div>}
        </div>
      </Card>
    );})}</div>:<Card style={{textAlign:"center",padding:36,color:"#9ca3af"}}><p style={{margin:0}}>No hay vehículos vendidos{mes?" en este mes":""}{vendedorF?" por este vendedor":""}.</p></Card>}
    {vv&&!sf2&&<VDetail vehicle={vv} onClose={()=>setVv(null)} onEdit={v=>{setVv(null);setEv2(v);setSf2(true);}}/>}
    {sf2&&<VForm vehicle={ev2} allMarcas={[...new Set([...DEF_MARCAS,...(data.customMarcas||[])])].sort()} onSave={f=>{const now=new Date().toLocaleString("es-AR");const nd={...data,vehicles:data.vehicles.map(v=>v.id===f.id?f:v),activityLog:[{date:now,user:user.name,action:`Editó vehículo vendido: ${f.titulo||f.marca+" "+f.modelo}`},...(data.activityLog||[])]};setData(nd);setSf2(false);setEv2(null);}} onCancel={()=>{setSf2(false);setEv2(null);}} onAddMarca={()=>{}}/>}
  </div>);
}

function SalesPage({data}){
  const [sf,setSf]=useState({mes:"",marca:"",modelo:"",q:""});
  const allSold=data.vehicles.filter(v=>v.vendido);
  const sld=allSold.filter(v=>{
    if(sf.mes&&v.fechaVenta){const m=v.fechaVenta.slice(0,7);if(m!==sf.mes)return false;}
    if(sf.marca&&v.marca!==sf.marca)return false;
    if(sf.modelo&&v.modelo!==sf.modelo)return false;
    if(sf.q){const q=sf.q.toLowerCase();if(![v.titulo,v.marca,v.modelo].some(f=>(f||"").toLowerCase().includes(q)))return false;}
    return true;
  });
  const mc={},mdc={};sld.forEach(v=>{mc[v.marca]=(mc[v.marca]||0)+1;mdc[`${v.marca} ${v.modelo}`]=(mdc[`${v.marca} ${v.modelo}`]||0)+1;});
  const tm=Object.entries(mc).sort((a,b)=>b[1]-a[1]);const tmd=Object.entries(mdc).sort((a,b)=>b[1]-a[1]);
  const tp=sld.reduce((s,v)=>s+cProfit(v).profit,0);const ap=sld.length?tp/sld.length:0;const mx=tm[0]?tm[0][1]:1;
  const meses=[...new Set(allSold.map(v=>v.fechaVenta?.slice(0,7)).filter(Boolean))].sort().reverse();
  const marcasV=[...new Set(allSold.map(v=>v.marca).filter(Boolean))].sort();
  const modelosV=[...new Set(allSold.filter(v=>!sf.marca||v.marca===sf.marca).map(v=>v.modelo).filter(Boolean))].sort();
  const selS={padding:"7px 9px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:11,background:"#fafbfc",outline:"none"};
  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}><h1 style={{fontSize:24,fontWeight:800,color:"#111827",margin:0,letterSpacing:-.5}}>Ventas</h1><Btn variant="secondary" size="sm" onClick={()=>exportSalesXLS(data.vehicles)}><Ic.Download/> Excel ventas</Btn></div>
    <Card style={{marginBottom:16,padding:12}}>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
        <select value={sf.mes} onChange={e=>setSf(f=>({...f,mes:e.target.value}))} style={selS}><option value="">Todos los meses</option>{meses.map(m=><option key={m} value={m}>{m}</option>)}</select>
        <select value={sf.marca} onChange={e=>setSf(f=>({...f,marca:e.target.value,modelo:""}))} style={selS}><option value="">Todas las marcas</option>{marcasV.map(m=><option key={m}>{m}</option>)}</select>
        <select value={sf.modelo} onChange={e=>setSf(f=>({...f,modelo:e.target.value}))} style={selS}><option value="">Todos los modelos</option>{modelosV.map(m=><option key={m}>{m}</option>)}</select>
        <div style={{position:"relative",flex:1,minWidth:140}}><span style={{position:"absolute",left:7,top:"50%",transform:"translateY(-50%)",color:"#9ca3af"}}><Ic.Search/></span><input placeholder="Buscar..." value={sf.q} onChange={e=>setSf(f=>({...f,q:e.target.value}))} style={{width:"100%",padding:"7px 9px 7px 24px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:11,background:"#fafbfc",outline:"none",boxSizing:"border-box"}}/></div>
        {(sf.mes||sf.marca||sf.modelo||sf.q)&&<Btn variant="ghost" size="sm" onClick={()=>setSf({mes:"",marca:"",modelo:"",q:""})}>Limpiar</Btn>}
      </div>
    </Card>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,marginBottom:16}}><StatCard label="Vendidos" value={sld.length} icon={<Ic.Car/>} color="#16a34a"/><StatCard label="Ganancia total" value={fmt$(tp)} icon={<Ic.Dollar/>} color="#0284c7"/><StatCard label="Gan. promedio" value={fmt$(ap)} icon={<Ic.Chart/>} color="#f59e0b"/></div>
    {sld.length===0?<Card style={{textAlign:"center",padding:36,color:"#9ca3af"}}><p style={{margin:0}}>Sin ventas con estos filtros.</p></Card>:<><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
      <Card><h3 style={{fontSize:12,fontWeight:700,color:"#111827",margin:"0 0 10px"}}>Marcas más vendidas</h3>{tm.slice(0,8).map(([m,c])=><div key={m} style={{marginBottom:7}}><div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:2}}><span style={{fontWeight:600,color:"#374151"}}>{m}</span><span style={{color:"#6b7280"}}>{c}</span></div><div style={{height:6,borderRadius:3,background:"#f3f4f6",overflow:"hidden"}}><div style={{height:"100%",width:`${(c/mx)*100}%`,borderRadius:3,background:"linear-gradient(90deg,#0284c7,#0ea5e9)"}}/></div></div>)}</Card>
      <Card><h3 style={{fontSize:12,fontWeight:700,color:"#111827",margin:"0 0 10px"}}>Modelos más vendidos</h3>{tmd.slice(0,8).map(([m,c],i)=><div key={m} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 8px",background:i%2===0?"#f9fafb":"#fff",borderRadius:6,marginBottom:2}}><div style={{display:"flex",alignItems:"center",gap:6}}><span style={{width:20,height:20,borderRadius:"50%",background:"#0284c7",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700}}>{i+1}</span><span style={{fontSize:11,fontWeight:600,color:"#374151"}}>{m}</span></div><Badge color="#6b7280">{c}</Badge></div>)}</Card>
    </div>
    <Card><h3 style={{fontSize:12,fontWeight:700,color:"#111827",margin:"0 0 10px"}}>Detalle de ventas</h3><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}><thead><tr style={{borderBottom:"2px solid #e5e7eb"}}>{["Vehículo","Marca","Modelo","Año","Trans.","Venta","Días","Compra","Precio","Ganancia","%"].map(h=><th key={h} style={{padding:"5px 7px",textAlign:"left",fontWeight:600,color:"#6b7280",fontSize:9,textTransform:"uppercase"}}>{h}</th>)}</tr></thead><tbody>{sld.map(v=>{const p=cProfit(v);return<tr key={v.id} style={{borderBottom:"1px solid #f3f4f6"}}><td style={{padding:"6px 7px",fontWeight:600,color:"#111827"}}>{v.titulo||`${v.marca} ${v.modelo}`}</td><td style={{padding:"6px 7px",color:"#6b7280"}}>{v.marca}</td><td style={{padding:"6px 7px",color:"#6b7280"}}>{v.modelo}</td><td style={{padding:"6px 7px",color:"#6b7280"}}>{v.anio}</td><td style={{padding:"6px 7px",color:"#6b7280"}}>{v.transmision}</td><td style={{padding:"6px 7px",color:"#6b7280"}}>{fmtD(v.fechaVenta)}</td><td style={{padding:"6px 7px",color:"#0284c7",fontWeight:600}}>{dDiff(v.fechaIngreso,v.fechaVenta)??"-"}</td><td style={{padding:"6px 7px",color:"#6b7280"}}>{fmt$(v.precioCompra)}</td><td style={{padding:"6px 7px",color:"#6b7280"}}>{fmt$(v.precioVenta)}</td><td style={{padding:"6px 7px",fontWeight:700,color:p.profit>=0?"#16a34a":"#dc2626"}}>{fmt$(p.profit)}</td><td style={{padding:"6px 7px",fontWeight:600,color:p.profit>=0?"#16a34a":"#dc2626"}}>{p.pct.toFixed(1)}%</td></tr>;})}</tbody></table></div></Card></>}
  </div>);
}

function CliPage({data,setData,user}){const [sf,setSf]=useState(false);const [ec,setEc]=useState(null);const [q,setQ]=useState("");const filt=data.clients.filter(c=>{if(!q)return true;const s=q.toLowerCase();return[c.nombre,c.telefono,c.email,c.dni].some(f=>(f||"").toLowerCase().includes(s));});const save=f=>{const nd={...data};const now=new Date().toLocaleString("es-AR");if(f.id){nd.clients=data.clients.map(c=>c.id===f.id?f:c);nd.activityLog=[{date:now,user:user.name,action:`Editó cliente: ${f.nombre}`},...(data.activityLog||[])];}else{f.id=data.nextCId;nd.nextCId=data.nextCId+1;nd.clients=[...data.clients,f];nd.activityLog=[{date:now,user:user.name,action:`Agregó cliente: ${f.nombre}`},...(data.activityLog||[])];}setData(nd);setSf(false);setEc(null);};const del=id=>{if(!confirm("¿Eliminar?"))return;const c=data.clients.find(x=>x.id===id);const now=new Date().toLocaleString("es-AR");setData({...data,clients:data.clients.filter(x=>x.id!==id),activityLog:[{date:now,user:user.name,action:`Eliminó cliente: ${c?.nombre}`},...(data.activityLog||[])]});};const gV=id=>data.vehicles.find(v=>v.id===Number(id));
  return(<div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}><h1 style={{fontSize:24,fontWeight:800,color:"#111827",margin:0,letterSpacing:-.5}}>Clientes</h1><div style={{display:"flex",gap:6}}><Btn variant="secondary" size="sm" onClick={()=>exportClientsXLS(data.clients,data.vehicles)}><Ic.Download/> Excel</Btn><Btn variant="primary" onClick={()=>{setEc(null);setSf(true);}}><Ic.Plus/> Nuevo</Btn></div></div><Card style={{marginBottom:14,padding:12}}><div style={{position:"relative"}}><span style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",color:"#9ca3af"}}><Ic.Search/></span><input placeholder="Buscar..." value={q} onChange={e=>setQ(e.target.value)} style={{width:"100%",padding:"7px 9px 7px 28px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:12,background:"#fafbfc",outline:"none",boxSizing:"border-box"}}/></div></Card>{filt.length>0?<Card style={{padding:0,overflow:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr style={{borderBottom:"2px solid #e5e7eb"}}>{["Nombre","Teléfono","Email","DNI","Vehículo","Acc."].map(h=><th key={h} style={{padding:"9px 12px",textAlign:"left",fontWeight:600,color:"#6b7280",fontSize:10,textTransform:"uppercase"}}>{h}</th>)}</tr></thead><tbody>{filt.map(c=>{const vh=gV(c.vehiculoId);return<tr key={c.id} style={{borderBottom:"1px solid #f3f4f6"}}><td style={{padding:"9px 12px",fontWeight:600,color:"#111827"}}>{c.nombre}</td><td style={{padding:"9px 12px",color:"#6b7280"}}>{c.telefono||"-"}</td><td style={{padding:"9px 12px",color:"#6b7280"}}>{c.email||"-"}</td><td style={{padding:"9px 12px",color:"#6b7280"}}>{c.dni||"-"}</td><td style={{padding:"9px 12px"}}>{vh?<Badge color="#0284c7">{vh.titulo||`${vh.marca} ${vh.modelo}`}</Badge>:<span style={{color:"#9ca3af"}}>—</span>}</td><td style={{padding:"9px 12px"}}><div style={{display:"flex",gap:4}}><Btn variant="secondary" size="sm" onClick={()=>{setEc(c);setSf(true);}}><Ic.Edit/></Btn><Btn variant="danger" size="sm" onClick={()=>del(c.id)}><Ic.Trash/></Btn></div></td></tr>;})}</tbody></table></Card>:<Card style={{textAlign:"center",padding:36,color:"#9ca3af"}}><p style={{margin:0}}>Sin clientes.</p></Card>}{sf&&<CForm client={ec} vehicles={data.vehicles} onSave={save} onCancel={()=>{setSf(false);setEc(null);}}/>}</div>);
}


function ActPage({data}){const [q,setQ]=useState("");const log=(data.activityLog||[]).filter(l=>{if(!q)return true;const s=q.toLowerCase();return l.action.toLowerCase().includes(s)||l.user.toLowerCase().includes(s);});return(<div><h1 style={{fontSize:24,fontWeight:800,color:"#111827",margin:"0 0 16px",letterSpacing:-.5}}>Actividad</h1><Card style={{marginBottom:14,padding:12}}><div style={{position:"relative"}}><span style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",color:"#9ca3af"}}><Ic.Search/></span><input placeholder="Buscar..." value={q} onChange={e=>setQ(e.target.value)} style={{width:"100%",padding:"7px 9px 7px 28px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:12,background:"#fafbfc",outline:"none",boxSizing:"border-box"}}/></div></Card>{log.length>0?<Card style={{padding:0}}><div style={{maxHeight:550,overflowY:"auto"}}>{log.map((l,i)=><div key={i} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 16px",borderBottom:"1px solid #f3f4f6"}}><div style={{width:28,height:28,borderRadius:"50%",background:"#f0f9ff",display:"flex",alignItems:"center",justifyContent:"center",color:"#0284c7",flexShrink:0,marginTop:2}}><Ic.Log/></div><div style={{flex:1}}><div style={{fontSize:12,color:"#111827",fontWeight:500}}>{l.action}</div><div style={{display:"flex",gap:8,marginTop:2}}><span style={{fontSize:10,color:"#6b7280"}}>{l.user}</span><span style={{fontSize:10,color:"#9ca3af"}}>{l.date}</span></div></div></div>)}</div></Card>:<Card style={{textAlign:"center",padding:36,color:"#9ca3af"}}><p style={{margin:0}}>Sin actividad.</p></Card>}</div>);}

/* ═══════ USER MANAGER (sidebar) ═══════ */
function UserManager({user,data,setData}){
  const [open,setOpen]=useState(false);
  const [showForm,setSF]=useState(false);
  const [form,setForm]=useState({nombre:"",username:"",password:"",role:"vendedor"});
  const [err,setErr]=useState("");
  const [apiUsers,setApiUsers]=useState([]);
  const [loadingApi,setLoadingApi]=useState(false);

  const loadApiUsers=async()=>{if(!hasAPI)return;setLoadingApi(true);try{const d=await apiRequest('/auth/users');setApiUsers(d);}catch{}setLoadingApi(false);};

  useEffect(()=>{if(open&&hasAPI)loadApiUsers();},[open]);

  const tenantUsers=hasAPI?apiUsers:(data.users||[]);

  const addUser=async()=>{
    if(!form.nombre||!form.username||!form.password){setErr("Completá todos los campos");return;}
    if(hasAPI){
      try{
        await apiRequest('/auth/users',{method:'POST',body:JSON.stringify({nombre:form.nombre,email:form.username,password:form.password,rol:form.role})});
        setForm({nombre:"",username:"",password:"",role:"vendedor"});setSF(false);setErr("");loadApiUsers();
        const now=new Date().toLocaleString("es-AR");
        setData({...data,activityLog:[{date:now,user:user.name,action:`Creó usuario: ${form.nombre} (${form.role})`},...(data.activityLog||[])]});
      }catch(e){setErr(e.message);}
    }else{
      if(data.users.find(u=>u.username===form.username)){setErr("Ya existe un usuario con ese nombre");return;}
      const now=new Date().toLocaleString("es-AR");
      const newUser={username:form.username,password:form.password,role:form.role,name:form.nombre};
      setData({...data,users:[...data.users,newUser],activityLog:[{date:now,user:user.name,action:`Creó usuario: ${form.nombre} (${form.role})`},...(data.activityLog||[])]});
      setForm({nombre:"",username:"",password:"",role:"vendedor"});setSF(false);setErr("");
    }
  };

  const delUser=(u)=>{
    const uName=hasAPI?u.nombre:(u.name||u.username);
    const uId=hasAPI?u.email:u.username;
    if(uId===user.username||uId===(hasAPI?user.username:user.username)){alert("No podés eliminarte a vos mismo");return;}
    if(!confirm(`¿Eliminar a ${uName}?`))return;
    if(hasAPI){
      // API delete not implemented in routes yet, just remove from local view
      setApiUsers(apiUsers.filter(x=>x.id!==u.id));
    }else{
      const now=new Date().toLocaleString("es-AR");
      setData({...data,users:data.users.filter(x=>x.username!==u.username),activityLog:[{date:now,user:user.name,action:`Eliminó usuario: ${uName}`},...(data.activityLog||[])]});
    }
  };

  const iS={padding:"7px 9px",border:"1px solid #e5e7eb",borderRadius:6,fontSize:11,background:"#fafbfc",outline:"none",width:"100%",boxSizing:"border-box",color:"#1f2937"};

  return(
    <div style={{marginBottom:10}}>
      <button onClick={()=>setOpen(!open)} style={{display:"flex",alignItems:"center",gap:5,padding:"6px 8px",background:open?"#f0f9ff":"#f9fafb",border:"1px solid #e5e7eb",borderRadius:7,cursor:"pointer",fontSize:10,color:open?"#0284c7":"#6b7280",fontWeight:600,width:"100%",fontFamily:"inherit",justifyContent:"center"}}>
        <Ic.Users/> Gestionar usuarios <Ic.Down/>
      </button>
      {open&&(
        <div style={{marginTop:8,background:"#f9fafb",borderRadius:8,border:"1px solid #e5e7eb",padding:10}}>
          <div style={{fontSize:10,fontWeight:700,color:"#374151",marginBottom:6}}>Usuarios del concesionario</div>
          {loadingApi?<div style={{fontSize:10,color:"#9ca3af",padding:4}}>Cargando...</div>:
          <div style={{maxHeight:120,overflowY:"auto",marginBottom:8}}>
            {tenantUsers.map((u,i)=>{
              const uName=hasAPI?u.nombre:(u.name||u.username);
              const uRole=hasAPI?u.rol:u.role;
              const uId=hasAPI?u.email:u.username;
              const isMe=uId===(user.username);
              return(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 6px",borderRadius:5,background:i%2===0?"#fff":"transparent",marginBottom:2}}>
                  <div>
                    <div style={{fontSize:10,fontWeight:600,color:"#374151"}}>{uName}{isMe&&<span style={{color:"#0284c7"}}> (vos)</span>}</div>
                    <div style={{fontSize:9,color:"#9ca3af"}}>{uRole} · {uId}</div>
                  </div>
                  {!isMe&&<button onClick={()=>delUser(u)} style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer",padding:2,fontSize:10}}><Ic.Trash/></button>}
                </div>
              );
            })}
          </div>}
          {!showForm?
            <button onClick={()=>setSF(true)} style={{display:"flex",alignItems:"center",gap:3,padding:"5px 8px",background:"#0284c7",color:"#fff",border:"none",borderRadius:6,cursor:"pointer",fontSize:10,fontWeight:600,width:"100%",fontFamily:"inherit",justifyContent:"center"}}><Ic.Plus/> Nuevo usuario</button>
          :(
            <div style={{display:"flex",flexDirection:"column",gap:5}}>
              <input style={iS} placeholder="Nombre completo" value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))}/>
              <input style={iS} placeholder={hasAPI?"Email":"Usuario"} value={form.username} onChange={e=>setForm(f=>({...f,username:e.target.value}))}/>
              <input style={iS} type="password" placeholder="Contraseña" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))}/>
              <select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))} style={iS}>
                <option value="vendedor">Vendedor</option>
                <option value="admin">Administrador</option>
              </select>
              {err&&<div style={{fontSize:10,color:"#dc2626",background:"#fef2f2",padding:"4px 6px",borderRadius:4}}>{err}</div>}
              <div style={{display:"flex",gap:4}}>
                <button onClick={()=>{setSF(false);setErr("");}} style={{flex:1,padding:"5px",background:"#f3f4f6",border:"1px solid #e5e7eb",borderRadius:5,cursor:"pointer",fontSize:10,fontFamily:"inherit",color:"#6b7280"}}>Cancelar</button>
                <button onClick={addUser} style={{flex:1,padding:"5px",background:"#0284c7",color:"#fff",border:"none",borderRadius:5,cursor:"pointer",fontSize:10,fontWeight:600,fontFamily:"inherit"}}>Crear</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════ CALCULADORA DE PATENTES ═══════ */
const PATENTE_PROV={
  buenos_aires:{nombre:"Buenos Aires (PBA)",escalas:[{desde:0,hasta:14100000,fijo:0,ali:0.01},{desde:14100000,hasta:18700000,fijo:141000,ali:0.02},{desde:18700000,hasta:25000000,fijo:233000,ali:0.025},{desde:25000000,hasta:35000000,fijo:390500,ali:0.035},{desde:35000000,fijo:740500,ali:0.045}],marginal:true,pickupAli:0.015,pickupDif:true,pickupNota:"Pick-up: 1,5% solo si está afectada a actividad laboral (autónomo/monotrib.). Sin afectación, paga escala general.",frec:"mensual",cuotas:10,elecExento:true,hibridoExento:true,nota:"Desde 2026: 10 cuotas mensuales (mar–dic). Eléctrico/Híbrido: exentos (solicitar en ARBA). Desc. 15% pago anual."},
  caba:{nombre:"CABA",escalas:[{hasta:5000000,ali:0.016},{hasta:12000000,ali:0.02},{hasta:25000000,ali:0.025},{hasta:50000000,ali:0.035},{hasta:100000000,ali:0.05},{ali:0.06}],pickupAli:0.023,pickupDif:true,frec:"bimestral",cuotas:6,elecExento:true,hibridoEsc:true,nota:"Eléctrico: exento permanente. Híbrido: años 1-2 exento, año 3 paga 40%, año 4 paga 60%, año 5 paga 80%, año 6+ completo. Pick-up/utilitario: 2,3% fijo. Desc. 10% pago anual. (Escala auto aproximada)"},
  cordoba:{nombre:"Córdoba",escalas:[{ali:0.015}],luxoAli:0.021,luxoUmbral:48000000,pickupDif:false,frec:"mensual",cuotas:12,elecDesc:0.5,hibridoDesc:0.5,anioExento:2008,nota:"1,5% general. Lujo (>$48M fiscal): 2,1%. Modelos ≤2008: exentos. Eléctrico/Híbrido (fab. en Córdoba): 50% desc. Desc. 30% buenos contribuyentes."},
  santa_fe:{nombre:"Santa Fe",escalas:[{ali:0.023}],pickupDif:false,frec:"bimestral",cuotas:6,elecExento:true,hibridoExento:true,nota:"2,3%. Eléctrico/Híbrido: exentos hasta 2030 (cond. integración nacional). Desc. 35% anual; 15% débito automático."},
  mendoza:{nombre:"Mendoza",escalas:[{hasta:5700000,ali:0.015},{hasta:11400000,ali:0.016},{hasta:19000000,ali:0.017},{hasta:28500000,ali:0.018},{hasta:38000000,ali:0.020},{hasta:47500000,ali:0.0225},{hasta:70300000,ali:0.025},{ali:0.030}],pickupDif:false,frec:"bimestral",cuotas:6,elecDesc:0.5,hibridoDesc:0.5,anioExento:1999,nota:"Escala progresiva (Ley 9597/2024). Vehículos ≤1999: exentos. Eléctrico/Híbrido: 50% desc."},
  tucuman:{nombre:"Tucumán",escalas:[{ali:0.02}],pickupDif:false,frec:"bimestral",cuotas:6,nota:"2% única."},
  salta:{nombre:"Salta",escalas:[{ali:0.02}],pickupDif:false,frec:"bimestral",cuotas:6,nota:"2% única."},
  entre_rios:{nombre:"Entre Ríos",escalas:[{ali:0.0267}],pickupDif:false,frec:"bimestral",cuotas:6,elecExentoAnios:5,hibridoExentoAnios:5,nota:"2,67%. Eléctrico/Híbrido (incl. PHEV, FCEV): exentos primeros 5 años (Ley 10.949)."},
  corrientes:{nombre:"Corrientes",escalas:[{ali:0.025}],pickupDif:false,frec:"bimestral",cuotas:6,nota:"2,5% única."},
  misiones:{nombre:"Misiones",escalas:[{ali:0.02}],pickupDif:false,frec:"bimestral",cuotas:6,nota:"2% única."},
  chaco:{nombre:"Chaco",escalas:[{ali:0.006}],pickupDif:false,frec:"bimestral",cuotas:6,nota:"0,6% — la más baja del país."},
  formosa:{nombre:"Formosa",escalas:[{ali:0.02}],pickupDif:false,frec:"bimestral",cuotas:6,nota:"2% única."},
  santiago:{nombre:"Santiago del Estero",escalas:[{ali:0.018}],pickupDif:false,frec:"bimestral",cuotas:6,nota:"1,8% única."},
  la_rioja:{nombre:"La Rioja",escalas:[{ali:0.025}],pickupDif:false,frec:"bimestral",cuotas:6,nota:"2,5% única."},
  catamarca:{nombre:"Catamarca",escalas:[{ali:0.02}],pickupDif:false,frec:"bimestral",cuotas:6,nota:"2% única."},
  jujuy:{nombre:"Jujuy",escalas:[{ali:0.02}],pickupDif:false,frec:"bimestral",cuotas:6,nota:"2% única."},
  san_juan:{nombre:"San Juan",escalas:[{ali:0.02}],pickupDif:false,frec:"bimestral",cuotas:6,elecExento:true,hibridoExento:true,nota:"2% única. Eléctrico/Híbrido: exentos."},
  san_luis:{nombre:"San Luis",escalas:[{ali:0.035}],pickupDif:false,frec:"bimestral",cuotas:6,elecExento:true,nota:"3,5% única. Eléctrico: exento."},
  la_pampa:{nombre:"La Pampa",escalas:[{hasta:624793,ali:0.02},{hasta:1338568,ali:0.023},{hasta:2230943,ali:0.025},{hasta:3122774,ali:0.026},{hasta:4015156,ali:0.027},{hasta:4907528,ali:0.028},{hasta:5799926,ali:0.029},{ali:0.030}],pickupDif:false,frec:"bimestral",cuotas:6,nota:"Escala progresiva por tramos (Ley Impositiva 2025)."},
  rio_negro:{nombre:"Río Negro",escalas:[{ali:0.035}],pickupDif:false,frec:"bimestral",cuotas:6,nota:"3,5%. Posibles beneficios eléctrico/híbrido (verificar con organismo provincial)."},
  neuquen:{nombre:"Neuquén",escalas:[{ali:0.025}],pickupDif:false,frec:"bimestral",cuotas:6,nota:"2,5%. Beneficio parcial eléctrico/híbrido (varía por municipio)."},
  chubut:{nombre:"Chubut",escalas:[{ali:0.027}],pickupDif:false,frec:"bimestral",cuotas:6,nota:"2,7%. Posibles beneficios eléctrico/híbrido (verificar)."},
  santa_cruz:{nombre:"Santa Cruz",escalas:[{ali:0.025}],pickupDif:false,frec:"bimestral",cuotas:6,nota:"2,5% única."},
  tierra_del_fuego:{nombre:"Tierra del Fuego",escalas:[{ali:0.035}],pickupDif:false,frec:"bimestral",cuotas:6,elecExento:true,municipal:true,nota:"⚠️ Impuesto MUNICIPAL (Ushuaia / Río Grande). Alícuota estimada ~3-4%. Eléctrico: exento (Ord. 3.812). Verificar con municipio."},
};

function calcPat(provId,valor,tipoV,motor,anio){
  const p=PATENTE_PROV[provId];if(!p)return null;
  const v=Number(valor),an=Number(anio),edad=2026-an;
  if(p.anioExento&&an<=p.anioExento)return{exento:true,razon:`Modelos ${p.anioExento} y anteriores están exentos en ${p.nombre}`,prov:p};
  if(motor==="electrico"){
    if(p.elecExento)return{exento:true,razon:`Vehículos 100% eléctricos están exentos en ${p.nombre}`,prov:p};
    if(p.elecExentoAnios&&edad<p.elecExentoAnios)return{exento:true,razon:`Eléctrico con menos de ${p.elecExentoAnios} años desde inscripción: exento en ${p.nombre} (Ley 10.949)`,prov:p};
  }
  if(motor==="hibrido"){
    if(p.hibridoExento)return{exento:true,razon:`Vehículos híbridos están exentos en ${p.nombre}`,prov:p};
    if(p.hibridoExentoAnios&&edad<p.hibridoExentoAnios)return{exento:true,razon:`Híbrido con menos de ${p.hibridoExentoAnios} años desde inscripción: exento en ${p.nombre} (Ley 10.949)`,prov:p};
    if(p.hibridoEsc&&provId==="caba"&&edad<=2)return{exento:true,razon:"Híbrido: exento los primeros 2 años en CABA",prov:p};
  }
  let base;
  if(tipoV==="pickup"&&p.pickupDif&&p.pickupAli!==undefined){
    base=v*p.pickupAli;
  }else if(p.luxoUmbral&&v>p.luxoUmbral){
    base=v*p.luxoAli;
  }else if(p.marginal){
    let t=p.escalas[p.escalas.length-1];
    for(const s of p.escalas){if(!s.hasta||v<=s.hasta){t=s;break;}}
    base=t.fijo+(v-(t.desde||0))*t.ali;
  }else if(p.escalas.length===1){
    base=v*p.escalas[0].ali;
  }else{
    let ali=p.escalas[p.escalas.length-1].ali;
    for(const t of p.escalas){if(!t.hasta||v<=t.hasta){ali=t.ali;break;}}
    base=v*ali;
  }
  let desc=0,notaEH="";
  if(motor==="electrico"&&p.elecDesc){desc=p.elecDesc;notaEH=`Descuento ${p.elecDesc*100}% por vehículo eléctrico`;}
  if(motor==="hibrido"){
    if(p.hibridoDesc){desc=p.hibridoDesc;notaEH=`Descuento ${p.hibridoDesc*100}% por vehículo híbrido`;}
    if(p.hibridoEsc&&provId==="caba"){
      if(edad===3){desc=0.6;notaEH="Híbrido año 3 en CABA: paga el 40% del impuesto base";}
      else if(edad===4){desc=0.4;notaEH="Híbrido año 4 en CABA: paga el 60% del impuesto base";}
      else if(edad===5){desc=0.2;notaEH="Híbrido año 5 en CABA: paga el 80% del impuesto base";}
    }
  }
  const anual=base*(1-desc);
  const cuota=anual/p.cuotas;
  const aliEf=v>0?(anual/v*100):0;
  return{exento:false,anual,cuota,aliEf,notaEH,prov:p,tipoUsado:tipoV==="pickup"&&p.pickupDif?"pickup-dif":"general"};
}

function CalcPatentePage(){
  const [prov,setProv]=useState("");
  const [tipoV,setTipoV]=useState("auto");
  const [motor,setMotor]=useState("combustion");
  const [valFiscal,setValFiscal]=useState("");
  const [anio,setAnio]=useState(String(new Date().getFullYear()));
  const [res,setRes]=useState(null);
  const calcular=()=>{if(!prov||!valFiscal)return;setRes(calcPat(prov,valFiscal,tipoV,motor,anio));};
  const provOpts=[{value:"",label:"— Seleccionar provincia —"},...Object.entries(PATENTE_PROV).map(([k,v])=>({value:k,label:v.nombre}))];
  const hasDif=prov&&PATENTE_PROV[prov]?.pickupDif;
  return(<div>
    <h1 style={{fontSize:24,fontWeight:800,color:"#111827",margin:"0 0 6px",letterSpacing:-.5}}>Calculadora de Patentes</h1>
    <p style={{fontSize:13,color:"#6b7280",margin:"0 0 20px"}}>Ingresá el valor fiscal DNRPA y seleccioná provincia, tipo de vehículo y motorización para estimar el impuesto automotor.</p>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
      <Card>
        <Sec>Datos del vehículo</Sec>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
          <div style={{gridColumn:"1/-1"}}><Sel label="Provincia" value={prov} onChange={e=>{setProv(e.target.value);setRes(null);}} options={provOpts}/></div>
          <div style={{gridColumn:"1/-1"}}>
            <label style={{fontSize:11,fontWeight:600,color:"#4b5563",display:"block",marginBottom:5}}>Tipo de vehículo</label>
            <div style={{display:"flex",gap:8}}>
              {[["auto","🚗 Auto / SUV"],["pickup","🛻 Pick-up"]].map(([val,lbl])=>(
                <button key={val} onClick={()=>{setTipoV(val);setRes(null);}} style={{flex:1,padding:"9px 12px",border:`2px solid ${tipoV===val?"#0284c7":"#e5e7eb"}`,borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:600,background:tipoV===val?"#f0f9ff":"#fafbfc",color:tipoV===val?"#0284c7":"#6b7280",transition:"all .15s",fontFamily:"inherit"}}>{lbl}</button>
              ))}
            </div>
            {tipoV==="pickup"&&hasDif&&<div style={{marginTop:6,padding:"6px 9px",background:"#fffbeb",border:"1px solid #fde68a",borderRadius:6,fontSize:10,color:"#92400e",lineHeight:1.5}}>{PATENTE_PROV[prov]?.pickupNota||"Esta provincia tiene alícuota diferencial para pick-ups."}</div>}
          </div>
          <div style={{gridColumn:"1/-1"}}>
            <label style={{fontSize:11,fontWeight:600,color:"#4b5563",display:"block",marginBottom:5}}>Motorización</label>
            <div style={{display:"flex",gap:6}}>
              {[["combustion","⛽ Combustión"],["hibrido","⚡ Híbrido"],["electrico","🔋 Eléctrico"]].map(([val,lbl])=>(
                <button key={val} onClick={()=>{setMotor(val);setRes(null);}} style={{flex:1,padding:"8px 6px",border:`2px solid ${motor===val?"#0284c7":"#e5e7eb"}`,borderRadius:8,cursor:"pointer",fontSize:11,fontWeight:600,background:motor===val?"#f0f9ff":"#fafbfc",color:motor===val?"#0284c7":"#6b7280",transition:"all .15s",fontFamily:"inherit"}}>{lbl}</button>
              ))}
            </div>
          </div>
          <Inp label="Valor fiscal DNRPA ($)" type="number" placeholder="Ej: 24320000" value={valFiscal} onChange={e=>{setValFiscal(e.target.value);setRes(null);}}/>
          <Inp label="Año del vehículo" type="number" placeholder={String(new Date().getFullYear())} value={anio} onChange={e=>{setAnio(e.target.value);setRes(null);}} min="1980" max={String(new Date().getFullYear()+1)}/>
        </div>
        <Btn onClick={calcular} variant="primary" size="lg" style={{width:"100%",justifyContent:"center",opacity:(!prov||!valFiscal)?0.5:1}}>Calcular patente</Btn>
        {prov&&PATENTE_PROV[prov]&&<div style={{marginTop:10,padding:"8px 10px",background:"#f8fafc",border:"1px solid #e5e7eb",borderRadius:7,fontSize:10,color:"#6b7280",lineHeight:1.5}}><strong style={{color:"#374151"}}>Info {PATENTE_PROV[prov].nombre}:</strong> {PATENTE_PROV[prov].nota}</div>}
      </Card>
      {res?(
        <Card style={{background:res.exento?"#f0fdf4":"#fff"}}>
          <Sec>{res.exento?"Estado fiscal":"Resultado"}</Sec>
          {res.exento?(
            <div style={{textAlign:"center",padding:"28px 10px"}}>
              <div style={{fontSize:36,marginBottom:10}}>✅</div>
              <div style={{fontSize:15,fontWeight:700,color:"#16a34a",marginBottom:8}}>Exento de patente</div>
              <div style={{fontSize:12,color:"#4b5563",lineHeight:1.6,marginBottom:12}}>{res.razon}</div>
              {res.prov?.nota&&<div style={{padding:"8px 10px",background:"#dcfce7",border:"1px solid #86efac",borderRadius:7,fontSize:10,color:"#166534",lineHeight:1.5,textAlign:"left"}}>{res.prov.nota}</div>}
            </div>
          ):(
            <div>
              {res.notaEH&&<div style={{marginBottom:10,padding:"7px 10px",background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:7,fontSize:10,color:"#075985",lineHeight:1.4}}>{res.notaEH}</div>}
              {res.tipoUsado==="pickup-dif"&&<div style={{marginBottom:10,padding:"7px 10px",background:"#fefce8",border:"1px solid #fde047",borderRadius:7,fontSize:10,color:"#713f12",lineHeight:1.4}}>Se aplicó alícuota diferencial para pick-up</div>}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                <div style={{background:"#f0f9ff",borderRadius:10,padding:"14px 12px",textAlign:"center"}}>
                  <div style={{fontSize:9,color:"#6b7280",fontWeight:600,textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>Alícuota efectiva</div>
                  <div style={{fontSize:22,fontWeight:800,color:"#0284c7"}}>{res.aliEf.toFixed(2)}%</div>
                </div>
                <div style={{background:"#f0fdf4",borderRadius:10,padding:"14px 12px",textAlign:"center"}}>
                  <div style={{fontSize:9,color:"#6b7280",fontWeight:600,textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>Impuesto anual</div>
                  <div style={{fontSize:18,fontWeight:800,color:"#16a34a"}}>{fmt$(Math.round(res.anual))}</div>
                </div>
              </div>
              <div style={{background:"linear-gradient(135deg,#0284c7,#0ea5e9)",borderRadius:12,padding:"18px 16px",textAlign:"center",marginBottom:10}}>
                <div style={{fontSize:10,color:"rgba(255,255,255,.75)",fontWeight:600,textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>Cuota {res.prov.frec}</div>
                <div style={{fontSize:28,fontWeight:800,color:"#fff"}}>{fmt$(Math.round(res.cuota))}</div>
                <div style={{fontSize:10,color:"rgba(255,255,255,.65)",marginTop:3}}>{res.prov.cuotas} cuotas {res.prov.frec}es</div>
              </div>
              <div style={{fontSize:9,color:"#9ca3af",lineHeight:1.5}}>Base: valor fiscal DNRPA. Cifras orientativas — verificar con organismo recaudador provincial.</div>
            </div>
          )}
        </Card>
      ):(
        <Card style={{display:"flex",alignItems:"center",justifyContent:"center",background:"#f8fafc",border:"2px dashed #e5e7eb",minHeight:280}}>
          <div style={{textAlign:"center",color:"#9ca3af"}}>
            <div style={{fontSize:36,marginBottom:8}}>🧮</div>
            <div style={{fontSize:13,fontWeight:600}}>Completá los datos</div>
            <div style={{fontSize:11,marginTop:4}}>y calculá el impuesto automotor</div>
          </div>
        </Card>
      )}
    </div>
    <Card>
      <h3 style={{fontSize:13,fontWeight:700,color:"#111827",margin:"0 0 10px"}}>Referencia por provincia — Alícuotas 2025/2026</h3>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
        <thead><tr style={{borderBottom:"2px solid #e5e7eb"}}>{["Provincia","Alícuota auto","Pick-up","Eléctrico","Híbrido","Frecuencia"].map(h=><th key={h} style={{padding:"6px 8px",textAlign:"left",fontWeight:600,color:"#6b7280",fontSize:9,textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
        <tbody>{Object.entries(PATENTE_PROV).map(([k,p],i)=>{
          const ali=p.escalas.length===1?`${(p.escalas[0].ali*100).toFixed(1)}%`:`${(p.escalas[0].ali*100).toFixed(1)}%–${(p.escalas[p.escalas.length-1].ali*100).toFixed(1)}%`;
          const elec=p.elecExento?"Exento":p.elecExentoAnios?`${p.elecExentoAnios}a exento`:p.elecDesc?`−${p.elecDesc*100}%`:"—";
          const hib=p.hibridoExento?"Exento":p.hibridoExentoAnios?`${p.hibridoExentoAnios}a exento`:p.hibridoDesc?`−${p.hibridoDesc*100}%`:p.hibridoEsc?"Escal.":"—";
          const pu=p.pickupDif?`${(p.pickupAli*100).toFixed(1)}%`:"Igual";
          return<tr key={k} style={{borderBottom:"1px solid #f3f4f6",background:i%2===0?"#fff":"#fafafa",cursor:"pointer"}} onClick={()=>{setProv(k);setRes(null);window.scrollTo(0,0);}}>
            <td style={{padding:"5px 8px",fontWeight:600,color:"#111827"}}>{p.nombre}{p.municipal&&<span style={{marginLeft:4,fontSize:8,background:"#fef3c7",color:"#92400e",padding:"1px 4px",borderRadius:3,fontWeight:700}}>MUN</span>}</td>
            <td style={{padding:"5px 8px",color:"#374151",fontWeight:500}}>{ali}</td>
            <td style={{padding:"5px 8px"}}><span style={{color:p.pickupDif?"#16a34a":"#9ca3af",fontWeight:p.pickupDif?700:400}}>{pu}</span></td>
            <td style={{padding:"5px 8px"}}><span style={{fontSize:10,padding:"1px 5px",borderRadius:4,background:p.elecExento||p.elecExentoAnios?"#dcfce7":p.elecDesc?"#dbeafe":"#f3f4f6",color:p.elecExento||p.elecExentoAnios?"#166534":p.elecDesc?"#1d4ed8":"#9ca3af",fontWeight:p.elecExento||p.elecExentoAnios||p.elecDesc?600:400}}>{elec}</span></td>
            <td style={{padding:"5px 8px"}}><span style={{fontSize:10,padding:"1px 5px",borderRadius:4,background:p.hibridoExento||p.hibridoExentoAnios||p.hibridoEsc?"#dcfce7":p.hibridoDesc?"#dbeafe":"#f3f4f6",color:p.hibridoExento||p.hibridoExentoAnios||p.hibridoEsc?"#166534":p.hibridoDesc?"#1d4ed8":"#9ca3af",fontWeight:p.hibridoExento||p.hibridoExentoAnios||p.hibridoDesc||p.hibridoEsc?600:400}}>{hib}</span></td>
            <td style={{padding:"5px 8px",color:"#6b7280",fontSize:10}}>{p.cuotas}× {p.frec}</td>
          </tr>;
        })}</tbody>
      </table></div>
      <div style={{marginTop:10,padding:"7px 10px",background:"#fffbeb",border:"1px solid #fde68a",borderRadius:6,fontSize:10,color:"#78350f",lineHeight:1.5}}>
        ⚠️ <strong>Importante:</strong> Los valores en $ ARS cambian anualmente. Las alícuotas (%) son el dato más estable. El valor fiscal DNRPA difiere del valor de mercado. Hacé clic en cualquier fila para seleccionar esa provincia en la calculadora.
      </div>
    </Card>
  </div>);
}

/* ═══════ COTIZADOR DE AUTOS USADOS ═══════ */
function CotizadorPage(){
  const anioActual=new Date().getFullYear();
  const [paso,setPaso]=useState(1);
  const [patente,setPatente]=useState("");
  const [patenteOk,setPatenteOk]=useState(false);
  const [marca,setMarca]=useState("");
  const [modelo,setModelo]=useState("");
  const [anio,setAnio]=useState("");
  const [version,setVersion]=useState("");
  const [precioMercado,setPrecioMercado]=useState("");
  const [resultado,setResultado]=useState(null);
  const [errPat,setErrPat]=useState("");
  const [mlLoading,setMlLoading]=useState(false);
  const [mlRef,setMlRef]=useState(null);
  const [mlError,setMlError]=useState("");

  const aniosOpt=Array.from({length:anioActual-1980+1},(_,i)=>String(anioActual-i));

  const buscarPatente=()=>{
    const p=patente.trim().toUpperCase();
    if(/^[A-Z]{3}\d{3}$/.test(p)||/^[A-Z]{2}\d{3}[A-Z]{2}$/.test(p)){setPatenteOk(true);setErrPat("");}
    else setErrPat("Formato inválido. Ej: ABC123 o AB123CD");
  };

  const siguientePaso=()=>{if(marca&&modelo&&anio)setPaso(2);};

  const buscarEnML=async()=>{
    setMlLoading(true);setMlError("");setMlRef(null);
    try{
      const params=new URLSearchParams({marca,modelo,anio});
      const res=await fetch(`/api/cotizar?${params}`);
      const data=await res.json();
      if(!res.ok||data.error)throw new Error(data.error||"Error al consultar ML");
      if(!data.found){setMlError("No se encontraron publicaciones para este vehículo en ML.");return;}
      setMlRef(data);
      setPrecioMercado(String(data.mediana));
    }catch(e){setMlError(e.message);}
    finally{setMlLoading(false);}
  };

  const calcular=()=>{
    const base=+(precioMercado.replace(/\./g,"").replace(",","."))||0;
    if(!base)return;
    setResultado({mercado:base,min:Math.round(base*0.75),max:Math.round(base*0.90)});
    setPaso(3);
  };

  const reiniciar=()=>{setPaso(1);setResultado(null);setPrecioMercado("");setPatenteOk(false);setErrPat("");setMlRef(null);setMlError("");};

  const StepCircle=({n,done})=>(
    <div style={{width:28,height:28,borderRadius:"50%",background:done?"#16a34a":n===paso?"#dc2626":"#e5e7eb",color:"#fff",fontSize:13,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .2s"}}>
      {done?"✓":n}
    </div>
  );
  const Conector=()=><div style={{borderLeft:"2px solid #e5e7eb",marginLeft:13,height:14,marginBottom:4}}/>;

  return(<div style={{maxWidth:540}}>
    <h1 style={{fontSize:24,fontWeight:800,color:"#111827",margin:"0 0 6px",letterSpacing:-.5}}>Cotizador de Autos Usados</h1>
    <p style={{fontSize:13,color:"#6b7280",margin:"0 0 22px"}}>Calculá el rango de oferta para comprar un auto usado: entre un 10% y 25% por debajo del precio de mercado.</p>
    <Card>

      {/* ── PASO 1: datos del vehículo ── */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:paso===1?14:8}}>
        <StepCircle n={1} done={paso>1}/>
        <span style={{fontWeight:700,fontSize:14,color:paso===1?"#111827":"#6b7280"}}>Datos del vehículo</span>
      </div>

      {paso===1&&<div style={{display:"flex",flexDirection:"column",gap:12,paddingLeft:38}}>
        <div>
          <label style={{fontSize:11,fontWeight:600,color:"#4b5563",display:"block",marginBottom:3}}>Patente (opcional)</label>
          <div style={{display:"flex",gap:6}}>
            <input placeholder="Ej: AB123CD" value={patente} onChange={e=>{setPatente(e.target.value.toUpperCase());setPatenteOk(false);setErrPat("");}} onKeyDown={e=>e.key==="Enter"&&buscarPatente()} style={{flex:1,padding:"8px 11px",border:`1px solid ${patenteOk?"#16a34a":"#e5e7eb"}`,borderRadius:8,fontSize:13,background:"#fafbfc",color:"#1f2937",outline:"none",textTransform:"uppercase"}}/>
            <button onClick={buscarPatente} style={{padding:"8px 16px",background:"#dc2626",color:"#fff",border:"none",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",fontFamily:"inherit"}}>BUSCAR</button>
          </div>
          {patenteOk&&<p style={{fontSize:11,color:"#16a34a",margin:"4px 0 0",fontWeight:600}}>✓ Patente válida</p>}
          {errPat&&<p style={{fontSize:11,color:"#dc2626",margin:"4px 0 0"}}>{errPat}</p>}
        </div>
        <div style={{borderTop:"1px solid #f3f4f6",paddingTop:10}}>
          <Sel label="Marca" value={marca} onChange={e=>setMarca(e.target.value)} options={[{value:"",label:"Seleccioná la marca..."},...DEF_MARCAS.map(m=>({value:m,label:m}))]}/>
        </div>
        <Inp label="Modelo" placeholder="Ej: Corolla, Palio, Sandero..." value={modelo} onChange={e=>setModelo(e.target.value)}/>
        <Sel label="Año" value={anio} onChange={e=>setAnio(e.target.value)} options={[{value:"",label:"Seleccioná el año..."},...aniosOpt]}/>
        <Inp label="Versión (opcional)" placeholder="Ej: 1.6 XEi, Highline..." value={version} onChange={e=>setVersion(e.target.value)}/>
        <button onClick={siguientePaso} disabled={!marca||!modelo||!anio} style={{marginTop:4,padding:"11px 0",background:(!marca||!modelo||!anio)?"#e5e7eb":"#0284c7",color:(!marca||!modelo||!anio)?"#9ca3af":"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:(!marca||!modelo||!anio)?"not-allowed":"pointer",fontFamily:"inherit"}}>
          Siguiente →
        </button>
      </div>}

      {paso>1&&<div style={{paddingLeft:38,fontSize:13,color:"#6b7280",paddingBottom:6}}>
        <strong style={{color:"#111827"}}>{marca} {modelo} {anio}</strong>{version&&` · ${version}`}{patente&&<span style={{color:"#9ca3af"}}> · {patente}</span>}
        {paso<3&&<button onClick={()=>setPaso(1)} style={{marginLeft:10,background:"none",border:"none",color:"#0284c7",cursor:"pointer",fontSize:11,fontWeight:600,padding:0,fontFamily:"inherit"}}>Editar</button>}
      </div>}

      {paso>=2&&<Conector/>}

      {/* ── PASO 2: precio de mercado ── */}
      {paso>=2&&<div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:paso===2?14:8}}>
          <StepCircle n={2} done={paso>2}/>
          <span style={{fontWeight:700,fontSize:14,color:paso===2?"#111827":"#6b7280"}}>Precio de mercado</span>
        </div>

        {paso===2&&<div style={{display:"flex",flexDirection:"column",gap:12,paddingLeft:38}}>

          {/* Botón consultar ML */}
          <button onClick={buscarEnML} disabled={mlLoading} style={{padding:"10px 0",background:mlLoading?"#e5e7eb":"#f97316",color:mlLoading?"#9ca3af":"#fff",border:"none",borderRadius:10,fontSize:13,fontWeight:700,cursor:mlLoading?"not-allowed":"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            {mlLoading?"Consultando MercadoLibre...":"🔍 Consultar precio en MercadoLibre"}
          </button>

          {/* Resultado de ML */}
          {mlRef&&<div style={{padding:"10px 12px",background:"#fff7ed",border:"1px solid #fed7aa",borderRadius:8,fontSize:12,color:"#9a3412",lineHeight:1.8}}>
            <div style={{fontWeight:700,marginBottom:4,fontSize:13,color:"#7c2d12"}}>Referencia ML — {mlRef.count} publicaciones</div>
            <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
              <span><strong>Mediana:</strong> {fmt$(mlRef.mediana)}</span>
              <span><strong>Mínimo:</strong> {fmt$(mlRef.min)}</span>
              <span><strong>Máximo:</strong> {fmt$(mlRef.max)}</span>
            </div>
            {mlRef.muestra?.length>0&&<div style={{marginTop:8,borderTop:"1px solid #fed7aa",paddingTop:8,display:"flex",flexDirection:"column",gap:4}}>
              {mlRef.muestra.map((p,i)=>(
                <a key={i} href={p.link} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:"#c2410c",display:"flex",justifyContent:"space-between",textDecoration:"none",gap:8}}>
                  <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{p.titulo}</span>
                  <strong style={{flexShrink:0}}>{fmt$(p.precio)}</strong>
                </a>
              ))}
            </div>}
            <div style={{marginTop:6,fontSize:10,color:"#b45309"}}>Precio pre-cargado con la mediana. Podés ajustarlo manualmente.</div>
          </div>}

          {mlError&&<div style={{padding:"8px 12px",background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,fontSize:12,color:"#dc2626"}}>{mlError}</div>}

          <div style={{display:"flex",flexDirection:"column",gap:3}}>
            <label style={{fontSize:11,fontWeight:600,color:"#4b5563"}}>Precio de mercado ($) — editable</label>
            <input
              type="number"
              placeholder="Ej: 18000000"
              value={precioMercado}
              onChange={e=>setPrecioMercado(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&calcular()}
              style={{padding:"10px 12px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:15,background:"#fafbfc",color:"#1f2937",outline:"none",fontWeight:600}}
              onFocus={e=>e.target.style.borderColor="#0ea5e9"}
              onBlur={e=>e.target.style.borderColor="#e5e7eb"}
            />
          </div>
          <button onClick={calcular} disabled={!precioMercado} style={{padding:"11px 0",background:!precioMercado?"#e5e7eb":"#0284c7",color:!precioMercado?"#9ca3af":"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:!precioMercado?"not-allowed":"pointer",fontFamily:"inherit"}}>
            Calcular rango de oferta
          </button>
        </div>}

        {paso>2&&<div style={{paddingLeft:38,fontSize:13,color:"#6b7280",paddingBottom:6}}>
          Precio de mercado: <strong style={{color:"#111827"}}>{fmt$(resultado?.mercado)}</strong>
        </div>}
      </div>}

      {paso>=3&&<Conector/>}

      {/* ── PASO 3: resultado ── */}
      {paso>=3&&resultado&&<div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
          <StepCircle n={3} done={false}/>
          <span style={{fontWeight:700,fontSize:14,color:"#111827"}}>Precio de referencia</span>
        </div>
        <div style={{paddingLeft:38}}>
          <div style={{textAlign:"center",padding:"18px 0 14px"}}>
            <div style={{fontSize:12,color:"#6b7280",marginBottom:4}}>Valor del vehículo (*)</div>
            <div style={{fontSize:13,color:"#0284c7",fontWeight:700,marginBottom:16}}>Entre</div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:24,flexWrap:"wrap"}}>
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:10,color:"#6b7280",fontWeight:700,letterSpacing:1,marginBottom:2}}>ARS</div>
                <div style={{fontSize:32,fontWeight:900,color:"#111827",letterSpacing:-1,lineHeight:1}}>{resultado.min.toLocaleString("es-AR")}</div>
              </div>
              <div style={{fontSize:22,color:"#9ca3af",fontWeight:300}}>y</div>
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:10,color:"#6b7280",fontWeight:700,letterSpacing:1,marginBottom:2}}>ARS</div>
                <div style={{fontSize:32,fontWeight:900,color:"#111827",letterSpacing:-1,lineHeight:1}}>{resultado.max.toLocaleString("es-AR")}</div>
              </div>
            </div>
            <div style={{marginTop:14,display:"flex",justifyContent:"center",gap:10,flexWrap:"wrap"}}>
              <div style={{padding:"5px 12px",background:"#f0fdf4",borderRadius:20,fontSize:11,color:"#16a34a",fontWeight:600}}>−25% → {fmt$(resultado.min)}</div>
              <div style={{padding:"5px 12px",background:"#f0f9ff",borderRadius:20,fontSize:11,color:"#0284c7",fontWeight:600}}>−10% → {fmt$(resultado.max)}</div>
            </div>
          </div>
          <div style={{marginTop:8,padding:"8px 12px",background:"#fefce8",border:"1px solid #fde68a",borderRadius:8,fontSize:11,color:"#92400e",lineHeight:1.6}}>
            (*) Precio estimativo. El rango representa entre un 10% y un 25% por debajo del precio de mercado ingresado. Sujeto a inspección, verificación de documentación y estado real del vehículo.
          </div>
          <button onClick={reiniciar} style={{marginTop:14,width:"100%",padding:"10px 0",background:"#f3f4f6",color:"#374151",border:"none",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Nueva cotización</button>
        </div>
      </div>}

    </Card>
  </div>);
}

/* ═══════ SIMULADOR DE FINANCIACIÓN ═══════ */
function SimuladorPage(){
  const anioActual=new Date().getFullYear();
  const aniosOpt=Array.from({length:anioActual-1990+1},(_,i)=>String(anioActual-i));

  const [vMarca,setVMarca]=useState("");const [vModelo,setVModelo]=useState("");const [vAnio,setVAnio]=useState("");const [vVersion,setVVersion]=useState("");
  const [precio,setPrecio]=useState("");const [anticipo,setAnticipo]=useState("");
  const [ncuotas,setNcuotas]=useState("24");const [tna,setTna]=useState("");
  const [quebranto,setQuebranto]=useState("");const [conPrenda,setConPrenda]=useState(false);

  const pn=v=>+(v||"").replace(/\./g,"").replace(",",".")||0;
  const precioN=pn(precio);const anticipoN=pn(anticipo);const quebrantoN=pn(quebranto);
  const tnaNum=+(tna||"").replace(",",".")||0;const n=+ncuotas;

  const prendaAmt=conPrenda?Math.round(precioN*0.03):0;
  const capital=Math.max(0,precioN-anticipoN+prendaAmt);
  const tem=tnaNum/100/12;

  // Capital neto recibido por el cliente (precio - anticipo, sin costos adicionales)
  const netCapital=Math.max(0,precioN-anticipoN);
  let cuotaBase=0,cuotaTotal=0,totalAPagar=0,interesTotal=0,cftna=tnaNum;
  const canShow=capital>0&&n>0&&tnaNum>0;
  if(canShow){
    cuotaBase=Math.round(tem===0?capital/n:capital*tem/(1-Math.pow(1+tem,-n)));
    cuotaTotal=Math.round(cuotaBase+quebrantoN);
    totalAPagar=Math.round(cuotaTotal*n+anticipoN);
    interesTotal=Math.round(cuotaTotal*n-capital);
    // CFTNA via bisección IRR:
    // Base = netCapital (lo que el cliente realmente recibe, sin prenda ni quebranto)
    // Flujo de pago = cuotaTotal (incluye prenda amortizada + quebranto)
    // Así prenda y quebranto siempre suben el CFTNA por encima de la TNA
    if(netCapital>0){
      let lo=0.0001,hi=2,mid=tem;
      for(let i=0;i<200;i++){mid=(lo+hi)/2;const pv=cuotaTotal*(1-Math.pow(1+mid,-n))/mid;if(pv>netCapital)lo=mid;else hi=mid;}
      cftna=mid*12*100;
    }
  }

  const descargarPDF=()=>{
    if(!canShow)return;
    const conc=(hasAPI&&localStorage.getItem('checkcar_tenant'))?JSON.parse(localStorage.getItem('checkcar_tenant')).nombre:"CheckCar";
    const veh=[vMarca,vModelo,vAnio,vVersion].filter(Boolean).join(" ")||"—";
    const fecha=new Date().toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit",year:"numeric"});
    const row=(l,v,cls="")=>`<tr class="${cls}"><td class="lbl">${l}</td><td class="val">${v}</td></tr>`;
    const html=`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Simulación — ${conc}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;padding:32px;color:#1a1a1a;font-size:13px}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0284c7;padding-bottom:14px;margin-bottom:22px}
.logo{font-size:22px;font-weight:900;color:#0284c7;letter-spacing:-.5px}.sub{font-size:10px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-top:2px}
.fecha{font-size:11px;color:#9ca3af;text-align:right}h2{font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid #e5e7eb;padding-bottom:5px;margin:18px 0 8px}
table{width:100%;border-collapse:collapse;margin-bottom:6px}td{padding:6px 10px;font-size:12px}tr:nth-child(even) td{background:#f9fafb}
.lbl{color:#6b7280;width:58%}.val{color:#111827;font-weight:700;text-align:right}
.cuota td{background:#f0f9ff!important;font-size:15px;color:#0284c7!important}
.total td{background:#111827!important;color:#fff!important;font-weight:700;font-size:14px}
.nota{margin-top:24px;padding:10px 14px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af;line-height:1.6}
@media print{body{padding:16px}}</style></head><body>
<div class="hdr"><div><div class="logo">${conc}</div><div class="sub">Simulación de Financiación</div></div><div class="fecha">Fecha: ${fecha}</div></div>
<h2>Vehículo</h2><table>${row("Vehículo",veh)}${row("Precio de venta",fmt$(precioN))}</table>
<h2>Condiciones</h2><table>
${row("Anticipo",fmt$(anticipoN))}${row("Capital a financiar",fmt$(capital))}
${conPrenda?row("Costo de prenda (3%)",fmt$(prendaAmt)):""}
${quebrantoN?row("Quebranto / Gastos adm.",fmt$(quebrantoN)+" / cuota"):""}
${row("TNA",tnaNum.toFixed(2)+"%")}${row("CFTNA",cftna.toFixed(2)+"%")}
${row("Plazo",n+" cuotas mensuales")}</table>
<h2>Resultado</h2><table>
<tr class="cuota"><td class="lbl" style="font-weight:700">Valor de cada cuota</td><td class="val" style="font-size:18px">${fmt$(cuotaTotal)}</td></tr>
${row("Total de intereses",fmt$(interesTotal))}${row("Total en cuotas",fmt$(cuotaTotal*n))}
<tr class="total"><td class="lbl">Total a pagar (anticipo + cuotas)</td><td class="val">${fmt$(totalAPagar)}</td></tr></table>
<div class="nota">(*) Simulación de carácter informativo. No constituye oferta formal de crédito. Valores sujetos a condiciones de mercado, perfil crediticio y normativa BCRA vigente.</div>
</body></html>`;
    const win=window.open("","_blank","width=820,height=720");win.document.write(html);win.document.close();setTimeout(()=>win.print(),400);
  };

  const Row=({label,value,sub,yellow,dark})=>(
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",background:yellow?"#fefce8":dark?"#111827":"#f9fafb",borderRadius:7,border:yellow?"1px solid #fde68a":"none"}}>
      <div><div style={{fontSize:11,color:dark?"#d1d5db":"#6b7280",fontWeight:600}}>{label}</div>{sub&&<div style={{fontSize:10,color:"#9ca3af"}}>{sub}</div>}</div>
      <span style={{fontSize:13,fontWeight:700,color:yellow?"#92400e":dark?"#fff":"#111827"}}>{value}</span>
    </div>
  );

  return(<div>
    <h1 style={{fontSize:24,fontWeight:800,color:"#111827",margin:"0 0 6px",letterSpacing:-.5}}>Simulador de Financiación</h1>
    <p style={{fontSize:13,color:"#6b7280",margin:"0 0 22px"}}>Simulá las condiciones de financiación y generá el resumen en PDF para el cliente.</p>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,maxWidth:920}}>

      {/* Columna izquierda — inputs */}
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        <Card>
          <Sec>Datos del vehículo (para el PDF)</Sec>
          <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:8}}>
            <Sel label="Marca" value={vMarca} onChange={e=>setVMarca(e.target.value)} options={[{value:"",label:"Marca..."},...DEF_MARCAS.map(m=>({value:m,label:m}))]}/>
            <Inp label="Modelo" placeholder="Ej: Corolla, Palio..." value={vModelo} onChange={e=>setVModelo(e.target.value)}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <Sel label="Año" value={vAnio} onChange={e=>setVAnio(e.target.value)} options={[{value:"",label:"Año..."},...aniosOpt]}/>
              <Inp label="Versión" placeholder="Opcional" value={vVersion} onChange={e=>setVVersion(e.target.value)}/>
            </div>
          </div>
        </Card>
        <Card>
          <Sec>Condiciones de financiación</Sec>
          <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:8}}>
            <Inp label="Precio total del vehículo ($)" type="number" placeholder="Ej: 20000000" value={precio} onChange={e=>setPrecio(e.target.value)}/>
            <Inp label="Anticipo ($)" type="number" placeholder="Ej: 5000000" value={anticipo} onChange={e=>setAnticipo(e.target.value)}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <Sel label="Cantidad de cuotas" value={ncuotas} onChange={e=>setNcuotas(e.target.value)} options={[6,12,18,24,30,36,48,60,72].map(v=>({value:String(v),label:`${v} cuotas`}))}/>
              <Inp label="TNA (%)" type="number" placeholder="Ej: 65" value={tna} onChange={e=>setTna(e.target.value)}/>
            </div>
            <Inp label="Quebranto / Gastos adm. ($ por cuota)" type="number" placeholder="Opcional. Ej: 15000" value={quebranto} onChange={e=>setQuebranto(e.target.value)}/>
            <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:"#f8fafc",borderRadius:8,border:"1px solid #e5e7eb",cursor:"pointer",userSelect:"none"}} onClick={()=>setConPrenda(!conPrenda)}>
              <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${conPrenda?"#0284c7":"#d1d5db"}`,background:conPrenda?"#0284c7":"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .15s"}}>
                {conPrenda&&<span style={{color:"#fff",fontSize:11,fontWeight:900,lineHeight:1}}>✓</span>}
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:600,color:"#374151"}}>Incluir prenda sobre el vehículo</div>
                <div style={{fontSize:11,color:"#9ca3af"}}>Suma el 3% del precio del auto al capital</div>
              </div>
              {conPrenda&&precioN>0&&<span style={{fontSize:12,color:"#0284c7",fontWeight:700}}>{fmt$(prendaAmt)}</span>}
            </div>
          </div>
        </Card>
      </div>

      {/* Columna derecha — resultado */}
      <div>
        <Card style={{position:"sticky",top:24}}>
          <Sec>Resultado de la simulación</Sec>
          {!canShow
            ?<div style={{textAlign:"center",padding:"48px 0",color:"#9ca3af",fontSize:13}}>Completá precio, TNA y cuotas para ver el resultado</div>
            :<div style={{marginTop:10}}>
              <div style={{textAlign:"center",padding:"18px 0 14px",background:"linear-gradient(135deg,#f0f9ff,#e0f2fe)",borderRadius:12,marginBottom:14}}>
                <div style={{fontSize:10,color:"#6b7280",fontWeight:700,letterSpacing:.8,textTransform:"uppercase",marginBottom:6}}>Cuota mensual</div>
                <div style={{fontSize:40,fontWeight:900,color:"#0284c7",letterSpacing:-1.5,lineHeight:1}}>{fmt$(cuotaTotal)}</div>
                <div style={{fontSize:11,color:"#9ca3af",marginTop:5}}>{n} cuota{n!==1?"s":""} · TNA {tnaNum.toFixed(2)}%</div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                <Row label="Capital a financiar" value={fmt$(capital)} sub={conPrenda?`Incluye prenda ${fmt$(prendaAmt)}`:null}/>
                <Row label="TNA" value={`${tnaNum.toFixed(2)}%`}/>
                <Row label="CFTNA" value={`${cftna.toFixed(2)}%`} yellow/>
                {quebrantoN>0&&<Row label="Quebranto incluido" value={`${fmt$(quebrantoN)} / cuota`}/>}
                <Row label="Total de intereses" value={fmt$(interesTotal)}/>
                <Row label="Total en cuotas" value={fmt$(cuotaTotal*n)}/>
                <Row label="Anticipo" value={fmt$(anticipoN)}/>
                <Row label="Total a pagar" value={fmt$(totalAPagar)} dark/>
              </div>
              <button onClick={descargarPDF} style={{marginTop:16,width:"100%",padding:"12px 0",background:"#dc2626",color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,fontFamily:"inherit"}}>
                <Ic.Download/> Descargar PDF para el cliente
              </button>
              <p style={{fontSize:10,color:"#9ca3af",textAlign:"center",marginTop:8,lineHeight:1.5}}>CFTNA calculado por método IRR según normativa BCRA. El quebranto se computa como cargo mensual en el flujo de pagos.</p>
            </div>
          }
        </Card>
      </div>
    </div>
  </div>);
}

/* ═══════ CALCULADORA DE TRANSFERENCIA ═══════ */
// Fuentes: DNRPA, La Nación 19/09/2024, elcerokm.com — tasas vigentes 2026
const PROVINCIAS_TRANSFERENCIA=[
  {name:"Buenos Aires (Prov.)",sellos:3.0},
  {name:"CABA",sellos:3.0},
  {name:"Santa Cruz",sellos:3.0},
  {name:"Chubut",sellos:2.0},
  {name:"Río Negro",sellos:2.0},
  {name:"Jujuy",sellos:2.0},
  {name:"Salta",sellos:2.0},
  {name:"Misiones",sellos:2.0},
  {name:"Chaco",sellos:1.8},
  {name:"Córdoba",sellos:1.5},
  {name:"Mendoza",sellos:1.5},
  {name:"Neuquén",sellos:1.5},
  {name:"La Pampa",sellos:1.5},
  {name:"Entre Ríos",sellos:1.2},
  {name:"Santa Fe",sellos:1.2},
  {name:"Tucumán",sellos:1.0},
  {name:"Catamarca",sellos:1.0},
  {name:"Corrientes",sellos:1.0},
  {name:"Santiago del Estero",sellos:1.0},
  {name:"Tierra del Fuego",sellos:1.0},
  {name:"La Rioja",sellos:0.7},
  {name:"Formosa",sellos:0.7},
  {name:"San Juan",sellos:0.5},
  {name:"San Luis",sellos:0.5},
];

// Gastos fijos DNRPA 2026
const GASTOS_FIJOS=[
  {label:"Formulario 08",monto:6120},
  {label:"Formulario 13",monto:4068},
  {label:"Alta impositiva",monto:3490},
  {label:"Libre deuda",monto:3390},
];
const TOTAL_FIJOS=GASTOS_FIJOS.reduce((s,g)=>s+g.monto,0); // $17.068

function TransferenciaPage(){
  const [valor,setValor]=useState("");
  const [provincia,setProvincia]=useState("");
  const [origen,setOrigen]=useState("nacional");
  const [calculado,setCalculado]=useState(false);

  const base=+(valor)||0;
  const prov=PROVINCIAS_TRANSFERENCIA.find(p=>p.name===provincia);

  const arancelDNRPA=base>0?Math.round(base*0.01):0;
  const impSellos=base>0&&prov?Math.round(base*prov.sellos/100):0;
  const honorariosRegistro=base>0?Math.round(base*0.016):0;
  const arancelesProvinciales=impSellos+honorariosRegistro;
  const total=arancelDNRPA+TOTAL_FIJOS+arancelesProvinciales;

  const calcular=()=>{if(base>0&&provincia)setCalculado(true);};
  const limpiar=()=>{setValor("");setProvincia("");setOrigen("nacional");setCalculado(false);};

  const FilaDetalle=({label,sub,monto,highlight})=>(
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:highlight?"#f0f9ff":"#f9fafb",borderRadius:8,border:highlight?"1px solid #bae6fd":"none"}}>
      <div>
        <div style={{fontSize:13,fontWeight:600,color:"#374151"}}>{label}</div>
        {sub&&<div style={{fontSize:11,color:"#9ca3af"}}>{sub}</div>}
      </div>
      <span style={{fontSize:14,fontWeight:700,color:highlight?"#0284c7":"#111827"}}>{fmt$(monto)}</span>
    </div>
  );

  return(<div style={{maxWidth:680}}>
    <h1 style={{fontSize:24,fontWeight:800,color:"#111827",margin:"0 0 6px",letterSpacing:-.5}}>Calculadora de Transferencia</h1>
    <p style={{fontSize:13,color:"#6b7280",margin:"0 0 22px"}}>Estimá el costo total de la transferencia de un vehículo usado en Argentina. Tasas DNRPA vigentes 2026.</p>

    <Card style={{marginBottom:16}}>
      <Sec>Datos del vehículo</Sec>
      <div style={{display:"flex",flexDirection:"column",gap:12,marginTop:10}}>
        <div>
          <label style={{fontSize:11,fontWeight:600,color:"#4b5563",display:"block",marginBottom:3}}>Valor del vehículo ($)</label>
          <input
            type="number"
            placeholder="Ingresá el valor según DNRPA / tabla de valuación"
            value={valor}
            onChange={e=>{setValor(e.target.value);setCalculado(false);}}
            style={{width:"100%",padding:"10px 12px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:14,background:"#fafbfc",color:"#1f2937",outline:"none",boxSizing:"border-box",fontWeight:600}}
            onFocus={e=>e.target.style.borderColor="#0ea5e9"}
            onBlur={e=>e.target.style.borderColor="#e5e7eb"}
          />
          <span style={{fontSize:10,color:"#9ca3af",marginTop:3,display:"block"}}>Consultá la valuación actualizada en dnrpa.gov.ar</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Sel label="Provincia de radicación" value={provincia} onChange={e=>{setProvincia(e.target.value);setCalculado(false);}} options={[{value:"",label:"Seleccioná la provincia..."},...PROVINCIAS_TRANSFERENCIA.map(p=>({value:p.name,label:`${p.name} (${p.sellos}%)`}))]}/>
          <Sel label="Origen del vehículo" value={origen} onChange={e=>setOrigen(e.target.value)} options={[{value:"nacional",label:"Nacional"},{value:"importado",label:"Importado"}]}/>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={calcular} disabled={!base||!provincia} style={{flex:1,padding:"11px 0",background:(!base||!provincia)?"#e5e7eb":"#0284c7",color:(!base||!provincia)?"#9ca3af":"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:(!base||!provincia)?"not-allowed":"pointer",fontFamily:"inherit",transition:"all .15s"}}>
            Calcular
          </button>
          {calculado&&<button onClick={limpiar} style={{padding:"11px 18px",background:"#f3f4f6",color:"#374151",border:"none",borderRadius:10,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Limpiar</button>}
        </div>
      </div>
    </Card>

    {calculado&&base>0&&prov&&<Card>
      <Sec>Detalle de costos — {prov.name}</Sec>
      <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:10}}>

        {/* Arancel DNRPA */}
        <div style={{fontSize:11,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",letterSpacing:.5,padding:"4px 4px 2px"}}>Arancel Nacional DNRPA</div>
        <FilaDetalle label="Arancel de transferencia (1%)" sub={`1% sobre ${fmt$(base)}`} monto={arancelDNRPA} highlight/>

        {/* Gastos fijos */}
        <div style={{fontSize:11,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",letterSpacing:.5,padding:"12px 4px 2px"}}>Gastos administrativos fijos</div>
        {GASTOS_FIJOS.map(g=><FilaDetalle key={g.label} label={g.label} monto={g.monto}/>)}
        <div style={{display:"flex",justifyContent:"space-between",padding:"6px 14px",fontSize:12,color:"#6b7280"}}>
          <span>Subtotal gastos fijos</span>
          <span style={{fontWeight:600}}>{fmt$(TOTAL_FIJOS)}</span>
        </div>

        {/* Impuesto de sellos + honorarios */}
        <div style={{fontSize:11,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",letterSpacing:.5,padding:"12px 4px 2px"}}>Aranceles provinciales — {prov.name}</div>
        <FilaDetalle label={`Impuesto de sellos`} sub={`${prov.sellos}% sobre ${fmt$(base)}`} monto={impSellos}/>
        <FilaDetalle label="Honorarios del registro automotor" sub={`1.6% sobre ${fmt$(base)}`} monto={honorariosRegistro}/>
        <div style={{display:"flex",justifyContent:"space-between",padding:"6px 14px",fontSize:12,color:"#6b7280"}}>
          <span>Subtotal aranceles provinciales</span>
          <span style={{fontWeight:600}}>{fmt$(arancelesProvinciales)}</span>
        </div>

        {/* Separador y total */}
        <div style={{borderTop:"2px solid #111827",marginTop:8,paddingTop:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:"#111827",borderRadius:10}}>
            <div>
              <div style={{fontSize:13,color:"#d1d5db",fontWeight:600}}>Total estimado</div>
              <div style={{fontSize:11,color:"#6b7280",marginTop:1}}>Vehículo {origen} · {prov.name} · {prov.sellos}% sellos + 1.6% honorarios</div>
            </div>
            <span style={{fontSize:22,fontWeight:900,color:"#fff",letterSpacing:-.5}}>{fmt$(total)}</span>
          </div>
        </div>

        <div style={{marginTop:8,padding:"8px 12px",background:"#fefce8",border:"1px solid #fde68a",borderRadius:8,fontSize:11,color:"#92400e",lineHeight:1.6}}>
          ⚠ Estimación basada en aranceles DNRPA 2026. Incluye honorarios del registro automotor (1.6%). No incluye honorarios de gestor particular ni verificación policial. Los valores pueden variar según el registro automotor y cambios de normativa.
        </div>
      </div>

      {/* Tabla comparativa de sellos */}
      <div style={{marginTop:20}}>
        <div style={{fontSize:12,fontWeight:700,color:"#374151",marginBottom:8}}>Impuesto de sellos por provincia (referencia)</div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
            <thead><tr style={{background:"#f8fafc"}}>
              <th style={{padding:"6px 10px",textAlign:"left",fontWeight:700,color:"#374151",borderBottom:"2px solid #e5e7eb"}}>Provincia</th>
              <th style={{padding:"6px 10px",textAlign:"center",fontWeight:700,color:"#374151",borderBottom:"2px solid #e5e7eb"}}>Sellos</th>
              <th style={{padding:"6px 10px",textAlign:"right",fontWeight:700,color:"#374151",borderBottom:"2px solid #e5e7eb"}}>Aranceles prov. (sellos+honorarios)</th>
            </tr></thead>
            <tbody>{PROVINCIAS_TRANSFERENCIA.map((p,i)=>(
              <tr key={p.name} style={{background:p.name===provincia?"#f0f9ff":i%2===0?"#fff":"#f9fafb",borderBottom:"1px solid #f3f4f6"}}>
                <td style={{padding:"5px 10px",fontWeight:p.name===provincia?700:400,color:p.name===provincia?"#0284c7":"#374151"}}>{p.name}{p.name===provincia&&" ✓"}</td>
                <td style={{padding:"5px 10px",textAlign:"center",fontWeight:600,color:p.sellos>=2.5?"#dc2626":p.sellos>=1.5?"#d97706":p.sellos>=1?"#374151":"#16a34a"}}>{p.sellos}%</td>
                <td style={{padding:"5px 10px",textAlign:"right",color:"#6b7280"}}>{fmt$(Math.round(base*p.sellos/100)+Math.round(base*0.016))}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </Card>}
  </div>);
}

/* ═══════ MAIN APP ═══════ */
export default function App(){
  const [data,setDR]=useState(INIT);const [page,setPage]=useState("dashboard");const [loaded,setLoaded]=useState(false);const [user,setUser]=useState(null);
  useEffect(()=>{(async()=>{
    // Try to restore API session
    if(hasAPI){const t=localStorage.getItem('checkcar_token');const u=localStorage.getItem('checkcar_user');if(t&&u){try{const d=await apiRequest('/auth/me');setUser({name:d.user.nombre,role:d.user.rol,username:d.user.email});}catch{localStorage.removeItem('checkcar_token');localStorage.removeItem('checkcar_user');}}setLoaded(true);return;}
    // Local storage fallback
    const s=await loadS();if(s){if(!s.activityLog)s.activityLog=[];if(!s.customMarcas)s.customMarcas=[];setDR(s);}setLoaded(true);})();},[]);
  const setData=useCallback(nd=>{setDR(nd);saveS(nd);},[]);
  const allMarcas=useMemo(()=>[...new Set([...DEF_MARCAS,...(data.customMarcas||[])])].sort(),[data.customMarcas]);
  const addMarca=useCallback(m=>{if(!m||allMarcas.includes(m))return;setData({...data,customMarcas:[...(data.customMarcas||[]),m]});},[data,allMarcas,setData]);
  const handleLogout=()=>{if(hasAPI){localStorage.removeItem('checkcar_token');localStorage.removeItem('checkcar_user');localStorage.removeItem('checkcar_tenant');}setUser(null);};
  const nav=[{id:"dashboard",label:"Dashboard",icon:<Ic.Home/>},{id:"vehicles",label:"Catálogo",icon:<Ic.Car/>},{id:"sold",label:"Vendidos",icon:<svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/></svg>},{id:"sales",label:"Ventas",icon:<Ic.Chart/>},{id:"clients",label:"Clientes",icon:<Ic.Users/>},{id:"activity",label:"Actividad",icon:<Ic.Log/>},{id:"calculadora",label:"Calculadora Patentes",icon:<svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 10h8M8 14h4" strokeLinecap="round"/></svg>},{id:"cotizador",label:"Cotizador",icon:<svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" strokeLinecap="round" strokeLinejoin="round"/></svg>},{id:"simulador",label:"Simulador Financ.",icon:<svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8v1m0 10v1M8 12H4m16 0h-4" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="9"/></svg>},{id:"transferencia",label:"Transferencia",icon:<svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M9 12h6m-3-3v6M5 8l2-2m10 0l2 2M5 16l2 2m10 0l2-2M3 12a9 9 0 1018 0 9 9 0 00-18 0z" strokeLinecap="round" strokeLinejoin="round"/></svg>}];
  if(!loaded)return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#fff",fontFamily:"'DM Sans',system-ui,sans-serif"}}><div style={{color:"#6b7280"}}>Cargando...</div></div>;
  if(!user)return <Login users={data.users} onLogin={setUser}/>;
  const alerts=data.vehicles.filter(v=>!v.vendido&&v.fechaIngreso&&dDiff(v.fechaIngreso,td())>=ALERT_DAYS);
  return(<div style={{display:"flex",minHeight:"100vh",background:"#f8fafc",fontFamily:"'DM Sans','Segoe UI',system-ui,sans-serif"}}><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
    <nav style={{width:215,background:"#fff",borderRight:"1px solid #e5e7eb",padding:"18px 8px",display:"flex",flexDirection:"column",position:"sticky",top:0,height:"100vh",boxSizing:"border-box",flexShrink:0}}>
      <div style={{padding:"0 10px",marginBottom:24}}><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:32,height:32,borderRadius:9,background:"linear-gradient(135deg,#0284c7,#38bdf8)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:14,fontWeight:800,flexShrink:0}}>✓</div><div><div style={{fontSize:15,fontWeight:800,color:"#111827",letterSpacing:-.5,lineHeight:1.2}}>{(hasAPI&&localStorage.getItem('checkcar_tenant'))?JSON.parse(localStorage.getItem('checkcar_tenant')).nombre:"CheckCar"}</div><div style={{fontSize:9,color:"#9ca3af",fontWeight:500,letterSpacing:.5,textTransform:"uppercase"}}>Concesionario</div></div></div></div>
      <div style={{display:"flex",flexDirection:"column",gap:2}}>{nav.map(item=><button key={item.id} onClick={()=>setPage(item.id)} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 11px",border:"none",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:600,background:page===item.id?"#f0f9ff":"transparent",color:page===item.id?"#0284c7":"#6b7280",transition:"all .15s",fontFamily:"inherit",textAlign:"left",position:"relative"}}>{item.icon}{item.label}{item.id==="dashboard"&&alerts.length>0&&<span style={{marginLeft:"auto",minWidth:16,height:16,borderRadius:8,background:"#ef4444",color:"#fff",fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 3px"}}>{alerts.length}</span>}</button>)}</div>
      <div style={{marginTop:"auto",padding:8,borderTop:"1px solid #f3f4f6"}}>
        {user.role==="admin"&&<UserManager user={user} data={data} setData={setData}/>}
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}><div style={{width:26,height:26,borderRadius:"50%",background:"#f0f9ff",display:"flex",alignItems:"center",justifyContent:"center",color:"#0284c7",fontSize:10,fontWeight:700,flexShrink:0}}>{user.name.charAt(0)}</div><div style={{minWidth:0}}><div style={{fontSize:11,fontWeight:600,color:"#374151",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.name}</div><div style={{fontSize:9,color:"#9ca3af"}}>{user.role}</div></div></div><button onClick={handleLogout} style={{display:"flex",alignItems:"center",gap:4,padding:"5px 8px",background:"none",border:"1px solid #e5e7eb",borderRadius:6,cursor:"pointer",fontSize:10,color:"#6b7280",fontWeight:600,width:"100%",fontFamily:"inherit",justifyContent:"center"}}><Ic.Logout/> Salir</button><div style={{fontSize:9,color:"#d1d5db",textAlign:"center",marginTop:6}}>{data.vehicles.filter(v=>!v.vendido).length} stock · {data.vehicles.filter(v=>v.vendido).length} vendidos</div></div>
    </nav>
    <main style={{flex:1,padding:"24px 32px",maxWidth:1200,overflowX:"hidden"}}>
      {page==="dashboard"&&<DashPage data={data}/>}
      {page==="vehicles"&&<VehPage data={data} setData={setData} user={user} allMarcas={allMarcas} addMarca={addMarca}/>}
      {page==="sold"&&<SoldPage data={data} setData={setData} user={user}/>}
      {page==="sales"&&<SalesPage data={data}/>}
      {page==="clients"&&<CliPage data={data} setData={setData} user={user}/>}
      {page==="activity"&&<ActPage data={data}/>}
      {page==="calculadora"&&<CalcPatentePage/>}
      {page==="cotizador"&&<CotizadorPage/>}
      {page==="simulador"&&<SimuladorPage/>}
      {page==="transferencia"&&<TransferenciaPage/>}
    </main>
  </div>);
}