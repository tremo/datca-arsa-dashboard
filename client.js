import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js';
import {getAuth,GoogleAuthProvider,onAuthStateChanged,signInWithPopup,signOut} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';
import {collection,doc,getDoc,getDocs,getFirestore,query,where,setDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';
const firebaseConfig={projectId:'datca-arsa',appId:'1:978587692621:web:0cf933d39328b1138d7604',storageBucket:'datca-arsa.firebasestorage.app',apiKey:'AIzaSyClWwdWqDg4ABvgyqkUAkGypFVJ9HJxGgY',authDomain:'datca-arsa.firebaseapp.com',messagingSenderId:'978587692621'};
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app),provider=new GoogleAuthProvider();
provider.setCustomParameters({prompt:'select_account'});
export const $=id=>document.getElementById(id);
export const esc=v=>String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const num=v=>v==null?'—':new Intl.NumberFormat('tr-TR',{maximumFractionDigits:1}).format(v);
export const money=v=>v==null?'Fiyat yok':new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:0}).format(v);
export const date=v=>v&&!Number.isNaN(Date.parse(v))?new Date(v).toLocaleString('tr-TR',{dateStyle:'short',timeStyle:'short'}):'Zaman kaydı yok';
export const safeUrl=v=>{try{const u=new URL(v);return u.protocol==='https:'?u.href:''}catch{return ''}};
export const link=(url,label)=>safeUrl(url)?`<a class="button" href="${esc(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`:'';
export const labels={official:'Resmî / bağımsız',statement:'Açık beyan',provisional:'Politika / provisional',pending:'Bekliyor',conflict:'Çelişkili'};
export const kindLabels={natural_sit:'Doğal sit',archaeological_sit:'Arkeolojik sit',neighbor_access:'Kadastral yol',route:'Mertur rotası'};
export const stageLabels={listingDetail:'İlan ayrıntısı',parcelIdentity:'Ada / parsel',officialParcel:'Resmî TKGM',verification:'Sit · yol · rota',finalReview:'Final inceleme',complete:'Final sonuçlandı',excluded:'Operasyonel eleme'};
export const badge=(text,grade='')=>`<span class="badge ${esc(grade)}">${esc(text)}</span>`;
export const area=r=>r.officialArea??r.listingArea;
export const route=r=>{if(r.routeMax==null&&r.routeKmMax==null)return 'Ölçüm bekliyor';const range=(lo,hi,unit)=>hi==null?null:`${lo!=null&&lo!==hi?num(lo)+'–':''}${num(hi)} ${unit}`;return [range(r.routeMin,r.routeMax,'dk')||'Süre kaydı yok',range(r.routeKmMin,r.routeKmMax,'km')].filter(Boolean).join(' · ')||'Ölçüm bekliyor'};
export function decode(v){if(Array.isArray(v))return v.map(x=>decode(x?.items??x));if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,decode(x)]));return v}
let epoch=0;
export function connect(onLoaded,onReset){
 const message=$('authMessage');
 $('signIn').onclick=async()=>{message.className='';message.textContent='Google giriş penceresi açılıyor…';try{await signInWithPopup(auth,provider)}catch(e){message.className='auth-error';message.textContent=e.code==='auth/popup-blocked'?'Giriş penceresi engellendi. Bu adresi Safari / Chrome’da açıp yeniden dene.':e.code==='auth/popup-closed-by-user'?'Giriş tamamlanmadı. Hazır olduğunda yeniden deneyebilirsin.':'Giriş tamamlanamadı: '+e.code}};
 $('signOut').onclick=()=>signOut(auth).catch(e=>{message.textContent='Çıkış yapılamadı: '+e.code});
 async function load(user){const token=++epoch;onReset();$('workspace').hidden=true;$('gate').hidden=false;$('signOut').hidden=!user;$('signIn').hidden=!!user;$('retry').hidden=true;message.className='';
 if(!user){$('gateTitle').textContent='Arsaların, tek bir yerde.';message.textContent='İlanlar ve kişisel notlar yalnız yetkili Google hesabına açıktır.';$('source').textContent='Özel araştırma · yalnızca yetkili hesap';return}
 $('gateTitle').textContent='Araştırman yükleniyor…';message.textContent='İlanlar, kanıtlar ve kişisel kararların hazırlanıyor.';
 try{const [m,l,f]=await Promise.all([getDoc(doc(db,'meta','status')),getDocs(query(collection(db,'listings'),where('dashboardIncluded','==',true))),getDocs(collection(db,'listingFeedback'))]);if(token!==epoch||!auth.currentUser)return;
 if(!m.exists())throw Error('Kaynak özeti bulunamadı');const meta=decode(m.data()),records=l.docs.map(d=>decode(d.data()));if(records.length!==meta.recordCount)throw Error('Kayıt sayısı kaynakla uyuşmuyor; yayın güncelleniyor olabilir');if(meta.schemaVersion!==2)throw Error('Yeni görünümün veri yayını henüz tamamlanmadı');
 await onLoaded({meta,records,feedback:new Map(f.docs.map(d=>[d.id,d.data()]))});if(token!==epoch)return;$('source').textContent=`Kaynak: ${date(meta.sourceUpdatedAt)} · ${records.length} ilan · ${meta.source}`;$('gate').hidden=true;$('workspace').hidden=false;
 }catch(e){if(token!==epoch)return;$('gateTitle').textContent='Veriler yüklenemedi';message.className='auth-error';message.textContent=e.code==='permission-denied'?'Bu hesabın erişim yetkisi yok. Çıkış yapıp yetkili Google hesabıyla giriş yap.':(e.code||e.message);$('retry').hidden=false}}
 $('retry').onclick=()=>load(auth.currentUser);onAuthStateChanged(auth,load);
}
export async function saveFeedback(id,note,decision){if(!auth.currentUser)throw Error('Oturum kapalı');const value={listingId:String(id),note,decision,updatedBy:auth.currentUser.email,updatedAt:serverTimestamp()};await setDoc(doc(db,'listingFeedback',String(id)),value,{merge:true});return {...value,updatedAt:new Date()}}
const assets=new Map();
export function clearAssets(){assets.clear()}
export async function getAsset(id){if(assets.has(id))return assets.get(id);const d=await getDoc(doc(db,'evidenceAssets',id));if(!d.exists())throw Error('Kanıt görseli bulunamadı');const v=d.data();if(!/^image\/(jpeg|png|webp)$/.test(v.mime))throw Error('Desteklenmeyen görsel');const src=`data:${v.mime};base64,${v.chunks.join('')}`;assets.set(id,src);return src}
