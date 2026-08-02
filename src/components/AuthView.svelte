<script lang="ts">
  import { registerWithEmail, requestPasswordReset, signInWithEmail } from '../lib/supabase';
  import { closeAuth, openAuth } from '../util/nav';

  let { mode }: { mode: 'signin' | 'signup' } = $props();

  let email = $state('');
  let password = $state('');
  let busy = $state(false);
  let notice = $state<string | null>(null);
  let error = $state<string | null>(null);
  // Set on success: replaces the form with a confirmation and a Continue
  // button, so messages like "check your inbox" aren't lost to navigation.
  let done = $state<string | null>(null);

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
      if (mode === 'signup') {
        done = await registerWithEmail(email.trim(), password);
      } else {
        await signInWithEmail(email.trim(), password);
        done = 'Signed in.';
      }
      password = '';
    });
  }

  function onForgot() {
    void run(() => requestPasswordReset(email.trim()));
  }
</script>

<div class="page">
  <button class="back" onclick={closeAuth}>← Back</button>
  <h2>{mode === 'signup' ? 'Create account' : 'Sign in'}</h2>
  <div class="panel">
    {#if done}
      <p class="done">✅ {done}</p>
      <button class="primary" onclick={closeAuth}>Continue</button>
    {:else}
      {#if mode === 'signup'}
        <p class="small muted">
          Optional — an account backs up your progress and league so you can pick up on other
          devices. Without one you still play with a per-device identity.
        </p>
      {/if}
      <form onsubmit={onSubmit}>
        <label class="small muted" for="auth-email">Email</label>
        <input id="auth-email" type="email" autocomplete="email" bind:value={email} />
        <label class="small muted" for="auth-password">Password</label>
        <input
          id="auth-password"
          type="password"
          autocomplete={mode === 'signup' ? 'new-password' : 'current-password'}
          bind:value={password}
        />
        <button
          class="primary"
          disabled={busy || email.trim().length === 0 || password.length === 0}
        >
          {mode === 'signup' ? 'Create account' : 'Sign in'}
        </button>
      </form>
      {#if mode === 'signin'}
        <button class="linkish" disabled={busy || email.trim().length === 0} onclick={onForgot}>
          Forgot password? Email me a reset link
        </button>
      {/if}
      {#if mode === 'signup'}
        <button class="switch" disabled={busy} onclick={() => openAuth('signin')}>
          Already have an account? <strong>Sign in</strong>
        </button>
      {:else}
        <button class="switch" disabled={busy} onclick={() => openAuth('signup')}>
          New here? <strong>Create an account</strong>
        </button>
      {/if}
    {/if}
  </div>
  {#if notice}
    <p class="notice small">{notice}</p>
  {/if}
  {#if error}
    <p class="error small">{error}</p>
  {/if}
</div>

<style>
  .page {
    max-width: 420px;
    margin: 0 auto;
  }

  .back {
    background: none;
    border: none;
    color: var(--muted);
    font-weight: 600;
    padding: 4px 0;
    margin-bottom: 4px;
  }

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

  .primary {
    background: var(--grad-primary);
    border: none;
    color: #fff;
    font-weight: 600;
    padding: 10px;
    border-radius: var(--radius-sm);
    box-shadow: 0 0 10px color-mix(in srgb, var(--magic) 35%, transparent);
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

  .switch {
    background: none;
    border: none;
    border-top: 1px solid var(--border);
    border-radius: 0;
    color: var(--muted);
    font-size: 0.85rem;
    padding: 10px 2px 2px;
  }

  .switch strong {
    color: var(--text);
    text-decoration: underline;
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

  .done {
    overflow-wrap: anywhere;
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
