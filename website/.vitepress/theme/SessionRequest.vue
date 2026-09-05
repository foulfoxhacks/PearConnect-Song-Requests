<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { sessionApi, displayTime } from './session-api';
import { receiptHeading, needsQueueCheck } from './receipt.js';
import './session.css';
const code = ref(''), name = ref(''), query = ref(''), session = ref(null), receipt = ref(null), busy = ref(false), error = ref(''), acknowledged = ref(false);
let pending = null, timer, mounted = false;
const normalized = () => code.value.toUpperCase().replace(/[\s-]/g, '');
function remember() { try { if (pending) sessionStorage.setItem('pearconnect-receipt', JSON.stringify(pending)); else sessionStorage.removeItem('pearconnect-receipt'); } catch { /* Storage is optional. */ } }
async function join() {
  if (busy.value) return;
  busy.value = true; error.value = '';
  try {
    if (!/^[A-HJ-NP-Z2-9]{8}$/.test(normalized())) throw new Error('Enter the 8-character code your streamer shared.');
    code.value = normalized(); session.value = await sessionApi(`${code.value}/public`);
    history.replaceState(null, '', `${location.pathname}#${code.value}`);
  } catch (e) { error.value = e.message; session.value = null; }
  finally { busy.value = false; }
}
async function checkReceipt() {
  if (!pending || !mounted) return;
  if (['done', 'rejected', 'expired'].includes(receipt.value?.state)) return;
  clearTimeout(timer);
  try { receipt.value = await sessionApi(`${pending.code}/result`, { id: pending.id }); pending.receipt = receipt.value; remember(); error.value = ''; }
  catch (e) { receipt.value = { state: 'uncertain', message: 'The receipt could not be checked. Ask the streamer to check the player before retrying.' }; error.value = `${e.message} Your request will not be automatically resubmitted.`; return; }
  if (['received', 'checking'].includes(receipt.value.state)) timer = setTimeout(checkReceipt, 3000);
}
async function submit() {
  if (busy.value || pending) return;
  busy.value = true; error.value = ''; acknowledged.value = false;
  pending = { code: code.value, id: crypto.randomUUID() }; remember();
  receipt.value = { state: 'sending', message: 'Sending your request. Please wait for the result.' };
  try {
    receipt.value = await sessionApi(`${pending.code}/submit`, { id: pending.id, name: name.value, query: query.value });
    if (['received', 'checking'].includes(receipt.value.state)) timer = setTimeout(checkReceipt, 1500);
  } catch (e) {
    if (['requests_paused', 'desktop_offline', 'session_expired', 'invalid_input', 'rate_limited', 'busy'].includes(e.code)) {
      receipt.value = { state: 'rejected', message: e.message };
    } else { receipt.value = { state: 'uncertain', message: 'The submission response was interrupted. Check the request status before sending another song.' }; error.value = e.message; }
  } finally { if (pending) { pending.receipt = receipt.value; remember(); } busy.value = false; }
}
function another() { clearTimeout(timer); pending = null; remember(); receipt.value = null; query.value = ''; error.value = ''; join(); }
onMounted(() => {
  mounted = true;
  code.value = location.hash.slice(1);
  try { const saved = JSON.parse(sessionStorage.getItem('pearconnect-receipt')); if (saved && /^[A-HJ-NP-Z2-9]{8}$/.test(saved.code) && /^[a-f0-9-]{36}$/.test(saved.id)) { pending = saved; code.value = saved.code; receipt.value = saved.receipt || { state: 'checking', message: 'Restoring your last request receipt…' }; if (['sending', 'received', 'checking', 'uncertain'].includes(receipt.value.state)) checkReceipt(); } } catch { /* No previous receipt. */ }
  if (code.value) join();
});
onUnmounted(() => { mounted = false; clearTimeout(timer); });
</script>

