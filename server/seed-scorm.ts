import { zipSync, strToU8 } from 'fflate';

/** Builds a small but real SCORM 1.2 package ("Pre-flight Safety Checklist") for demos. */
export function buildDemoScorm(): Uint8Array {
  const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="orbit.preflight" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata>
  <organizations default="org1">
    <organization identifier="org1">
      <title>Pre-flight Safety Checklist</title>
      <item identifier="item1" identifierref="res1"><title>Pre-flight Safety Checklist</title></item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="res1" type="webcontent" adlcp:scormtype="sco" href="index.html"><file href="index.html"/></resource>
  </resources>
</manifest>`;

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pre-flight Safety Checklist</title>
<style>
  *{box-sizing:border-box}body{margin:0;min-height:100vh;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#e9e8ff;background:radial-gradient(1200px 600px at 80% -10%,#3b2a9c55,transparent),#0b0f26;display:flex;align-items:center;justify-content:center;padding:24px}
  .card{width:min(680px,100%);background:#141a3a;border:1px solid #ffffff1f;border-radius:20px;padding:28px;box-shadow:0 20px 60px #0008}
  h1{margin:0 0 4px;font-size:22px}p{color:#b9b8e6;line-height:1.6}.step{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#8f86ff}
  .items{display:grid;gap:10px;margin:18px 0}label{display:flex;gap:12px;align-items:center;padding:14px 16px;border:1px solid #ffffff22;border-radius:12px;cursor:pointer;background:#0d1230;transition:.15s}
  label:hover{border-color:#8f86ff}label.on{border-color:#4ade80;background:#0f2a22}input{accent-color:#7c5cff;width:18px;height:18px}
  button{background:linear-gradient(135deg,#7c5cff,#22d3ee);color:#fff;border:0;border-radius:12px;padding:12px 20px;font-weight:600;font-size:15px;cursor:pointer}button:disabled{opacity:.4;cursor:not-allowed}
  .bar{height:6px;background:#ffffff1a;border-radius:9px;overflow:hidden;margin-bottom:20px}.bar i{display:block;height:100%;background:linear-gradient(90deg,#7c5cff,#22d3ee);transition:width .3s}
  .opt{display:block;width:100%;text-align:left;margin:8px 0;background:#0d1230;border:1px solid #ffffff22;font-weight:500}.opt:hover{border-color:#8f86ff}.ok{border-color:#4ade80!important;background:#0f2a22!important}.no{border-color:#f87171!important;background:#2a1010!important}
  .big{font-size:56px;margin:0}.status{font-size:12px;color:#8886b8;margin-top:18px}
</style></head><body>
<div class="card"><div class="bar"><i id="bar" style="width:0"></i></div><div id="view"></div><div class="status" id="status">Connecting to LMS…</div></div>
<script>
// ---- minimal SCORM 1.2 client ----
function findAPI(w){var n=0;while(w&&!w.API&&w.parent&&w.parent!==w&&n<10){w=w.parent;n++}return w&&w.API?w.API:null}
var api=findAPI(window)||(window.opener&&findAPI(window.opener));
var connected=false;
function set(k,v){if(connected)api.LMSSetValue(k,String(v))}
function get(k){return connected?api.LMSGetValue(k):''}
function commit(){if(connected)api.LMSCommit('')}
var steps=[
 {t:'Suit & life support',items:['Helmet seal checked','Oxygen at 100%','Comms channel open']},
 {t:'Vehicle systems',items:['Fuel pressure nominal','Navigation computer online','Abort system armed']}
];
var state=0,start=Date.now();
var view=document.getElementById('view'),bar=document.getElementById('bar');
function progress(p){bar.style.width=p+'%'}
function renderStep(i){
 var s=steps[i];progress(i*33);
 view.innerHTML='<div class="step">Step '+(i+1)+' of 3</div><h1>'+s.t+'</h1><p>Confirm every item before continuing.</p><div class="items">'+s.items.map(function(x,j){return '<label><input type="checkbox" data-i="'+j+'"> '+x+'</label>'}).join('')+'</div><button id="next" disabled>Continue</button>';
 var boxes=view.querySelectorAll('input');
 boxes.forEach(function(b){b.onchange=function(){b.parentNode.className=b.checked?'on':'';document.getElementById('next').disabled=!Array.prototype.every.call(boxes,function(x){return x.checked})}});
 document.getElementById('next').onclick=function(){set('cmi.core.lesson_location',String(i+1));set('cmi.suspend_data',JSON.stringify({step:i+1}));commit();state=i+1;state<steps.length?renderStep(state):renderQuiz()};
}
function renderQuiz(){
 progress(66);
 view.innerHTML='<div class="step">Step 3 of 3</div><h1>Knowledge check</h1><p>Which action should you take first if the cabin pressure alarm sounds?</p><button class="opt" data-c="0">Remove your helmet to check the sensor</button><button class="opt" data-c="1">Don emergency oxygen and notify mission control</button><button class="opt" data-c="0">Ignore it until the next scheduled check</button>';
 view.querySelectorAll('.opt').forEach(function(b){b.onclick=function(){
   var right=b.getAttribute('data-c')==='1';b.className='opt '+(right?'ok':'no');
   view.querySelectorAll('.opt').forEach(function(x){x.disabled=true});
   setTimeout(function(){finish(right)},700)}});
}
function finish(passed){
 progress(100);
 var score=passed?100:60;
 set('cmi.core.score.min','0');set('cmi.core.score.max','100');set('cmi.core.score.raw',score);
 var secs=Math.round((Date.now()-start)/1000),h=String(Math.floor(secs/3600)).padStart(4,'0'),m=String(Math.floor(secs%3600/60)).padStart(2,'0'),s=String(secs%60).padStart(2,'0');
 set('cmi.core.session_time',h+':'+m+':'+s);
 set('cmi.core.lesson_status',passed?'passed':'completed');
 commit();
 view.innerHTML='<div style="text-align:center"><p class="big">'+(passed?'🚀':'🛰️')+'</p><h1>'+(passed?'Cleared for launch!':'Checklist complete')+'</h1><p>Score: '+score+'%. Your result has been sent to the LMS.</p></div>';
}
if(api){connected=api.LMSInitialize('')==='true';}
if(connected){
 var name=get('cmi.core.student_name');
 document.getElementById('status').textContent='Connected to LMS as '+(name||'learner')+' · SCORM 1.2';
 if(get('cmi.core.lesson_status')==='not attempted')set('cmi.core.lesson_status','incomplete');
 window.addEventListener('beforeunload',function(){api.LMSFinish('')});
} else document.getElementById('status').textContent='Running standalone (no LMS found) — progress will not be saved.';
renderStep(0);
</script></body></html>`;

  return zipSync({ 'imsmanifest.xml': strToU8(manifest), 'index.html': strToU8(html) });
}
