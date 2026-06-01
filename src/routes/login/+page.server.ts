import { fail, redirect } from '@sveltejs/kit';
import {
  AUTH_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  checkPassword,
  checkRateLimit,
  clearAttempts,
  createToken,
  recordFailedAttempt,
  verifyToken
} from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

function isSafeRedirect(path: string | null): string {
  if (!path) return '/';
  if (!path.startsWith('/') || path.startsWith('//')) return '/';
  if (path.startsWith('/login')) return '/';
  return path;
}

function getClientIp(request: Request, getClientAddress: () => string): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  try {
    return getClientAddress();
  } catch {
    return 'unknown';
  }
}

export const load: PageServerLoad = ({ cookies, url }) => {
  if (verifyToken(cookies.get(AUTH_COOKIE))) {
    throw redirect(303, isSafeRedirect(url.searchParams.get('redirect')));
  }
  return {};
};

export const actions: Actions = {
  default: async ({ request, cookies, url, getClientAddress }) => {
    const ip = getClientIp(request, getClientAddress);
    const rl = checkRateLimit(ip);
    if (!rl.allowed) {
      const minutes = Math.max(1, Math.ceil(rl.retryAfterMs / 60000));
      return fail(429, { error: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.` });
    }

    const form = await request.formData();
    const password = String(form.get('password') ?? '');

    if (!password || !checkPassword(password)) {
      recordFailedAttempt(ip);
      return fail(401, { error: 'Incorrect password — contact alan@dydx.exchange' });
    }

    clearAttempts(ip);
    cookies.set(AUTH_COOKIE, createToken(), {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: SESSION_MAX_AGE_SECONDS
    });

    throw redirect(303, isSafeRedirect(url.searchParams.get('redirect')));
  }
};
