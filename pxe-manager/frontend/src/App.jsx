import { useState, useEffect, useRef, useCallback } from "react";

const API = window.location.port === "3000"
  ? `http://${window.location.hostname}:5000`
  : "";

// ── CSS ───────────────────────────────────────────────────────────────────────
const css = `
@import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;500;600&display=swap');

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  /* Surfaces */
  --bg:#05070f;
  --bg2:#080c18;
  --bg3:#0d1220;
  --bg4:#111829;
  --bg5:#161e30;
  --bg6:#1c2540;

  /* Borders */
  --bd1:#192038;
  --bd2:#1f2a45;
  --bd3:#283554;
  --bd4:#364569;

  /* Brand */
  --blue:#4d8bf5;
  --blue2:#3a7af3;
  --blue3:#2563d8;
  --blue-glow:rgba(77,139,245,.18);
  --blue-dim:rgba(77,139,245,.08);

  /* Semantic */
  --green:#0dce8a;
  --green-dim:rgba(13,206,138,.1);
  --green-glow:rgba(13,206,138,.2);
  --red:#f04e4e;
  --red-dim:rgba(240,78,78,.1);
  --yellow:#f0a020;
  --yellow-dim:rgba(240,160,32,.1);
  --purple:#7c5fe6;
  --cyan:#0bb8d4;

  /* Text */
  --t1:#e4eeff;
  --t2:#8fa8cc;
  --t3:#4d6285;
  --t4:#2c3d58;

  /* Typography */
  --sans:'Inter',system-ui,sans-serif;
  --mono:'JetBrains Mono',monospace;

  /* Shape */
  --r:6px;
  --r-md:10px;
  --r-lg:14px;
  --r-xl:18px;
}

html,body,#root{
  height:100%;
  background:var(--bg);
  color:var(--t1);
  font-family:var(--sans);
  font-size:13.5px;
  line-height:1.5;
  -webkit-font-smoothing:antialiased;
}

::-webkit-scrollbar{width:3px;height:3px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--bd3);border-radius:4px}
::-webkit-scrollbar-thumb:hover{background:var(--bd4)}

/* ══════════════════════════════════════════════
   LAYOUT
══════════════════════════════════════════════ */
.app{display:grid;grid-template-rows:54px 1fr;height:100%;overflow:hidden}

/* Header */
.header{
  display:flex;align-items:center;gap:0;
  padding:0 24px;
  background:var(--bg2);
  border-bottom:1px solid var(--bd1);
  position:relative;
  z-index:10;
}
.header::after{
  content:'';position:absolute;bottom:0;left:0;right:0;height:1px;
  background:linear-gradient(90deg,transparent,var(--blue-glow),transparent);
  pointer-events:none;
}

.logo{
  display:flex;align-items:center;gap:10px;
  font-family:var(--mono);font-size:12.5px;font-weight:600;
  color:var(--t1);letter-spacing:.02em;
  text-decoration:none;
}
.logo-mark{
  width:30px;height:30px;
  background:linear-gradient(135deg,#1a2d5a 0%,#0f1e42 100%);
  border:1px solid var(--blue);
  border-radius:8px;
  display:flex;align-items:center;justify-content:center;
  font-size:14px;flex-shrink:0;
  box-shadow:0 0 14px rgba(77,139,245,.25);
}
.logo-text{display:flex;flex-direction:column;line-height:1.1}
.logo-title{color:var(--t1);font-size:12px;font-weight:600}
.logo-sub{color:var(--t3);font-size:10px;font-weight:400;letter-spacing:.06em}

.header-center{flex:1;display:flex;justify-content:center}

.header-right{display:flex;align-items:center;gap:8px}

.svc-chip{
  display:flex;align-items:center;gap:6px;
  padding:5px 12px;border-radius:20px;
  font-size:11px;font-family:var(--mono);
  background:var(--bg3);border:1px solid var(--bd2);
  color:var(--t3);transition:all .2s;
}
.svc-chip.active{border-color:rgba(13,206,138,.3);color:var(--t2)}

.dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.dot.active{background:var(--green);box-shadow:0 0 8px var(--green-glow)}
.dot.inactive,.dot.failed{background:var(--red)}
.dot.unknown{background:var(--t3)}

/* Tabs */
.tabs{
  display:flex;
  background:var(--bg2);
  border-bottom:1px solid var(--bd1);
  padding:0 24px;
  gap:0;
  overflow-x:auto;
}
.tabs::-webkit-scrollbar{height:0}

.tab{
  display:flex;align-items:center;gap:7px;
  padding:0 18px;height:44px;
  font-size:12px;font-family:var(--mono);font-weight:500;
  color:var(--t3);cursor:pointer;
  border-bottom:2px solid transparent;
  transition:all .18s;white-space:nowrap;
  letter-spacing:.02em;
  position:relative;
}
.tab:hover{color:var(--t2);background:rgba(255,255,255,.02)}
.tab.active{
  color:var(--blue);
  border-bottom-color:var(--blue);
  background:var(--blue-dim);
}
.tab-icon{font-size:14px;opacity:.8}

.body{overflow:hidden;height:100%;display:grid;grid-template-rows:auto 1fr}
.content{overflow-y:auto;padding:24px 28px;max-width:960px;margin:0 auto;width:100%}

/* drag-and-drop rows */
[data-drow].drag-over{background:rgba(77,139,245,.09)!important;outline:1px dashed rgba(77,139,245,.45);outline-offset:-1px}
[data-drow].dragging{opacity:.35}
.dhandle{cursor:grab;font-size:15px;color:var(--t4);padding:2px 4px;border-radius:3px;
  user-select:none;transition:color .15s,background .15s;line-height:1;display:flex;align-items:center}
.dhandle:hover{color:var(--t2);background:var(--bg4)}

/* ══════════════════════════════════════════════
   CARDS
══════════════════════════════════════════════ */
.card{
  background:var(--bg2);
  border:1px solid var(--bd1);
  border-radius:var(--r-lg);
  padding:0;
  margin-bottom:12px;
  overflow:hidden;
  transition:border-color .2s;
}
.card:hover{border-color:var(--bd2)}

.card-hd{
  display:flex;align-items:center;justify-content:space-between;
  padding:14px 20px;
  border-bottom:1px solid var(--bd1);
  background:var(--bg3);
}
.card-hd-left{display:flex;align-items:center;gap:10px}
.card-icon{
  width:28px;height:28px;border-radius:7px;
  display:flex;align-items:center;justify-content:center;
  font-size:13px;flex-shrink:0;
}
.card-title{
  font-size:11px;font-family:var(--mono);font-weight:600;
  color:var(--t1);letter-spacing:.08em;text-transform:uppercase;
}
.card-sub{font-size:11px;color:var(--t3);margin-top:1px}
.card-body{padding:20px}
.card-body-sm{padding:14px 20px}

/* ══════════════════════════════════════════════
   GRID & FIELDS
══════════════════════════════════════════════ */
.grid{display:grid;gap:12px}
.grid-2{grid-template-columns:1fr 1fr}
.grid-3{grid-template-columns:1fr 1fr 1fr}
.grid-4{grid-template-columns:1fr 1fr 1fr 1fr}
.span-2{grid-column:span 2}
.span-3{grid-column:span 3}

.field{display:flex;flex-direction:column;gap:5px}
.field label{
  font-size:10px;font-family:var(--mono);font-weight:600;
  color:var(--t3);letter-spacing:.1em;text-transform:uppercase;
}

input,select,textarea{
  background:var(--bg4);
  border:1px solid var(--bd2);
  color:var(--t1);
  font-family:var(--mono);font-size:12px;
  padding:8px 11px;border-radius:var(--r);
  outline:none;width:100%;
  transition:border-color .15s,background .15s,box-shadow .15s;
}
input:hover,select:hover{border-color:var(--bd3)}
input:focus,select:focus,textarea:focus{
  border-color:var(--blue);
  background:var(--bg5);
  box-shadow:0 0 0 3px var(--blue-glow);
}
textarea{resize:vertical;min-height:80px;line-height:1.7}
select option{background:var(--bg4)}
input[type=number]{-moz-appearance:textfield}
input[type=number]::-webkit-inner-spin-button{opacity:.35}

/* Password */
.pw-wrap{position:relative;display:flex}
.pw-wrap input{padding-right:36px}
.pw-toggle{
  position:absolute;right:0;top:0;bottom:0;width:34px;
  background:none;border:none;cursor:pointer;color:var(--t3);
  display:flex;align-items:center;justify-content:center;
  font-size:13px;transition:color .15s;
  border-radius:0 var(--r) var(--r) 0;
}
.pw-toggle:hover{color:var(--blue)}

/* ══════════════════════════════════════════════
   BUTTONS
══════════════════════════════════════════════ */
.btn{
  font-family:var(--mono);font-size:11px;font-weight:600;
  letter-spacing:.04em;text-transform:uppercase;
  border:none;border-radius:var(--r);cursor:pointer;
  padding:8px 16px;
  transition:all .15s;
  display:inline-flex;align-items:center;gap:6px;
  white-space:nowrap;
}

.btn-primary{
  background:var(--blue);color:#fff;
  box-shadow:0 1px 3px rgba(0,0,0,.3);
}
.btn-primary:hover:not(:disabled){
  background:var(--blue2);
  transform:translateY(-1px);
  box-shadow:0 4px 16px rgba(77,139,245,.35);
}

.btn-ghost{
  background:transparent;color:var(--t2);
  border:1px solid var(--bd2);
}
.btn-ghost:hover{border-color:var(--bd3);color:var(--t1);background:var(--bg4)}

.btn-danger{
  background:transparent;color:var(--red);
  border:1px solid rgba(240,78,78,.2);
}
.btn-danger:hover{background:var(--red-dim);border-color:rgba(240,78,78,.45)}

.btn-success{background:var(--green);color:#000;font-weight:700}
.btn-success:hover{opacity:.88;transform:translateY(-1px)}

.btn-sm{padding:5px 10px;font-size:10px}
.btn-xs{padding:3px 8px;font-size:10px}
.btn:disabled{opacity:.28;cursor:not-allowed;transform:none !important;box-shadow:none !important}

.btn-row{
  display:flex;gap:8px;justify-content:flex-end;
  margin-top:20px;padding-top:16px;
  border-top:1px solid var(--bd1);
}

/* ══════════════════════════════════════════════
   TOGGLE
══════════════════════════════════════════════ */
.toggle-row{
  display:flex;align-items:center;gap:12px;
  padding:10px 13px;
  background:var(--bg4);border:1px solid var(--bd2);
  border-radius:var(--r);transition:border-color .15s;
}
.toggle-row:hover{border-color:var(--bd3)}
.toggle-row label{font-size:12px;font-family:var(--mono);color:var(--t2);flex:1}

.toggle{
  width:34px;height:18px;border-radius:9px;
  background:var(--bd3);position:relative;
  cursor:pointer;transition:background .2s;
  border:none;outline:none;flex-shrink:0;
}
.toggle.on{background:var(--blue)}
.toggle::after{
  content:'';position:absolute;
  width:12px;height:12px;background:#fff;
  border-radius:50%;top:3px;left:3px;
  transition:transform .2s;
  box-shadow:0 1px 4px rgba(0,0,0,.4);
}
.toggle.on::after{transform:translateX(16px)}

/* ══════════════════════════════════════════════
   BADGE
══════════════════════════════════════════════ */
.badge{
  display:inline-flex;align-items:center;gap:5px;
  font-family:var(--mono);font-size:10px;font-weight:600;
  letter-spacing:.04em;text-transform:uppercase;
  padding:3px 9px;border-radius:20px;
}
.badge-active{background:var(--green-dim);color:var(--green);border:1px solid rgba(13,206,138,.22)}
.badge-inactive,.badge-failed{background:var(--red-dim);color:var(--red);border:1px solid rgba(240,78,78,.22)}
.badge-running{background:var(--blue-dim);color:var(--blue);border:1px solid rgba(77,139,245,.22)}
.badge-done{background:var(--green-dim);color:var(--green);border:1px solid rgba(13,206,138,.22)}
.badge-unknown{background:rgba(45,55,80,.5);color:var(--t3);border:1px solid var(--bd2)}

/* ══════════════════════════════════════════════
   TERMINAL
══════════════════════════════════════════════ */
.terminal{
  background:#020409;
  border:1px solid var(--bd1);
  border-radius:var(--r-md);
  padding:14px 16px;
  font-family:var(--mono);font-size:11.5px;line-height:2;
  color:#6a8aaa;
  min-height:140px;max-height:380px;overflow-y:auto;
}
.terminal-bar{
  display:flex;align-items:center;gap:7px;
  margin-bottom:12px;padding-bottom:10px;
  border-bottom:1px solid var(--bd1);
}
.tdot{width:10px;height:10px;border-radius:50%}
.log-ok{color:var(--green)}
.log-err{color:var(--red)}
.log-info{color:var(--blue)}
.log-warn{color:var(--yellow)}
.lnum{
  color:var(--t4);margin-right:14px;
  user-select:none;display:inline-block;
  width:24px;text-align:right;font-size:10px;
}

/* ══════════════════════════════════════════════
   PROGRESS
══════════════════════════════════════════════ */
.prog-wrap{margin:14px 0}
.prog-bar{height:3px;background:var(--bd2);border-radius:3px;overflow:hidden}
.prog-fill{
  height:100%;
  background:linear-gradient(90deg,var(--blue),var(--cyan));
  border-radius:3px;transition:width .5s ease;
}
.prog-fill.done{background:linear-gradient(90deg,var(--green),#34d399)}
.prog-stages{display:flex;gap:3px;margin-bottom:10px}
.prog-stage{flex:1;text-align:center}
.prog-seg{height:2px;border-radius:2px;margin-bottom:5px;transition:background .4s}
.prog-seg.done{background:var(--green)}
.prog-seg.active{background:var(--blue)}
.prog-seg.idle{background:var(--bd2)}
.prog-label{font-family:var(--mono);font-size:9px;letter-spacing:.04em}
.prog-label.done{color:var(--green)}
.prog-label.active{color:var(--blue)}
.prog-label.idle{color:var(--t3)}

/* ══════════════════════════════════════════════
   DASHBOARD
══════════════════════════════════════════════ */
.stat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px}
.stat-card{
  background:var(--bg3);border:1px solid var(--bd1);
  border-radius:var(--r-md);padding:16px 18px;
  transition:all .2s;cursor:default;
  display:flex;flex-direction:column;gap:6px;
}
.stat-card:hover{border-color:var(--bd3);transform:translateY(-1px)}
.stat-val{font-size:22px;font-weight:700;font-family:var(--mono);line-height:1}
.stat-key{font-size:10px;color:var(--t3);font-family:var(--mono);text-transform:uppercase;letter-spacing:.1em}
.stat-val.green{color:var(--green)}
.stat-val.red{color:var(--red)}
.stat-val.blue{color:var(--blue)}
.stat-val.yellow{color:var(--yellow)}

.cfg-grid{
  display:grid;grid-template-columns:repeat(3,1fr);
  gap:0;
}
.cfg-item{
  padding:14px 18px;
  border-right:1px solid var(--bd1);
  border-bottom:1px solid var(--bd1);
}
.cfg-item:nth-child(3n){border-right:none}
.cfg-item:nth-last-child(-n+3){border-bottom:none}
.cfg-label{font-size:10px;font-family:var(--mono);color:var(--t3);text-transform:uppercase;letter-spacing:.1em;margin-bottom:5px}
.cfg-val{font-size:12px;font-family:var(--mono);color:var(--t1)}

/* ══════════════════════════════════════════════
   ISO TABLE
══════════════════════════════════════════════ */
.iso-table{width:100%;border-collapse:separate;border-spacing:0;font-family:var(--mono);font-size:12px}
.iso-table th{
  text-align:left;padding:9px 14px;
  color:var(--t3);font-size:10px;
  letter-spacing:.1em;border-bottom:1px solid var(--bd1);
  font-weight:600;text-transform:uppercase;background:var(--bg3);
}
.iso-table th:first-child{border-radius:0}
.iso-table td{padding:11px 14px;border-bottom:1px solid var(--bd1);color:var(--t2);transition:background .1s}
.iso-table tbody tr:hover td{background:var(--bg4)}
.iso-table tbody tr:last-child td{border-bottom:none}
.iso-table td:first-child{color:var(--t1)}

.os-pill{
  display:inline-flex;align-items:center;gap:4px;
  padding:2px 9px;border-radius:20px;font-size:10px;
  text-transform:uppercase;font-weight:700;letter-spacing:.04em;
}
.os-rocky,.os-rhel,.os-centos{background:rgba(59,130,246,.1);color:#78b4ff;border:1px solid rgba(59,130,246,.18)}
.os-ubuntu{background:rgba(240,160,32,.1);color:#f0a020;border:1px solid rgba(240,160,32,.18)}
.os-almalinux,.os-ol{background:rgba(124,95,230,.1);color:#a98bff;border:1px solid rgba(124,95,230,.18)}
.os-unknown{background:var(--bg5);color:var(--t3);border:1px solid var(--bd2)}

/* ══════════════════════════════════════════════
   KS LIST & EDITOR
══════════════════════════════════════════════ */
.ks-list{display:flex;flex-direction:column;gap:4px}
.ks-item{
  display:flex;align-items:center;gap:10px;
  padding:10px 14px;
  background:var(--bg3);border:1px solid var(--bd1);
  border-radius:var(--r);cursor:pointer;transition:all .15s;
}
.ks-item:hover,.ks-item.selected{border-color:var(--blue);background:var(--bg4)}
.ks-item-name{font-family:var(--mono);font-size:12px;color:var(--t1);flex:1}
.ks-item-meta{font-size:10px;color:var(--t3);font-family:var(--mono)}

.code-editor{
  width:100%;background:#020409;
  border:1px solid var(--bd1);border-radius:var(--r-md);
  padding:16px;font-family:var(--mono);font-size:12px;
  color:#a8c8e8;line-height:1.9;resize:vertical;
  outline:none;min-height:300px;transition:border-color .15s;
}
.code-editor:focus{border-color:var(--blue)}

/* ══════════════════════════════════════════════
   INFO BOX
══════════════════════════════════════════════ */
.info-box{
  background:var(--blue-dim);border:1px solid rgba(77,139,245,.15);
  border-radius:var(--r);padding:11px 15px;
  font-family:var(--mono);font-size:11px;
  color:var(--t2);line-height:1.9;margin-bottom:14px;
}

/* ══════════════════════════════════════════════
   PACKAGES
══════════════════════════════════════════════ */
.pkg-list{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.pkg-tag{
  background:var(--bg5);border:1px solid var(--bd2);
  font-family:var(--mono);font-size:11px;color:var(--t2);
  padding:3px 10px;border-radius:20px;
  display:flex;align-items:center;gap:6px;transition:all .15s;
}
.pkg-tag:hover{border-color:var(--bd3)}
.pkg-tag button{background:none;border:none;color:var(--t3);cursor:pointer;font-size:13px;line-height:1;padding:0;transition:color .15s}
.pkg-tag button:hover{color:var(--red)}
.pkg-tag.exclude{border-color:rgba(240,78,78,.2);color:var(--red)}
.pkg-tag.exclude button:hover{color:var(--t1)}
.pkg-add{display:flex;gap:8px}

/* ══════════════════════════════════════════════
   SECTION LABEL
══════════════════════════════════════════════ */
.section-label{
  font-size:10px;font-family:var(--mono);font-weight:600;color:var(--blue);
  letter-spacing:.14em;text-transform:uppercase;
  margin:18px 0 10px;padding-bottom:7px;
  border-bottom:1px solid var(--bd1);
  display:flex;align-items:center;gap:8px;
}
.section-label::before{content:'';width:2px;height:10px;background:var(--blue);border-radius:2px;display:inline-block}

/* ══════════════════════════════════════════════
   SAVE TOAST
══════════════════════════════════════════════ */
.save-toast{
  display:inline-flex;align-items:center;gap:6px;
  padding:5px 12px;border-radius:20px;
  background:var(--green-dim);border:1px solid rgba(13,206,138,.28);
  font-family:var(--mono);font-size:11px;color:var(--green);
  animation:toastIn .25s cubic-bezier(.34,1.56,.64,1);
}
@keyframes toastIn{from{opacity:0;transform:translateY(-5px) scale(.95)}to{opacity:1;transform:none}}

/* ══════════════════════════════════════════════
   AUTH SECTIONS
══════════════════════════════════════════════ */
.auth-section{
  border:1px solid var(--bd2);border-radius:var(--r-md);
  overflow:hidden;margin-bottom:10px;
}
.auth-section-title{
  font-family:var(--mono);font-size:10px;font-weight:700;
  color:var(--t2);letter-spacing:.1em;text-transform:uppercase;
  padding:10px 14px;
  background:var(--bg4);border-bottom:1px solid var(--bd2);
  display:flex;align-items:center;gap:8px;
}
.auth-section-body{padding:14px}

/* ══════════════════════════════════════════════
   DISK / PARTITION EDITOR
══════════════════════════════════════════════ */
.disk-bar{
  display:flex;height:26px;border-radius:var(--r);overflow:hidden;
  border:1px solid var(--bd2);margin-bottom:10px;
}
.disk-seg{
  display:flex;align-items:center;justify-content:center;
  font-size:9.5px;font-family:var(--mono);font-weight:600;color:rgba(255,255,255,.9);
  overflow:hidden;white-space:nowrap;transition:filter .2s;
}
.disk-seg:hover{filter:brightness(1.18)}
.disk-legend{display:flex;flex-wrap:wrap;gap:5px 14px}
.disk-legend-item{display:flex;align-items:center;gap:5px;font-family:var(--mono);font-size:11px;color:var(--t2)}

/* ══════════════════════════════════════════════
   GRUB KS LIST (in GrubTab)
══════════════════════════════════════════════ */
.grub-ks-row{
  display:grid;
  grid-template-columns:16px 1fr 160px 36px;
  gap:8px;padding:8px 14px;
  border-bottom:1px solid var(--bd1);
  align-items:center;transition:background .1s;
}
.grub-ks-row:hover{background:var(--bg4)}
.grub-ks-row:last-child{border-bottom:none}
.grub-ks-row.checked{background:rgba(77,139,245,.05)}

/* ══════════════════════════════════════════════
   BUILDER OS SELECTOR
══════════════════════════════════════════════ */
.os-selector{display:flex;gap:8px}
.os-btn{
  flex:1;padding:13px 16px;border-radius:var(--r-md);cursor:pointer;
  transition:all .18s;text-align:center;
  border:1px solid var(--bd2);background:var(--bg3);
}
.os-btn:hover{border-color:var(--bd3);background:var(--bg4)}
.os-btn.active{border-color:var(--blue);background:var(--blue-dim)}
.os-btn-icon{font-size:22px;margin-bottom:6px}
.os-btn-label{font-family:var(--mono);font-size:11px;font-weight:600;color:var(--t2)}
.os-btn.active .os-btn-label{color:var(--blue)}

/* ══════════════════════════════════════════════
   MISC
══════════════════════════════════════════════ */
.pulse{animation:pulse 1.4s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.2}}

.status-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px}
.stat-card{background:var(--bg3);border:1px solid var(--bd1);border-radius:var(--r-md);padding:16px;transition:all .2s;cursor:default}
.stat-card:hover{border-color:var(--bd3);transform:translateY(-1px)}

/* ══════════════════════════════════════════════
   SERVER INVENTORY
══════════════════════════════════════════════ */
.inv-table{width:100%;border-collapse:collapse;font-size:12px}
.inv-table th{
  font-family:var(--mono);font-size:10px;font-weight:600;letter-spacing:.08em;
  text-transform:uppercase;color:var(--t3);
  padding:10px 12px;border-bottom:1px solid var(--bd2);
  text-align:left;background:var(--bg3);white-space:nowrap;
}
.inv-table td{
  padding:10px 12px;border-bottom:1px solid var(--bd1);
  color:var(--t1);vertical-align:middle;
}
.inv-table tr:last-child td{border-bottom:none}
.inv-table tr:hover td{background:rgba(77,139,245,.03)}
.badge-applied{display:inline-flex;align-items:center;gap:4px;font-family:var(--mono);font-size:10px;
  padding:2px 8px;border-radius:10px;
  background:var(--green-dim);color:var(--green);border:1px solid rgba(13,206,138,.25)}
.badge-pending{display:inline-flex;align-items:center;gap:4px;font-family:var(--mono);font-size:10px;
  padding:2px 8px;border-radius:10px;
  background:var(--yellow-dim);color:var(--yellow);border:1px solid rgba(240,160,32,.25)}

/* Modal overlay */
.modal-overlay{
  position:fixed;inset:0;z-index:100;
  background:rgba(5,7,15,.75);backdrop-filter:blur(4px);
  display:flex;align-items:center;justify-content:center;padding:24px;
}
.modal{
  background:var(--bg2);border:1px solid var(--bd2);border-radius:var(--r-xl);
  width:100%;max-width:680px;max-height:90vh;overflow-y:auto;
  box-shadow:0 24px 80px rgba(0,0,0,.6);
}
.modal-hd{
  display:flex;align-items:center;justify-content:space-between;
  padding:18px 24px;border-bottom:1px solid var(--bd1);
  font-family:var(--mono);font-size:12px;font-weight:600;
  color:var(--t1);letter-spacing:.06em;text-transform:uppercase;
  position:sticky;top:0;background:var(--bg2);z-index:1;
}
.modal-body{padding:24px}
.modal-close{
  background:none;border:none;cursor:pointer;color:var(--t3);
  font-size:18px;line-height:1;padding:4px;border-radius:4px;
  transition:color .15s,background .15s;
}
.modal-close:hover{color:var(--t1);background:var(--bg4)}

.nic-list{display:flex;flex-direction:column;gap:6px;margin-top:8px}
.nic-item{
  display:flex;align-items:center;justify-content:space-between;
  padding:10px 14px;border-radius:var(--r);
  background:var(--bg3);border:1px solid var(--bd1);
  cursor:pointer;transition:all .15s;
}
.nic-item:hover{border-color:var(--blue);background:var(--blue-dim)}
.nic-item-info{display:flex;flex-direction:column;gap:2px}
.nic-item-id{font-family:var(--mono);font-size:11px;color:var(--t2);font-weight:600}
.nic-item-desc{font-size:11px;color:var(--t3)}
.nic-item-mac{font-family:var(--mono);font-size:12px;color:var(--blue);font-weight:600}
`;


