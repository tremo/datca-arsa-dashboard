// Shared basemaps for both the compact evidence preview and full map.
// Esri World Imagery has useful native detail in Datça through zoom 18. Requests
// above that level return placeholder/resampled tiles here, so maxZoom is capped
// at 18 to avoid implying detail that the source does not contain.
export const BASEMAP_STORAGE_KEY='datca-basemap';

const selectedBasemap=()=>{try{return localStorage.getItem(BASEMAP_STORAGE_KEY)==='street'?'street':'satellite'}catch{return 'satellite'}};
const rememberBasemap=value=>{try{localStorage.setItem(BASEMAP_STORAGE_KEY,value)}catch{}};

export function installBasemaps(map,{compact=false}={}){
  if(!window.L)throw Error('Harita kitaplığı yüklenemedi.');
  const street=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxNativeZoom:19,maxZoom:19,
    attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap katkıcıları</a>'
  });
  const satellite=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{
    maxNativeZoom:18,maxZoom:18,tileSize:256,
    attribution:'Source: <a href="https://www.esri.com/">Esri</a>, Vantor, Earthstar Geographics ve GIS User Community'
  });
  const layers={street,satellite};
  layers[selectedBasemap()].addTo(map);
  const control=L.control.layers({'Harita':street,'Uydu · yüksek çözünürlük':satellite},null,{collapsed:compact,position:'topright'}).addTo(map);
  map.on('baselayerchange',event=>rememberBasemap(event.layer===satellite?'satellite':'street'));
  requestAnimationFrame(()=>{
    const container=control.getContainer();
    if(!container)return;
    container.setAttribute('aria-label','Harita katmanı seçimi: Uydu veya Harita');
    container.title='Uydu / Harita katmanını değiştir';
    container.querySelectorAll('input').forEach(input=>input.setAttribute('aria-label',input.parentElement?.textContent?.trim()||'Harita katmanı'));
  });
  return {layers,control};
}

export const parcelStyle={color:'#00d7ef',weight:4,opacity:1,fillColor:'#ffe36e',fillOpacity:.2,dashArray:'9 5'};

export function addParcelEvidence(map,geometry,centroid,{popup=null,style=parcelStyle}={}){
  const group=L.featureGroup().addTo(map);
  if(geometry){
    L.geoJSON(geometry,{style}).addTo(group);
  }
  if(Array.isArray(centroid)&&centroid.length>=2){
    L.circleMarker([centroid[1],centroid[0]],{radius:7,color:'#fffefa',weight:3,fillColor:style.color||'#ffe36e',fillOpacity:1})
      .bindTooltip('Parsel merkezi',{direction:'top'}).addTo(group);
  }
  if(popup)group.bindPopup(popup);
  return group;
}

export function fitParcel(map,group,maxZoom=18){
  const bounds=group?.getBounds?.();
  if(bounds?.isValid?.())map.fitBounds(bounds.pad(.35),{maxZoom});
}

export function googleSatelliteHref(centroid,zoom=19){
  if(!Array.isArray(centroid)||centroid.length<2)return null;
  const [lng,lat]=centroid.map(Number);
  if(!Number.isFinite(lat)||!Number.isFinite(lng))return null;
  const params=new URLSearchParams({api:'1',map_action:'map',center:`${lat},${lng}`,zoom:String(zoom),basemap:'satellite'});
  return `https://www.google.com/maps/@?${params}`;
}
