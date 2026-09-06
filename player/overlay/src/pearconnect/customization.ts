// Imported packages contain web content, never Node modules or native code.
export const MAX_PACKAGE_BYTES = 2 * 1024 * 1024;
export const permissions = ['playback.read'] as const;
export type WebPlugin = { format: 1; id: string; name: string; version: string; description: string; permissions: string[]; html: string; css: string; javascript: string };
export type Appearance = { palette: string; font: string; density: string; icon: string; background: boolean; motion: boolean };
export const defaultAppearance: Appearance = { palette: 'pear', font: 'system', density: 'comfortable', icon: 'pear', background: false, motion: false };
export function validateAppearance(value: unknown): Appearance {
  const v = value as Appearance;
  if (!v || !['pear','violet','ocean','ember'].includes(v.palette) || !['system','humanist','mono'].includes(v.font) || !['comfortable','compact'].includes(v.density) || typeof v.background !== 'boolean' || typeof v.motion !== 'boolean') throw Error('Choose a valid appearance preset.');
  if(v.icon!==undefined&&!['pear','orchid','ember'].includes(v.icon))throw Error('Choose a bundled icon.');
  return { palette:v.palette, font:v.font, density:v.density, icon:v.icon||'pear', background:v.background, motion:v.motion };
}
export function parsePlugin(text: string): WebPlugin {
  if (new TextEncoder().encode(text).length > MAX_PACKAGE_BYTES) throw Error('Plugin files must be smaller than 2 MB.');
  const p = JSON.parse(text) as WebPlugin; // Untrusted boundary; every stored field is validated below.
  if (!p || p.format !== 1 || typeof p.id !== 'string' || !/^[a-z][a-z0-9-]{2,47}$/.test(p.id)) throw Error('Invalid plugin format or identifier.');
  for (const [key, max] of [['name',60],['version',32],['description',300],['html',500000],['css',100000],['javascript',500000]] as const) {
    if (typeof p[key] !== 'string' || p[key].length > max || (['name','version'].includes(key) && !p[key].trim())) throw Error(`Invalid plugin ${key}.`);
  }
  if (!Array.isArray(p.permissions) || p.permissions.length > permissions.length || new Set(p.permissions).size !== p.permissions.length || p.permissions.some((p: unknown) => p !== 'playback.read')) throw Error('Unsupported permission. This edition supports playback.read only.');
  return { format:1, id:p.id, name:p.name, version:p.version, description:p.description, permissions:[...p.permissions], html:p.html, css:p.css, javascript:p.javascript };
}
export function appearanceCSS(a: Appearance, background = '') {
  const accent = {pear:'#c5e58c',violet:'#c9b6ff',ocean:'#80d6df',ember:'#ffb28d'}[a.palette] || '#c5e58c';
  const font = {system:'"Segoe UI", system-ui, sans-serif', humanist:'"Trebuchet MS", sans-serif',mono:'Consolas, monospace'}[a.font];
  return `:root{--pc-accent:${accent};--ytmusic-color-black1:#101714;--ytmusic-color-black2:#17201b;--ytmusic-color-black3:#202d24;--ytmusic-color-text-primary:#edf1e9;--ytmusic-color-text-secondary:#b2bfb5;--ytmusic-color-text-primary-inverse:#101714;--ytmusic-color-light1:${accent};--yt-spec-themed-blue:${accent};--ytmusic-color-badge-accent:${accent}} body{font-family:${font}!important} ytmusic-app{background:${a.background && background ? `linear-gradient(#101714dc,#101714ec),url("${background}") center/cover fixed`:'#101714'}!important} ytmusic-nav-bar,ytmusic-player-bar{background:#101714ed!important;border-bottom:1px solid #334337} #progress-bar{--paper-slider-active-color:${accent};--paper-slider-knob-color:${accent}} ytmusic-player-queue-item{border-bottom:1px solid #29372e;${a.density==='compact'?'min-height:54px!important;':''}} ytmusic-chip-cloud-chip-renderer{border-radius:4px!important} #pc-studio-button{background:${accent};color:#101714;border:0;border-radius:3px;padding:9px 13px;margin:0 12px;font:600 13px ${font};cursor:pointer;white-space:nowrap} #pc-studio-button:focus-visible{outline:2px solid white;outline-offset:3px} #pc-playing-time{color:${accent};font:12px ${font};padding:0 12px;white-space:nowrap} ${!a.motion?'ytmusic-app *{scroll-behavior:auto!important}':''}`;
}
