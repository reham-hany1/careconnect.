const APPOINTMENTS_KEY = "careconnect_appointments_v1";
const REMINDERS_KEY = "careconnect_reminders_v1";
const NOTIFIED_KEY = "careconnect_notified_appointments_v1";
const $ = (id) => document.getElementById(id);
let appointments = readSaved(APPOINTMENTS_KEY);
let reminders = readSaved(REMINDERS_KEY);

function readSaved(key) {
  try { const value = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(value) ? value : []; }
  catch { return []; }
}
function saveSaved(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch { alert("Your browser could not save this information. Try another browser."); }
}
function makeId() { return `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function formatDate(value) {
  const d = new Date(`${value}T12:00:00`);
  return { day: new Intl.DateTimeFormat("en",{day:"2-digit"}).format(d), month: new Intl.DateTimeFormat("en",{month:"short"}).format(d) };
}
function formatTime(value) {
  if (!value) return "";
  const [h,m] = value.split(":").map(Number), suffix = h >= 12 ? "PM" : "AM";
  return `${h%12 || 12}:${String(m).padStart(2,"0")} ${suffix}`;
}
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}

$("appointmentForm").addEventListener("submit", event => {
  event.preventDefault();
  const title = $("appointmentTitle").value.trim(), date = $("appointmentDate").value, time = $("appointmentTime").value;
  if (!title || !date || !time) return;
  if (date < todayString() && !confirm("This date is in the past. Save it anyway?")) return;
  appointments.push({id:makeId(),title,date,time,note:$("appointmentNote").value.trim(),reminderLead:Number($("reminderLead").value),completed:false});
  appointments.sort((a,b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  saveSaved(APPOINTMENTS_KEY,appointments); $("appointmentForm").reset(); $("appointmentDate").value=todayString(); renderAppointments();
});
$("reminderForm").addEventListener("submit", event => {
  event.preventDefault(); const text=$("reminderText").value.trim(); if(!text)return;
  reminders.unshift({id:makeId(),text}); saveSaved(REMINDERS_KEY,reminders); $("reminderForm").reset(); renderReminders();
});
$("appointmentList").addEventListener("click", event => {
  const button=event.target.closest("button[data-action]"); if(!button)return;
  const item=appointments.find(x=>x.id===button.dataset.id); if(!item)return;
  if(button.dataset.action==="toggle") item.completed=!item.completed;
  if(button.dataset.action==="delete"){if(!confirm("Delete this appointment?"))return;appointments=appointments.filter(x=>x.id!==item.id);}
  saveSaved(APPOINTMENTS_KEY,appointments); renderAppointments();
});
$("reminderList").addEventListener("click", event => {
  const button=event.target.closest("button[data-id]");if(!button)return;
  reminders=reminders.filter(x=>x.id!==button.dataset.id);saveSaved(REMINDERS_KEY,reminders);renderReminders();
});
function getNotifiedIds() {
  try { const value = JSON.parse(localStorage.getItem(NOTIFIED_KEY) || "[]"); return Array.isArray(value) ? value : []; }
  catch { return []; }
}
function setNotifiedIds(ids) { saveSaved(NOTIFIED_KEY, ids); }
function requestNotificationPermission() {
  if (!("Notification" in window)) {
    alert("This browser does not support notifications. Try an updated Chrome browser.");
    return;
  }
  if (location.protocol !== "https:" && location.hostname !== "localhost" && location.protocol !== "file:") {
    alert("Notifications work best when CareConnect is opened through its secure HTTPS website link.");
  }
  Notification.requestPermission().then(permission => {
    if (permission === "granted") alert("Notifications enabled on this device. Keep CareConnect open so it can check appointment times.");
    else alert("Notifications are not enabled. You can allow them in the browser's site settings.");
  }).catch(() => alert("Could not request notification permission in this browser."));
}
function checkAppointmentNotifications() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const now = Date.now();
  const notified = new Set(getNotifiedIds());
  let changed = false;
  appointments.forEach(item => {
    if (item.completed || notified.has(item.id) || !item.date || !item.time) return;
    const appointmentAt = new Date(`${item.date}T${item.time}`).getTime();
    const lead = Number.isFinite(Number(item.reminderLead)) ? Number(item.reminderLead) : 30;
    const notifyAt = appointmentAt - lead * 60 * 1000;
    // Notify once during the minute after the scheduled reminder time.
    if (now >= notifyAt && now < notifyAt + 60 * 1000 && appointmentAt > now) {
      try {
        const notification = new Notification("CareConnect appointment reminder", {
          body: `${item.title} is coming up${lead ? ` in ${lead >= 1440 ? "1 day" : lead >= 60 ? `${lead / 60} hour${lead === 60 ? "" : "s"}` : `${lead} minutes`}` : " now"}.`,
          tag: `careconnect-${item.id}`
        });
        notification.onclick = () => { window.focus(); notification.close(); };
        notified.add(item.id); changed = true;
      } catch (error) { console.warn("Notification could not be shown", error); }
    }
  });
  if (changed) setNotifiedIds([...notified]);
}
$("enableNotifications").addEventListener("click", requestNotificationPermission);
// Browser timers can be paused in background tabs; keep this page open for best results.
checkAppointmentNotifications();
setInterval(checkAppointmentNotifications, 15000);

function renderAppointments() {
  $("upcomingCount").textContent=appointments.filter(x=>!x.completed&&x.date>=todayString()).length;
  $("completedCount").textContent=appointments.filter(x=>x.completed).length;
  $("reminderCount").textContent=reminders.length;
  $("appointmentPill").textContent=`${appointments.length} total`;
  $("emptyHint").textContent=appointments.length?"Your saved schedule":"Your list will appear here.";
  if(!appointments.length){$("appointmentList").innerHTML='<div class="empty-state">No appointments yet. Add one using the form above.</div>';return;}
  $("appointmentList").innerHTML=appointments.map(x=>{
    const d=formatDate(x.date);
    return `<article class="appointment-item ${x.completed?"done":""}"><div class="date-tile"><b>${d.day}</b><small>${d.month}</small></div>
    <div class="appointment-info"><b>${escapeHTML(x.title)}</b><small>${formatTime(x.time)}${x.note?` · ${escapeHTML(x.note)}`:""}</small></div>
    <div class="item-actions"><button class="small-button" data-action="toggle" data-id="${x.id}">${x.completed?"Undo":"Complete"}</button><button class="small-button delete" data-action="delete" data-id="${x.id}">Delete</button></div></article>`;
  }).join("");
}
function renderReminders() {
  $("reminderCount").textContent=reminders.length;
  if(!reminders.length){$("reminderList").innerHTML='<div class="empty-state">No reminders saved yet.</div>';return;}
  $("reminderList").innerHTML=reminders.map(x=>`<div class="reminder-item"><p>${escapeHTML(x.text)}</p><button type="button" aria-label="Delete reminder" data-id="${x.id}">×</button></div>`).join("");
}
$("todayButton").addEventListener("click",()=> $("dashboard").scrollIntoView({behavior:"smooth"}));
$("appointmentDate").value=todayString();renderAppointments();renderReminders();
