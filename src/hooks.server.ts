import { redirect, type Handle } from '@sveltejs/kit';
import { AUTH_COOKIE, verifyToken } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
  const { pathname, search } = event.url;

  const isLogin = pathname === '/login' || pathname.startsWith('/login/');
  const isApi = pathname.startsWith('/api/');
  const isInternal = pathname.startsWith('/_app/') || pathname === '/favicon.ico';

  if (isLogin || isApi || isInternal) {
    return resolve(event);
  }

  if (!verifyToken(event.cookies.get(AUTH_COOKIE))) {
    const redirectTo = encodeURIComponent(pathname + search);
    throw redirect(303, `/login?redirect=${redirectTo}`);
  }

  return resolve(event);
};
