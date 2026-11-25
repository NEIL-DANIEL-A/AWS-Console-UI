import { apiFetch } from './client';

export interface PortalParticipant {
  websiteUserId: string;
  email: string;
  displayName: string;
  status: 'entered' | 'preparing' | 'running' | 'grading' | 'submitted' | 'error';
  errorMessage?: string | null;
  joinedAt: string;
  readyAt?: string | null;
  submittedAt?: string | null;
}

export interface PortalEvent {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'open' | 'running' | 'ended';
  startsAt?: string | null;
  startedAt?: string | null;
  endsAt?: string | null;
  timeLimitMinutes: number;
  resultsReleased: boolean;
}

export interface PortalScenario {
  title: string;
  description: string;
}

export interface PortalMe {
  serverTime: string;
  participant: PortalParticipant;
  event: PortalEvent;
  scenario?: PortalScenario | null;
}

export interface PortalResult {
  eventId: string;
  websiteUserId: string;
  score: number;
  maxScore: number;
  checks: Array<{
    id?: string;
    description?: string;
    passed?: boolean;
    points?: number;
    earned?: number;
    awarded?: number;
    details?: string;
  }>;
  snapshot: Record<string, unknown>;
  gradedAt: string;
  reason: string;
  timeTakenSeconds?: number | null;
}

export interface PortalResultResponse {
  status: string;
  resultsReleased: boolean;
  message?: string;
  result?: PortalResult | null;
}

export async function enterPortal(token: string) {
  return apiFetch<{ ok: boolean; role: string; eventId?: string }>(
    '/api/portal/enter',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }
  );
}

export async function enterSingleUserPortal(username: string, password: string) {
  return apiFetch<{ ok: boolean; role: string; eventId?: string }>(
    '/api/portal/enter-single',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }
  );
}

export async function getPortalMe() {
  return apiFetch<PortalMe>('/api/portal/me');
}

export async function submitPortalAnswer() {
  return apiFetch<{ status: string; reason?: string; submittedAt?: string }>(
    '/api/portal/submit',
    { method: 'POST' }
  );
}

export async function getPortalResult() {
  return apiFetch<PortalResultResponse>('/api/portal/result');
}

export interface AdminEvent {
  id: string;
  name: string;
  description: string;
  challengeId: string;
  status: 'draft' | 'open' | 'running' | 'ended';
  startsAt?: string | null;
  startedAt?: string | null;
  endsAt?: string | null;
  timeLimitMinutes: number;
  resultsReleased: boolean | number;
  participantCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminParticipant {
  websiteUserId: string;
  email: string;
  displayName: string;
  status: string;
  errorMessage?: string | null;
  joinedAt: string;
  readyAt?: string | null;
  submittedAt?: string | null;
  timeLeftSeconds: number;
  grade?: PortalResult | null;
}

export interface AdminChallenge {
  id: string;
  title: string;
  timeLimitMinutes: number;
  totalPoints: number;
}

export async function adminEnter(token: string) {
  return apiFetch<{ ok: boolean; role: string }>('/api/portal/enter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
}

export async function adminLogin(password: string) {
  return apiFetch<{ ok: boolean }>('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
}

export async function listAdminChallenges() {
  return apiFetch<{ challenges: AdminChallenge[] }>('/api/admin/challenges');
}

export async function listAdminEvents() {
  return apiFetch<{ events: AdminEvent[] }>('/api/admin/events');
}

export async function createAdminEvent(input: {
  id?: string;
  name: string;
  description: string;
  challengeId: string;
  startsAt?: string;
  timeLimitMinutes: number;
}) {
  return apiFetch<{ event: AdminEvent }>('/api/admin/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function getAdminEvent(id: string) {
  return apiFetch<{ event: AdminEvent; participants: AdminParticipant[] }>(
    `/api/admin/events/${encodeURIComponent(id)}`
  );
}

export async function updateAdminEvent(
  id: string,
  patch: Partial<Pick<AdminEvent, 'name' | 'description' | 'challengeId' | 'startsAt' | 'timeLimitMinutes' | 'resultsReleased'>>
) {
  return apiFetch<{ event: AdminEvent }>(
    `/api/admin/events/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }
  );
}

export async function openAdminEvent(id: string) {
  return apiFetch<{ event: AdminEvent }>(`/api/admin/events/${encodeURIComponent(id)}/open`, { method: 'POST' });
}

export async function startAdminEvent(id: string) {
  return apiFetch<{ event: AdminEvent; provisioningCount: number }>(
    `/api/admin/events/${encodeURIComponent(id)}/start`,
    { method: 'POST' }
  );
}

export async function endAdminEvent(id: string) {
  return apiFetch<{ event: AdminEvent }>(`/api/admin/events/${encodeURIComponent(id)}/end`, { method: 'POST' });
}

export async function restartAdminParticipant(id: string, userId: string) {
  return apiFetch<{ participant: AdminParticipant }>(
    `/api/admin/events/${encodeURIComponent(id)}/participants/${encodeURIComponent(userId)}/restart`,
    { method: 'POST' }
  );
}

export async function setAdminResultsRelease(id: string, released: boolean) {
  return apiFetch<{ event: AdminEvent }>(
    `/api/admin/events/${encodeURIComponent(id)}/results-release`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ released }),
    }
  );
}

export async function getAdminResults(id: string) {
  return apiFetch<{
    eventId: string;
    resultsReleased: boolean;
    results: Array<PortalResult & { email: string; displayName: string }>;
  }>(`/api/admin/events/${encodeURIComponent(id)}/results`);
}