// ── Helpers ───────────────────────────────────────────────────────────────────

function Field({ label, children, span2, span3 }) {
  return (
    <div className={`field${span2 ? " span-2" : ""}${span3 ? " span-3" : ""}`}>
      {label && <label>{label}</label>}
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <div className="toggle-row">
      <label>{label}</label>
      <button type="button" className={`toggle${checked ? " on" : ""}`} onClick={() => onChange(!checked)} />
    </div>
  );
}

function PasswordField({ label, value, onChange, placeholder, span2 }) {
  const [show, setShow] = useState(false);
  return (
    <div className={`field${span2 ? " span-2" : ""}`}>
      {label && <label>{label}</label>}
      <div className="pw-wrap">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
        />
        <button type="button" className="pw-toggle" onClick={() => setShow(v => !v)}
          title={show ? "숨기기" : "보기"}>
          {show ? "🙈" : "👁"}
        </button>
      </div>
    </div>
  );
}

function Terminal({ log, status }) {
  const ref = useRef();
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [log]);
  return (
    <>
      <div className="terminal-bar">
        <div className="tdot" style={{ background: "#ff5f56" }} />
        <div className="tdot" style={{ background: "#ffbd2e" }} />
        <div className="tdot" style={{ background: "#27c93f" }} />
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--t3)", marginLeft: 6 }}>
          log — {log.length} lines
        </span>
        {status && (
          <span className={`badge badge-${status}`} style={{ marginLeft: "auto" }}>
            {status === "running" && <span className="pulse">● </span>}
            {status === "running" ? "실행 중" : status === "done" ? "완료" : status === "failed" ? "실패" : status}
          </span>
        )}
      </div>
      <div className="terminal" ref={ref}>
        {log.map((l, i) => (
          <div key={i} className={l.startsWith("✅") || l.startsWith("[+]") ? "log-ok" : l.startsWith("❌") || l.startsWith("ERROR") ? "log-err" : l.startsWith("⚠") || l.startsWith("[!]") ? "log-warn" : ""}>
            <span className="lnum">{String(i + 1).padStart(3, "0")}</span>{l}
          </div>
        ))}
        {status === "running" && <div className="pulse" style={{ color: "var(--blue)" }}>▊</div>}
      </div>
    </>
  );
}

const STAGES = [
  { label: "패키지", pct: 15 },
  { label: "디렉터리", pct: 30 },
  { label: "Nginx", pct: 45 },
  { label: "dnsmasq", pct: 65 },
  { label: "SELinux", pct: 82 },
  { label: "방화벽", pct: 95 },
];

