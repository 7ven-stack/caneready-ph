import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import './index.css';

if (typeof window !== 'undefined') {
  const scrollTimers = new WeakMap();
  let rootTimer = null;

  const activateScrollbar = (el, delay = 750) => {
    if (!el || !el.classList) return;
    el.classList.add('is-scrolling');

    if (el === document.documentElement) {
      if (rootTimer) clearTimeout(rootTimer);
      rootTimer = setTimeout(() => {
        document.documentElement.classList.remove('is-scrolling');
      }, delay);
    } else {
      const prev = scrollTimers.get(el);
      if (prev) clearTimeout(prev);
      const timer = setTimeout(() => {
        el.classList.remove('is-scrolling');
      }, delay);
      scrollTimers.set(el, timer);
    }
  };

  // 1. Show scrollbar on any wheel / touch / keyboard scroll
  window.addEventListener(
    'scroll',
    (e) => {
      const target =
        e.target === document || e.target === document.body
          ? document.documentElement
          : e.target;
      activateScrollbar(target, 750);
    },
    { capture: true, passive: true }
  );

  // 2. Also reveal scrollbar if user moves mouse within 14px of the right window edge
  window.addEventListener(
    'mousemove',
    (e) => {
      if (window.innerWidth - e.clientX <= 14) {
        activateScrollbar(document.documentElement, 1000);
      }
    },
    { passive: true }
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
