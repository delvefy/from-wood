<script lang="ts">
  import { account, changePassword, passwordRecovery, signOutAccount } from '../lib/supabase';
  import { flushCloudSave } from '../engine/cloudSave';
  import { deleteAccount } from '../engine/deleteAccount';
  import { openAuth } from '../util/nav';

  let newPassword = $state('');
  let deletePassword = $state('');
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

  function onChangePassword(event: SubmitEvent) {
    event.preventDefault();
    void run(async () => {
      await changePassword(newPassword);
      newPassword = '';
      passwordRecovery.set(false);
      return 'Password changed.';
    });
  }

  function onDeleteAccount(event: SubmitEvent) {
    event.preventDefault();
    if (
      !confirm(
        'Permanently delete your account? This erases your cloud save, tournament history, ' +
          'and premium purchases on every device. It cannot be undone.',
      )
    )
      return;
    void run(async () => {
      await deleteAccount(deletePassword);
      deletePassword = '';
      return 'Account deleted.';
    });
  }

  function onSignOut() {
    void run(async () => {
      // Back the account's progress up first so it survives the sign-out;
      // flush never throws on network failure, so offline sign-out still works.
      await flushCloudSave();
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
    {#if $passwordRecovery}
      <p class="recovery small">
        🔑 You arrived from a password-reset link — choose a new password below.
      </p>
    {/if}
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
    <form class="danger-zone" onsubmit={onDeleteAccount}>
      <p class="small danger-title">Danger zone</p>
      <label class="small muted" for="account-delete-password">
        Confirm your password to permanently delete this account
      </label>
      <input
        id="account-delete-password"
        type="password"
        autocomplete="current-password"
        bind:value={deletePassword}
      />
      <button class="danger" disabled={busy || deletePassword.length === 0}>Delete account</button>
    </form>
  </div>
{:else}
  <div class="panel">
    <p class="small muted">
      Optional — an account backs up your progress and league so you can pick up on other
      devices. Without one you still play with a per-device identity.
    </p>
    <div class="options">
      <button class="primary" onclick={() => openAuth('signin')}>Sign in</button>
      <button class="secondary" onclick={() => openAuth('signup')}>Create account</button>
    </div>
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

  .danger-zone {
    border-top: 1px solid var(--border);
    padding-top: 10px;
  }

  .danger-title {
    color: var(--danger);
    font-weight: 600;
  }

  .danger {
    background: none;
    border: 1px solid var(--danger);
    color: var(--danger);
    font-weight: 600;
    padding: 10px;
    border-radius: var(--radius-sm);
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

  .recovery {
    padding: 8px 10px;
    border: 1px solid color-mix(in srgb, var(--magic) 45%, var(--border));
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--magic) 12%, var(--panel-2));
  }

  .error {
    color: var(--danger);
    margin: 4px 0 0;
  }
</style>
