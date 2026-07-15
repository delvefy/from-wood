<script lang="ts">
  import {
    account,
    changePassword,
    registerWithEmail,
    requestPasswordReset,
    signInWithEmail,
    signOutAccount,
  } from '../lib/supabase';
  import { accountMode } from '../util/nav';

  let email = $state('');
  let password = $state('');
  let newPassword = $state('');
  let busy = $state(false);
  let notice = $state<string | null>(null);
  let error = $state<string | null>(null);

  // Wraps every auth action: one in flight at a time, message or error shown below.
  async function run(action: () => Promise<string | void>) {
    busy = true;
    notice = null;
    error = null;
    try {
      notice = (await action()) ?? null;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Something went wrong';
    } finally {
      busy = false;
    }
  }

  function onSubmit(event: SubmitEvent) {
    event.preventDefault();
    void run(async () => {
      if ($accountMode === 'register') return registerWithEmail(email.trim(), password);
      await signInWithEmail(email.trim(), password);
      password = '';
      return 'Signed in.';
    });
  }

  function onForgot() {
    void run(() => requestPasswordReset(email.trim()));
  }

  function onChangePassword(event: SubmitEvent) {
    event.preventDefault();
    void run(async () => {
      await changePassword(newPassword);
      newPassword = '';
      return 'Password changed.';
    });
  }

  function onSignOut() {
    void run(async () => {
      await signOutAccount();
      return 'Signed out.';
    });
  }
</script>

<h2>Account</h2>
{#if $account.email}
  <div class="panel">
    <p class="signed-in">
      Signed in as <strong>{$account.email}</strong>
    </p>
    <form onsubmit={onChangePassword}>
      <label class="small muted" for="account-new-password">New password</label>
      <input
        id="account-new-password"
        type="password"
        autocomplete="new-password"
        bind:value={newPassword}
      />
      <button class="primary" disabled={busy || newPassword.length === 0}>Change password</button>
    </form>
    <button class="secondary" disabled={busy} onclick={onSignOut}>Sign out</button>
  </div>
{:else}
  <div class="panel">
    <p class="small muted">
      Optional — an account lets you keep your league and sign in from other devices. Without
      one you still play with a per-device identity.
    </p>
    <div class="options">
      <button class:active={$accountMode === 'signin'} onclick={() => accountMode.set('signin')}>
        Sign in
      </button>
      <button class:active={$accountMode === 'register'} onclick={() => accountMode.set('register')}>
        Register
      </button>
    </div>
    <form onsubmit={onSubmit}>
      <label class="small muted" for="account-email">Email</label>
      <input id="account-email" type="email" autocomplete="email" bind:value={email} />
      <label class="small muted" for="account-password">Password</label>
      <input
        id="account-password"
        type="password"
        autocomplete={$accountMode === 'register' ? 'new-password' : 'current-password'}
        bind:value={password}
      />
      <button
        class="primary"
        disabled={busy || email.trim().length === 0 || password.length === 0}
      >
        {$accountMode === 'register' ? 'Create account' : 'Sign in'}
      </button>
    </form>
    <button class="linkish" disabled={busy || email.trim().length === 0} onclick={onForgot}>
      Forgot password? Email me a new one
    </button>
  </div>
{/if}
{#if notice}
  <p class="notice small">{notice}</p>
{/if}
{#if error}
  <p class="error small">{error}</p>
{/if}

<style>
  .panel {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .panel p {
    margin: 0;
  }

  .signed-in {
    overflow-wrap: anywhere;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  input {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg);
    color: var(--text);
  }

  .options {
    display: flex;
    gap: 8px;
  }

  .options button {
    flex: 1;
    padding: 10px;
    font-weight: 600;
  }

  .options button.active {
    border-color: color-mix(in srgb, var(--magic) 45%, var(--border));
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--magic) 18%, var(--panel-2)),
      color-mix(in srgb, var(--tech) 18%, var(--panel-2))
    );
    box-shadow: 0 0 12px color-mix(in srgb, var(--magic) 25%, transparent);
  }

  .primary {
    background: var(--grad-primary);
    border: none;
    color: #fff;
    font-weight: 600;
    padding: 10px;
    border-radius: var(--radius-sm);
    box-shadow: 0 0 10px color-mix(in srgb, var(--magic) 35%, transparent);
  }

  .secondary {
    background: none;
    border: 1px solid var(--border);
    color: var(--text);
    font-weight: 600;
    padding: 10px;
    border-radius: var(--radius-sm);
  }

  .linkish {
    background: none;
    border: none;
    color: var(--muted);
    font-size: 0.85rem;
    text-decoration: underline;
    padding: 2px;
    align-self: flex-start;
  }

  button:disabled {
    opacity: 0.6;
  }

  .small {
    font-size: 0.85rem;
  }

  .muted {
    color: var(--muted);
  }

  .notice {
    color: var(--text);
    margin: 4px 0 0;
  }

  .error {
    color: var(--danger);
    margin: 4px 0 0;
  }
</style>
