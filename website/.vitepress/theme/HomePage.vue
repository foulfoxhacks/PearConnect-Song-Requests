<script setup>
import { ref } from 'vue';
const menuOpen = ref(false);
const download = 'https://github.com/foulfoxhacks/PearConnect-Song-Requests/releases/download/v0.3.0-beta.1/PearConnect-0.3.0-beta.1-win-x64.zip';
</script>

<template>
  <div class="landing">
    <a href="#content" class="home-skip">Skip to content</a>
    <header class="home-header">
      <a class="home-brand" href="/" aria-label="PearConnect home"><img src="/pear.svg" width="29" height="34" alt="" aria-hidden="true"><span>Pear<span>Connect</span></span></a>
      <button class="menu-toggle" :aria-expanded="menuOpen" aria-controls="home-nav" @click="menuOpen = !menuOpen">Menu <span aria-hidden="true">☰</span></button>
      <nav id="home-nav" aria-label="Main navigation" :class="{ open: menuOpen }">
        <a href="#how-it-works" @click="menuOpen = false">How it works</a>
        <a href="/docs/">Documentation</a>
        <a href="/docs/faq">FAQ</a>
        <a href="https://github.com/foulfoxhacks/PearConnect-Song-Requests">GitHub <span aria-hidden="true">↗</span></a>
        <a href="#download" class="nav-download" @click="menuOpen = false">Download <span aria-hidden="true">↓</span></a>
      </nav>
    </header>

    <main id="content">
      <section class="hero" aria-labelledby="hero-title">
        <div class="hero-inner">
          <p class="kicker"><span aria-hidden="true"></span> YOUR STREAM. IN TUNE.</p>
          <h1 id="hero-title">Good music.<br><em>Great company.</em></h1>
          <p class="hero-description">Give your community a place in the queue. PearConnect brings live chat song requests to Pear Desktop, with you in control.</p>
          <div class="hero-actions"><a class="download-button" :href="download"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5l8-1v7H3zm10-1 8-1v8h-8zM3 13h8v7l-8-1zm10 0h8v8l-8-1z"/></svg>Download for Windows <span aria-hidden="true">↓</span></a><a href="/docs/" class="guide-link">Read the setup guide <span aria-hidden="true">→</span></a></div>
          <p class="release-caption">Free &amp; open source <span>·</span> Windows x64 <span>·</span> v0.3.0-beta.1 preview</p>
        </div>
        <figure class="hero-product"><div class="product-label"><span class="live-mark" aria-hidden="true"></span> PEARCONNECT DESKTOP <span class="preview-label">PRODUCT PREVIEW</span></div><img src="/desktop-overview.png" width="1839" height="1220" fetchpriority="high" decoding="async" alt="PearConnect desktop showing player connection, request intake, input activity and recent request results"><figcaption>One view for your music, connections and requests. Shown with sample data.</figcaption></figure>
      </section>

      <div class="compatibility"><span>BUILT AROUND YOUR STREAM</span><p>Pear Desktop <b>+</b> TikFinity <b>/</b> Streamer.bot <b>/</b> Twitch <b>/</b> YouTube</p></div>

      <section class="how section-wrap" id="how-it-works" aria-labelledby="how-title"><div class="section-heading"><p class="kicker">FROM CHAT TO YOUR QUEUE</p><h2 id="how-title">A few connections.<br>A whole new soundtrack.</h2><p>PearConnect runs on your computer. Your player handles the music; PearConnect handles the requests.</p></div><ol class="how-steps"><li><span>01</span><div><h3>Connect your music</h3><p>Open Pear Desktop, enable its API Server plugin and authorize PearConnect.</p><a href="/docs/player">Player setup <span aria-hidden="true">↗</span></a></div></li><li><span>02</span><div><h3>Bring in your chat</h3><p>Connect TikFinity Desktop for Simple mode, or keep your Streamer.bot automation in Advanced.</p><a href="/docs/simple">Choose your connection <span aria-hidden="true">↗</span></a></div></li><li><span>03</span><div><h3>Open the requests</h3><p>Set your rules, run a safe test and enable requests when you’re ready.</p><a href="/docs/rules">Make the rules yours <span aria-hidden="true">↗</span></a></div></li></ol></section>

      <section class="connections-section section-wrap" aria-labelledby="connections-title"><div class="section-heading"><p class="kicker">YOUR SETUP, YOUR CHOICE</p><h2 id="connections-title">Simple to start.<br>Room to make it yours.</h2></div><div class="connection-options"><article><p class="option-label">SIMPLE <span>RECOMMENDED</span></p><h3>TikFinity Connection</h3><p>Receive chat events straight from TikFinity Desktop. No Streamer.bot actions to configure.</p><p class="route">TikFinity <span aria-hidden="true">→</span> PearConnect <span aria-hidden="true">→</span> Pear Desktop</p><a href="/docs/simple">Set up Simple <span aria-hidden="true">→</span></a></article><article><p class="option-label">ADVANCED</p><h3>Streamer.bot &amp; Automation</h3><p>Keep your custom actions, event workflows and authenticated local integrations.</p><p class="route">Streamer.bot <span aria-hidden="true">→</span> PearConnect <span aria-hidden="true">→</span> Pear Desktop</p><a href="/docs/advanced">Set up Advanced <span aria-hidden="true">→</span></a></article></div><p class="section-note">Both modes work with the desktop app or CLI and use the same request rules. TikTok input requires TikFinity Desktop on the same computer.</p></section>

      <section class="control-section section-wrap" aria-labelledby="control-title"><div class="section-heading"><p class="kicker">KEEP THE STREAM YOURS</p><h2 id="control-title">The queue is open.<br>You’re still in control.</h2></div><dl class="feature-list"><div><dt>Rules that travel with you</dt><dd>Cooldowns, song-length limits, blocked phrases and request permissions apply across your inputs.</dd></div><div><dt>Pause requests. Keep the music.</dt><dd>Stop accepting new songs at any time. Existing playback stays with Pear Desktop.</dd></div><div><dt>Know what happened</dt><dd>See accepted, rejected and uncertain results. Request history and the player queue have their own views.</dd></div><div><dt>A window, or your own workflow</dt><dd>Use the desktop console or run the same engine from a terminal. One engine instance keeps your counters together.</dd></div></dl></section>

      <section class="download-section section-wrap" id="download" aria-labelledby="download-title"><div><p class="kicker">READY WHEN YOU ARE</p><h2 id="download-title">Your next stream<br>starts with a request.</h2><p>Download the Windows preview, extract the complete folder and open PearConnect. No separate Node.js or Git installation needed.</p></div><div class="download-options"><a class="download-button" :href="download">Download for Windows <span aria-hidden="true">↓</span></a><p>v0.3.0-beta.1 · x64 · portable ZIP</p><a href="/docs/install">Installation &amp; requirements <span aria-hidden="true">→</span></a><a href="/docs/cli">Prefer the CLI? Start here <span aria-hidden="true">→</span></a><div class="preview-note"><strong>This is a preview release.</strong><p>The Windows build is unsigned. Live-platform and fresh-machine acceptance are still in progress. Review the <a href="/docs/releases">release notes</a> before using it on stream.</p></div></div></section>

      <section class="help-line section-wrap"><h2>A little guidance goes a long way.</h2><a href="/docs/">Explore the documentation <span aria-hidden="true">→</span></a></section>
    </main>
    <footer class="home-footer"><a class="home-brand" href="/"><img src="/pear.svg" width="23" height="28" alt="" aria-hidden="true"><span>Pear<span>Connect</span></span></a><p>Independent community software. Not affiliated with TikTok, TikFinity or Pear Desktop.</p><div><a href="https://github.com/foulfoxhacks">By FoulFoxHacks</a><a href="/docs/security">Privacy &amp; security</a><a href="https://github.com/foulfoxhacks/PearConnect-Song-Requests/blob/main/LICENSE">MIT license</a></div></footer>
  </div>
</template>
