import {$,esc,num,connect,loadV2Status} from './client.js';
const time=v=>v&&!Number.isNaN(Date.parse(v))?new Date(v).toLocaleString('tr-TR',{dateStyle:'short',timeStyle:'short'}):'—';
const clock=v=>v&&!Number.isNaN(Date.parse(v))?new Date(v).toLocaleTimeString('tr-TR',{timeStyle:'short'}):'—';
const sum=(rows,key)=>(rows||[]).reduce((n,r)=>n+(r[key]||0),0);
function render(s){
 if(!s){$('statusBody').innerHTML='<p class="notice">Durum verisi henüz yayınlanmadı. Verda’nın yayıncısı çalışıyorsa birkaç dakika sonra yenile.</p>';return}
 const age=(Date.now()-Date.parse(s.generatedAt))/60000,stale=age>20;
 const health=(s.health||[]).map(h=>`<li class="hl is-${esc(h.level)}"><i aria-hidden="true">${h.level==='ok'?'✓':h.level==='warn'?'!':'✕'}</i><span>${esc(h.text)}</span></li>`).join('');
 const listings=(s.listings||[]).map(l=>`<div class="st-tile"><b>${num(l.count)}</b><span>${esc(l.label)}</span></div>`).join('');
 const waiting=(s.waiting||[]).length?`<ul class="st-list">${s.waiting.map(w=>`<li><b>${num(w.waiting)}</b> ${esc(w.label)}</li>`).join('')}</ul>`:'<p class="dt-note">Şu an devredilecek iş yok.</p>';
 const refusals=(s.senderRefusals||[]).length?`<h3>Mesaj gönderilmeyenler</h3><ul class="st-list">${s.senderRefusals.map(w=>`<li><b>${num(w.count)}</b> ${esc(w.label)}</li>`).join('')}</ul>`:'';
 const done=(s.done||[]).map(d=>`<tr><td>${esc(d.label)}</td><td class="n">${num(d.done)}</td><td class="n${d.failed?' is-bad':''}">${d.failed?num(d.failed):'—'}</td></tr>`).join('');
 const sent=(s.sentToday||[]).map(m=>`<li><span>${esc(clock(m.at))}</span> <a href="index.html#ilan=${esc(m.listingId)}">#${esc(m.listingId)}</a></li>`).join('');
 const stuck=(s.stuck||[]).length?`<h3>Takılan görevler (son 6 saat)</h3><ul class="st-list">${s.stuck.map(x=>`<li><b>${num(x.count)}</b> ${esc(x.agent)} · ${esc(x.reason||'sebep yok')}</li>`).join('')}</ul>`:'';
 const recent=(s.recent||[]).map(e=>`<li class="ev is-${esc(e.kind)}"><time>${esc(time(e.at))}</time> ${esc(e.text)}</li>`).join('');
 $('statusMeta').textContent=`Son yayın ${time(s.generatedAt)}${stale?' · veri eski, yayıncı durmuş olabilir':''}`;
 $('statusBody').innerHTML=`${stale?'<p class="stale-banner" role="status">Yayın '+Math.round(age)+' dakikadır güncellenmedi; aşağıdakiler eski olabilir.</p>':''}
 <section class="st-card"><h2>Sağlık</h2><ul class="st-health">${health}</ul></section>
 <section class="st-card"><h2>İlan durumları</h2><div class="st-tiles">${listings}</div></section>
 <div class="st-cols">
  <section class="st-card"><h2>Bekleyen işler</h2>${waiting}${refusals}${stuck}</section>
  <section class="st-card"><h2>Bugün yapılanlar</h2><p class="dt-note">${num(s.factsToday)} olgu kaydedildi · ${num(s.photosToday)} fotoğraf · ${num(sum(s.done,'done'))} iş tamamlandı${sum(s.done,'failed')?` · ${num(sum(s.done,'failed'))} başarısız`:''}</p>
   <table class="st-table"><thead><tr><th>İş</th><th class="n">Tamam</th><th class="n">Hata</th></tr></thead><tbody>${done}</tbody></table>
   ${sent?`<h3>Bugün giden mesajlar (${num((s.sentToday||[]).length)})</h3><ul class="st-sent">${sent}</ul>`:''}</section>
 </div>
 <section class="st-card"><h2>Son olaylar</h2><ul class="st-events">${recent||'<li>Kayıt yok</li>'}</ul></section>`;
}
connect(async()=>{render(await loadV2Status())},()=>{});
