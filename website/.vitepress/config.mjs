import { defineConfig } from 'vitepress';
import { fileURLToPath } from 'node:url';
import { addPageMetadata, origin } from './seo.mjs';

export default defineConfig({
  title: 'PearConnect',
  lang: 'en-US',
  description: 'Song requests for your stream. Download PearConnect and connect your community to Pear Desktop.',
  srcDir: 'content',
  outDir: 'dist',
  cleanUrls: true,
  appearance: 'dark',
  sitemap: { hostname: origin },
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/pear.svg' }],
    ['meta', { name: 'theme-color', content: '#101514' }],
    ['meta', { property: 'og:site_name', content: 'PearConnect' }],
    ['meta', { property: 'og:locale', content: 'en_US' }],
    ['meta', { name: 'author', content: 'FoulFoxHacks' }],
    ['meta', { name: 'publisher', content: 'FoulFoxHacks' }],
    ['meta', { name: 'keywords', content: 'PearConnect, song requests, Pear Desktop, TikFinity, Streamer.bot, livestream music' }]
  ],
  transformPageData: addPageMetadata,
  transformHead({ page }) {
    // The default 404 bypasses transformPageData; never mark it indexable.
    return page === '404.md' ? [['meta', { name: 'robots', content: 'noindex, follow' }]] : [];
  },
  themeConfig: {
    logo: '/pear.svg',
    siteTitle: 'PearConnect',
    nav: [{ text: 'Download', link: '/#download' }, { text: 'Documentation', link: '/docs/' }, { text: 'GitHub', link: 'https://github.com/foulfoxhacks/PearConnect-Song-Requests' }],
    sidebar: {
      '/docs/': [
        { text: 'Start here', items: [
          { text: 'Welcome to PearConnect', link: '/docs/' },
          { text: 'Download & install', link: '/docs/install' },
          { text: 'Connect your player', link: '/docs/player' }
        ] },
        { text: 'Connect your stream', items: [
          { text: 'Simple · TikFinity', link: '/docs/simple' },
          { text: 'Advanced · Streamer.bot', link: '/docs/advanced' },
          { text: 'Twitch & YouTube', link: '/docs/platforms' }
        ] },
        { text: 'Run your requests', items: [
          { text: 'Commands', link: '/docs/commands' },
          { text: 'Rules & permissions', link: '/docs/rules' },
          { text: 'CLI & headless', link: '/docs/cli' }
        ] },
        { text: 'Help & project', items: [
          { text: 'Troubleshooting', link: '/docs/troubleshooting' },
          { text: 'Frequently asked questions', link: '/docs/faq' },
          { text: 'Privacy & security', link: '/docs/security' },
          { text: 'Release notes', link: '/docs/releases' }
        ] }
      ]
    },
    search: { provider: 'local' },
    outline: { level: [2, 3], label: 'On this page' },
    editLink: { pattern: 'https://github.com/foulfoxhacks/PearConnect-Song-Requests/edit/main/website/content/:path', text: 'Improve this page on GitHub' },
    footer: { message: 'Independent community software · MIT licensed', copyright: 'PearConnect by FoulFoxHacks · Your stream. In tune.' },
    docFooter: { prev: 'Previous guide', next: 'Next guide' }
  },
  vite: { resolve: { alias: { '@site': fileURLToPath(new URL('./theme', import.meta.url)) } } }
});
