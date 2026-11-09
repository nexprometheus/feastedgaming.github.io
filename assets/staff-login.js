"use strict";
(() => {
  const form = document.getElementById('staffLoginForm');
  const button = document.getElementById('staffLoginButton');
  const status = document.getElementById('staffLoginStatus');
  const password = document.getElementById('staffPassword');
  const config = window.FEASTED_SUPABASE || {};
  const ready = /^https:\/\/[\w.-]+\.supabase\.co\/?$/.test(config.url || '') && config.anonKey;
  const base = (config.url || '').replace(/\/$/, '');
  if (!ready) { button.disabled = true; status.textContent = 'Staff sign-in is unavailable. Contact the site owner.'; }

  async function request(path, body, token) {
    const response = await fetch(base + path, {
      method: 'POST',
      headers: {apikey: config.anonKey, 'Content-Type': 'application/json', ...(token ? {Authorization: `Bearer ${token}`} : {})},
      ...(body === undefined ? {} : {body: JSON.stringify(body)})
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error('Sign-in failed');
    return result;
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!ready || button.disabled) return;
    button.disabled = true;
    status.textContent = 'Checking your account and staff permissions…';
    let signedIn;
    let accepted = false;
    try {
      signedIn = await request('/auth/v1/token?grant_type=password', {
        email: document.getElementById('staffEmail').value.trim(), password: password.value
      });
      if (!signedIn?.access_token || !signedIn.user?.id) throw new Error('Invalid session');
      const role = await request('/rest/v1/rpc/get_championship_role', {}, signedIn.access_token);
      if (!['staff', 'admin'].includes(role)) {
        status.textContent = 'This account does not have staff access. Ask an admin to authorize your existing player account.';
        return;
      }
      // Reuse the Arena session format, only after the server confirms the role.
      sessionStorage.setItem('feastedSupabaseSessionV1', JSON.stringify({
        ...signedIn, expires_at: Date.now() / 1000 + (signedIn.expires_in || 3600)
      }));
      accepted = true;
      status.textContent = 'Staff access confirmed. Opening your dashboard…';
      window.location.replace('championship.html#staff');
    } catch {
      status.textContent = 'Could not sign in or confirm staff permissions. Check your details and connection, then try again.';
    } finally {
      password.value = '';
      if (signedIn?.access_token && !accepted) {
        // End only this attempted login; preserve any existing player session.
        try { await request('/auth/v1/logout?scope=local', undefined, signedIn.access_token); } catch { /* No rejected session is saved locally. */ }
      }
      button.disabled = false;
    }
  });
})();
