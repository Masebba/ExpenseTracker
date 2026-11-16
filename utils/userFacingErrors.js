// Convert internal SDK/network errors into clear, non-technical messages for customers.
export function userFacingError(error, fallback = 'Something went wrong. Please try again.'){
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').trim();
  if (code.includes('permission-denied') || code.includes('permission_denied')) return 'You do not have permission to do that. Check your access or contact the workspace owner.';
  if (code.includes('unauthenticated') || code.includes('auth/invalid-credential') || code.includes('auth/wrong-password') || code.includes('auth/invalid-login-credentials')) return 'Those sign-in details could not be verified. Check your email and password and try again.';
  if (code.includes('auth/email-already-in-use')) return 'An account already exists for this email address. Sign in or use password recovery.';
  if (code.includes('auth/invalid-email')) return 'Enter a valid email address.';
  if (code.includes('auth/weak-password')) return 'Choose a stronger password with at least 6 characters.';
  if (code.includes('auth/network-request-failed') || code.includes('unavailable') || code.includes('deadline-exceeded') || code.includes('network')) return 'We could not connect. Check your internet connection and try again.';
  if ((code.includes('failed-precondition') && /index/i.test(message)) || /requires a .*index|collection[_ -]?group/i.test(message)) return 'Workspace member listing needs a one-time database index update. The app administrator must run npm run deploy:firestore-indexes for the Firebase project configured in .env, then wait for the index to finish building before retrying.';
  if (/requires a .*index|collection[_ -]?group|firestore|firebase|permission[_ -]?denied|storage\/|functions\//i.test(message)) return fallback;
  if (!message || message.length > 220 || /\b(at |in |node_modules|https?:\/\/|\.js:|\.ts:)/i.test(message)) return fallback;
  return message;
}
