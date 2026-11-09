"use strict";
(() => {
  const logo = document.querySelector('header .brand');
  if (!logo) return;
  let clicks = 0;
  let startedAt = 0;
  logo.addEventListener('click', event => {
    const now = Date.now();
    if (!clicks || now - startedAt > 6000) {
      clicks = 0;
      startedAt = now;
    }
    clicks += 1;
    if (clicks === 5) {
      event.preventDefault();
      clicks = 0;
      window.location.assign('crew-access.html');
    }
  });
})();
