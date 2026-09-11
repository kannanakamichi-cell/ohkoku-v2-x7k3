/* Oh!国 v2 共通ライブラリ */
const OHK = {
  URL: "https://phvoipihjlktgpargrei.supabase.co",
  KEY: "sb_publishable_W6lv3WdKgLtDnLxX05Wfzw_vrDPgRHb"
};
const $ = id => document.getElementById(id);
const fmt = n => (n==null?"—":Number(n).toLocaleString("ja-JP"));

async function rpc(fn, args){
  const res = await fetch(OHK.URL + "/rest/v1/rpc/" + fn, {
    method: "POST",
    headers: { "apikey": OHK.KEY, "Content-Type": "application/json" },
    body: JSON.stringify(args || {})
  });
  const j = await res.json().catch(()=>null);
  if(!res.ok){
    const m = (j && (j.message || j.hint)) || ("エラー(" + res.status + ")");
    throw new Error(m.replace(/^P0001: */,""));
  }
  return j;
}
async function tbl(q){
  const res = await fetch(OHK.URL + "/rest/v1/" + q, { headers: { "apikey": OHK.KEY } });
  if(!res.ok) throw new Error("読み込みに失敗しました(" + res.status + ")");
  return res.json();
}

let toastT = null;
function toast(msg, err){
  const t = $("toast"); if(!t) return alert(msg);
  t.textContent = msg; t.className = err ? "err" : ""; t.style.display = "block";
  clearTimeout(toastT); toastT = setTimeout(()=>{ t.style.display = "none"; }, 3200);
}

/* ---- フェーズ計算(全端末で同一結果) ---- */
let PH_DEFS = null, EV = null;
async function loadPhaseDefs(){
  if(!PH_DEFS) PH_DEFS = await tbl("phase_def?select=*&order=start_min.asc");
  return PH_DEFS;
}
async function loadEvent(){
  const rows = await tbl("event?select=id,name,state,opened_at,paused_at,pause_ms,paper_mode,last_phase&id=eq.1");
  EV = rows[0]; return EV;
}
function elapsedMin(ev){
  if(!ev || !ev.opened_at) return -1;
  const base = ev.paused_at ? new Date(ev.paused_at) : new Date();
  return (base - new Date(ev.opened_at) - (ev.pause_ms||0)) / 60000;
}
function calcPhase(ev, defs){
  const el = elapsedMin(ev);
  let cur = defs[0], next = null;
  for(const d of defs){
    if(d.start_min <= Math.floor(el)) cur = d;
    else { next = d; break; }
  }
  const remain = next ? Math.max(0, next.start_min - el) : 0;
  return { ph: cur, next, elapsed: el, remain };
}
function remainStr(min){
  if(min <= 0) return "";
  const m = Math.floor(min), s = Math.floor((min - m) * 60);
  return "残り " + m + ":" + String(s).padStart(2,"0");
}

/* ---- セッション ---- */
function saveS(k,o){ try{ localStorage.setItem(k, JSON.stringify(o)); }catch(e){} }
function loadS(k){ try{ return JSON.parse(localStorage.getItem(k)); }catch(e){ return null; } }
function clearS(k){ try{ localStorage.removeItem(k); }catch(e){} }

/* ---- QRスキャン(名札 OHK:番号) ---- */
let scanStream=null, scanRAF=null, scanCb=null;
function startScan(cb){
  if(!window.jsQR){ toast("スキャナ読込中。数秒後にもう一度", 1); return; }
  if(!navigator.mediaDevices){ toast("カメラ不可。番号を手入力してください", 1); return; }
  scanCb = cb; $("scan-ov").style.display = "flex";
  navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
    .then(s=>{ scanStream=s; const v=$("scan-v"); v.srcObject=s; v.play(); scanTick(); })
    .catch(e=>{ stopScan(); toast("カメラを起動できません("+e.name+")", 1); });
}
function scanTick(){
  const v = $("scan-v"); if(!scanStream) return;
  if(v.readyState === v.HAVE_ENOUGH_DATA){
    const c = document.createElement("canvas"); c.width=v.videoWidth; c.height=v.videoHeight;
    const x = c.getContext("2d"); x.drawImage(v,0,0);
    const d = x.getImageData(0,0,c.width,c.height);
    const q = jsQR(d.data, c.width, c.height);
    const m = q && /^OHK:(\d+)$/.exec(q.data);
    if(m){ const cb=scanCb; stopScan(); toast("📷 読み取り:"+m[1]); cb(m[1]); return; }
  }
  scanRAF = requestAnimationFrame(scanTick);
}
function stopScan(){
  if(scanRAF) cancelAnimationFrame(scanRAF); scanRAF=null;
  if(scanStream){ scanStream.getTracks().forEach(t=>t.stop()); scanStream=null; }
  $("scan-ov").style.display = "none";
}
function scanOverlayHTML(){
  return '<div id="scan-ov" onclick="stopScan()"><video id="scan-v" playsinline onclick="event.stopPropagation()"></video><p>名札のQRを枠に映してください(タップで閉じる)</p></div><div id="toast"></div>';
}
