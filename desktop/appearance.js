import { InputError } from '../src/validation.js';
export const APPEARANCE_DEFAULTS = Object.freeze({ APP_BACKGROUND: 'aurora', APP_FONT: 'system', APP_TEXT: 'standard', APP_ICON: 'pear',
  WIDGET_LAYOUT: 'cover', WIDGET_SURFACE: 'dark', WIDGET_ACCENT: '#c7e794', WIDGET_FONT: 'system', WIDGET_MOTION: 'ambient', WIDGET_ART: 'true', WIDGET_TIMING: 'true', WIDGET_LABEL: 'ON THE AUX',
  OVERLAY_ENABLED: 'false', OVERLAY_PORT: '8787', LASTFM_ENABLED: 'false' });
const choices = { APP_BACKGROUND: ['aurora', 'ink', 'dusk', 'grid'], APP_FONT: ['system', 'humanist', 'mono'], APP_TEXT: ['standard', 'large'], APP_ICON: ['pear', 'orchid', 'ember'],
  WIDGET_LAYOUT: ['cover', 'compact', 'minimal'], WIDGET_SURFACE: ['dark', 'light', 'transparent'], WIDGET_FONT: ['system', 'humanist', 'mono'], WIDGET_MOTION: ['ambient', 'off'], WIDGET_ART: ['true', 'false'], WIDGET_TIMING: ['true', 'false'], OVERLAY_ENABLED: ['true', 'false'], LASTFM_ENABLED: ['true', 'false'] };
export const APPEARANCE_KEYS = Object.keys(APPEARANCE_DEFAULTS);
export function appearance(env = {}) { return Object.fromEntries(APPEARANCE_KEYS.map(k => [k, env[k] ?? APPEARANCE_DEFAULTS[k]])); }
export function validateAppearance(values) {
  if (!values || typeof values !== 'object' || Array.isArray(values) || Object.keys(values).some(k => !APPEARANCE_KEYS.includes(k) && k !== 'LASTFM_KEY') || Object.values(values).some(v => typeof v !== 'string')) throw new InputError('Unsupported appearance setting.');
  for (const [key, value] of Object.entries(values)) {
    if (choices[key] && !choices[key].includes(value)) throw new InputError('Choose one of the available styles.');
    if (key === 'WIDGET_ACCENT' && !/^#[a-f\d]{6}$/i.test(value)) throw new InputError('Choose a six-digit accent color.');
    if (key === 'WIDGET_LABEL' && (value.length > 36 || /[\u0000-\u001f]/.test(value))) throw new InputError('Widget labels must be 36 characters or fewer.');
    if (key === 'OVERLAY_PORT' && (!/^\d+$/.test(value) || Number(value) < 1024 || Number(value) > 65535)) throw new InputError('Overlay port must be 1024–65535.');
    if (key === 'LASTFM_KEY' && value && !/^[a-f\d]{32}$/i.test(value)) throw new InputError('Enter the 32-character Last.fm API key.');
  }
  return values;
}
