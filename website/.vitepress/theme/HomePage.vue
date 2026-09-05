<script setup>
import { ref } from 'vue';
import previewSmall from './assets/desktop-480.webp';
import previewMedium from './assets/desktop-960.webp';
import previewLarge from './assets/desktop-1600.webp';

const menuOpen = ref(false);
const download = 'https://github.com/foulfoxhacks/PearConnect-Song-Requests/releases/download/v0.3.0-beta.1/PearConnect-0.3.0-beta.1-win-x64.zip';
</script>

<template>
  <div class="landing">
    <a href="#content" class="home-skip">Skip to content</a>
    <header class="home-header" @keydown.esc="menuOpen = false">
      <a class="home-brand" href="/" aria-label="PearConnect home">
        <img src="/pear.svg" width="29" height="34" alt="" aria-hidden="true">
        <span>Pear<span>Connect</span></span>
      </a>
      <button class="menu-toggle" :aria-expanded="menuOpen" aria-controls="home-nav" @click="menuOpen = !menuOpen">
        {{ menuOpen ? 'Close' : 'Menu' }} <span aria-hidden="true">{{ menuOpen ? '×' : '☰' }}</span>
      </button>
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
          <p class="kicker"><span class="status-dot" aria-hidden="true"></span> SONG REQUESTS FOR YOUR STREAM</p>
          <h1 id="hero-title">Your stream.<br><em>In tune.</em></h1>
          <p class="hero-description">Turn live chat into your next song. Connect your community to Pear Desktop, with you in control of every request.</p>
          <div class="hero-actions">
            <a class="download-button" :href="download">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5l8-1v7H3zm10-1 8-1v8h-8zM3 13h8v7l-8-1zm10 0h8v8l-8-1z"/></svg>
              Download for Windows <span aria-hidden="true">↓</span>
            </a>
            <a href="/docs/" class="guide-link">Read the setup guide <span aria-hidden="true">→</span></a>
          </div>
          <p class="release-caption">Free &amp; open source <span>·</span> v0.3.0-beta.1 preview</p>
          <p class="hero-detail">Windows x64. Portable download. No separate runtime to install.</p>
        </div>
        <figure class="hero-product">
          <div class="product-label"><span>PEARCONNECT DESKTOP</span><span>APP PREVIEW / 01</span></div>
          <img :src="previewLarge" :srcset="`${previewSmall} 480w, ${previewMedium} 960w, ${previewLarge} 1600w`"
            sizes="(max-width: 800px) calc(100vw - 40px), (max-width: 1440px) 55vw, 770px"
            width="1600" height="1061" fetchpriority="high" decoding="async"
            alt="PearConnect desktop showing player connection, request intake, input activity and recent request results">
          <figcaption><span>Your music. Your connections. One view.</span><span>Shown with sample data.</span></figcaption>
        </figure>
      </section>

      <div class="compatibility section-width">
        <span>WORKS WITH YOUR SETUP</span>
        <ul aria-label="Supported integrations"><li>Pear Desktop</li><li>TikFinity</li><li>Streamer.bot</li><li>Twitch</li><li>YouTube</li></ul>
      </div>

      <section class="how section-wrap" id="how-it-works" aria-labelledby="how-title">
        <div class="section-heading"><p class="kicker">01 / GET CONNECTED</p><h2 id="how-title">From chat to queue.<br>In three steps.</h2><p>Your player handles the music. PearConnect handles the requests.</p></div>
        <ol class="how-steps">
          <li><span class="step-number">01</span><h3>Connect your music</h3><p>Enable Pear Desktop’s API Server plugin and authorize PearConnect.</p><a href="/docs/player">Player setup <span aria-hidden="true">↗</span></a></li>
          <li><span class="step-number">02</span><h3>Bring in your chat</h3><p>Connect TikFinity directly, or keep your Streamer.bot automation.</p><a href="/docs/simple">Connection guide <span aria-hidden="true">↗</span></a></li>
          <li><span class="step-number">03</span><h3>Open the requests</h3><p>Set your rules, run a safe test and enable requests when you’re ready.</p><a href="/docs/rules">Set your rules <span aria-hidden="true">↗</span></a></li>
        </ol>
      </section>

      <section class="connections-section section-wrap" aria-labelledby="connections-title">
        <div class="section-heading"><p class="kicker">02 / CHOOSE YOUR CONNECTION</p><h2 id="connections-title">Start simple.<br>Make it yours.</h2><p>The same commands and safeguards, whichever route you choose.</p></div>
        <div class="connection-options">
          <article>
            <div class="option-heading"><span class="option-label">SIMPLE</span><span class="recommendation">Recommended for new setups</span></div>
            <h3>TikFinity Connection</h3><p>Receive chat events straight from TikFinity Desktop. No Streamer.bot actions to configure.</p>
            <p class="route">TikFinity <span aria-hidden="true">→</span> PearConnect <span aria-hidden="true">→</span> Pear Desktop</p>
            <a href="/docs/simple">Set up Simple <span aria-hidden="true">→</span></a>
          </article>
          <article>
            <div class="option-heading"><span class="option-label">ADVANCED</span><span>For existing automation</span></div>
            <h3>Streamer.bot &amp; Automation</h3><p>Keep your custom actions, event workflows and authenticated local integrations.</p>
            <p class="route">Streamer.bot <span aria-hidden="true">→</span> PearConnect <span aria-hidden="true">→</span> Pear Desktop</p>
            <a href="/docs/advanced">Set up Advanced <span aria-hidden="true">→</span></a>
          </article>
        </div>
        <p class="section-note">Both modes work with the desktop app or CLI. TikTok input requires TikFinity Desktop on the same computer.</p>
      </section>

      <section class="control-section section-wrap" aria-labelledby="control-title">
        <div class="section-heading"><p class="kicker">03 / STAY IN CONTROL</p><h2 id="control-title">Their requests.<br>Your rules.</h2></div>
        <dl class="feature-list">
          <div><dt>Set the boundaries</dt><dd>Cooldowns, song-length limits, blocked phrases and permissions apply across your inputs.</dd></div>
          <div><dt>Pause requests. Keep the music.</dt><dd>Stop accepting new songs at any time. Existing playback stays with Pear Desktop.</dd></div>
          <div><dt>See what happened</dt><dd>Accepted, rejected or uncertain: every request has a result. History and the player queue stay separate.</dd></div>
          <div><dt>Desktop or command line</dt><dd>One engine powers both interfaces and keeps your request counters together.</dd></div>
        </dl>
      </section>

      <section class="download-band" id="download" aria-labelledby="download-title" itemprop="mainEntity" itemscope itemtype="https://schema.org/SoftwareApplication" itemid="https://pearconnect.mellozone.site/#software">
        <meta itemprop="name" content="PearConnect"><meta itemprop="operatingSystem" content="Windows">
        <meta itemprop="applicationCategory" content="MultimediaApplication"><meta itemprop="isAccessibleForFree" content="true">
        <div class="download-section section-width">
          <div><p class="kicker">YOUR NEXT STREAM STARTS HERE</p><h2 id="download-title">Bring your chat<br>into the mix.</h2><p>Download PearConnect, extract the complete folder and open the app. Your first request starts with a connection.</p></div>
          <div class="download-options">
            <div class="download-meta"><span>WINDOWS x64</span><span itemprop="softwareVersion">0.3.0-beta.1</span></div>
            <a class="download-button" :href="download" itemprop="downloadUrl">Download the Windows preview <span aria-hidden="true">↓</span></a>
            <p>Portable ZIP · Free &amp; open source</p>
            <div class="download-links"><a href="/docs/install">Installation guide <span aria-hidden="true">↗</span></a><a href="/docs/cli">CLI setup <span aria-hidden="true">↗</span></a></div>
            <p class="preview-note">Preview release · unsigned Windows build. Live-platform and fresh-machine acceptance are still in progress. <a href="/docs/releases" itemprop="releaseNotes">Read the release notes.</a></p>
          </div>
        </div>
      </section>

      <section class="help-line section-width"><h2>Need a hand getting connected?</h2><a href="/docs/">Explore the documentation <span aria-hidden="true">→</span></a></section>
    </main>
    <footer class="home-footer">
      <a class="home-brand" href="/"><img src="/pear.svg" width="23" height="28" alt="" aria-hidden="true"><span>Pear<span>Connect</span></span></a>
      <p>Independent community software. Not affiliated with TikTok, TikFinity or Pear Desktop.</p>
      <div><a href="https://github.com/foulfoxhacks">By FoulFoxHacks</a><a href="/docs/security">Privacy &amp; security</a><a href="https://github.com/foulfoxhacks/PearConnect-Song-Requests/blob/main/LICENSE">MIT license</a></div>
    </footer>
  </div>
</template>
