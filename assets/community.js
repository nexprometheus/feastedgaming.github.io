"use strict";
(async () => {
  const config = window.FEASTED_SUPABASE;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const read = async path => {
    const response = await fetch(config.url + '/rest/v1/' + path, {headers:{apikey:config.anonKey}});
    if(!response.ok) throw new Error('Unavailable');
    return response.json();
  };
  const schedule=document.getElementById('homeSchedule');
  const news=document.getElementById('homeAnnouncements');
  await Promise.allSettled([
    (async()=>{try {
      const items=await read('championship_schedule?select=title,starts_at,location&status=eq.scheduled&starts_at=gte.'+encodeURIComponent(new Date().toISOString())+'&order=starts_at.asc&limit=5');
      schedule.innerHTML=items.map(item=>`<span style="display:block;margin-bottom:12px"><strong>${escape(item.title)}</strong><br>${escape(new Date(item.starts_at).toLocaleString('en-US',{timeZone:'America/Los_Angeles',dateStyle:'medium',timeStyle:'short'}))} PT · ${escape(item.location)}</span>`).join('') || 'No upcoming tournaments published yet. Contact staff for weekly game nights.';
    } catch {schedule.textContent='The live schedule is unavailable. Please contact staff for event details.';}})(),
    (async()=>{try {
      const items=await read('championship_announcements?select=title,body&published=eq.true&order=created_at.desc&limit=3');
      news.innerHTML=items.map(item=>`<article><h4>${escape(item.title)}</h4><p>${escape(item.body).replace(/\n/g,'<br>')}</p></article>`).join('') || 'No current announcements. Check back for updates.';
    } catch {news.textContent='Live announcements are unavailable. Please contact staff for updates.';}})()
  ]);
})();
