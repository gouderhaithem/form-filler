import { fillPage } from './engine';
window.addEventListener('message', event => {
  if (event.origin !== window.location.origin || event.source !== window.parent || event.data?.type !== 'formly-fill') return;
  const result = fillPage(event.data.request);
  window.parent.postMessage({ type: 'formly-result', result }, window.location.origin);
});
document.querySelector('form')?.addEventListener('submit', event => event.preventDefault());
