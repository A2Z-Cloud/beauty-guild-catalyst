import { useEffect, useState } from 'react';

// Referencing the flag sprite as an *external* file (<use href="/app/flags-sprite.svg#flag-gb">)
// is unreliable once there are 200+ <use> elements on one page - Chrome doesn't consistently
// re-render every instance once the external fetch finishes, which is exactly the "some flags
// never load" symptom reported. Fetching the sprite once and injecting its <symbol>s directly
// into this document fixes that: <use href="#flag-gb"> then resolves against the live DOM
// instead of a separate network resource, the same way it already works reliably for inline
// icon sprites everywhere else on the web.
let spriteState = 'idle'; // 'idle' | 'loading' | 'ready'
const listeners = new Set();

function loadSprite() {
  if (spriteState !== 'idle') return;
  spriteState = 'loading';
  fetch('/app/flags-sprite.svg')
    .then((res) => res.text())
    .then((svgText) => {
      const container = document.createElement('div');
      container.setAttribute('aria-hidden', 'true');
      container.style.position = 'absolute';
      container.style.width = '0';
      container.style.height = '0';
      container.style.overflow = 'hidden';
      container.innerHTML = svgText;
      document.body.appendChild(container);
      spriteState = 'ready';
      listeners.forEach((fn) => fn());
      listeners.clear();
    })
    .catch(() => { spriteState = 'idle'; });
}

// Mount this once per PhoneField instance (cheap - the fetch itself only ever happens once);
// it just reports back when the sprite is in the DOM and ready for <use> to resolve against.
export function useFlagSprite() {
  const [ready, setReady] = useState(spriteState === 'ready');
  useEffect(() => {
    if (spriteState === 'ready') { setReady(true); return undefined; }
    const onReady = () => setReady(true);
    listeners.add(onReady);
    loadSprite();
    return () => listeners.delete(onReady);
  }, []);
  return ready;
}
