const SESSION_KEY = 'pong-session';
const USER_KEY = 'pong-user';

export function getSessionId(): string | null {
  return sessionStorage.getItem(SESSION_KEY);
}

export function setSessionId(sessionId: string): void {
  sessionStorage.setItem(SESSION_KEY, sessionId);
}

export function removeSessionId(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

export function getUserData(): string | null {
  return sessionStorage.getItem(USER_KEY);
}

export function setUserData(userData: string): void {
  sessionStorage.setItem(USER_KEY, userData);
}

export function removeUserData(): void {
  sessionStorage.removeItem(USER_KEY);
}

export function clearAllSession(): void {
  removeSessionId();
  removeUserData();
}
