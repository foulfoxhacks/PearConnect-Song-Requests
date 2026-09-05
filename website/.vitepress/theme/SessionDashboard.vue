<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { sessionApi, displayTime } from './session-api';
import './session.css';
const session = ref(null), error = ref(''), message = ref(''), busy = ref(false), duration = ref(240), pairing = ref(true);
let timer, mounted = false;
async function refresh() {
  if (!mounted || busy.value) return;
  try { session.value = await sessionApi('dashboard/status'); error.value = ''; }
  catch (e) { error.value = e.message; if (e.code === 'unauthorized') session.value = null; }
}
async function update(values) {
  busy.value = true; error.value = ''; message.value = '';
  try { const result = await sessionApi('dashboard/update', values); session.value = { ...session.value, ...result }; message.value = values.end ? 'Session ended. Website requests are closed.' : values.minutes ? `Expiration updated: ${displayTime(result.expiresAt)}.` : 'Control saved. Desktop applies the change on its next connection check.'; }
  catch (e) { error.value = e.message; }
  finally { busy.value = false; }
}
async function logout() { busy.value = true; try { await sessionApi('dashboard/logout'); session.value = null; message.value = 'Browser disconnected. Pair again from Desktop when needed.'; } catch (e) { error.value = e.message; } finally { busy.value = false; } }
async function copyLink() { try { await navigator.clipboard.writeText(`${location.origin}/sessioncode#${session.value.code}`); message.value = 'Viewer link copied. It only permits song requests.'; } catch { message.value = `Share pearconnect.mellozone.site/sessioncode and code ${session.value.code}.`; } }
onMounted(async () => {
  mounted = true;
  const fragment = location.hash.slice(1); history.replaceState(null, '', location.pathname);
  try {
    if (fragment) {
      const match = fragment.match(/^pair=([A-HJ-NP-Z2-9]{8})\.([a-f0-9]{64})$/);
      if (!match) throw new Error('Invalid pairing link. Open the dashboard from Desktop again.');
      await sessionApi(`${match[1]}/pair`, { token: match[2] });
    }
    await refresh();
  } catch (e) { error.value = e.message; }
  finally { pairing.value = false; if (mounted) timer = setInterval(refresh, 5000); }
});
onUnmounted(() => { mounted = false; clearInterval(timer); });
</script>

<template>
  <main class="session-page dashboard-page">
    <header class="session-heading"><p class="session-eyebrow">PEARCONNECT · STREAM CONTROL</p><h1>Your session.<br>Your call.</h1><p>Manage your temporary request code from a browser paired with PearConnect Desktop.</p></header>
    <p v-if="pairing" class="session-status" role="status">Checking your desktop pairing…</p>
    <p v-if="error" class="session-error" role="alert">{{ error }}</p><p v-if="message" class="session-status" role="status">{{ message }}</p>
    <section v-if="!session && !pairing" class="session-pair-instructions"><h2>Start from Desktop.</h2><ol><li>Open <strong>Session-code fallback</strong> in PearConnect Desktop.</li><li>Create a code after connecting your player.</li><li>Select <strong>Open &amp; pair web dashboard</strong>.</li></ol><p>The pairing link works once and expires after two minutes. Your viewer code cannot open this dashboard. Pairing a new browser replaces the previous pairing.</p><a href="/docs/session-codes">Read the session-code guide →</a></section>
    <template v-if="session">
      <div class="session-metrics"><div><span>VIEWER CODE</span><strong class="session-large-code">{{ session.code }}</strong></div><div><span>DESKTOP</span><strong>{{ session.online ? 'Connected' : 'Offline' }}</strong></div><div><span>REQUEST INTAKE</span><strong>{{ session.ended ? 'Ended' : session.accepting ? 'Accepting' : 'Paused' }}</strong></div></div>
      <div class="session-layout"><section class="session-workflow"><h2>Control this stream</h2><p>Expires {{ displayTime(session.expiresAt) }}. Desktop must remain connected to accept requests.</p><div class="session-actions"><button class="session-primary" :disabled="busy || session.ended || (!session.accepting && (!session.online || !session.ready))" @click="update({ enabled: !session.accepting })">{{ session.accepting ? 'Pause website requests' : 'Enable website requests' }}</button><button :disabled="session.ended" @click="copyLink">Copy viewer link</button></div><p class="session-help">Pausing leaves music playing. TikTok command intake stays suspended while the fallback session exists. End the session to return to chat, then enable requests in Desktop.</p><form class="session-form" @submit.prevent="update({ minutes: Number(duration) })"><label for="session-minutes">Set expiration from now <small>15 minutes to 24 hours.</small></label><div class="session-input-row"><input id="session-minutes" v-model="duration" type="number" min="15" max="1440" required :disabled="session.ended"><button :disabled="busy || session.ended">Update expiration</button></div></form><div class="session-actions"><button :disabled="busy || session.ended" @click="update({ end: true })">End this session</button><button :disabled="busy" @click="logout">Disconnect this browser</button></div></section>
      <aside class="session-explainer"><h2>Connected to<br>your desktop.</h2><p>This dashboard controls the code, its expiry and website intake. Player credentials remain in Desktop.</p><p>A restricted request list disables website requests because visitors cannot prove a chat identity. Review your rules in Desktop.</p><p>After an interrupted connection, resume requests deliberately. Claimed requests are never automatically replayed.</p><a href="/docs/validation">Troubleshoot your command connection →</a></aside></div>
      <section class="session-history"><div class="session-step-heading"><span>RECENT</span><h2>Website request results</h2></div><p v-if="!session.recent?.length">Your viewers’ request results will appear here. Records expire after 15 minutes.</p><ul v-else><li v-for="row in session.recent" :key="row.id"><div><strong>{{ row.query }}</strong><span>{{ row.name }} · {{ displayTime(row.created) }}</span></div><p>{{ row.message }}</p></li></ul></section>
    </template>
  </main>
</template>
