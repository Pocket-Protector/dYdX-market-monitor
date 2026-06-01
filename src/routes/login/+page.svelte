<script lang="ts">
  import { enhance } from '$app/forms';
  import type { ActionData } from './$types';

  const { form }: { form: ActionData } = $props();
  let submitting = $state(false);
</script>

<svelte:head>
  <title>Sign in — dYdX Market Monitor</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center px-4">
  <div class="w-full max-w-sm">
    <div class="mb-8 text-center">
      <h1 class="text-xl font-medium tracking-tight text-zinc-100">dYdX Market Monitor</h1>
      <p class="mt-2 text-sm text-zinc-500">Enter password to continue</p>
    </div>

    <form
      method="POST"
      class="space-y-4"
      use:enhance={() => {
        submitting = true;
        return async ({ update }) => {
          await update();
          submitting = false;
        };
      }}
    >
      <div>
        <input
          type="password"
          name="password"
          autocomplete="current-password"
          autofocus
          required
          class="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          placeholder="Password"
        />
      </div>

      {#if form?.error}
        <p class="text-sm text-red-400">{form.error}</p>
      {/if}

      <button
        type="submit"
        disabled={submitting}
        class="w-full rounded-md bg-violet-600 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? 'Signing in…' : 'Sign in'}
      </button>

      <p class="text-center text-xs text-zinc-500">
        Session stays signed in for 30 days on this browser.
      </p>
    </form>
  </div>
</div>
