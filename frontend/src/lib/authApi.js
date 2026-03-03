import { buildApiUrl } from './apiClient';

const AUTH_SYNC_URL = buildApiUrl('/api/auth/firebase/session');

async function parseResponseBody(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  return { error: await response.text() };
}

export async function syncFirebaseUserProfile(firebaseUser) {
  const idToken = await firebaseUser.getIdToken();

  let response;
  try {
    response = await fetch(AUTH_SYNC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        name: firebaseUser.displayName || '',
      }),
    });
  } catch (error) {
    throw new Error(`Could not reach backend sync endpoint (${AUTH_SYNC_URL})`);
  }

  const payload = await parseResponseBody(response);
  if (!response.ok) {
    throw new Error(payload.error || 'Failed to sync Firebase user profile');
  }

  return payload;
}