function ProgressBar({ pct, status }) {
  return (
    <div className="prog-wrap">
      <div className="prog-stages">
        {STAGES.map(s => {
          const done = pct >= s.pct;
          const active = !done && pct >= s.pct - 20;
          const cls = done ? "done" : active ? "active" : "idle";
          return (
            <div key={s.label} className="prog-stage">
              <div className={`prog-seg ${cls}`} />
              <div className={`prog-label ${cls}`}>{s.label}</div>
            </div>
          );
        })}
      </div>
      <div className="prog-bar">
        <div className={`prog-fill${status === "done" ? " done" : ""}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function useJob(jobId) {
  const [job, setJob] = useState(null);
  useEffect(() => {
    if (!jobId) return;
    const id = setInterval(async () => {
      try {
        const r = await fetch(`${API}/api/jobs/${jobId}`);
        const d = await r.json();
        setJob(d);
        if (d.status !== "running") clearInterval(id);
      } catch {}
    }, 1000);
    return () => clearInterval(id);
  }, [jobId]);
  return job;
}

// ── ConfirmDialog — 브라우저 confirm() 대체 ──────────────────────────────────
// 사용법:
//   const [dlg, setDlg] = useState(null);
//   <ConfirmDialog dlg={dlg} onClose={() => setDlg(null)} />
//   setDlg({ msg: "삭제?", onOk: () => doDelete() });
function ConfirmDialog({ dlg, onClose }) {
  if (!dlg) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,.55)", backdropFilter: "blur(3px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}
      onClick={onClose}
    >
      <div style={{
        background: "var(--bg3)", border: "1px solid var(--bd3)",
        borderRadius: "var(--r-lg)", padding: "24px 28px",
        minWidth: 320, maxWidth: 480,
        boxShadow: "0 24px 64px rgba(0,0,0,.5)",
      }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--t1)", marginBottom: 20, lineHeight: 1.7 }}>
          {dlg.msg}
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>취소</button>
          <button className="btn btn-danger btn-sm" onClick={() => { dlg.onOk(); onClose(); }}>
            {dlg.okLabel || "삭제"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Dashboard ────────────────────────────────────────────────────────────

function Dashboard() {
  const [st, setSt] = useState(null);
  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/status`);
      setSt(await r.json());
    } catch {}
  }, []);
  useEffect(() => { load(); const id = setInterval(load, 8000); return () => clearInterval(id); }, []);

  if (!st) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:200,
      fontFamily:"var(--mono)", fontSize:12, color:"var(--t3)" }}>
      <span className="pulse">Loading…</span>
    </div>
  );

  return (
    <div>
      {/* 서비스 상태 */}
      <div className="card">
        <div className="card-hd">
          <div className="card-hd-left">
            <div className="card-icon" style={{ background:"rgba(77,139,245,.12)", color:"var(--blue)" }}>◈</div>
            <div>
              <div className="card-title">System Status</div>
              <div className="card-sub">PXE 서버 구성요소 상태</div>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={load}>↻ 새로고침</button>
        </div>
        <div className="card-body-sm">
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:10 }}>
            {[
              { name:"nginx",       val: st.services["nginx"]   || "unknown" },
              { name:"dnsmasq",     val: st.services["dnsmasq"] || "unknown" },
              { name:"grubx64.efi", val: st.grub_efi ? "present" : "missing" },
              { name:"grub.cfg",    val: st.grub_cfg ? "present" : "missing" },
            ].map(item => {
              const ok  = item.val === "active" || item.val === "present";
              const bad = item.val === "inactive" || item.val === "failed" || item.val === "missing";
              return (
                <div key={item.name} className="stat-card">
                  <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                    <div className={`dot ${ok ? "active" : bad ? "failed" : "unknown"}`} />
                    <div className="stat-key">{item.name}</div>
                  </div>
                  <div className={`stat-val ${ok ? "green" : bad ? "red" : ""}`} style={{ fontSize:16, marginBottom:0 }}>{item.val}</div>
                </div>
              );
            })}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div className="stat-card">
              <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                <div className="dot active" style={{ background:"var(--blue)", boxShadow:"none" }} />
                <div className="stat-key">Kickstart</div>
              </div>
              <div className="stat-val blue" style={{ fontSize:16, marginBottom:0 }}>{st.ks_count} files</div>
            </div>
            <div className="stat-card">
              <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                <div className="dot active" style={{ background:"var(--blue)", boxShadow:"none" }} />
                <div className="stat-key">ISO</div>
              </div>
              <div className="stat-val blue" style={{ fontSize:16, marginBottom:0 }}>{st.iso_count} files</div>
            </div>
          </div>
        </div>
      </div>

      {/* PXE 서버 설정 */}
      <div className="card">
        <div className="card-hd">
          <div className="card-hd-left">
            <div className="card-icon" style={{ background:"rgba(11,184,212,.1)", color:"var(--cyan)" }}>◎</div>
            <div>
              <div className="card-title">Server Configuration</div>
              <div className="card-sub">현재 PXE 서버 설정값</div>
            </div>
          </div>
        </div>
        <div className="cfg-grid">
          {[
            ["Interface",  st.cfg.iface      || "—"],
            ["Server IP",  st.cfg.server_ip  || "—"],
            ["DHCP Range", st.cfg.dhcp_range || "—"],
            ["WWW Root",   "/var/www/html"],
            ["TFTP Root",  "/var/lib/tftpboot"],
            ["KS Path",    "/var/www/html/ks/"],
          ].map(([k, v]) => (
            <div key={k} className="cfg-item">
              <div className="cfg-label">{k}</div>
              <div className="cfg-val">{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


// ── PartitionEditor 컴포넌트 (IIFE 대체 — esbuild 파싱 오류 방지) ───────────
const PART_COLORS = ["#4f8ef7","#8b5cf6","#10d48e","#06b6d4","#f97316","#f5a623","#f05252","#a855f7","#84cc16","#ec4899"];

function PartitionEditor({ isUbuntu, cfg, setC }) {
  const fixedParts = isUbuntu
    ? [{ key:"efi",  mount:"/boot/efi", size: cfg.partEfi||512,  fstype:"vfat", color:"#6366f1" }]
    : [
        { key:"efi",  mount:"/boot/efi", size: cfg.partEfi||512,  fstype:"vfat", color:"#6366f1" },
        { key:"boot", mount:"/boot",     size: cfg.partBoot||1024, fstype: cfg.fsBoot||"xfs",   color:"#8b5cf6" },
      ];

  const customParts = cfg.customParts || [
    { id:1, mount:"/",     size:10240, fstype:"xfs",  grow:false },
    { id:2, mount:"/home", size:5120,  fstype:"xfs",  grow:false },
    { id:3, mount:"swap",  size:2048,  fstype:"swap", grow:false },
  ];

  const allParts = [
    ...fixedParts,
    ...customParts.map((p,i) => ({ ...p, color: PART_COLORS[(i+fixedParts.length) % PART_COLORS.length] })),
  ];
  const totalMB = allParts.reduce((s,p) => s + Number(p.size||0), 0) || 1;
  let nextId = customParts.reduce((m,p) => Math.max(m, p.id||0), 0) + 1;

  function updateFixed(key, field, val) {
    if (key === "efi")  setC("partEfi",  Number(val));
    if (key === "boot") { field === "size" ? setC("partBoot", Number(val)) : setC("fsBoot", val); }
  }
  function updateCustom(id, field, val) {
    setC("customParts", customParts.map(p => p.id === id ? { ...p, [field]: field === "size" ? Number(val) : val } : p));
  }
  function addPart() {
    setC("customParts", [...customParts, { id: nextId++, mount:"", size:2048, fstype:"xfs", grow:false }]);
  }
  function delPart(id) {
    setC("customParts", customParts.filter(p => p.id !== id));
  }

  return (
    <div style={{ marginTop:4 }}>
      {/* 디스크 바 미리보기 */}
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:10, fontFamily:"var(--mono)", color:"var(--t3)", marginBottom:8, display:"flex", justifyContent:"space-between" }}>
          <span>디스크 레이아웃 미리보기</span>
          <span style={{ color:"var(--t2)", fontWeight:600 }}>총 {(totalMB/1024).toFixed(1)} GB</span>
        </div>
        <div className="disk-bar">
          {allParts.filter(p => Number(p.size)>0).map(p => (
            <div key={p.key||p.id} className="disk-seg"
              title={`${p.mount}  ${Number(p.size) >= 1024 ? (Number(p.size)/1024).toFixed(1)+"G" : p.size+"M"}`}
              style={{ width:`${(Number(p.size)/totalMB)*100}%`, background:p.color }}>
              {Number(p.size)/totalMB > 0.08 ? (p.mount||"?") : ""}
            </div>
          ))}
        </div>
        <div className="disk-legend">
          {allParts.map(p => (
            <div key={p.key||p.id} className="disk-legend-item">
              <div style={{ width:10, height:10, borderRadius:2, background:p.color, flexShrink:0 }} />
              <span>{p.mount||"?"}</span>
              <span style={{ color:"var(--t3)" }}>{Number(p.size) >= 1024 ? (Number(p.size)/1024).toFixed(1)+"G" : p.size+"M"}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 파티션 테이블 */}
      <div style={{ background:"var(--bg3)", border:"1px solid var(--bd2)", borderRadius:"var(--r-md)", overflow:"hidden" }}>
        {/* 헤더 */}
        <div style={{ display:"grid", gridTemplateColumns:"14px 1fr 110px 110px 70px 36px",
          gap:8, padding:"8px 14px", borderBottom:"1px solid var(--bd1)", background:"var(--bg4)" }}>
          {["", "마운트 포인트", "크기 (MB)", "파일시스템", "—grow", ""].map((h,i) => (
            <div key={i} style={{ fontFamily:"var(--mono)", fontSize:10, color:"var(--t3)",
              textTransform:"uppercase", letterSpacing:".08em", fontWeight:600 }}>{h}</div>
          ))}
        </div>

        {/* 고정 파티션 */}
        {fixedParts.map(p => (
          <div key={p.key} style={{ display:"grid", gridTemplateColumns:"14px 1fr 110px 110px 70px 36px",
            gap:8, padding:"10px 14px", borderBottom:"1px solid var(--bd1)", alignItems:"center", opacity:.7 }}>
            <div style={{ width:10, height:10, borderRadius:2, background:p.color, flexShrink:0 }} />
            <div style={{ fontFamily:"var(--mono)", fontSize:12, color:"var(--t2)", display:"flex", alignItems:"center", gap:6 }}>
              {p.mount}
              <span style={{ fontSize:10, color:"var(--t3)", background:"var(--bg4)",
                padding:"1px 6px", borderRadius:10, border:"1px solid var(--bd2)" }}>고정</span>
            </div>
            <input type="number" value={p.size} min={200}
              onChange={e => updateFixed(p.key, "size", e.target.value)}
              style={{ fontSize:12, padding:"6px 10px", textAlign:"right" }} />
            {p.key === "boot" ? (
              <select value={cfg.fsBoot||"xfs"} onChange={e => updateFixed("boot","fstype",e.target.value)}
                style={{ fontSize:12, padding:"6px 10px" }}>
                <option value="xfs">xfs</option>
                <option value="ext4">ext4</option>
              </select>
            ) : (
              <div style={{ fontFamily:"var(--mono)", fontSize:11, color:"var(--t3)", padding:"6px 10px" }}>vfat</div>
            )}
            <div /><div />
          </div>
        ))}

        {/* 사용자 정의 파티션 */}
        {customParts.map((p, i) => {
          const color = PART_COLORS[(i + fixedParts.length) % PART_COLORS.length];
          return (
            <div key={p.id} style={{ display:"grid", gridTemplateColumns:"14px 1fr 110px 110px 70px 36px",
              gap:8, padding:"9px 14px", borderBottom:"1px solid var(--bd1)",
              alignItems:"center", background: i%2===0 ? "transparent" : "rgba(255,255,255,.01)" }}>
              <div style={{ width:10, height:10, borderRadius:2, background:color, flexShrink:0 }} />
              <input value={p.mount} onChange={e => updateCustom(p.id,"mount",e.target.value)}
                placeholder="/var 또는 swap"
                style={{ fontSize:12, padding:"6px 10px",
                  borderColor: p.mount ? "var(--bd2)" : "rgba(240,82,82,.4)" }} />
              <input type="number" value={p.size} min={0}
                onChange={e => updateCustom(p.id,"size",e.target.value)}
                style={{ fontSize:12, padding:"6px 10px", textAlign:"right" }} />
              <select value={p.fstype} onChange={e => updateCustom(p.id,"fstype",e.target.value)}
                style={{ fontSize:12, padding:"6px 10px" }}>
                <option value="xfs">xfs</option>
                <option value="ext4">ext4</option>
                <option value="swap">swap</option>
                <option value="vfat">vfat</option>
                <option value="btrfs">btrfs</option>
              </select>
              <div style={{ display:"flex", justifyContent:"center" }}>
                <button type="button"
                  className={`toggle${p.grow ? " on" : ""}`}
                  onClick={() => updateCustom(p.id,"grow",!p.grow)} />
              </div>
              <button className="btn btn-danger btn-sm"
                style={{ padding:"4px 8px", fontSize:13, lineHeight:1, minWidth:0 }}
                onClick={() => delPart(p.id)}>x</button>
            </div>
          );
        })}

        {/* 파티션 추가 */}
        <div style={{ padding:"10px 14px" }}>
          <button className="btn btn-ghost btn-sm"
            style={{ color:"var(--green)", borderColor:"rgba(16,212,142,.3)", width:"100%" }}
            onClick={addPart}>
            + 파티션 추가
          </button>
        </div>
      </div>

      {/* RHEL VG 설정 */}
      {!isUbuntu && (
        <div className="grid grid-2" style={{ marginTop:12 }}>
          <Field label="LVM VG 이름">
            <input value={cfg.vgName||"vg_root"} onChange={e => setC("vgName", e.target.value)} />
          </Field>
          <Field label="PV 크기">
            <select value={cfg.pvGrow||"grow"} onChange={e => setC("pvGrow", e.target.value)}>
              <option value="grow">나머지 전체 (--grow)</option>
              <option value="fixed">고정 크기</option>
            </select>
          </Field>
        </div>
      )}
    </div>
  );
}

// ── Tab: Kickstart ─────────────────────────────────────────────────────────────

const DEFAULT_KS_CFG = {
  osType: "rhel",
  lang: "en_US.UTF-8", keyboard: "us", timezone: "Asia/Seoul",
  hostname: "server01",
  rootPassword: "", extraUser: "user", extraUserPassword: "", extraUserSudo: true,
  diskMode: "auto", disk: "", partScheme: "auto", autoPartType: "lvm", autoPartEncrypted: "no",
  partBoot: 1024, partEfi: 512, partRoot: 10240, partHome: 5120, partSwap: 2048,
  fsBoot: "xfs", fsRoot: "xfs", fsHome: "xfs",
  pvGrow: "grow", rootGrow: "fixed", homeGrow: "fixed", swapMode: "lv",
  vgName: "vg_root", separateTmp: false, partTmp: 2048,
  bootloaderAppend: "crashkernel=auto",
  selinux: "enforcing", firewallEnabled: true, sshPort: "22",
  firewallServices: "ssh",
  packageEnv: "@^graphical-server-environment",
  pkgIgnoreMissing: true, pkgExcludeDocs: false,
  packages: ["vim", "wget", "curl", "bash-completion"],
  excludePackages: [],
  preScript: "",
  postScript: "systemctl enable sshd\necho 'KS install complete' >> /root/install.log",
  onFinish: "reboot",
};

function KickstartTab() {
  const [ksList, setKsList] = useState([]);
  const [selected, setSelected] = useState(null);   // {path, content}
  const [editorContent, setEditorContent] = useState("");
  const [newName, setNewName] = useState("");
  const [mode, setMode] = useState("list");          // list | editor | builder
  const [cfg, setCfg] = useState(DEFAULT_KS_CFG);
  const [pkgInput, setPkgInput] = useState("");
  const [exPkgInput, setExPkgInput] = useState("");  // 제외 패키지 입력 (cfg 오염 방지)
  const [saving, setSaving] = useState(false);
  const [savedPath, setSavedPath] = useState(null);
  const savedTimer = useRef(null);
  const [dlg, setDlg] = useState(null);              // ConfirmDialog 상태

  const loadList = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/ks`);
      const d = await r.json();
      setKsList(d.files || []);
    } catch {}
  }, []);

  useEffect(() => { loadList(); }, []);

  async function openFile(item) {
    const r = await fetch(`${API}/api/ks/${item.path}`);
    const d = await r.json();
    setSelected(item);
    setEditorContent(d.content || "");
    setSavedPath(null);
    setMode("editor");
  }

  async function saveFile() {
    if (!selected) return;
    setSaving(true);
    const isUbuntu = selected.isUbuntu || editorContent.startsWith("#cloud-config");
    await fetch(`${API}/api/ks/${selected.path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editorContent, is_ubuntu: isUbuntu }),
    });
    setSaving(false);
    // 저장 완료 표시 (3.5초 후 사라짐)
    setSavedPath(selected.path);
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSavedPath(null), 3500);
    loadList();
  }

  async function deleteFile(path) {
    setDlg({
      msg: `다음 파일을 삭제하시겠습니까?\n\n${path}`,
      onOk: async () => {
        await fetch(`${API}/api/ks/${path}`, { method: "DELETE" });
        setSelected(null); setMode("list"); loadList();
      },
    });
  }

  async function generateFromUI() {
    const r = await fetch(`${API}/api/ks/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cfg),
    });
    const d = await r.json();
    setEditorContent(d.content || "");
    setMode("editor");

    const hostname = cfg.hostname || "server";
    let fname;
    if (cfg.osType === "ubuntu") {
      const ver = cfg.ubuntuVersion || "22.04";
      // ubuntu/22.04/hostname.ks → 저장 시 ubuntu/22.04/hostname/user-data 자동 생성
      fname = `ubuntu/${ver}/${hostname}.ks`;
    } else {
      fname = `${hostname}.ks`;
    }
    setSelected({ path: fname, isUbuntu: cfg.osType === "ubuntu" });
    setSavedPath(null);
  }

  function setC(k, v) { setCfg(p => ({ ...p, [k]: v })); }

  // ── List panel
  if (mode === "list") return (
    <div>
      <ConfirmDialog dlg={dlg} onClose={() => setDlg(null)} />
      <div className="card">
        <div className="card-hd">
          <div className="card-hd-left">
            <div className="card-icon" style={{ background:"rgba(77,139,245,.12)", color:"var(--blue)" }}>◧</div>
            <div>
              <div className="card-title">Kickstart Files</div>
              <div className="card-sub">{ksList.length > 0 ? `${ksList.length}개 파일` : "파일 없음"}</div>
            </div>
          </div>
          <button className="btn btn-primary" style={{ fontSize:12, padding:"8px 18px" }}
            onClick={() => setMode("builder")}>
            ＋ UI 빌더로 생성
          </button>
        </div>

        {savedPath && (
          <div style={{ padding:"10px 20px", borderBottom:"1px solid var(--bd1)", background:"rgba(13,206,138,.06)", display:"flex", alignItems:"center", gap:10 }}>
            <span className="save-toast">✓ 저장 완료 — {savedPath}</span>
          </div>
        )}

        <div className="card-body">
          {ksList.length === 0 ? (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"40px 0", gap:12 }}>
              <div style={{ fontSize:36, opacity:.2, fontFamily:"var(--mono)" }}>◧</div>
              <div style={{ fontFamily:"var(--mono)", fontSize:12, color:"var(--t3)", textAlign:"center", lineHeight:1.8 }}>
                Kickstart 파일 없음<br/>
                <span style={{ fontSize:11 }}>UI 빌더로 생성하거나 <code style={{color:"var(--blue)"}}>
                  /var/www/html/ks/</code>에 직접 추가하세요.
                </span>
              </div>
            </div>
          ) : (
            <div className="ks-list">
              {ksList.map(f => (
                <div key={f.path}
                  className={`ks-item${selected?.path === f.path ? " selected" : ""}`}
                  onClick={() => openFile(f)}>
                  <div style={{ width:6, height:6, borderRadius:"50%",
                    background: savedPath === f.path ? "var(--green)" : "var(--bd3)",
                    flexShrink:0, transition:"background .3s" }} />
                  <div className="ks-item-name">{f.path}</div>
                  <div className="ks-item-meta">{(f.size / 1024).toFixed(1)} KB</div>
                  <button className="btn btn-danger btn-xs"
                    onClick={e => { e.stopPropagation(); deleteFile(f.path); }}>삭제</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ── Editor panel
  if (mode === "editor") return (
    <div>
      <ConfirmDialog dlg={dlg} onClose={() => setDlg(null)} />
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14,
        padding:"12px 16px", background:"var(--bg2)", border:"1px solid var(--bd1)",
        borderRadius:"var(--r-md)" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => { setMode("list"); loadList(); }}>← 목록</button>
        <div style={{ width:1, height:20, background:"var(--bd2)", flexShrink:0 }} />
        <span style={{ fontFamily:"var(--mono)", fontSize:12, color:"var(--t1)", flex:1 }}>
          {selected?.path || "새 파일"}
        </span>
        {savedPath && <span className="save-toast">✓ 저장됨</span>}
        <button className="btn btn-primary btn-sm" onClick={saveFile} disabled={saving}>
          {saving ? "저장 중…" : "저장"}
        </button>
        {selected?.path && <button className="btn btn-danger btn-sm" onClick={() => deleteFile(selected.path)}>삭제</button>}
      </div>
      <div className="info-box" style={{ marginBottom: 10 }}>
        {selected?.isUbuntu || editorContent.startsWith("#cloud-config") ? (
          <>
            저장 경로: <code style={{ color: "var(--blue)" }}>/var/www/html/ks/{selected?.path}</code><br/>
            autoinstall 디렉터리: <code style={{ color: "var(--green)" }}>/var/www/html/ks/{selected?.path?.replace(".ks","")}/user-data</code><br/>
            grub.cfg: <code style={{ color: "var(--blue)" }}>ds=nocloud-net;s=http://서버IP/ks/{selected?.path?.replace(".ks","")}/</code>
          </>
        ) : (
          <>
            저장 경로: <code style={{ color: "var(--blue)" }}>/var/www/html/ks/{selected?.path}</code> —
            PXE 부팅 시 <code style={{ color: "var(--blue)" }}>inst.ks=http://서버IP/ks/{selected?.path}</code>
          </>
        )}
      </div>
      <textarea
        className="code-editor"
        style={{ width: "100%", height: "calc(100vh - 260px)", minHeight: 400 }}
        value={editorContent}
        onChange={e => setEditorContent(e.target.value)}
        spellCheck={false}
      />
    </div>
  );

  // ── Builder panel
  const isUbuntu = cfg.osType === "ubuntu";
  return (
    <div>
      <ConfirmDialog dlg={dlg} onClose={() => setDlg(null)} />
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16,
        padding:"12px 16px", background:"var(--bg2)", border:"1px solid var(--bd1)",
        borderRadius:"var(--r-md)" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setMode("list")}>← 목록</button>
        <div style={{ width:1, height:20, background:"var(--bd2)", flexShrink:0 }} />
        <span style={{ fontFamily:"var(--mono)", fontSize:12, color:"var(--t2)", flex:1 }}>
          {isUbuntu ? "Ubuntu Autoinstall Builder" : "Kickstart Builder"}
        </span>
        <button className="btn btn-primary" style={{ padding:"8px 20px" }} onClick={generateFromUI}>
          {isUbuntu ? "▶ user-data 생성" : "▶ ks.cfg 생성"}
        </button>
      </div>

      {/* OS 타입 */}
      <div className="card">
        <div className="card-hd">
          <div className="card-hd-left">
            <div className="card-icon" style={{ background:"rgba(124,95,230,.12)", color:"var(--purple)" }}>◈</div>
            <div className="card-title">OS Type</div>
          </div>
        </div>
        <div className="card-body">
          <div className="os-selector">
            {[
              ["rhel",   "RHEL / Rocky", "◈", "CentOS / AlmaLinux"],
              ["ubuntu", "Ubuntu",        "◉", "Autoinstall (cloud-init)"],
            ].map(([v, title, icon, sub]) => (
              <div key={v} className={`os-btn${cfg.osType === v ? " active" : ""}`}
                onClick={() => setC("osType", v)}>
                <div className="os-btn-icon">{icon}</div>
                <div className="os-btn-label">{title}</div>
                <div style={{ fontSize:10, color:"var(--t3)", fontFamily:"var(--mono)", marginTop:3 }}>{sub}</div>
              </div>
            ))}
          </div>
          {isUbuntu && (
            <div className="info-box" style={{ marginTop:12, marginBottom:0 }}>
              Ubuntu는 <strong>cloud-init autoinstall</strong> 방식으로 생성됩니다.<br/>
              저장 시 <code style={{color:"var(--blue)"}}>ks/ubuntu/버전/호스트명/user-data</code> + meta-data 파일이 자동 생성됩니다.
            </div>
          )}
        </div>
      </div>

      {/* System */}
      <div className="card">
        <div className="card-hd">
          <div className="card-hd-left">
            <div className="card-icon" style={{ background:"rgba(11,184,212,.1)", color:"var(--cyan)" }}>◎</div>
            <div className="card-title">System</div>
          </div>
        </div>
        <div className="card-body">
        <div className="grid grid-3">
          <Field label="언어">
            <select value={cfg.lang} onChange={e => setC("lang", e.target.value)}>
              <option value="en_US.UTF-8">en_US.UTF-8</option>
              <option value="ko_KR.UTF-8">ko_KR.UTF-8</option>
            </select>
          </Field>
          <Field label="키보드">
            <select value={cfg.keyboard} onChange={e => setC("keyboard", e.target.value)}>
              <option value="us">us</option>
              <option value="kr">kr</option>
            </select>
          </Field>
          <Field label="타임존">
            <select value={cfg.timezone} onChange={e => setC("timezone", e.target.value)}>
              <option value="Asia/Seoul">Asia/Seoul</option>
              <option value="Asia/Tokyo">Asia/Tokyo</option>
              <option value="UTC">UTC</option>
              <option value="America/New_York">America/New_York</option>
            </select>
          </Field>
          <Field label="호스트명" span2>
            <input value={cfg.hostname} onChange={e => setC("hostname", e.target.value)} />
          </Field>
          {!isUbuntu && (
            <Field label="완료 후">
              <select value={cfg.onFinish} onChange={e => setC("onFinish", e.target.value)}>
                <option value="reboot">reboot</option>
                <option value="poweroff">poweroff</option>
                <option value="halt">halt</option>
              </select>
            </Field>
          )}
        </div>
        </div>
      </div>

      {/* 인증 */}
      <div className="card">
        <div className="card-hd">
          <div className="card-hd-left">
            <div className="card-icon" style={{ background:"rgba(240,78,78,.1)", color:"var(--red)" }}>◉</div>
            <div className="card-title">Authentication</div>
          </div>
        </div>
        <div className="card-body">

        {!isUbuntu ? (
          <>
            <div className="auth-section">
              <div className="auth-section-title">🔑 Root Account</div>
              <div className="auth-section-body">
              <PasswordField
                label="root 비밀번호"
                value={cfg.rootPassword}
                onChange={e => setC("rootPassword", e.target.value)}
                placeholder="root 비밀번호 입력"
              />
              </div>
            </div>
            <div className="auth-section">
              <div className="auth-section-title">👤 Additional User</div>
              <div className="auth-section-body">
              <div className="grid grid-2">
                <Field label="사용자명">
                  <input type="text" value={cfg.extraUser}
                    onChange={e => setC("extraUser", e.target.value)}
                    placeholder="user" />
                </Field>
                <PasswordField
                  label="비밀번호"
                  value={cfg.extraUserPassword}
                  onChange={e => setC("extraUserPassword", e.target.value)}
                  placeholder="사용자 비밀번호 입력"
                />
                <Field label="" span2>
                  <Toggle label="sudo(wheel) 그룹 추가" checked={cfg.extraUserSudo} onChange={v => setC("extraUserSudo", v)} />
                </Field>
              </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="auth-section">
              <div className="auth-section-title">👤 Default User</div>
              <div className="auth-section-body">
              <div className="grid grid-2">
                <Field label="사용자명">
                  <input type="text" value={cfg.extraUser}
                    onChange={e => setC("extraUser", e.target.value)}
                    placeholder="ubuntu" />
                </Field>
                <PasswordField
                  label="비밀번호"
                  value={cfg.extraUserPassword}
                  onChange={e => setC("extraUserPassword", e.target.value)}
                  placeholder="비밀번호 입력"
                />
              </div>
              </div>
            </div>
            <div className="auth-section">
              <div className="auth-section-title">🔐 SSH Settings</div>
              <div className="auth-section-body">
              <div className="grid grid-2">
                <Field label="" span2>
                  <Toggle label="SSH 비밀번호 인증 허용" checked={cfg.sshAllowPassword !== false} onChange={v => setC("sshAllowPassword", v)} />
                </Field>
                <Field label="SSH 공개키 (선택, 한 줄씩)" span2>
                  <textarea
                    value={(cfg.sshAuthorizedKeys || []).join("\n")}
                    onChange={e => setC("sshAuthorizedKeys", e.target.value.split("\n").filter(Boolean))}
                    placeholder="ssh-rsa AAAA... user@host"
                    style={{ minHeight: 60, fontFamily: "var(--mono)", fontSize: 11 }}
                  />
                </Field>
              </div>
              </div>
            </div>
            <div className="auth-section">
              <div className="auth-section-title">🌐 Network (Ubuntu)</div>
              <div className="auth-section-body">
              <div className="grid grid-2">
                <Field label="네트워크 설정">
                  <select value={cfg.networkMode || "dhcp"} onChange={e => setC("networkMode", e.target.value)}>
                    <option value="dhcp">DHCP (자동)</option>
                    <option value="static">Static IP</option>
                  </select>
                </Field>
                {cfg.networkMode === "static" && (
                  <Field label="NIC 이름">
                    <input value={cfg.nic || ""} onChange={e => setC("nic", e.target.value)}
                      placeholder="ens3, eth0, enp3s0 …"
                      style={{ fontFamily: "var(--mono)", fontSize: 12 }} />
                    <div style={{ fontSize: 10, color: "var(--t3)", fontFamily: "var(--mono)", marginTop: 4 }}>
                      ip link show 로 확인 — 미입력 시 ens3 기본값
                    </div>
                  </Field>
                )}
                {cfg.networkMode === "static" && (<>
                  <Field label="IP 주소">
                    <input value={cfg.ip || ""} onChange={e => setC("ip", e.target.value)} placeholder="192.168.1.100" />
                  </Field>
                  <Field label="Prefix (CIDR)">
                    <input value={cfg.netmask || "24"} onChange={e => setC("netmask", e.target.value)} placeholder="24" />
                  </Field>
                  <Field label="Gateway">
                    <input value={cfg.gateway || ""} onChange={e => setC("gateway", e.target.value)} placeholder="192.168.1.1" />
                  </Field>
                  <Field label="DNS">
                    <input value={cfg.dns || "8.8.8.8"} onChange={e => setC("dns", e.target.value)} placeholder="8.8.8.8" />
                  </Field>
                </>)}
              </div>
              </div>
            </div>
          </>
        )}
        </div>
      </div>

      {/* 디스크 / 파티션 */}
      <div className="card">
        <div className="card-hd">
          <div className="card-hd-left">
            <div className="card-icon" style={{ background:"rgba(240,160,32,.1)", color:"var(--yellow)" }}>◫</div>
            <div className="card-title">Disk / Partition</div>
          </div>
        </div>
        <div className="card-body">
        <div className="grid grid-2" style={{ marginBottom: 16 }}>
          <Field label="대상 디스크">
            <select value={cfg.diskMode || "auto"} onChange={e => setC("diskMode", e.target.value)}
              style={{marginBottom: cfg.diskMode === "manual" ? 6 : 0}}>
              <option value="auto">🔍 자동 (첫 번째 디스크)</option>
              <option value="manual">✏️ 수동 지정</option>
            </select>
            {cfg.diskMode === "manual" && (
              <select value={cfg.disk || "sda"} onChange={e => setC("disk", e.target.value)}>
                <option value="sda">sda (SATA/SAS)</option>
                <option value="vda">vda (VirtIO)</option>
                <option value="nvme0n1">nvme0n1 (NVMe)</option>
                <option value="hda">hda (IDE)</option>
                <option value="sdb">sdb</option>
                <option value="vdb">vdb</option>
              </select>
            )}
            {(cfg.diskMode === "auto" || !cfg.diskMode) && (
              <div style={{fontSize:10,color:"var(--t3)",marginTop:4,fontFamily:"var(--mono)"}}>
                clearpart --all --initlabel (ignoredisk 없음)
              </div>
            )}
          </Field>
          <Field label={isUbuntu ? "레이아웃" : "파티션 방식"}>
            <select
              value={isUbuntu ? (cfg.ubuntuStorage || "lvm") : cfg.partScheme}
              onChange={e => isUbuntu ? setC("ubuntuStorage", e.target.value) : setC("partScheme", e.target.value)}
            >
              {isUbuntu ? (
                <>
                  <option value="lvm">LVM (자동)</option>
                  <option value="direct">direct (단일 파티션)</option>
                  <option value="custom">수동 지정</option>
                </>
              ) : (
                <>
                  <option value="auto">자동 (autopart LVM)</option>
                  <option value="manual">수동 지정</option>
                </>
              )}
            </select>
          </Field>
          {!isUbuntu && cfg.partScheme === "auto" && (
            <>
              <Field label="LVM 타입">
                <select value={cfg.autoPartType} onChange={e => setC("autoPartType", e.target.value)}>
                  <option value="lvm">lvm</option>
                  <option value="plain">plain</option>
                  <option value="thinp">thinp</option>
                </select>
              </Field>
              <Field label="LUKS 암호화">
                <select value={cfg.autoPartEncrypted} onChange={e => setC("autoPartEncrypted", e.target.value)}>
                  <option value="no">없음</option>
                  <option value="yes">LUKS</option>
                </select>
              </Field>
            </>
          )}
        </div>

        {/* 수동 파티션 — 동적 테이블 편집기 */}
        {((isUbuntu && cfg.ubuntuStorage === "custom") || (!isUbuntu && cfg.partScheme === "manual")) && (
          <PartitionEditor
            isUbuntu={isUbuntu}
            cfg={cfg}
            setC={setC}
          />
        )}
        

        {/* RHEL 전용 보안/부트로더 설정 */}
        {!isUbuntu && (
          <div className="grid grid-2" style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--bd1)" }}>
            <Field label="SELinux">
              <select value={cfg.selinux} onChange={e => setC("selinux", e.target.value)}>
                <option value="enforcing">enforcing</option>
                <option value="permissive">permissive</option>
                <option value="disabled">disabled</option>
              </select>
            </Field>
            <Field label="SSH 포트">
              <input type="number" value={cfg.sshPort} onChange={e => setC("sshPort", e.target.value)} />
            </Field>
            <Field label="" span2>
              <Toggle label="방화벽 활성화" checked={cfg.firewallEnabled} onChange={v => setC("firewallEnabled", v)} />
            </Field>
            {cfg.firewallEnabled && (
              <Field label="방화벽 허용 서비스" span2>
                <input value={cfg.firewallServices || "ssh"} onChange={e => setC("firewallServices", e.target.value)}
                  placeholder="ssh,http,https" />
                <div style={{ fontSize:10, color:"var(--t3)", fontFamily:"var(--mono)", marginTop:4 }}>
                  쉼표 구분: ssh, http, https, nfs, samba, dns 등
                </div>
              </Field>
            )}
            <Field label="bootloader --append" span2>
              <input value={cfg.bootloaderAppend || ""} onChange={e => setC("bootloaderAppend", e.target.value)}
                placeholder="crashkernel=auto rhgb quiet" />
              <div style={{ fontSize:10, color:"var(--t3)", fontFamily:"var(--mono)", marginTop:4 }}>
                커널 부팅 파라미터 추가 (선택사항)
              </div>
            </Field>
          </div>
        )}
        </div>
      </div>


      {/* Packages */}
      <div className="card">
        <div className="card-hd">
          <div className="card-hd-left">
            <div className="card-icon" style={{ background:"rgba(13,206,138,.1)", color:"var(--green)" }}>◈</div>
            <div className="card-title">Packages</div>
          </div>
        </div>
        <div className="card-body">
        {!isUbuntu && (
          <div style={{ marginBottom: 12 }}>
            <Field label="환경 그룹">
              <select value={cfg.packageEnv} onChange={e => setC("packageEnv", e.target.value)}>
                <option value="@^graphical-server-environment">Server with GUI</option>
                <option value="@^server-product-environment">Server</option>
                <option value="@^minimal-environment">Minimal Install</option>
              </select>
            </Field>
          </div>
        )}
        {/* 설치 패키지 */}
        <div style={{ fontFamily:"var(--mono)", fontSize:10, color:"var(--t3)", letterSpacing:".08em", textTransform:"uppercase", marginBottom:6 }}>설치할 패키지</div>
        <div className="pkg-add">
          <input value={pkgInput} onChange={e => setPkgInput(e.target.value)}
            placeholder="패키지명 입력 후 Enter"
            onKeyDown={e => { if (e.key === "Enter" && pkgInput.trim()) { setC("packages", [...cfg.packages, pkgInput.trim()]); setPkgInput(""); } }} />
          <button className="btn btn-ghost" onClick={() => { if (pkgInput.trim()) { setC("packages", [...cfg.packages, pkgInput.trim()]); setPkgInput(""); } }}>추가</button>
        </div>
        <div className="pkg-list">
          {cfg.packages.map(p => (
            <div key={p} className="pkg-tag">
              {p}
              <button onClick={() => setC("packages", cfg.packages.filter(x => x !== p))}>×</button>
            </div>
          ))}
        </div>
        {/* 제외 패키지 — RHEL only */}
        {!isUbuntu && (
          <>
            <div style={{ fontFamily:"var(--mono)", fontSize:10, color:"var(--t3)", letterSpacing:".08em", textTransform:"uppercase", marginTop:14, marginBottom:6 }}>
              제외할 패키지 <span style={{ color:"var(--text4)" }}>(-pkg 형태로 생성)</span>
            </div>
            <div className="pkg-add">
              <input value={exPkgInput} onChange={e => setExPkgInput(e.target.value)}
                placeholder="제외할 패키지명 입력 후 Enter"
                onKeyDown={e => { if (e.key === "Enter" && exPkgInput.trim()) {
                  setC("excludePackages", [...(cfg.excludePackages||[]), exPkgInput.trim()]);
                  setExPkgInput("");
                }}} />
              <button className="btn btn-ghost" style={{ color:"var(--red)", borderColor:"rgba(240,82,82,.3)" }}
                onClick={() => { if (exPkgInput.trim()) {
                  setC("excludePackages", [...(cfg.excludePackages||[]), exPkgInput.trim()]);
                  setExPkgInput("");
                }}}>추가</button>
            </div>
            <div className="pkg-list">
              {(cfg.excludePackages||[]).map(p => (
                <div key={p} className="pkg-tag" style={{ borderColor:"rgba(240,82,82,.25)", color:"var(--red)" }}>
                  -{p}
                  <button onClick={() => setC("excludePackages", (cfg.excludePackages||[]).filter(x => x !== p))}>×</button>
                </div>
              ))}
            </div>
          </>
        )}
        </div>
      </div>

      {/* Scripts */}
      <div className="card">
        <div className="card-hd">
          <div className="card-hd-left">
            <div className="card-icon" style={{ background:"rgba(124,95,230,.12)", color:"var(--purple)" }}>◧</div>
            <div className="card-title">{isUbuntu ? "Late Commands" : "Scripts"}</div>
          </div>
        </div>
        <div className="card-body">

        {!isUbuntu && (
          <>
            {/* %pre */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                <div style={{ fontFamily:"var(--mono)", fontSize:11, fontWeight:600, color:"var(--yellow)" }}>
                  %pre  <span style={{ color:"var(--t3)", fontWeight:400 }}>— 설치 시작 전 실행 (디스크 감지 등)</span>
                </div>
                <div style={{ fontFamily:"var(--mono)", fontSize:10, color:"var(--t3)" }}>--log=/tmp/ks-pre.log</div>
              </div>
              <textarea value={cfg.preScript || ""} onChange={e => setC("preScript", e.target.value)}
                style={{ width:"100%", minHeight:80, fontFamily:"var(--mono)", fontSize:12,
                  background:"#030507", color:"#a8c4d8", padding:12,
                  border:"1px solid var(--bd1)", borderRadius:6, lineHeight:1.7 }}
                placeholder={"#!/bin/bash\n# 예: 디스크 자동 감지\n# DISK=$(lsblk -nd --output NAME | head -1)\n# echo \"ignoredisk --only-use=$DISK\" > /tmp/disk.cfg"}
              />
            </div>

            {/* %post */}
            <div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                <div style={{ fontFamily:"var(--mono)", fontSize:11, fontWeight:600, color:"var(--green)" }}>
                  %post  <span style={{ color:"var(--t3)", fontWeight:400 }}>— 설치 완료 후 실행 (chroot 환경)</span>
                </div>
                <div style={{ fontFamily:"var(--mono)", fontSize:10, color:"var(--t3)" }}>--log=/root/ks-post.log</div>
              </div>
              <textarea value={cfg.postScript} onChange={e => setC("postScript", e.target.value)}
                style={{ width:"100%", minHeight:120, fontFamily:"var(--mono)", fontSize:12,
                  background:"#030507", color:"#a8c4d8", padding:12,
                  border:"1px solid var(--bd1)", borderRadius:6, lineHeight:1.7 }}
                placeholder="systemctl enable sshd"
              />
            </div>
          </>
        )}

        {isUbuntu && (
          <>
            <div style={{ fontFamily:"var(--mono)", fontSize:11, color:"var(--t3)", marginBottom:8 }}>
              각 줄이 <code>{"curtin in-target -- bash -c '...'"}</code> 으로 실행됩니다.
            </div>
            <textarea value={cfg.postScript} onChange={e => setC("postScript", e.target.value)}
              style={{ width:"100%", minHeight:120, fontFamily:"var(--mono)", fontSize:12,
                background:"#030507", color:"#a8c4d8", padding:12,
                border:"1px solid var(--bd1)", borderRadius:6, lineHeight:1.7 }}
              placeholder={"systemctl enable ssh\napt install -y htop"}
            />
          </>
        )}
        </div>
      </div>

      <div className="btn-row">
        <button className="btn btn-ghost" onClick={() => setMode("list")}>취소</button>
        <button className="btn btn-primary" onClick={generateFromUI}>
          {isUbuntu ? "▶ user-data 생성" : "▶ ks.cfg 생성"}
        </button>
      </div>
    </div>

  );
}


// ── DisklessPanel ────────────────────────────────────────────────────────────
// ISO 선택 → /api/diskless/setup → 전체 자동 구성 + grub.cfg 추가
// 자동 구성:
//   ① /diskless/{os}/{ver}/root/ 생성
//   ② dnf --installroot 최소 OS 설치
//   ③ dracut (nfs 모듈) initrd 재생성 → pxelinux/ 배치
//   ④ /etc/exports NFS 항목 추가
//   ⑤ grub.cfg Diskless menuentry 자동 추가
function DisklessPanel({ loadAll, preview }) {
  const [isos,      setIsos]      = useState([]);   // /api/diskless/status 응답
  const [nfsSrv,    setNfsSrv]    = useState("");
  const [loading,   setLoading]   = useState(true);
  const [selIso,      setSelIso]      = useState("");   // 선택한 ISO path
  const [label,       setLabel]       = useState("");
  const [pkgInput,    setPkgInput]    = useState("");
  const [packages,    setPackages]    = useState([]);
  const [rootPw,      setRootPw]      = useState("");
  const [extraUser,   setExtraUser]   = useState("");
  const [extraPw,     setExtraPw]     = useState("");
  const [extraSudo,   setExtraSudo]   = useState(true);
  const [showRootPw,  setShowRootPw]  = useState(false);
  const [showExtraPw, setShowExtraPw] = useState(false);
  const [jobId,       setJobId]       = useState(null);
  const [jobData,     setJobData]     = useState(null);
  const [addSaved,    setAddSaved]    = useState(false);
  const addSavedTimer = useRef(null);
  const logRef = useRef();

  // ── ISO + 상태 로드
  const loadStatus = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/diskless/status`);
      const d = await r.json();
      setNfsSrv(d.nfs_server || "");
      setIsos(d.isos || []);
    } catch { setIsos([]); }
    setLoading(false);
  };
  useEffect(() => { loadStatus(); }, []);

  // ── job 폴링
  useEffect(() => {
    if (!jobId) return;
    const id = setInterval(async () => {
      try {
        const r = await fetch(`${API}/api/jobs/${jobId}`);
        const d = await r.json();
        setJobData(d);
        if (d.status !== "running") {
          clearInterval(id);
          if (d.status === "done") { await loadAll(); await loadStatus(); }
        }
      } catch {}
    }, 1000);
    return () => clearInterval(id);
  }, [jobId]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [jobData?.log]);

  const selInfo  = isos.find(i => i.path === selIso);
  const isRunning = jobData?.status === "running";
  const isDone    = jobData?.status === "done";
  const isFailed  = jobData?.status === "failed";

  // grub menuentry 미리보기 — 백엔드 _grub_hook과 동일한 파라미터 사용
  const entryPreview = selInfo ? (() => {
    const lbl = label || `Dskless: ${selInfo.os_name.charAt(0).toUpperCase()+selInfo.os_name.slice(1)} ${selInfo.os_ver} x86-64`;
    // nfs_root 형식: "nfs:{srv}:{path}" → srv / path 분리
    const nfsMatch  = (selInfo.nfs_root || "").match(/^nfs:([^:]+):(.+)$/);
    const nfsSrv    = nfsMatch ? nfsMatch[1] : "192.168.200.254";
    const nfsPath   = nfsMatch ? nfsMatch[2] : selInfo.root_path || "";
    return (
      `menuentry '${lbl}' {\n` +
      `  echo 'Loading vmlinuz ...'\n` +
      `  linuxefi (tftp)/pxelinux/${selInfo.os_name}/${selInfo.ver_dir}/vmlinuz \\\\\n` +
      `    root=/dev/nfs \\\\\n` +
      `    nfsroot=${nfsSrv}:${nfsPath},vers=3,tcp,rw \\\\\n` +
      `    ip=dhcp rd.neednet=1 rd.net.timeout.carrier=30 \\\\\n` +
      `    selinux=0 ipv6.disable=1\n` +
      `  echo 'Loading initrd.img ...'\n` +
      `  initrdefi (tftp)/pxelinux/${selInfo.os_name}/${selInfo.ver_dir}/initrd.img\n` +
      `}`
    );
  })() : "";

  // ── 자동 구성 실행
  async function runSetup() {
    if (!selIso) return;
    setJobData({ status: "running", log: ["🚀 Diskless 자동 구성 시작…"], progress: 2 });
    setJobId(null);
    try {
      const r = await fetch(`${API}/api/diskless/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          iso_path: selIso, label, packages,
          rootPassword: rootPw,
          extraUser:    extraUser.trim(),
          extraPassword: extraPw,
          extraSudo,
        }),
      });
      const d = await r.json();
      if (d.job_id) setJobId(d.job_id);
      else setJobData({ status: "failed", log: [`❌ ${d.error || "Unknown error"}`], progress: 0 });
    } catch (e) {
      setJobData({ status: "failed", log: [`❌ 연결 실패: ${e.message}`], progress: 0 });
    }
  }

  // ── rootfs 있으면 grub.cfg에만 추가
  async function addEntryOnly() {
    if (!selInfo) return;
    const r = await fetch(`${API}/api/grub/nfs-build`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        os_name: selInfo.os_name, ver_dir: selInfo.ver_dir,
        type: "diskless", label,
      }),
    });
    const d = await r.json();
    if (d.ok) {
      setAddSaved(true);
      clearTimeout(addSavedTimer.current);
      addSavedTimer.current = setTimeout(() => setAddSaved(false), 3000);
      await loadAll();
    }
  }

  async function setPasswd() {
    if (!selInfo) return;
    const r = await fetch(`${API}/api/diskless/passwd`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        os_name: selInfo.os_name, ver_dir: selInfo.ver_dir,
        rootPassword: rootPw,
        extraUser:    extraUser.trim(),
        extraPassword: extraPw,
        extraSudo,
      }),
    });
    const d = await r.json();
    if (d.ok) {
      setJobData({
        status: "done",
        progress: 100,
        log: ["✅ 계정 설정 완료", ...(d.messages || [])],
      });
    } else {
      setJobData({
        status: "failed",
        progress: 0,
        log: [`❌ ${d.error || "Unknown error"}`],
      });
    }
  }

  return (
    <div>
      <div className="info-box">
        ISO를 선택하면 <strong>전체 Diskless 환경을 자동 구성</strong>합니다.<br/>
        <span style={{color:"var(--t2)",lineHeight:2}}>
          ① <code style={{color:"var(--blue)"}}>{"  /diskless/{os}/{ver}/root/"}</code> 디렉터리 생성<br/>
          ② <code style={{color:"var(--blue)"}}>dnf --installroot</code> 최소 OS 설치<br/>
          ③ <code style={{color:"var(--blue)"}}>dracut --add "network nfs"</code> initrd 재생성 → <code style={{color:"var(--blue)"}}>pxelinux/</code> 배치 (NFS 모듈 포함 검증)<br/>
          ④ <code style={{color:"var(--blue)"}}>/etc/exports</code> NFS 항목 추가 + nfs-server 활성화 + 방화벽 설정<br/>
          ⑤ TFTP 퍼미션 / SELinux 레이블 적용, grubx64.efi 존재 확인<br/>
          ⑥ grub.cfg Diskless menuentry 자동 추가 (<code style={{color:"var(--blue)"}}>(tftp)/pxelinux/…</code>)
        </span>
      </div>

      {/* ISO 선택 카드 */}
      <div className="card">
        <div className="card-hd">
          <div className="card-hd-left">
            <div className="card-icon" style={{background:"rgba(77,139,245,.12)",color:"var(--blue)"}}>◎</div>
            <div>
              <div className="card-title">ISO 선택</div>
              <div className="card-sub">
                {loading ? "ISO 목록 로딩 중…" :
                 `${isos.length}개 ISO · NFS: ${nfsSrv || "자동감지"}`}
              </div>
            </div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {addSaved && <span className="save-toast">✓ grub.cfg 추가됨</span>}
            <button className="btn btn-ghost btn-sm" onClick={loadStatus} title="새로고침">↻</button>
          </div>
        </div>
        <div className="card-body">
          {/* ISO 드롭다운 */}
          <Field label="ISO 파일">
            <select value={selIso}
              onChange={e => { setSelIso(e.target.value); setLabel(""); setJobData(null); setJobId(null); }}
              disabled={isRunning}>
              <option value="">— ISO 선택 —</option>
              {isos.length === 0 && !loading && (
                <option disabled>ISO 없음 — /srv/pxe-manager/iso/ 에 파일을 추가하세요</option>
              )}
              {isos.map(iso => (
                <option key={iso.path} value={iso.path}>
                  [{iso.os_name.toUpperCase()}] {iso.name} ({iso.size})
                  {iso.root_ok ? " ✓ 배포됨" : ""}
                </option>
              ))}
            </select>
          </Field>

          {/* 선택된 ISO 상태 표시 */}
          {selInfo && (
            <div style={{marginTop:14}}>
              {/* OS + 버전 + 상태 배지 */}
              <div style={{display:"flex",gap:8,marginBottom:12,alignItems:"center",flexWrap:"wrap"}}>
                <span style={{fontFamily:"var(--mono)",fontSize:12,fontWeight:600,color:"var(--t1)"}}>
                  {selInfo.os_name.charAt(0).toUpperCase()+selInfo.os_name.slice(1)} {selInfo.os_ver}
                </span>
                <span style={{fontFamily:"var(--mono)",fontSize:10,
                  padding:"2px 9px",borderRadius:10,
                  background:"rgba(77,139,245,.1)",color:"var(--blue)",
                  border:"1px solid rgba(77,139,245,.3)"}}>
                  {selInfo.ver_dir}
                </span>
                <span style={{marginLeft:"auto",fontFamily:"var(--mono)",fontSize:10,
                  padding:"2px 9px",borderRadius:10,fontWeight:600,
                  background: selInfo.root_ok ? "rgba(13,206,138,.1)" : "rgba(240,160,32,.1)",
                  color: selInfo.root_ok ? "var(--green)" : "var(--yellow)",
                  border: `1px solid ${selInfo.root_ok ? "rgba(13,206,138,.3)" : "rgba(240,160,32,.3)"}`,
                }}>
                  {selInfo.root_ok ? "✓ rootfs 있음" : "미구성"}
                </span>
              </div>

              {/* 경로 상태 */}
              <div style={{background:"var(--bg4)",border:"1px solid var(--bd2)",
                borderRadius:"var(--r-md)",marginBottom:14}}>
                {[
                  { label:"커널",   path:`(tftp)/pxelinux/${selInfo.os_name}/${selInfo.ver_dir}/vmlinuz`,    ok:selInfo.kern_ok },
                  { label:"initrd", path:`(tftp)/pxelinux/${selInfo.os_name}/${selInfo.ver_dir}/initrd.img`, ok:selInfo.initrd_ok },
                  { label:"rootfs", path:selInfo.root_path,                                                   ok:selInfo.root_ok },
                  { label:"NFS",    path:selInfo.nfs_root,                                                    ok:selInfo.root_ok },
                ].map(({label:lbl, path, ok}, i, arr) => (
                  <div key={lbl} style={{display:"flex",alignItems:"center",gap:8,
                    padding:"8px 14px",
                    borderBottom:i<arr.length-1?"1px solid var(--bd1)":"none"}}>
                    <span style={{fontFamily:"var(--mono)",fontSize:9,color:"var(--t3)",
                      textTransform:"uppercase",width:52,flexShrink:0}}>{lbl}</span>
                    <span style={{width:7,height:7,borderRadius:"50%",flexShrink:0,
                      background:ok?"var(--green)":"var(--yellow)",
                      boxShadow:ok?"0 0 5px var(--green-glow)":"none"}}/>
                    <span style={{fontFamily:"var(--mono)",fontSize:11,
                      color:ok?"var(--t2)":"var(--yellow)",
                      overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>
                      {path}
                    </span>
                    {!ok && <span style={{fontFamily:"var(--mono)",fontSize:10,
                      color:"var(--yellow)",flexShrink:0}}>없음</span>}
                  </div>
                ))}
              </div>

              {/* 메뉴 표시명 */}
              <Field label="grub 메뉴 표시명" style={{marginBottom:14}}>
                <input value={label}
                  onChange={e => setLabel(e.target.value)}
                  placeholder={`Dskless: ${selInfo.os_name.charAt(0).toUpperCase()+selInfo.os_name.slice(1)} ${selInfo.os_ver} x86-64`}
                  disabled={isRunning} />
              </Field>

              {/* 계정 설정 */}
              <div style={{background:"var(--bg4)",border:"1px solid var(--bd2)",
                borderRadius:"var(--r-md)",padding:"14px 16px",marginBottom:16}}>
                <div style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--t3)",
                  textTransform:"uppercase",letterSpacing:".1em",marginBottom:12}}>
                  계정 설정 <span style={{color:"var(--t4)",fontWeight:400}}>— 비워두면 자동 생성 (로그에 표시)</span>
                </div>
                <div className="grid grid-2" style={{gap:10,marginBottom:10}}>
                  <Field label="root 패스워드">
                    <div className="pw-wrap">
                      <input type={showRootPw?"text":"password"} value={rootPw}
                        onChange={e=>setRootPw(e.target.value)}
                        placeholder="비워두면 자동생성"
                        disabled={isRunning}/>
                      <button className="pw-toggle" onClick={()=>setShowRootPw(v=>!v)}
                        type="button">{showRootPw?"🙈":"👁"}</button>
                    </div>
                  </Field>
                  <div/>
                </div>
                <div className="grid grid-2" style={{gap:10,marginBottom:8}}>
                  <Field label="추가 계정 (선택)">
                    <input value={extraUser} onChange={e=>setExtraUser(e.target.value)}
                      placeholder="예: admin"
                      disabled={isRunning}/>
                  </Field>
                  <Field label="추가 계정 패스워드">
                    <div className="pw-wrap">
                      <input type={showExtraPw?"text":"password"} value={extraPw}
                        onChange={e=>setExtraPw(e.target.value)}
                        placeholder="비워두면 자동생성"
                        disabled={isRunning||!extraUser}/>
                      <button className="pw-toggle" onClick={()=>setShowExtraPw(v=>!v)}
                        type="button" disabled={!extraUser}>{showExtraPw?"🙈":"👁"}</button>
                    </div>
                  </Field>
                </div>
                {extraUser && (
                  <label style={{display:"flex",alignItems:"center",gap:7,
                    fontSize:11,fontFamily:"var(--mono)",color:"var(--t2)",cursor:"pointer"}}>
                    <input type="checkbox" checked={extraSudo}
                      onChange={e=>setExtraSudo(e.target.checked)}
                      disabled={isRunning}/>
                    wheel 그룹 추가 (sudo 권한)
                  </label>
                )}
              </div>

              {/* 추가 패키지 */}
              <div style={{marginBottom:16}}>
                <div style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--t3)",
                  textTransform:"uppercase",letterSpacing:".08em",marginBottom:6}}>
                  추가 패키지 <span style={{color:"var(--t4)"}}>— 기본 최소 설치 외 추가 (선택)</span>
                </div>
                <div className="pkg-add">
                  <input value={pkgInput}
                    onChange={e => setPkgInput(e.target.value)}
                    placeholder="vim, curl, htop …"
                    disabled={isRunning}
                    onKeyDown={e => { if(e.key==="Enter"&&pkgInput.trim()){
                      setPackages(p=>[...p,pkgInput.trim()]); setPkgInput("");
                    }}}/>
                  <button className="btn btn-ghost"
                    disabled={isRunning}
                    onClick={() => { if(pkgInput.trim()){ setPackages(p=>[...p,pkgInput.trim()]); setPkgInput(""); }}}>
                    추가
                  </button>
                </div>
                {packages.length > 0 && (
                  <div className="pkg-list" style={{marginTop:8}}>
                    {packages.map(p => (
                      <div key={p} className="pkg-tag">
                        {p}
                        <button onClick={() => setPackages(prev => prev.filter(x => x!==p))}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 액션 버튼 */}
              <div style={{display:"flex",gap:8}}>
                {!selInfo.root_ok ? (
                  /* rootfs 없음 → 전체 자동 구성 */
                  <button className="btn btn-primary"
                    style={{flex:1,padding:"11px",fontSize:12,justifyContent:"center"}}
                    onClick={runSetup}
                    disabled={isRunning}>
                    {isRunning
                      ? <><span className="pulse" style={{marginRight:6}}>●</span>Diskless 구성 중…</>
                      : "▶  Diskless 자동 구성  (① ~ ⑤ 전체 실행)"}
                  </button>
                ) : (
                  /* rootfs 있음 → 재구성 or grub만 추가 or 패스워드 설정 */
                  <>
                    <button className="btn btn-ghost"
                      style={{flex:1,padding:"11px",fontSize:12,justifyContent:"center"}}
                      onClick={runSetup}
                      disabled={isRunning}>
                      {isRunning ? "⏳ 재구성 중…" : "↺ rootfs 재구성"}
                    </button>
                    <button className="btn btn-ghost"
                      style={{padding:"11px 16px",fontSize:12}}
                      onClick={setPasswd}
                      disabled={isRunning}
                      title="rootfs에 chroot해서 패스워드/계정만 즉시 설정">
                      🔑 계정 설정
                    </button>
                    <button className="btn btn-primary"
                      style={{padding:"11px 20px",fontSize:12}}
                      onClick={addEntryOnly}>
                      ▶ grub.cfg에만 추가
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {!selIso && !loading && (
            <div style={{padding:"24px 0",textAlign:"center",
              fontFamily:"var(--mono)",fontSize:12,color:"var(--t3)"}}>
              ISO를 선택하면 자동으로 Diskless 환경을 구성합니다.
            </div>
          )}
        </div>
      </div>

      {/* 구성 진행 로그 */}
      {jobData && (
        <div className="card">
          <div className="card-hd">
            <div className="card-hd-left">
              <div className="card-icon" style={{background:"rgba(124,95,230,.12)",color:"var(--purple)"}}>◧</div>
              <div className="card-title">Diskless 구성 로그</div>
            </div>
            <span className={`badge badge-${jobData.status}`}
              style={{minWidth:60,justifyContent:"center"}}>
              {isRunning&&<span className="pulse" style={{marginRight:3}}>●</span>}
              {isRunning?"실행 중":isDone?"✓ 완료":isFailed?"✗ 실패":jobData.status}
            </span>
          </div>
          {/* 진행 바 */}
          <div style={{height:3,background:"var(--bd2)"}}>
            <div style={{height:"100%",
              background:isDone?"var(--green)":isFailed?"var(--red)":"var(--blue)",
              width:isDone||isFailed?"100%":"60%",
              transition:"width .5s",
              animation:isRunning?"indeterminate 2s linear infinite":"none"}}/>
          </div>
          <div className="terminal-bar" style={{margin:"12px 16px 0"}}>
            <div className="tdot" style={{background:"#ff5f56"}}/>
            <div className="tdot" style={{background:"#ffbd2e"}}/>
            <div className="tdot" style={{background:"#27c93f"}}/>
            <span style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--t3)",marginLeft:6}}>
              diskless setup — {jobData.log?.length||0} lines
            </span>
          </div>
          <div className="terminal" style={{margin:"8px 16px 16px"}} ref={logRef}>
            {(jobData.log||[]).map((l,i)=>(
              <div key={i} className={
                l.startsWith("✅")||l.startsWith("[+]")?"log-ok":
                l.startsWith("❌")||l.startsWith("[✗]")?"log-err":
                l.startsWith("[!]")?"log-warn":""}>
                <span className="lnum">{String(i+1).padStart(3,"0")}</span>{l}
              </div>
            ))}
            {isRunning&&<div className="pulse" style={{color:"var(--blue)"}}>▊</div>}
          </div>
          {isDone&&(
            <div style={{padding:"12px 16px",background:"rgba(13,206,138,.08)",
              borderTop:"1px solid rgba(13,206,138,.2)",
              fontFamily:"var(--mono)",fontSize:12,
              display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:18}}>✅</span>
              <div>
                <div style={{color:"var(--green)",fontWeight:600,marginBottom:4}}>Diskless 구성 완료</div>
                <div style={{color:"var(--t2)",fontSize:11,lineHeight:1.8}}>
                  {selInfo && <>
                    <span style={{color:"var(--blue)"}}>grub.cfg</span> — menuentry 탭에서 확인<br/>
                    <span style={{color:"var(--t3)"}}>nfsroot: </span>
                    <span style={{color:"var(--cyan)"}}>{selInfo.nfs_root}</span><br/>
                    <span style={{color:"var(--t3)"}}>vmlinuz: </span>
                    <span style={{color:"var(--cyan)"}}>(tftp)/pxelinux/{selInfo.os_name}/{selInfo.ver_dir}/vmlinuz</span><br/>
                    <span style={{color:"var(--t3)"}}>NFS 검증: </span>
                    <span style={{color:"var(--yellow)"}}>exportfs -v | grep {selInfo.root_path?.split("/").slice(0,4).join("/")}</span><br/>
                    <span style={{color:"var(--t3)"}}>root 계정: </span>
                    <span style={{color:"var(--green)"}}>
                      {rootPw ? "패스워드 설정됨" : "자동생성 — 로그 맨 아래 확인"}
                    </span>
                    {extraUser && <><br/>
                      <span style={{color:"var(--t3)"}}>추가 계정: </span>
                      <span style={{color:"var(--green)"}}>{extraUser}{extraSudo?" (wheel)":""} — {extraPw?"패스워드 설정됨":"자동생성 (로그 확인)"}</span>
                    </>}
                  </>}
                </div>
              </div>
            </div>
          )}
          {isFailed&&(
            <div style={{padding:"12px 16px",background:"rgba(240,78,78,.08)",
              borderTop:"1px solid rgba(240,78,78,.2)",
              fontFamily:"var(--mono)",fontSize:11,lineHeight:1.8}}>
              <div style={{color:"var(--red)",fontWeight:600,marginBottom:4}}>✗ 구성 실패 — 로그에서 원인 확인</div>
              <div style={{color:"var(--t2)"}}>
                주요 점검 항목:<br/>
                <span style={{color:"var(--yellow)"}}>· NFS 모듈 미포함</span> → 호스트에서 <code>dnf install -y nfs-utils dracut-network</code> 후 재시도<br/>
                <span style={{color:"var(--yellow)"}}>· dracut 실패</span> → <code>dracut --version</code> 확인, kernel-devel 설치<br/>
                <span style={{color:"var(--yellow)"}}>· ISO 마운트 실패</span> → ISO 파일 무결성 확인<br/>
                <span style={{color:"var(--yellow)"}}>· grubx64.efi 없음</span> → <code>/var/lib/tftpboot/grubx64.efi</code> 수동 배치 필요
              </div>
            </div>
          )}
        </div>
      )}

      {/* menuentry 미리보기 (job 없을 때만) */}
      {entryPreview && !jobData && (
        <div className="card">
          <div className="card-hd">
            <div className="card-hd-left">
              <div className="card-icon" style={{background:"rgba(124,95,230,.12)",color:"var(--purple)"}}>◧</div>
              <div className="card-title">생성될 menuentry</div>
            </div>
          </div>
          <pre style={{fontFamily:"var(--mono)",fontSize:11,color:"#7a9ab0",lineHeight:1.9,
            padding:"14px 18px",background:"#020409",margin:0,whiteSpace:"pre-wrap"}}>
            {entryPreview}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Tab: grub.cfg ─────────────────────────────────────────────────────────────

function GrubTab() {
  const [isos, setIsos]       = useState([]);
  const [ksList, setKsList]   = useState([]);
  const [ksEntries, setKsEntries] = useState([]);
  const [isoPath, setIsoPath] = useState("");
  const [jobId, setJobId]     = useState(null);
  const [jobData, setJobData] = useState(null);
  const [preview, setPreview] = useState("");
  const [editMode, setEditMode]     = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving]   = useState(false);
  const [showNewKs,    setShowNewKs]    = useState(false);
  const [newKsName,    setNewKsName]    = useState("");
  const [newKsContent, setNewKsContent] = useState("");
  const [grubSubTab,    setGrubSubTab]    = useState("install");
  const [grubEntries,   setGrubEntries]   = useState([]);
  const [editingId,     setEditingId]     = useState(null);
  const [savingEntries, setSavingEntries] = useState(false);
  const [entrySaved,    setEntrySaved]    = useState(false);
  const entrySavedTimer = useRef(null);
  const logRef = useRef();
  const [dlg, setDlg] = useState(null);  // ConfirmDialog 상태

  function parseGrubCfg(text) {
    const result = [];
    const re = /menuentry\s+['"]([^'"]+)['"]/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const bStart = text.indexOf("{", m.index);
      if (bStart === -1) continue;
      let depth=0, i=bStart;
      for(;i<text.length;i++){
        if(text[i]==="{")depth++;
        else if(text[i]==="}"){depth--;if(depth===0)break;}
      }
      const raw=text.slice(m.index,i+1).trim();
      const body=text.slice(bStart+1,i);
      const type=body.includes("inst.ks=")?"ks"
                :body.includes("/diskless/")?"diskless"
                :body.includes("inst.repo=")?"install":"base";
      result.push({id:m.index,label:m[1],raw,type});
    }
    return result;
  }

  function extractHeader(text) {
    const lines=text.split("\n"),hdr=[];
    for(const l of lines){if(/^menuentry/.test(l.trim()))break;hdr.push(l);}
    while(hdr.length&&!hdr[hdr.length-1].trim())hdr.pop();
    return hdr.join("\n");
  }

  async function saveEntries(entries) {
    const header=extractHeader(preview);
    const body=entries.map(e=>e.raw).join("\n\n");
    const updated=(header?header+"\n\n":"")+body+"\n";
    setSavingEntries(true);
    await fetch(`${API}/api/grub/save`,{
      method:"PUT",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({content:updated}),
    });
    setSavingEntries(false);
    setPreview(updated);
    setGrubEntries(parseGrubCfg(updated));
    setEntrySaved(true);
    clearTimeout(entrySavedTimer.current);
    entrySavedTimer.current=setTimeout(()=>setEntrySaved(false),3000);
  }

  const loadAll = useCallback(async () => {
    try {
      const [isoRes, ksRes, grubRes] = await Promise.all([
        fetch(`${API}/api/isos`),
        fetch(`${API}/api/ks`),
        fetch(`${API}/api/grub/preview`),
      ]);
      const isoData  = await isoRes.json();
      const ksData   = await ksRes.json();
      const grubData = await grubRes.json();
      setIsos(isoData.isos || []);
      const files = ksData.files || [];
      setKsList(files);
      // ksEntries 동기화: 새 파일 추가, 삭제된 파일 제거
      setKsEntries(prev => {
        const prevMap = Object.fromEntries(prev.map(e => [e.path, e]));
        return files.map(f => prevMap[f.path] || {
          path: f.path,
          label: f.path.split("/").pop().replace(".ks", ""),
          checked: false,
        });
      });
      const grubText=grubData.content||"";
      setPreview(grubText);
      if(grubText.includes("menuentry"))setGrubEntries(parseGrubCfg(grubText));
    } catch {}
  }, []);

  useEffect(() => { loadAll(); }, []);

  // 폴링
  useEffect(() => {
    if (!jobId) return;
    const id = setInterval(async () => {
      try {
        const r = await fetch(`${API}/api/jobs/${jobId}`);
        const d = await r.json();
        setJobData(d);
        if (d.status !== "running") {
          clearInterval(id);
          if (d.status === "done") setTimeout(loadAll, 1200);
        }
      } catch {}
    }, 800);
    return () => clearInterval(id);
  }, [jobId]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [jobData?.log]);

  function setF(k, v) { setForm(p => ({ ...p, [k]: v })); }

  function selectIso(path) {
    setIsoPath(path);
  }

  async function runBuild() {
    const checked = ksEntries.filter(e => e.checked);
    setJobData({ status: "running", log: ["🚀 grub.cfg 생성 시작..."], progress: 2 });
    setJobId(null);
    try {
      const r = await fetch(`${API}/api/grub/build`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          iso_path: isoPath,
          ks_entries: checked.map(e => ({ path: e.path, label: e.label })),
        }),
      });
      const d = await r.json();
      if (d.job_id) setJobId(d.job_id);
      else setJobData({ status: "failed", log: [`❌ ${d.error || "Unknown"}`], progress: 0 });
    } catch (e) {
      setJobData({ status: "failed", log: [`❌ 연결 실패: ${e.message}`], progress: 0 });
    }
  }

  async function saveGrub() {
    setSaving(true);
    await fetch(`${API}/api/grub/save`,{method:"PUT",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({content:editContent})});
    setSaving(false);
    setPreview(editContent);
    setGrubEntries(parseGrubCfg(editContent));
    setEditMode(false);
    setTimeout(loadAll,400);
  }

  async function deleteKs(path) {
    setDlg({
      msg: `다음 Kickstart 파일을 삭제하시겠습니까?\n\n${path}`,
      onOk: async () => {
        await fetch(`${API}/api/ks/${path}`, { method: "DELETE" });
        loadAll();
      },
    });
  }

  async function saveNewKs() {
    if (!newKsName) {
      setDlg({ msg: "파일명을 입력하세요 (예: 9.6/minimal.ks)", onOk: () => {}, okLabel: "확인" });
      return;
    }
    const name = newKsName.endsWith(".ks") ? newKsName : newKsName + ".ks";
    await fetch(`${API}/api/ks/${name}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: newKsContent || "# Kickstart\n" }),
    });
    setNewKsName(""); setNewKsContent(""); setShowNewKs(false);
    loadAll();
  }

  function toggleKs(path)        { setKsEntries(p => p.map(e => e.path===path ? {...e,checked:!e.checked} : e)); }
  function updateLabel(path, lbl) { setKsEntries(p => p.map(e => e.path===path ? {...e,label:lbl} : e)); }

  const checkedCount = ksEntries.filter(e => e.checked).length;
  const status = jobData?.status || "idle";
  const pct    = jobData?.progress || 0;

  return (
    <div>
      <ConfirmDialog dlg={dlg} onClose={() => setDlg(null)} />
      {/* ── 서브탭: 일반 설치 / Diskless ── */}
      <div style={{display:"flex",gap:6,marginBottom:14}}>
        {[
          {id:"install",  label:"💿 OS 설치 (Kickstart)",  sub:"ISO → grub.cfg 생성"},
          {id:"diskless", label:"🌐 Diskless 부팅",         sub:"NFS/iSCSI rootfs 부팅"},
        ].map(t => (
          <button key={t.id}
            className="btn"
            style={{
              flex:1, padding:"12px 16px", borderRadius:"var(--r-md)",
              background: grubSubTab===t.id ? "var(--blue-dim)" : "var(--bg2)",
              border: `1px solid ${grubSubTab===t.id ? "var(--blue)" : "var(--bd2)"}`,
              color: grubSubTab===t.id ? "var(--blue)" : "var(--t3)",
              display:"flex", flexDirection:"column", alignItems:"flex-start", gap:3,
              textTransform:"none", letterSpacing:0,
            }}
            onClick={() => setGrubSubTab(t.id)}>
            <span style={{fontSize:12,fontWeight:600,fontFamily:"var(--mono)"}}>{t.label}</span>
            <span style={{fontSize:10,color: grubSubTab===t.id ? "var(--blue)" : "var(--t3)",fontFamily:"var(--mono)"}}>{t.sub}</span>
          </button>
        ))}
      </div>

      {/* ── Diskless 패널 ── */}
      {grubSubTab === "diskless" && <DisklessPanel loadAll={loadAll} preview={preview} />}

      {/* ── 1. ISO 선택 + KS 연결 ── */}
      {grubSubTab === "install" && <div className="card">
        <div className="card-hd">
          <div className="card-hd-left">
            <div className="card-icon" style={{background:"rgba(77,139,245,.12)",color:"var(--blue)"}}>◎</div>
            <div>
              <div className="card-title">grub.cfg Builder</div>
              <div className="card-sub">ISO 선택 → KS 연결 → 생성</div>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={loadAll}>↻ 새로고침</button>
        </div>
        <div className="info-box">
          ISO를 선택하고 연결할 Kickstart 파일을 체크하세요.<br/>
          각 KS 파일이 grub 메뉴 항목 하나로 추가됩니다. 여러 개 선택 가능합니다.
        </div>

        {/* ISO 선택 */}
        <div className="section-label">① ISO 선택</div>
        <div style={{marginBottom:20}}>
          <Field label="ISO 파일">
            <select value={isoPath} onChange={e => selectIso(e.target.value)}>
              <option value="">— /opt/iso/ 에서 선택 —</option>
              {isos.map(iso => (
                <option key={iso.path} value={iso.path}>
                  [{iso.os.toUpperCase()}] {iso.name} ({iso.size})
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/* KS 파일 관리 + 선택 */}
        <div className="section-label">② Kickstart 파일 선택 및 관리</div>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
          <span style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--t3)",flex:1}}>
            {checkedCount > 0 ? `${checkedCount}개 선택됨 → grub 메뉴 ${checkedCount}개 생성` : "선택 없음 → 기본 설치 메뉴만 생성"}
          </span>
          <button className="btn btn-ghost" style={{fontSize:10,padding:"3px 10px"}}
            onClick={() => setKsEntries(p => p.map(e => ({...e,checked:true})))}>전체선택</button>
          <button className="btn btn-ghost" style={{fontSize:10,padding:"3px 10px"}}
            onClick={() => setKsEntries(p => p.map(e => ({...e,checked:false})))}>전체해제</button>
          <button className="btn btn-ghost" style={{fontSize:10,padding:"3px 10px",color:"var(--green)",borderColor:"rgba(34,197,94,.3)"}}
            onClick={() => setShowNewKs(v => !v)}>
            {showNewKs ? "▲ 닫기" : "+ 새 KS 파일"}
          </button>
        </div>

        {/* 새 KS 파일 인라인 생성 */}
        {showNewKs && (
          <div style={{background:"var(--bg3)",border:"1px solid var(--bd2)",borderRadius:6,padding:14,marginBottom:12}}>
            <div style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--blue)",marginBottom:10}}>새 Kickstart 파일 생성</div>
            <div style={{display:"flex",gap:8,marginBottom:8}}>
              <input value={newKsName} onChange={e => setNewKsName(e.target.value)}
                placeholder="경로/파일명.ks  (예: 9.6/minimal.ks)"
                style={{flex:1,fontSize:12}} />
              <button className="btn btn-success" style={{fontSize:11}} onClick={saveNewKs}>저장</button>
              <button className="btn btn-ghost"   style={{fontSize:11}} onClick={() => {setShowNewKs(false);setNewKsName("");setNewKsContent("");}}>취소</button>
            </div>
            <textarea value={newKsContent} onChange={e => setNewKsContent(e.target.value)}
              placeholder="# Kickstart 내용 — 비워두면 빈 파일로 생성됩니다."
              style={{width:"100%",height:100,fontFamily:"var(--mono)",fontSize:11,
                background:"#030507",color:"#a8c4d8",padding:10,
                border:"1px solid var(--bd1)",borderRadius:4,lineHeight:1.7}} />
          </div>
        )}

        {/* KS 파일 목록 */}
        {ksEntries.length === 0 ? (
          <div style={{padding:"14px 0",fontFamily:"var(--mono)",fontSize:12,color:"var(--t3)"}}>
            KS 파일 없음 — [+ 새 KS 파일] 버튼으로 추가하거나 Kickstart 탭에서 생성하세요.
          </div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:14}}>
            {ksEntries.map(e => (
              <div key={e.path} style={{
                display:"flex",alignItems:"center",gap:10,
                padding:"9px 12px",
                background: e.checked ? "rgba(59,130,246,.08)" : "var(--bg3)",
                border:`1px solid ${e.checked ? "var(--blue)" : "var(--bd1)"}`,
                borderRadius:5,transition:"all .15s",
              }}>
                {/* 체크박스 */}
                <input type="checkbox" checked={e.checked} onChange={() => toggleKs(e.path)}
                  style={{width:15,height:15,cursor:"pointer",accentColor:"var(--blue)",flexShrink:0}} />

                {/* 순서 번호 */}
                {e.checked && (
                  <div style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--blue)",
                    background:"rgba(59,130,246,.15)",borderRadius:3,padding:"1px 6px",flexShrink:0}}>
                    #{ksEntries.filter(x => x.checked).findIndex(x => x.path === e.path) + 1}
                  </div>
                )}

                {/* KS 경로 */}
                <div style={{fontFamily:"var(--mono)",fontSize:12,
                  color: e.checked ? "var(--t1)" : "var(--t2)",flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  <span style={{color:"var(--t3)"}}>/ks/</span>{e.path}
                </div>

                {/* 메뉴 표시명 */}
                <input value={e.label} onChange={ev => updateLabel(e.path, ev.target.value)}
                  placeholder="grub 메뉴 표시명"
                  title="grub 부팅 메뉴에 표시될 이름"
                  style={{width:170,fontSize:11,padding:"4px 8px",
                    background:"var(--bg)",border:"1px solid var(--bd2)",borderRadius:4,flexShrink:0}} />

                {/* inst.ks URL */}
                {e.checked && (
                  <div style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--t3)",
                    flexShrink:0,maxWidth:220,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}
                    title={`inst.ks=http://[PXE-IP]/ks/${e.path}`}>
                    …/ks/{e.path}
                  </div>
                )}

                {/* 삭제 버튼 */}
                <button className="btn btn-danger" style={{padding:"2px 8px",fontSize:10,flexShrink:0}}
                  onClick={() => deleteKs(e.path)}>삭제</button>
              </div>
            ))}
          </div>
        )}

        <div className="btn-row">
          <button className="btn btn-primary"
            onClick={runBuild}
            disabled={!isoPath || status === "running"}>
            {status === "running"
              ? "⏳ 생성 중..."
              : checkedCount > 0
                ? `▶ grub.cfg 생성 (KS ${checkedCount}개 포함)`
                : "▶ grub.cfg 생성 (기본 메뉴)"}
          </button>
        </div>
      </div>}

      {/* ── 2. 실행 로그 ── */}
      {grubSubTab === "install" && jobData && (
        <div className="card">
          <div className="card-hd">
            <div className="card-hd-left">
              <div className="card-icon" style={{background:"rgba(124,95,230,.12)",color:"var(--purple)"}}>◧</div>
              <div className="card-title">실행 로그</div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontFamily:"var(--mono)",fontSize:12,
                color: status==="done"?"var(--green)":status==="failed"?"var(--red)":"var(--blue)"}}>
                {pct}%
              </span>
              <span className={`badge badge-${status}`} style={{minWidth:54,justifyContent:"center"}}>
                {status === "running" && <span className="pulse" style={{marginRight:3}}>●</span>}
                {status === "running" ? "실행 중" : status === "done" ? "✓ 완료" : status === "failed" ? "✗ 실패" : "대기"}
              </span>
            </div>
          </div>
          <ProgressBar pct={pct} status={status} />
          <div className="terminal-bar">
            <div className="tdot" style={{background:"#ff5f56"}}/>
            <div className="tdot" style={{background:"#ffbd2e"}}/>
            <div className="tdot" style={{background:"#27c93f"}}/>
            <span style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--t3)",marginLeft:6}}>
              grub build log — {jobData.log?.length || 0} lines
            </span>
          </div>
          <div className="terminal" ref={logRef}>
            {(jobData.log||[]).map((l,i)=>(
              <div key={i} className={
                l.startsWith("✅")||l.startsWith("[+]")?"log-ok":
                l.startsWith("❌")||l.startsWith("ERROR")?"log-err":
                l.startsWith("[!]")?"log-warn":""}>
                <span className="lnum">{String(i+1).padStart(3,"0")}</span>{l}
              </div>
            ))}
            {status==="running"&&<div className="pulse" style={{color:"var(--blue)"}}>▊</div>}
          </div>
          {status==="done" && (
            <div style={{marginTop:12,padding:"12px 16px",background:"rgba(34,197,94,.08)",border:"1px solid rgba(34,197,94,.3)",borderRadius:6,fontFamily:"var(--mono)",fontSize:12,display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontSize:20}}>✅</span>
              <div>
                <div style={{color:"var(--green)",fontWeight:600,marginBottom:2}}>grub.cfg 생성 완료</div>
                <div style={{color:"var(--t2)",fontSize:11}}>아래에서 내용을 확인하세요.</div>
              </div>
            </div>
          )}
          {status==="failed" && (
            <div style={{marginTop:12,padding:"12px 16px",background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.3)",borderRadius:6,fontFamily:"var(--mono)",fontSize:12,display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontSize:20}}>❌</span>
              <div>
                <div style={{color:"var(--red)",fontWeight:600,marginBottom:2}}>생성 실패</div>
                <div style={{color:"var(--t2)",fontSize:11}}>위 로그를 확인하세요.</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 3. GRUB.CFG 메뉴 관리자 ── */}
      <div className="card">
        <div className="card-hd">
          <div className="card-hd-left">
            <div className="card-icon" style={{background:"rgba(11,184,212,.1)",color:"var(--cyan)"}}>◎</div>
            <div>
              <div className="card-title">GRUB.CFG 메뉴 관리</div>
              <div className="card-sub">/var/lib/tftpboot/grub.cfg · {grubEntries.length}개 항목</div>
            </div>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            {entrySaved&&<span className="save-toast">✓ 저장됨</span>}
            <button className="btn btn-ghost btn-sm" onClick={loadAll}>↻</button>
            {!editMode?(
              <>
                <button className="btn btn-ghost btn-sm"
                  onClick={()=>{setEditContent(preview);setEditMode(true);}}>
                  ✏ 원문 편집
                </button>
                <button className="btn btn-ghost btn-sm"
                  onClick={()=>{
                    const w=window.open("","_blank","width=820,height=720,scrollbars=yes");
                    w.document.write(`<!DOCTYPE html><html><head><title>grub.cfg</title><style>
                      *{box-sizing:border-box;margin:0;padding:0}
                      body{background:#020409;color:#a8c4d8;font-family:'JetBrains Mono',monospace;font-size:12.5px;line-height:1.85;padding:0}
                      .toolbar{position:sticky;top:0;background:#080c18;border-bottom:1px solid #192038;padding:10px 18px;display:flex;align-items:center;gap:12;z-index:10}
                      .title{color:#4d8bf5;font-weight:700;font-size:12px;letter-spacing:.06em}
                      .path{color:#4d6285;font-size:11px;margin-left:8px}
                      table{width:100%;border-collapse:collapse}
                      tr:hover td{background:#0a0e1a}
                      td{padding:0}
                      .ln{color:#2c3d58;min-width:46px;text-align:right;padding:0 14px 0 18px;user-select:none;border-right:1px solid #111827;font-size:11px}
                      .code{padding:0 18px;white-space:pre;color:#a8c4d8}
                      .kw{color:#4d8bf5;font-weight:600}
                      .str{color:#0dce8a}
                      .cmt{color:#2c3d58;font-style:italic}
                    </style></head><body>
                    <div class="toolbar">
                      <span class="title">grub.cfg</span>
                      <span class="path">/var/lib/tftpboot/grub.cfg</span>
                    </div>
                    <table>${
                      preview.split("\\n").map((l,i)=>{
                        const esc=l.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
                        const hi=esc
                          .replace(/(menuentry)/g,'<span class="kw">$1</span>')
                          .replace(/(linuxefi|initrdefi|set |echo )/g,'<span class="kw">$1</span>')
                          .replace(/(#.*)/g,'<span class="cmt">$1</span>')
                          .replace(/('[^']*')/g,'<span class="str">$1</span>');
                        return `<tr><td class="ln">${i+1}</td><td class="code">${hi}</td></tr>`;
                      }).join("")
                    }</table></body></html>`);
                    w.document.close();
                  }}>
                  👁 파일 보기
                </button>
              </>
            ):(
              <>
                <button className="btn btn-ghost btn-sm" onClick={()=>setEditMode(false)}>취소</button>
                <button className="btn btn-primary btn-sm" onClick={saveGrub} disabled={saving}>
                  {saving?"…":"💾 저장"}
                </button>
              </>
            )}
            {!editMode&&grubEntries.length>0&&(
              <button className="btn btn-primary btn-sm"
                onClick={()=>saveEntries(grubEntries)} disabled={savingEntries}>
                {savingEntries?"…":"💾 순서 적용"}
              </button>
            )}
          </div>
        </div>

        {editMode&&(
          <textarea value={editContent} onChange={e=>setEditContent(e.target.value)}
            style={{width:"100%",height:500,fontFamily:"var(--mono)",fontSize:12,
              color:"#a8c4d8",background:"#030507",padding:14,border:"none",
              borderTop:"1px solid var(--blue)",lineHeight:1.8,
              resize:"vertical",outline:"none"}}
            spellCheck={false}/>
        )}

        {!editMode&&(grubEntries.length===0?(
          <div style={{padding:"32px 0",textAlign:"center",
            fontFamily:"var(--mono)",fontSize:12,color:"var(--t3)"}}>
            grub.cfg 없음 — [↻] 새로고침하거나 위에서 생성하세요.
          </div>
        ):(
          <div>
            {grubEntries.map((entry,idx)=>{
              const isKs=entry.type==="ks",isDl=entry.type==="diskless",isIn=entry.type==="install";
              const tc=isKs?"var(--green)":isDl?"var(--cyan)":isIn?"var(--blue)":"var(--t3)";
              const tb=isKs?"rgba(13,206,138,.1)":isDl?"rgba(11,184,212,.1)":isIn?"rgba(77,139,245,.1)":"rgba(75,85,99,.12)";
              const tn=isKs?"KS":isDl?"Dskless":isIn?"Install":"Base";
              const isEd=editingId===entry.id,isFst=idx===0,isLst=idx===grubEntries.length-1;
              return (
                <div key={entry.id}
                  data-drow=""
                  onDragOver={e=>{e.preventDefault();e.currentTarget.classList.add("drag-over");}}
                  onDragLeave={e=>{e.currentTarget.classList.remove("drag-over");}}
                  onDrop={e=>{
                    e.preventDefault();
                    e.currentTarget.classList.remove("drag-over");
                    const from=parseInt(e.dataTransfer.getData("grub-idx"),10);
                    if(isNaN(from)||from===idx)return;
                    setGrubEntries(p=>{const a=[...p];const[it]=a.splice(from,1);a.splice(idx,0,it);return a;});
                  }}
                  style={{borderBottom:isLst?"none":"1px solid var(--bd1)"}}>
                  <div style={{display:"grid",gridTemplateColumns:"28px 56px 1fr auto",
                    alignItems:"center",gap:8,padding:"10px 16px",
                    background:isEd?"rgba(77,139,245,.04)":"transparent"}}>
                    <div style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--t3)",
                      textAlign:"center",fontWeight:600}}>{idx+1}</div>
                    <div style={{fontFamily:"var(--mono)",fontSize:9,fontWeight:700,
                      letterSpacing:".06em",textTransform:"uppercase",
                      padding:"2px 0",borderRadius:10,textAlign:"center",
                      background:tb,color:tc,border:`1px solid ${tc}44`}}>{tn}</div>
                    {isEd?(
                      <input value={entry.label} autoFocus
                        onChange={e=>{const v=e.target.value;setGrubEntries(p=>p.map(en=>en.id===entry.id
                          ?{...en,label:v,raw:en.raw.replace(/menuentry\s+['"]([^'"]*)['"]/,`menuentry '${v}'`)}:en));}}
                        style={{fontSize:12,padding:"4px 8px"}}/>
                    ):(
                      <div style={{fontFamily:"var(--mono)",fontSize:12,color:"var(--t1)",
                        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                        {entry.label}
                      </div>
                    )}
                    <div style={{display:"flex",gap:3,flexShrink:0,alignItems:"center"}}>
                      <button className="btn btn-ghost btn-xs"
                        style={{padding:"3px 7px",opacity:isFst?.35:1}} disabled={isFst}
                        onClick={()=>setGrubEntries(p=>{const a=[...p];[a[idx-1],a[idx]]=[a[idx],a[idx-1]];return a;})}>↑</button>
                      <button className="btn btn-ghost btn-xs"
                        style={{padding:"3px 7px",opacity:isLst?.35:1}} disabled={isLst}
                        onClick={()=>setGrubEntries(p=>{const a=[...p];[a[idx],a[idx+1]]=[a[idx+1],a[idx]];return a;})}>↓</button>
                      {isEd?(
                        <button className="btn btn-primary btn-xs" style={{padding:"3px 10px"}}
                          onClick={()=>setEditingId(null)}>완료</button>
                      ):(
                        <button className="btn btn-ghost btn-xs" style={{padding:"3px 10px"}}
                          onClick={()=>setEditingId(entry.id)}>수정</button>
                      )}
                      {/* ⠿ 드래그 핸들 — 수정 버튼 바로 옆 */}
                      <div className="dhandle" title="드래그하여 순서 변경"
                        draggable
                        onDragStart={e=>{
                          e.dataTransfer.effectAllowed="move";
                          e.dataTransfer.setData("grub-idx",String(idx));
                          setTimeout(()=>e.target.closest("[data-drow]").classList.add("dragging"),0);
                        }}
                        onDragEnd={e=>{
                          document.querySelectorAll("[data-drow]").forEach(el=>{
                            el.classList.remove("dragging","drag-over");
                          });
                        }}>⠿</div>
                      <button className="btn btn-danger btn-xs" style={{padding:"3px 8px"}}
                        onClick={()=>{
                          setDlg({
                            msg: `"${entry.label}" 항목을 삭제하시겠습니까?\n\n삭제 후 [💾 순서 적용]으로 grub.cfg에 반영하세요.`,
                            onOk: () => setGrubEntries(p=>p.filter(e=>e.id!==entry.id)),
                          });
                        }}>×</button>
                    </div>
                  </div>
                  {isEd&&(
                    <div style={{padding:"0 16px 14px"}}>
                      <textarea value={entry.raw}
                        onChange={e=>{const v=e.target.value;
                          const lm=v.match(/menuentry\s+['"]([^'"]*)['"]/);
                          setGrubEntries(p=>p.map(en=>en.id===entry.id
                            ?{...en,raw:v,label:lm?lm[1]:en.label}:en));}}
                        style={{width:"100%",minHeight:140,fontFamily:"var(--mono)",
                          fontSize:11,color:"#a8c4d8",background:"#020409",
                          padding:"10px 12px",border:"1px solid var(--blue)",
                          borderRadius:"var(--r)",lineHeight:1.8,
                          resize:"vertical",outline:"none"}}
                        spellCheck={false}/>
                      <div style={{fontFamily:"var(--mono)",fontSize:10,
                        color:"var(--t3)",marginTop:5,textAlign:"right"}}>
                        수정 완료 후 [💾 순서 적용]으로 grub.cfg에 반영
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tab: 설치 모니터링 ────────────────────────────────────────────────────────

const STATUS_INFO = {
  requesting:        { label: "DHCP 요청",   color: "var(--yellow)", icon: "⟳" },
  booting:           { label: "PXE 부팅",    color: "var(--blue)",   icon: "↑" },
  installing:        { label: "설치 중",     color: "var(--cyan)",   icon: "▶" },
  installed:         { label: "설치 완료",   color: "var(--green)",  icon: "✓" },
  "installed(추정)": { label: "완료(추정)",  color: "var(--yellow)", icon: "✓?" },
  unknown:           { label: "감지됨",      color: "var(--t3)",     icon: "○" },
};

function MonitorTab() {
  const [clients, setClients] = useState([]);
  const [ngLog, setNgLog]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const logRef = useRef();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cr, lr] = await Promise.all([
        fetch(`${API}/api/monitor/clients`),
        fetch(`${API}/api/monitor/nginx-log`),
      ]);
      const cd = await cr.json();
      const ld = await lr.json();
      setClients(cd.clients || []);
      setNgLog(ld.lines || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [autoRefresh, load]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [ngLog]);

  const statusCount = clients.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1; return acc;
  }, {});
  // installed + installed(추정) + done 합산
  const totalDone = (statusCount["installed"] || 0) +
                    (statusCount["installed(추정)"] || 0) +
                    (statusCount["done"] || 0);

  return (
    <div>
      {/* 요약 카운터 */}
      <div className="card">
        <div className="card-hd">
          <div className="card-hd-left">
            <div className="card-icon" style={{background:"rgba(13,206,138,.1)",color:"var(--green)"}}>◉</div>
            <div>
              <div className="card-title">PXE 클라이언트 모니터링</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {loading && <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--t3)" }} className="pulse">갱신 중…</span>}
            <button className="btn btn-ghost" style={{ fontSize: 10, padding: "3px 10px" }} onClick={load}>🔄 새로고침</button>
            <button
              className="btn"
              style={{ fontSize: 10, padding: "3px 10px",
                background: autoRefresh ? "rgba(34,197,94,.15)" : "transparent",
                color: autoRefresh ? "var(--green)" : "var(--t3)",
                border: `1px solid ${autoRefresh ? "rgba(34,197,94,.4)" : "var(--bd2)"}`,
              }}
              onClick={() => setAutoRefresh(v => !v)}
            >
              {autoRefresh ? "⏸ 자동갱신 ON" : "▶ 자동갱신 OFF"}
            </button>
          </div>
        </div>

        {/* 상태별 카운트 */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          {[
            { key: "requesting",  label: "DHCP 요청",  color: "var(--yellow)" },
            { key: "booting",     label: "PXE 부팅",   color: "var(--blue)"   },
            { key: "installing",  label: "설치 중",    color: "var(--cyan)"   },
          ].map(({key, label, color}) => (
            <div key={key} style={{
              padding: "8px 16px", borderRadius: 6,
              background: "var(--bg3)", border: `1px solid var(--bd1)`,
              fontFamily: "var(--mono)", textAlign: "center", minWidth: 80,
            }}>
              <div style={{ fontSize: 20, fontWeight: 700, color }}>{statusCount[key] || 0}</div>
              <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 2 }}>{label}</div>
            </div>
          ))}
          {/* 설치 완료 확정 */}
          {(() => {
            const confirmedDone = (statusCount["installed"] || 0) + (statusCount["done"] || 0);
            const estimatedDone = statusCount["installed(추정)"] || 0;
            return (<>
              <div style={{
                padding: "8px 16px", borderRadius: 6,
                background: confirmedDone > 0 ? "rgba(13,206,138,.1)" : "var(--bg3)",
                border: `1px solid ${confirmedDone > 0 ? "rgba(13,206,138,.3)" : "var(--bd1)"}`,
                fontFamily: "var(--mono)", textAlign: "center", minWidth: 80,
              }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--green)" }}>{confirmedDone}</div>
                <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 2 }}>설치 완료</div>
              </div>
              {estimatedDone > 0 && (
                <div style={{
                  padding: "8px 16px", borderRadius: 6,
                  background: "rgba(240,160,32,.08)",
                  border: "1px solid rgba(240,160,32,.3)",
                  fontFamily: "var(--mono)", textAlign: "center", minWidth: 80,
                }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "var(--yellow)" }}>{estimatedDone}</div>
                  <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 2 }}>완료(추정)</div>
                </div>
              )}
            </>);
          })()}
          <div style={{
            padding: "8px 16px", borderRadius: 6,
            background: "var(--bg3)", border: "1px solid var(--bd1)",
            fontFamily: "var(--mono)", textAlign: "center", minWidth: 80,
          }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--t1)" }}>{clients.length}</div>
            <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 2 }}>전체</div>
          </div>
        </div>

        {/* 클라이언트 테이블 */}
        {clients.length === 0 ? (
          <div style={{ padding: "24px 0", fontFamily: "var(--mono)", fontSize: 12, color: "var(--t3)", textAlign: "center" }}>
            감지된 PXE 클라이언트 없음<br/>
            <span style={{ fontSize: 11 }}>클라이언트를 PXE 네트워크에 연결하고 부팅하면 여기에 표시됩니다.</span>
          </div>
        ) : (
          <table className="iso-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>상태</th>
                <th>IP 주소</th>
                <th>MAC 주소</th>
                <th>호스트명</th>
                <th>마지막 활동</th>
                <th>이벤트</th>
              </tr>
            </thead>
            <tbody>
              {clients.map(c => {
                const si = STATUS_INFO[c.status] || STATUS_INFO.unknown;
                const isExp = expanded === c.mac;
                return (
                  <>
                    <tr key={c.mac} onClick={() => setExpanded(isExp ? null : c.mac)}
                      style={{ cursor: "pointer" }}>
                      <td>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600,
                          color: si.color,
                        }}>
                          {/* booting/installing 은 깜빡임, installed/done 은 고정 */}
                          <span className={["installing","booting"].includes(c.status) ? "pulse" : ""}>{si.icon}</span>
                          {si.label}
                        </span>
                      </td>
                      <td style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>{c.ip}</td>
                      <td style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--t3)" }}>{c.mac}</td>
                      <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{c.hostname || "—"}</td>
                      <td style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--t3)" }}>{c.last_seen}</td>
                      <td style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--t3)" }}>
                        {c.events.length}개 {isExp ? "▲" : "▼"}
                      </td>
                    </tr>
                    {isExp && (
                      <tr key={`${c.mac}-detail`}>
                        <td colSpan={6} style={{ padding: "10px 16px", background: "var(--bg3)" }}>
                          <div style={{ fontFamily: "var(--mono)", fontSize: 11, lineHeight: 2 }}>
                            {c.events.map((ev, i) => {
                              const isDone  = ev.event?.includes("설치완료") || ev.event?.includes("완료추정") || ev.event?.includes("마커파일");
                              const isKs    = ev.event?.includes("KS") || ev.event?.includes("user-data");
                              const isPkg   = ev.event?.includes("패키지");
                              const isBoot  = ev.event?.includes("부팅") || ev.event?.includes("DHCPACK");
                              const isWarn  = ev.event?.includes("404");
                              const color   = isDone  ? "var(--green)"  :
                                              isKs    ? "var(--cyan)"   :
                                              isPkg   ? "var(--t2)"     :
                                              isBoot  ? "var(--blue)"   :
                                              isWarn  ? "var(--yellow)" : "var(--t3)";
                              return (
                                <div key={i} style={{
                                  color,
                                  display: "flex", gap: 12,
                                  fontWeight: isDone ? 600 : 400,
                                }}>
                                  <span style={{ color: "var(--t3)", flexShrink: 0 }}>{ev.ts}</span>
                                  <span style={{ fontWeight: isDone ? 700 : 600, flexShrink: 0 }}>{ev.event}</span>
                                  {ev.url && <span style={{ color: "var(--t3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.url}</span>}
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Nginx 접근 로그 */}
      <div className="card">
        <div className="card-hd">
          <div className="card-hd-left">
            <div className="card-icon" style={{background:"rgba(11,184,212,.1)",color:"var(--cyan)"}}>◧</div>
            <div className="card-title">설치 파일 요청 로그 (Nginx)</div>
          </div>
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--t3)" }}>
            vmlinuz / initrd / ks / squashfs 요청만 표시 · 5초 자동갱신
          </span>
        </div>
        <div className="terminal-bar">
          <div className="tdot" style={{ background: "#ff5f56" }} />
          <div className="tdot" style={{ background: "#ffbd2e" }} />
          <div className="tdot" style={{ background: "#27c93f" }} />
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--t3)", marginLeft: 6 }}>
            /var/log/nginx/pxe-www.access.log — {ngLog.length} lines
          </span>
        </div>
        <div className="terminal" ref={logRef} style={{ maxHeight: 300 }}>
          {ngLog.length === 0 ? (
            <div style={{ color: "var(--t3)" }}>로그 없음 — 클라이언트 부팅 시 여기에 표시됩니다.</div>
          ) : ngLog.map((l, i) => {
            const isKs  = l.includes("/ks/");
            const isBoot = l.includes("vmlinuz") || l.includes("initrd");
            const isSquash = l.includes("squashfs");
            return (
              <div key={i} className={isKs ? "log-ok" : isBoot ? "log-info" : isSquash ? "log-warn" : ""}>
                <span className="lnum">{String(i + 1).padStart(3, "0")}</span>{l}
              </div>
            );
          })}
        </div>
      </div>

      {/* 안내 */}
      <div className="info-box">
        <strong>상태 감지 방식:</strong><br/>
        • <span style={{color:"var(--yellow)"}}>DHCP 요청</span> — dnsmasq 로그에서 DHCPDISCOVER/REQUEST 감지<br/>
        • <span style={{color:"var(--blue)"}}>PXE 부팅 중</span> — DHCPACK 후 vmlinuz/initrd 다운로드 감지<br/>
        • <span style={{color:"var(--green)"}}>설치 중</span> — Kickstart/user-data 파일 요청 감지<br/>
        <br/>
        dnsmasq 로그 활성화: <code style={{color:"var(--blue)"}}>echo "log-dhcp" &gt;&gt; /etc/dnsmasq.d/pxe.conf && systemctl restart dnsmasq</code>
      </div>
    </div>
  );
}

// ── Tab: ISO 목록 ─────────────────────────────────────────────────────────────

function IsoTab() {
  const [isos, setIsos] = useState([]);
  const load = () => fetch(`${API}/api/isos`).then(r => r.json()).then(d => setIsos(d.isos || [])).catch(() => {});
  useEffect(() => { load(); }, []);

  const osCls = os => {
    if (["rocky", "rhel", "centos"].includes(os)) return "os-rocky";
    if (os === "ubuntu") return "os-ubuntu";
    if (["almalinux", "ol"].includes(os)) return "os-almalinux";
    return "os-unknown";
  };

  return (
    <div>
      <div className="card">
        <div className="card-hd">
          <div className="card-hd-left">
            <div className="card-icon" style={{ background:"rgba(240,160,32,.1)", color:"var(--yellow)" }}>◫</div>
            <div>
              <div className="card-title">ISO Files</div>
              <div className="card-sub">/srv/pxe-manager/iso/ · {isos.length}개</div>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={load}>↻ 새로고침</button>
        </div>
        <table className="iso-table">
          <thead>
            <tr>
              <th>파일명</th>
              <th>OS</th>
              <th>크기</th>
              <th>전체 경로</th>
            </tr>
          </thead>
          <tbody>
            {isos.map(iso => (
              <tr key={iso.path}>
                <td style={{ fontWeight:500 }}>{iso.name}</td>
                <td><span className={`os-pill ${osCls(iso.os)}`}>{iso.os}</span></td>
                <td style={{ color:"var(--t3)" }}>{iso.size}</td>
                <td style={{ color:"var(--t3)", fontSize:11 }}>{iso.path}</td>
              </tr>
            ))}
            {isos.length === 0 && (
              <tr>
                <td colSpan={4}>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"40px 0", gap:10 }}>
                    <div style={{ fontSize:32, opacity:.2, fontFamily:"var(--mono)" }}>◫</div>
                    <div style={{ fontFamily:"var(--mono)", fontSize:12, color:"var(--t3)" }}>ISO 파일 없음</div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Tab: 서버 인벤토리 ────────────────────────────────────────────────────────

const EMPTY_SERVER = {
  hostname: "", mac: "", ip: "", gateway: "", netmask: "255.255.255.0",
  dns: "", nic: "", idracIp: "", idracUser: "root",
  osType: "rhel", osName: "rocky", osVer: "9.6",
  disk: "", diskMode: "auto", partScheme: "auto", autoPartType: "lvm",
  customParts: [], rootPassword: "changeme",
  extraUser: "", extraUserPassword: "", extraUserSudo: true,
  packageGroups: ["@^minimal-environment"], extraPackages: [], postScript: "",
};

function RacadmModal({ onClose, onSelect }) {
  const [form, setForm] = useState({ idracIp: "", idracUser: "root", idracPass: "" });
  const [loading, setLoading] = useState(false);
  const [nics, setNics]       = useState(null);
  const [err, setErr]         = useState("");

  const discover = async () => {
    if (!form.idracIp) { setErr("iDRAC IP를 입력하세요"); return; }
    setLoading(true); setErr(""); setNics(null);
    try {
      const r = await fetch(`${API}/api/racadm/mac`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idracIp: form.idracIp, idracUser: form.idracUser, idracPass: form.idracPass }),
      });
      const d = await r.json();
      if (d.error) { setErr(d.error); }
      else         { setNics(d.nics || []); }
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-hd">
          racadm MAC 조회
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="grid grid-3" style={{ marginBottom: 16 }}>
            <Field label="iDRAC IP">
              <input value={form.idracIp} onChange={e => setForm(f => ({ ...f, idracIp: e.target.value }))}
                placeholder="192.168.0.95" />
            </Field>
            <Field label="사용자">
              <input value={form.idracUser} onChange={e => setForm(f => ({ ...f, idracUser: e.target.value }))} />
            </Field>
            <Field label="비밀번호">
              <input type="password" value={form.idracPass}
                onChange={e => setForm(f => ({ ...f, idracPass: e.target.value }))}
                placeholder="calvin" />
            </Field>
          </div>
          <button className="btn btn-primary" onClick={discover} disabled={loading}>
            {loading ? "조회 중…" : "▶ NIC 조회"}
          </button>
          {err && (
            <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: "var(--r)",
              background: "var(--red-dim)", border: "1px solid rgba(240,78,78,.3)",
              fontFamily: "var(--mono)", fontSize: 11, color: "var(--red)" }}>
              {err}
            </div>
          )}
          {nics !== null && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--t3)",
                letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 8 }}>
                NIC 목록 — 클릭하여 선택
              </div>
              {nics.length === 0 ? (
                <div style={{ color: "var(--t3)", fontSize: 12 }}>NIC를 찾을 수 없습니다</div>
              ) : (
                <div className="nic-list">
                  {nics.map(n => (
                    <div key={n.nicId} className="nic-item" onClick={() => { onSelect(n); onClose(); }}>
                      <div className="nic-item-info">
                        <span className="nic-item-id">{n.nicId}</span>
                        <span className="nic-item-desc">{n.description}</span>
                      </div>
                      <span className="nic-item-mac">{n.mac}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ServerFormModal({ server, onClose, onSave }) {
  const [form, setForm] = useState(server ? { ...server } : { ...EMPTY_SERVER });
  const [showRacadm, setShowRacadm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.hostname) { setErr("hostname 필수"); return; }
    if (!form.mac)      { setErr("MAC 주소 필수"); return; }
    setSaving(true); setErr("");
    try {
      const url    = server ? `${API}/api/servers/${server.id}` : `${API}/api/servers`;
      const method = server ? "PUT" : "POST";
      const r = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (d.error) { setErr(d.error); }
      else         { onSave(d.server); onClose(); }
    } catch (e) { setErr(String(e)); }
    finally { setSaving(false); }
  };

  return (
    <>
      {showRacadm && (
        <RacadmModal
          onClose={() => setShowRacadm(false)}
          onSelect={nic => set("mac", nic.mac)}
        />
      )}
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="modal">
          <div className="modal-hd">
            {server ? `서버 편집 — ${server.hostname}` : "새 서버 등록"}
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
          <div className="modal-body">
            {err && (
              <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: "var(--r)",
                background: "var(--red-dim)", border: "1px solid rgba(240,78,78,.3)",
                fontFamily: "var(--mono)", fontSize: 11, color: "var(--red)" }}>
                {err}
              </div>
            )}

            {/* 기본 정보 */}
            <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--t3)",
              letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 10 }}>
              기본 정보
            </div>
            <div className="grid grid-2" style={{ marginBottom: 16 }}>
              <Field label="호스트명 *">
                <input value={form.hostname} onChange={e => set("hostname", e.target.value)} placeholder="server01" />
              </Field>
              <Field label="MAC 주소 *">
                <div style={{ display: "flex", gap: 6 }}>
                  <input value={form.mac} onChange={e => set("mac", e.target.value)}
                    placeholder="6c:2b:59:91:82:29" style={{ flex: 1 }} />
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowRacadm(true)}
                    title="racadm으로 MAC 조회">iDRAC</button>
                </div>
              </Field>
            </div>

            {/* 네트워크 */}
            <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--t3)",
              letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 10 }}>
              네트워크 (정적 IP)
            </div>
            <div className="grid grid-2" style={{ marginBottom: 16 }}>
              <Field label="IP 주소">
                <input value={form.ip} onChange={e => set("ip", e.target.value)} placeholder="10.0.0.11" />
              </Field>
              <Field label="게이트웨이">
                <input value={form.gateway} onChange={e => set("gateway", e.target.value)} placeholder="10.0.0.1" />
              </Field>
              <Field label="서브넷 마스크">
                <input value={form.netmask} onChange={e => set("netmask", e.target.value)} placeholder="255.255.255.0" />
              </Field>
              <Field label="DNS">
                <input value={form.dns} onChange={e => set("dns", e.target.value)} placeholder="8.8.8.8" />
              </Field>
              <Field label="NIC 장치명">
                <input value={form.nic} onChange={e => set("nic", e.target.value)} placeholder="eth0 또는 em1" />
              </Field>
              <Field label="iDRAC IP">
                <input value={form.idracIp} onChange={e => set("idracIp", e.target.value)} placeholder="192.168.0.95" />
              </Field>
            </div>

            {/* OS */}
            <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--t3)",
              letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 10 }}>
              OS
            </div>
            <div className="grid grid-3" style={{ marginBottom: 16 }}>
              <Field label="OS 종류">
                <select value={form.osType} onChange={e => set("osType", e.target.value)}>
                  <option value="rhel">RHEL 계열</option>
                  <option value="ubuntu">Ubuntu</option>
                </select>
              </Field>
              <Field label="OS 이름">
                <select value={form.osName} onChange={e => set("osName", e.target.value)}>
                  <option value="rocky">Rocky Linux</option>
                  <option value="rhel">RHEL</option>
                  <option value="centos">CentOS Stream</option>
                  <option value="almalinux">AlmaLinux</option>
                  <option value="ubuntu">Ubuntu</option>
                </select>
              </Field>
              <Field label="버전">
                <input value={form.osVer} onChange={e => set("osVer", e.target.value)} placeholder="9.6" />
              </Field>
            </div>

            {/* 디스크 / 파티션 */}
            <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--t3)",
              letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 10 }}>
              디스크 / 파티션
            </div>
            <div className="grid grid-3" style={{ marginBottom: 16 }}>
              <Field label="디스크 장치">
                <input value={form.disk} onChange={e => set("disk", e.target.value)} placeholder="sda (비워두면 자동)" />
              </Field>
              <Field label="디스크 모드">
                <select value={form.diskMode} onChange={e => set("diskMode", e.target.value)}>
                  <option value="auto">자동 선택</option>
                  <option value="manual">지정</option>
                </select>
              </Field>
              <Field label="파티션 방식">
                <select value={form.partScheme} onChange={e => set("partScheme", e.target.value)}>
                  <option value="auto">자동 (autopart)</option>
                  <option value="manual">수동 LVM</option>
                </select>
              </Field>
            </div>

            {/* 계정 */}
            <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--t3)",
              letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 10 }}>
              계정
            </div>
            <div className="grid grid-2" style={{ marginBottom: 16 }}>
              <Field label="root 비밀번호">
                <input type="password" value={form.rootPassword} onChange={e => set("rootPassword", e.target.value)} />
              </Field>
              <Field label="추가 사용자">
                <input value={form.extraUser} onChange={e => set("extraUser", e.target.value)} placeholder="(선택)" />
              </Field>
            </div>

            <div className="btn-row">
              <button className="btn btn-ghost" onClick={onClose}>취소</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? "저장 중…" : server ? "저장" : "등록"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function ApplyResultModal({ results, onClose }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-hd">
          적용 결과
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {results.map((r, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600,
                color: r.ok ? "var(--green)" : "var(--red)", marginBottom: 4 }}>
                {r.ok ? "✓" : "✗"} {r.hostname}
              </div>
              {r.error && (
                <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--red)",
                  padding: "6px 10px", background: "var(--red-dim)", borderRadius: "var(--r)" }}>
                  {r.error}
                </div>
              )}
              {(r.messages || []).map((m, j) => (
                <div key={j} style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--t3)", paddingLeft: 8 }}>
                  {m}
                </div>
              ))}
            </div>
          ))}
          <div className="btn-row">
            <button className="btn btn-primary" onClick={onClose}>닫기</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ServerInventoryTab() {
  const [servers, setServers]         = useState([]);
  const [editServer, setEditServer]   = useState(null);   // null=closed, false=new, obj=edit
  const [applyResults, setApplyResults] = useState(null);
  const [applying, setApplying]       = useState({});     // { id: true }
  const [applyingAll, setApplyingAll] = useState(false);

  const load = useCallback(() => {
    fetch(`${API}/api/servers`).then(r => r.json())
      .then(d => setServers(d.servers || [])).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = () => load();

  const deleteServer = async (id, hostname) => {
    if (!window.confirm(`"${hostname}" 서버를 삭제할까요?`)) return;
    await fetch(`${API}/api/servers/${id}`, { method: "DELETE" });
    load();
  };

  const applyOne = async (id) => {
    setApplying(a => ({ ...a, [id]: true }));
    try {
      const r = await fetch(`${API}/api/servers/${id}/apply`, { method: "POST" });
      const d = await r.json();
      setApplyResults([{ hostname: servers.find(s => s.id === id)?.hostname || id, ...d }]);
      load();
    } catch (e) {
      setApplyResults([{ hostname: id, error: String(e) }]);
    } finally {
      setApplying(a => ({ ...a, [id]: false }));
    }
  };

  const applyAll = async () => {
    setApplyingAll(true);
    try {
      const r = await fetch(`${API}/api/servers/apply-all`, { method: "POST" });
      const d = await r.json();
      setApplyResults(d.results || []);
      load();
    } catch (e) {
      setApplyResults([{ hostname: "전체", error: String(e) }]);
    } finally {
      setApplyingAll(false);
    }
  };

  return (
    <>
      {editServer !== null && (
        <ServerFormModal
          server={editServer || null}
          onClose={() => setEditServer(null)}
          onSave={handleSave}
        />
      )}
      {applyResults && (
        <ApplyResultModal results={applyResults} onClose={() => setApplyResults(null)} />
      )}

      <div className="card">
        <div className="card-hd">
          <div className="card-hd-left">
            <div className="card-icon" style={{ background: "rgba(124,95,230,.1)", color: "var(--purple)" }}>◧</div>
            <div>
              <div className="card-title">서버 인벤토리</div>
              <div className="card-sub">서버별 호스트명 · IP · MAC · 파티션 관리 → 개별 KS 자동 생성</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={load}>↻ 새로고침</button>
            <button className="btn btn-ghost btn-sm" onClick={applyAll}
              disabled={applyingAll || servers.length === 0}>
              {applyingAll ? "적용 중…" : "▶ 전체 적용"}
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setEditServer(false)}>
              + 서버 등록
            </button>
          </div>
        </div>

        {servers.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
            padding: "48px 0", gap: 12 }}>
            <div style={{ fontSize: 32, opacity: .2, fontFamily: "var(--mono)" }}>◧</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--t3)" }}>
              등록된 서버 없음
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setEditServer(false)}>
              + 첫 서버 등록
            </button>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="inv-table">
              <thead>
                <tr>
                  <th>호스트명</th>
                  <th>MAC</th>
                  <th>IP</th>
                  <th>OS</th>
                  <th>디스크</th>
                  <th>KS 파일</th>
                  <th>상태</th>
                  <th>동작</th>
                </tr>
              </thead>
              <tbody>
                {servers.map(sv => (
                  <tr key={sv.id}>
                    <td style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>{sv.hostname}</td>
                    <td style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--blue)" }}>{sv.mac}</td>
                    <td style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{sv.ip || <span style={{ color: "var(--t3)" }}>DHCP</span>}</td>
                    <td style={{ fontSize: 11 }}>
                      <span style={{ color: "var(--t2)" }}>{sv.osName}</span>
                      <span style={{ color: "var(--t3)" }}> {sv.osVer}</span>
                    </td>
                    <td style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--t3)" }}>
                      {sv.disk || <span style={{ color: "var(--t4)" }}>auto</span>}
                    </td>
                    <td style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--t3)",
                      maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {sv.ksFile || "—"}
                    </td>
                    <td>
                      {sv.applied
                        ? <span className="badge-applied">✓ 적용됨</span>
                        : <span className="badge-pending">미적용</span>}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-ghost btn-xs" onClick={() => setEditServer(sv)}>편집</button>
                        <button className="btn btn-primary btn-xs"
                          onClick={() => applyOne(sv.id)} disabled={applying[sv.id]}>
                          {applying[sv.id] ? "…" : "적용"}
                        </button>
                        <button className="btn btn-danger btn-xs"
                          onClick={() => deleteServer(sv.id, sv.hostname)}>삭제</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 안내 카드 */}
      <div className="card" style={{ marginTop: 12 }}>
        <div className="card-hd">
          <div className="card-hd-left">
            <div className="card-icon" style={{ background: "rgba(11,184,212,.1)", color: "var(--cyan)" }}>ℹ</div>
            <div>
              <div className="card-title">동작 방식</div>
            </div>
          </div>
        </div>
        <div className="card-body" style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.9 }}>
          <ol style={{ paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
            <li><b style={{ color: "var(--t1)" }}>서버 등록</b> — 호스트명, MAC, 고정 IP, OS, 파티션 설정 입력</li>
            <li><b style={{ color: "var(--t1)" }}>iDRAC 조회</b> — MAC 입력란 옆 <code style={{ color: "var(--blue)" }}>iDRAC</code> 버튼 클릭 → racadm으로 NIC 목록 조회 후 선택</li>
            <li><b style={{ color: "var(--t1)" }}>적용</b> — <code style={{ color: "var(--blue)" }}>적용</code> 클릭 시 자동으로 수행:
              <ul style={{ paddingLeft: 18, marginTop: 4, display: "flex", flexDirection: "column", gap: 2 }}>
                <li>서버 전용 KS 파일 생성 (<code style={{ color: "var(--green)" }}>/var/www/html/ks/servers/&lt;hostname&gt;.ks</code>)</li>
                <li>dnsmasq <code style={{ color: "var(--yellow)" }}>dhcp-host</code> 갱신 → MAC에 고정 IP 할당</li>
                <li>grub.cfg에 해당 서버 전용 메뉴 항목 추가</li>
              </ul>
            </li>
            <li><b style={{ color: "var(--t1)" }}>PXE 부팅</b> — 서버 전원 시 dnsmasq가 MAC을 인식해 고정 IP 부여, KS 파일로 무인 설치 진행</li>
          </ol>
        </div>
      </div>
    </>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "dashboard", label: "대시보드",       icon: "◈" },
  { id: "ks",        label: "Kickstart",      icon: "◧" },
  { id: "grub",      label: "grub.cfg",       icon: "◎" },
  { id: "monitor",   label: "설치 모니터링",  icon: "◉" },
  { id: "iso",       label: "ISO 목록",       icon: "◫" },
  { id: "servers",   label: "서버 인벤토리",  icon: "◩" },
];

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [svc, setSvc] = useState({});

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(`${API}/api/status`);
        const d = await r.json();
        setSvc(d.services || {});
      } catch {}
    };
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <style>{css}</style>
      <div className="app">
        <header className="header">
          <span className="logo">
            <span className="logo-mark">⚡</span>
            <span className="logo-text">
              <span className="logo-title">PXE / KS Manager</span>
              <span className="logo-sub">Automated Install Platform</span>
            </span>
          </span>
          <div className="header-center" />
          <div className="header-right">
            {["nginx", "dnsmasq"].map(s => (
              <div key={s} className={`svc-chip ${svc[s] === "active" ? "active" : ""}`}>
                <div className={`dot ${svc[s] || "unknown"}`} />
                {s}
              </div>
            ))}
          </div>
        </header>

        <div className="body">
          <div className="tabs">
            {TABS.map(t => (
              <div key={t.id} className={`tab${tab === t.id ? " active" : ""}`} onClick={() => setTab(t.id)}>
                <span className="tab-icon">{t.icon}</span>
                {t.label}
              </div>
            ))}
          </div>
          <div className="content">
            {tab === "dashboard" && <Dashboard />}
            {tab === "ks"        && <KickstartTab />}
            {tab === "grub"      && <GrubTab />}
            {tab === "monitor"   && <MonitorTab />}
            {tab === "iso"       && <IsoTab />}
            {tab === "servers"   && <ServerInventoryTab />}
          </div>
        </div>
      </div>
    </>
  );
}