<template>
  <main class="session-page">
    <header class="session-heading"><p class="session-eyebrow">YOUR STREAM. YOUR NEXT SONG.</p><h1>A place in<br>the queue.</h1><p>Chat commands not connecting? Use the temporary code your streamer shared to send a song request.</p></header>
    <div class="session-layout">
      <section class="session-workflow" aria-label="Request a song">
        <div class="session-step-heading"><span>01</span><h2>Join your stream</h2></div>
        <form class="session-form" @submit.prevent="join"><label for="stream-code">Session code</label><div class="session-input-row"><input id="stream-code" v-model="code" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="12" placeholder="ABCD2345" required :disabled="!!receipt"><button :disabled="busy || !!receipt">{{ busy && !receipt ? 'Checking…' : 'Check code' }}</button></div></form>
        <p v-if="error" class="session-error" role="alert">{{ error }}</p>
        <div v-if="session" class="session-status" role="status"><strong>{{ session.accepting ? 'Website requests are open' : session.online ? 'Requests are paused' : 'Streamer’s desktop is offline' }}</strong><span>Code expires {{ displayTime(session.expiresAt) }}.</span><p v-if="!session.accepting">Wait for your streamer to enable website requests, then check the code again.</p></div>
        <template v-if="session && !receipt"><div class="session-step-heading"><span>02</span><h2>Choose your song</h2></div><form class="session-form" @submit.prevent="submit"><label for="viewer-name">Display name <small>Shown to your streamer; not a verified chat identity.</small></label><input id="viewer-name" v-model="name" required maxlength="60" autocomplete="nickname"><label for="song-query">Artist and song</label><input id="song-query" v-model="query" required maxlength="512" placeholder="Björk — Jóga"><p>Your streamer’s duration, blocked-phrase and request-limit rules still apply.</p><button class="session-primary" :disabled="busy || !session.accepting">Send song request <span aria-hidden="true">→</span></button></form></template>
        <section v-if="receipt" class="session-receipt" aria-live="polite"><p class="session-eyebrow">YOUR REQUEST RESULT</p><h2>{{ receiptHeading(receipt) }}</h2><p>{{ receipt.message }}</p><p v-if="receipt.code === 'added' && receipt.queueVerified">New requests go to the end of the existing player queue. The streamer can see them in PearConnect Desktop → Requests & queue. This confirms a queue entry, not that playback has started.</p><p v-if="receipt.code === 'added' && !receipt.queueVerified">This Desktop version did not verify the queue entry. Ask your streamer to check the player and update PearConnect to beta.4 or later before retrying.</p><button v-if="!['done','rejected','expired'].includes(receipt.state)" type="button" @click="checkReceipt">Check request status</button><template v-if="!['sending','received','checking'].includes(receipt.state)"><label v-if="needsQueueCheck(receipt)" class="session-checkbox"><input v-model="acknowledged" type="checkbox">I checked with the streamer before sending another request.</label><button class="session-text-button" :disabled="(needsQueueCheck(receipt)) && !acknowledged" @click="another">Request another song</button></template></section>
      </section>
      <aside class="session-explainer"><h2>One request.<br>A clear result.</h2><ol><li><strong>Send it once.</strong><p>“Received” means your request arrived. Desktop still needs to check it.</p></li><li><strong>Wait for confirmation.</strong><p>Only “Enqueue confirmed” means the player accepted your song.</p></li><li><strong>Give everyone a turn.</strong><p>Viewers on the same network share website request limits. Changing a display name doesn’t reset them.</p></li></ol><p>Streamers: create a code in <strong>PearConnect Desktop → Session-code fallback</strong>. Codes don’t grant dashboard access.</p><a href="/docs/session-codes">How session codes work →</a></aside>
    </div>
    <footer class="session-footer">Only submitted song requests go to the relay. Request records expire after 15 minutes; the desktop keeps its local activity history. <a href="/docs/security">Privacy &amp; security</a></footer>
  </main>
</template>
