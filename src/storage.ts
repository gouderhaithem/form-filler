import { defaults, validateSettings, type Settings } from './data';
export const isExtension = () => typeof chrome !== 'undefined' && !!chrome.runtime?.id;
export async function readSettings(): Promise<Settings> {
  if (isExtension()) return validateSettings((await chrome.storage.local.get('settings')).settings);
  const value = localStorage.getItem('formly-settings');
  return value ? validateSettings(JSON.parse(value)) : defaults;
}
export async function saveSettings(settings: Settings) {
  if (isExtension()) await chrome.storage.local.set({ settings });
  else localStorage.setItem('formly-settings', JSON.stringify(settings));
}
