import {$,esc,num,money,readableTitle,connect,safeUrl,areaFacts,comparisonShort,routeShort,decisionMark,seenPill,addedAt,addedLabel,dayText,loadUserState,saveUserState,lastViewed} from './client.js';
import {criterionModel,shortDate} from './evidence.js';
import {effectiveRecords} from './facts.js';
import {loadLocalSeen,mergeSeen,seenState} from './seen.js';

// Every listing marked ⭐ kısa liste or “Belki”, side by side. Rows are listings,
// columns the facts Mert compares; the best value of a column is marked green.
// Rows follow Mert's own order (drag the ⠿ handle) until a column is sorted.
let rows=[],feedback=new Map(),seen={},show='all',sortKey='',sortDir=1,order=[],drag=null;
const ORDER_STORE='datca-compare-order';
const brief=(t,max)=>{const s=String(t||'').replace(/\s+/g,' ').trim();return s.length>max?s.slice(0,max-1).trim()+'…':s};
const decisionOf=r=>feedback.get(String(r.id))?.decision;
const noteOf=r=>String(feedback.get(String(r.id))?.note||'').trim();
const areaValue=r=>r.ownershipScreen?.status==='shared'?r.listingArea??null:r.officialArea??r.listingArea??null;
// Criteria sort from settled-and-fine to eliminating.
const STATE_ORDER={yes:0,penalty:1,edge:2,uncertain:2,nosrc:3,nores:3,unknown:4,no:5};
function criterionCell(r,key){const c=criterionModel(r,key);return `<span class="cmp-crit state-${esc(c.state)}${c.user?' is-user':''}" title="${esc(c.sub||'')}"><i aria-hidden="true">${esc(c.icon)}</i>${esc(c.text.replace(/^(Kadastral yol|Doğal sit|Arkeolojik sit|Tapu kaydı):\s*/,''))}</span>`}
function elevationCell(r){const e=r.elevation||{};if(e.status!=='estimated')return '—';return e.min_m!=null&&e.max_m!=null&&e.min_m!==e.max_m?`${num(e.min_m)}–${num(e.max_m)} m`:`${num(e.elevation_m)} m`}
// best: which end of a numeric column is better for a buyer.
const COLUMNS=[
 {key:'price',label:'Fiyat',best:'min',num:true,value:r=>r.price??null,cell:r=>money(r.price)},
 {key:'area',label:'Alan',best:'max',num:true,value:areaValue,cell:r=>{const a=areaFacts(r);return `${esc(a.value)}${a.note?`<small>${esc(a.note)}</small>`:''}`}},
 {key:'unit',label:'m² fiyatı',best:'min',num:true,value:r=>areaFacts(r).unit??null,cell:r=>{const a=areaFacts(r);return a.unit==null?'—':`${money(a.unit)}${a.unitNote?`<small>${esc(a.unitNote)}</small>`:''}`}},
 {key:'discount',label:'Emsale göre',best:'max',value:r=>r.comparison?.discountPct??null,cell:r=>esc(comparisonShort(r))},
 {key:'type',label:'Nitelik',value:r=>r.officialType&&r.officialType!=='—'?r.officialType:null,cell:r=>esc(r.officialType&&r.officialType!=='—'?r.officialType:'—')},
 {key:'route',label:'Mertur’a',best:'min',num:true,value:r=>r.routeMax??null,cell:r=>`${esc(routeShort(r))}${r.routeKmMax!=null?`<small>${num(r.routeKmMax)} km</small>`:''}`},
 {key:'road',label:'Kadastral yol',value:r=>STATE_ORDER[criterionModel(r,'road').state]??4,cell:r=>criterionCell(r,'road')},
 {key:'natural',label:'Doğal sit',value:r=>STATE_ORDER[criterionModel(r,'natural').state]??4,cell:r=>criterionCell(r,'natural')},
 {key:'archaeological',label:'Arkeolojik sit',value:r=>STATE_ORDER[criterionModel(r,'archaeological').state]??4,cell:r=>criterionCell(r,'archaeological')},
 {key:'parcel',label:'Tapu kaydı',value:r=>STATE_ORDER[criterionModel(r,'parcel').state]??4,cell:r=>criterionCell(r,'parcel')},
 {key:'elevation',label:'Rakım',num:true,value:r=>r.elevation?.status==='estimated'?r.elevation.elevation_m:null,cell:elevationCell},
 {key:'score',label:'Puan',best:'max',num:true,value:r=>r.lifecycle==='excluded'?null:Number(r.score),cell:r=>r.lifecycle==='excluded'?'Puan dışı':num(r.score)},
 {key:'added',label:'Eklendi',value:r=>Date.parse(addedAt(r))||null,cell:r=>addedAt(r)?`<span title="${esc(addedLabel(r))}: ${esc(dayText(addedAt(r)))}">${esc(shortDate(addedAt(r)))}</span>`:'—'},
 {key:'note',label:'Notun',value:r=>noteOf(r)||null,cell:r=>noteOf(r)?esc(brief(noteOf(r),90)):'—'},
];
const DEFAULT_ORDER=(a,b)=>(decisionOf(a)==='shortlist'?0:1)-(decisionOf(b)==='shortlist'?0:1)||(a.lifecycle==='excluded')-(b.lifecycle==='excluded')||(a.rank??Infinity)-(b.rank??Infinity);
// Mert's order; listings added to the lists later go to the end until he places them.
function manualSorted(list){const pos=new Map(order.map((id,i)=>[id,i]));return list.slice().sort((a,b)=>{const x=pos.get(String(a.id)),y=pos.get(String(b.id));return x!=null&&y!=null?x-y:x!=null?-1:y!=null?1:DEFAULT_ORDER(a,b)})}
function sorted(list){
 const col=COLUMNS.find(c=>c.key===sortKey);if(!col)return manualSorted(list);
 // Unknown values stay at the bottom in both directions.
 return list.slice().sort((a,b)=>{const x=col.value(a),y=col.value(b);if(x==null||y==null)return (x==null)-(y==null)||DEFAULT_ORDER(a,b);return (typeof x==='string'?x.localeCompare(y,'tr'):x-y)*sortDir||DEFAULT_ORDER(a,b)});
}
// The order is kept in this browser and in userState/compare; the later save wins.
const iso=v=>typeof v?.toDate==='function'?v.toDate().toISOString():typeof v==='string'?v:'';
function readLocalOrder(){try{const v=JSON.parse(localStorage.getItem(ORDER_STORE)||'null');return v&&Array.isArray(v.order)?v:null}catch{return null}}
function pickOrder(local,remote){const r=Array.isArray(remote?.order)?{order:remote.order,at:iso(remote.updatedAt)}:null,best=!local?r:!r?local:r.at>String(local.at||'')?r:local;return (best?.order||[]).map(String)}
function saveOrder(ids){order=ids;try{localStorage.setItem(ORDER_STORE,JSON.stringify({order:ids,at:new Date().toISOString()}))}catch{}saveUserState('compare',{order:ids}).catch(()=>{})}
// A drag inside a filtered view keeps the hidden rows where they were.
function reorder(visibleIds){const visible=new Set(visibleIds),full=manualSorted(rows).map(r=>String(r.id));let i=0;return full.map(id=>visible.has(id)?visibleIds[i++]:id)}
// The best value per column, only when at least two listings can be compared and they differ.
function bests(list){const out={};for(const col of COLUMNS.filter(c=>c.best)){const values=list.map(col.value).filter(v=>v!=null&&Number.isFinite(v));if(values.length<2||Math.min(...values)===Math.max(...values))continue;out[col.key]=col.best==='min'?Math.min(...values):Math.max(...values)}return out}
function titleCell(r,index){
 const id=String(r.id),url=safeUrl(r.listingUrl),tkgm=safeUrl(r.parcelUrl),parcel=r.parcel&&r.parcel!=='—'?r.parcel:'',own=r.published&&r.published.parcel!==r.parcel?r.published.parcel:'';
 const place=[r.neighborhood&&r.neighborhood!=='—'?r.neighborhood:'',parcel||'ada/parsel bilinmiyor'].filter(Boolean).join(' · ');
 const handle=sortKey?'':`<span class="cmp-order"><b>${index+1}</b><button type="button" class="cmp-handle" aria-label="${esc(brief(readableTitle(r.title),40))}: sırasını değiştir; sürükle ya da yukarı/aşağı ok tuşuna bas" title="Sürükleyerek sırala">⠿</button></span>`;
 // The TKGM link opens the parcel the pipeline found; after a hand-entered ada/parsel it says so.
 const tkgmLink=tkgm?`<a href="${esc(tkgm)}" target="_blank" rel="noopener noreferrer">TKGM · ${esc(own?`sistemdeki ${own}`:parcel||'parsel')} ↗</a>`:'';
 return `<th scope="row"><div class="cmp-row-head">${handle}<div class="cmp-row-body"><a class="cmp-title" href="index.html#ilan=${encodeURIComponent(id)}">${decisionMark(decisionOf(r))}${seenPill(seenState(r,seen,decisionOf(r)))}${esc(brief(readableTitle(r.title),72))}</a><small>${esc(place)} · #${esc(id)}</small>${id===lastViewed()?'<span class="last-tag">Son baktığın</span>':''}<span class="cmp-meta">${tkgmLink}${url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Sahibinden ↗</a>`:''}</span></div></div></th>`;
}
function render(){
 const counts={all:rows.length,shortlist:rows.filter(r=>decisionOf(r)==='shortlist').length,maybe:rows.filter(r=>decisionOf(r)==='maybe').length};
 $('compareChips').innerHTML=[['all','Hepsi'],['shortlist','★ Kısa liste'],['maybe','☆ Belki']].map(([key,label])=>`<button type="button" data-show="${key}" aria-pressed="${show===key}">${esc(label)} <b>${num(counts[key])}</b></button>`).join('');
 const list=sorted(rows.filter(r=>show==='all'||decisionOf(r)===show)),best=bests(list),seenId=lastViewed();
 $('compareCount').textContent=list.length?`${num(list.length)} ilan yan yana`:'';
 if(!rows.length){$('compareTable').innerHTML='<div class="empty"><h3>Karşılaştıracak ilan yok</h3><p>İlanlar sayfasında bir ilanın detayını açıp “⭐ Kısa liste” ya da “Belki” de; burada yan yana görünür.</p><a class="button" href="index.html">İlanlara git</a></div>';return}
 const head=`<thead><tr><th scope="col"${sortKey?'':' aria-sort="none"'}><button type="button" data-sort="" class="cmp-own${sortKey?'':' is-on'}">Benim sıram</button></th>${COLUMNS.map(c=>`<th scope="col"${sortKey===c.key?` aria-sort="${sortDir>0?'ascending':'descending'}"`:''}${c.num?' class="num"':''}><button type="button" data-sort="${c.key}">${esc(c.label)}${sortKey===c.key?`<span aria-hidden="true">${sortDir>0?' ↑':' ↓'}</span>`:''}</button></th>`).join('')}</tr></thead>`;
 const body=list.map((r,i)=>`<tr data-id="${esc(r.id)}" class="${[r.lifecycle==='excluded'?'is-excluded':'',String(r.id)===seenId?'is-last-viewed':''].filter(Boolean).join(' ')}">${titleCell(r,i)}${COLUMNS.map(c=>{const v=c.value(r),isBest=best[c.key]!=null&&v===best[c.key];return `<td class="${[c.num?'num':'',isBest?'is-best':''].filter(Boolean).join(' ')}"${isBest?' title="Bu sütunun en iyisi"':''}>${c.cell(r)}</td>`}).join('')}</tr>`).join('');
 $('compareTable').innerHTML=`<table class="compare${sortKey?'':' is-manual'}">${head}<tbody>${body}</tbody></table>`;
}
// Back from a listing's detail: its row is shown and briefly highlighted.
function revealLastViewed(){const tr=[...$('compareTable').querySelectorAll('tr[data-id]')].find(x=>x.dataset.id===lastViewed());if(!tr)return;const b=tr.getBoundingClientRect();if(b.top<0||b.bottom>innerHeight)tr.scrollIntoView({block:'center'});tr.classList.add('flash');setTimeout(()=>tr.classList.remove('flash'),1600)}
const tbody=()=>$('compareTable').querySelector('tbody');
function commitOrder(moved){saveOrder(reorder([...tbody().children].map(tr=>tr.dataset.id)));render();$('compareCount').textContent='Sıran kaydedildi';if(moved)$('compareTable').querySelector(`tr[data-id="${CSS.escape(moved)}"] .cmp-handle`)?.focus()}
$('compareChips').onclick=e=>{const b=e.target.closest('[data-show]');if(!b)return;show=b.dataset.show;render()};
// First tap sorts best-first where a column has a better end; a second tap reverses. “Benim sıram” returns to Mert's order.
$('compareTable').addEventListener('click',e=>{const b=e.target.closest('[data-sort]');if(!b)return;const key=b.dataset.sort;if(!key){sortKey='';render();$('compareTable').querySelector('[data-sort=""]')?.focus();return}const col=COLUMNS.find(c=>c.key===key);if(sortKey===key)sortDir=-sortDir;else{sortKey=key;sortDir=col.best==='max'?-1:1}render();$('compareTable').querySelector(`[data-sort="${key}"]`)?.focus()});
// Dragging works with a mouse and a finger; the page scrolls when the row reaches the screen edge.
$('compareTable').addEventListener('pointerdown',e=>{const h=e.target.closest('.cmp-handle');if(!h||sortKey)return;e.preventDefault();const tr=h.closest('tr');drag={tr,pointer:e.pointerId};tr.classList.add('is-dragging');try{h.setPointerCapture(e.pointerId)}catch{}});
$('compareTable').addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.pointer)return;for(const row of tbody().children){if(row===drag.tr)continue;const b=row.getBoundingClientRect();if(e.clientY>b.top&&e.clientY<b.bottom){tbody().insertBefore(drag.tr,e.clientY<b.top+b.height/2?row:row.nextSibling);break}}if(e.clientY<70)scrollBy(0,-12);else if(e.clientY>innerHeight-70)scrollBy(0,12)});
const endDrag=e=>{if(!drag||e.pointerId!==drag.pointer)return;const id=drag.tr.dataset.id;drag.tr.classList.remove('is-dragging');drag=null;commitOrder(id)};
$('compareTable').addEventListener('pointerup',endDrag);$('compareTable').addEventListener('pointercancel',endDrag);
$('compareTable').addEventListener('keydown',e=>{const h=e.target.closest('.cmp-handle');if(!h||!['ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const tr=h.closest('tr'),next=e.key==='ArrowUp'?tr.previousElementSibling:tr.nextElementSibling;if(!next)return;tbody().insertBefore(tr,e.key==='ArrowUp'?next:next.nextSibling);commitOrder(tr.dataset.id)});
// Coming back with the browser's back button can show a stored copy of this page; it is loaded again so decisions made in the detail count.
addEventListener('pageshow',e=>{if(e.persisted)location.reload()});
connect(async({records,feedback:f,seen:remoteSeen})=>{feedback=f;seen=mergeSeen(loadLocalSeen(),remoteSeen);rows=effectiveRecords(records,f).filter(r=>['shortlist','maybe'].includes(decisionOf(r)));order=pickOrder(readLocalOrder(),await loadUserState('compare'));render();requestAnimationFrame(revealLastViewed)},()=>{rows=[];feedback=new Map();seen={};order=[];$('compareTable').replaceChildren();$('compareChips').replaceChildren()});
