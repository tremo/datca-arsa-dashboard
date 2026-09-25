import {$,esc,num,money,area,connect,decode} from './client.js';
import {installBasemaps,addParcelEvidence,fitParcel,googleSatelliteHref,parcelStyle} from './basemaps.js';
import {SCENARIO_STORAGE_KEY,defaultScenario,sanitizeScenario,scenarioFromUrl,scenarioVisible,scenarioIsDefault,scenarioParam} from './scenario.js';

let all=[],total=0,map=null,layer=null,shapes=new Map(),scenario=null,meta=null;

function init(){
  if(map)return;
  if(!window.L)throw Error('Harita kitaplığı yüklenemedi. Bağlantıyı kontrol edip yeniden dene.');
  map=L.map('map',{maxZoom:19}).setView([36.73,27.60],11);
  installBasemaps(map);
  layer=L.featureGroup().addTo(map);
}

function fit(){if(layer?.getLayers().length)map.fitBounds(layer.getBounds().pad(.08),{maxZoom:14})}

function statusStyle(r){
  const color=r.lifecycle==='excluded'?'#ff5b55':r.recommended?'#ffd94a':'#00d7ef';
  return {...parcelStyle,color,fillColor:color,fillOpacity:r.lifecycle==='excluded'?.16:.2,dashArray:r.lifecycle==='excluded'?'5 5':'9 5'};
}

function render(){
  if(!map)return;
  const q=$('mapSearch').value.trim().toLocaleLowerCase('tr'),status=$('mapStatus').value;
  const visible=all.filter(r=>(!q||`${r.id} ${r.neighborhood} ${r.parcel} ${r.title}`.toLocaleLowerCase('tr').includes(q))&&(!status||(status==='active'?r.lifecycle!=='excluded':status==='positive'?r.recommended:r.lifecycle==='excluded')));
  layer.clearLayers();shapes.clear();
  for(const r of visible){
    const params=new URLSearchParams();if(!scenarioIsDefault(scenario,meta))params.set('scenario',scenarioParam(scenario,meta));
    const google=googleSatelliteHref(r.centroid);
    const popup=`<strong>${esc(r.neighborhood)} · ${esc(r.parcel)}</strong><p>${money(r.price)} · ${num(area(r))} m²</p><p>${esc(r.lifecycle==='excluded'?'ELENDİ · '+(r.reason||'Operasyonel eleme'):r.category)}</p><a href="index.html${params.size?'?'+params:''}#ilan=${encodeURIComponent(r.id)}">Kanıtlar ve ilan detayı →</a>${google?`<br><a href="${esc(google)}" target="_blank" rel="noopener">Google Uydu’da aç ↗</a>`:''}`;
    const group=addParcelEvidence(layer,decode(r.geometry),r.centroid,{popup,style:statusStyle(r)});
    shapes.set(String(r.id),group);
  }
  $('mapCount').textContent=`${visible.length} / ${all.length} koordinatlı ilan`;
  $('mapNote').textContent=`${total-all.length} ilanda parsel geometrisi yok; haritada gösterilmez. Yüksek çözünürlüklü uydu görünümü Datça’da gerçek yararlı kaynak sınırı olan 18. düzeyde durur. Yol ve komşu kanıtları ilan ayrıntısındadır.`;
  $('mapResults').innerHTML=visible.length?visible.map(r=>`<button class="listing${r.lifecycle==='excluded'?' is-excluded':''}" data-id="${esc(r.id)}"><strong>${esc(r.neighborhood)} · ${esc(r.parcel)}</strong><h3>${esc(r.title)}</h3><small>${money(r.price)} · ${num(area(r))} m²</small><p class="muted">${esc(r.lifecycle==='excluded'?'ELENDİ · '+(r.reason||'Operasyonel eleme'):r.category)} · haritada odaklan ↗</p></button>`).join(''):'<div class="empty"><h3>Eşleşen parsel yok</h3><p>Filtreleri temizleyebilirsin.</p></div>';
}

$('mapSearch').oninput=render;
$('mapStatus').onchange=render;
$('fitMap').onclick=fit;
$('clearMap').onclick=()=>{$('mapSearch').value='';$('mapStatus').value='';render();fit()};
$('mapResults').onclick=e=>{const b=e.target.closest('[data-id]'),s=shapes.get(b?.dataset.id);if(s){fitParcel(map,s,18);s.openPopup();$('map').scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})}};

connect(({meta:m,records})=>{
  meta=m;const fromUrl=scenarioFromUrl(meta);if(fromUrl)scenario=fromUrl;else{try{scenario=sanitizeScenario(JSON.parse(localStorage.getItem(SCENARIO_STORAGE_KEY)||'null'),meta)}catch{scenario=defaultScenario(meta)}}
  const catalog=records.filter(r=>scenarioVisible(r,scenario));all=catalog.filter(r=>r.geometry&&r.centroid);total=catalog.length;init();render();
  requestAnimationFrame(()=>{map.invalidateSize();const id=new URLSearchParams(location.search).get('id'),s=shapes.get(id);if(s){fitParcel(map,s,18);s.openPopup()}else fit()});
},()=>{all=[];shapes.clear();layer?.clearLayers();$('mapResults').replaceChildren()});
