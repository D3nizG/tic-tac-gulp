import { create } from 'zustand';
import { useAuthStore } from './authStore.js';
import { joinRoomSession } from './socketStore.js';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? '';

function authHeaders(token: string | null): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

export interface Friend {
  friendshipId: string;
  userId: string;
  username: string | null;
  avatarUrl: string | null;
  elo: number;
  friendsSince: string;
}

export interface FriendRequest {
  friendshipId: string;
  userId: string;
  username: string | null;
  avatarUrl: string | null;
  requestedAt: string;
}

export interface GameInvite {
  id: string;
  fromUserId: string;
  fromUsername: string | null;
  roomCode: string;
  createdAt: string;
  expiresAt: string;
}

export interface UserSearchResult {
  id: string;
  username: string;
  avatarUrl: string | null;
  elo: number;
}

interface FriendsState {
  friends: Friend[];
  pendingIn: FriendRequest[];
  pendingOut: FriendRequest[]; // not fetched from API yet, but tracked locally when sending
  invites: GameInvite[];
  searchResults: UserSearchResult[];
  loading: boolean;

  fetchFriends: () => Promise<void>;
  fetchRequests: () => Promise<void>;
  fetchInvites: () => Promise<void>;
  sendRequest: (username: string) => Promise<{
    error: string | null;
    status?: 'pending' | 'accepted';
    friendshipId?: string;
  }>;
  acceptRequest: (friendshipId: string) => Promise<void>;
  removeOrCancel: (friendshipId: string) => Promise<void>;
  searchUsers: (q: string) => Promise<void>;
  clearSearch: () => void;
  sendGameInvite: (toUsername: string, roomCode: string) => Promise<{ error: string | null }>;
  acceptGameInvite: (invite: GameInvite) => Promise<{ error: string | null; roomCode?: string }>;
  dismissInvite: (inviteId: string) => Promise<void>;
}

function getToken() {
  return useAuthStore.getState().getToken();
}

export const useFriendsStore = create<FriendsState>((set, get) => ({
  friends: [],
  pendingIn: [],
  pendingOut: [],
  invites: [],
  searchResults: [],
  loading: false,

  fetchFriends: async () => {
    const token = getToken();
    if (!token) return;
    set({ loading: true });
    try {
      const res = await fetch(`${SOCKET_URL}/api/friends`, {
        headers: authHeaders(token),
      });
      if (res.ok) set({ friends: await res.json() });
    } catch {
      // Keep stale data; polling should not surface as a React error overlay.
    } finally {
      set({ loading: false });
    }
  },

  fetchRequests: async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${SOCKET_URL}/api/friends/requests`, {
        headers: authHeaders(token),
      });
      if (res.ok) set({ pendingIn: await res.json() });
    } catch {
      // Keep stale data; polling retries shortly.
    }
  },

  fetchInvites: async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${SOCKET_URL}/api/invites`, {
        headers: authHeaders(token),
      });
      if (res.ok) set({ invites: await res.json() });
    } catch {
      // Keep stale data; polling retries shortly.
    }
  },

  sendRequest: async (username) => {
    const token = getToken();
    if (!token) return { error: 'Not signed in.' };
    try {
      const res = await fetch(`${SOCKET_URL}/api/friends/request`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ username }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = data.error ?? 'Failed to send request.';
        if (res.status === 409 && /already|exists/i.test(message)) {
          await Promise.all([get().fetchFriends(), get().fetchRequests()]);
          return { error: null, status: 'pending' };
        }
        return { error: message };
      }
      await Promise.all([get().fetchFriends(), get().fetchRequests()]);
      return {
        error: null,
        status: data.status,
        friendshipId: data.friendshipId,
      };
    } catch {
      return { error: 'Network error.' };
    }
  },

  acceptRequest: async (friendshipId) => {
    const token = getToken();
    if (!token) return;
    try {
      await fetch(`${SOCKET_URL}/api/friends/${friendshipId}/accept`, {
        method: 'POST',
        headers: authHeaders(token),
      });
      // Refresh both lists
      await Promise.all([get().fetchFriends(), get().fetchRequests()]);
    } catch {
      // Polling will retry state refresh.
    }
  },

  removeOrCancel: async (friendshipId) => {
    const token = getToken();
    if (!token) return;
    try {
      await fetch(`${SOCKET_URL}/api/friends/${friendshipId}`, {
        method: 'DELETE',
        headers: authHeaders(token),
      });
      set((s) => ({
        friends: s.friends.filter((f) => f.friendshipId !== friendshipId),
        pendingIn: s.pendingIn.filter((f) => f.friendshipId !== friendshipId),
      }));
    } catch {
      // Keep stale data; polling retries shortly.
    }
  },

  searchUsers: async (q) => {
    if (q.trim().length < 2) { set({ searchResults: [] }); return; }
    const token = getToken();
    try {
      const res = await fetch(
        `${SOCKET_URL}/api/users/search?q=${encodeURIComponent(q.trim())}`,
        { headers: authHeaders(token) }
      );
      if (res.ok) set({ searchResults: await res.json() });
    } catch {
      set({ searchResults: [] });
    }
  },

  clearSearch: () => set({ searchResults: [] }),

  sendGameInvite: async (toUsername, roomCode) => {
    const token = getToken();
    if (!token) return { error: 'Not signed in.' };
    try {
      const res = await fetch(`${SOCKET_URL}/api/invites`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ toUsername, roomCode }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error ?? 'Failed to send invite.' };
      return { error: null };
    } catch {
      return { error: 'Network error.' };
    }
  },

  acceptGameInvite: async (invite) => {
    const token = getToken();
    if (!token) return { error: 'Not signed in.' };

    try {
      const profileRes = await fetch(`${SOCKET_URL}/api/users/me`, {
        headers: authHeaders(token),
      });
      const profile = await profileRes.json().catch(() => ({}));
      if (!profileRes.ok || !profile.username) {
        return { error: profile.error ?? 'Set a username before joining.' };
      }

      const joinRes = await fetch(`${SOCKET_URL}/api/rooms/${invite.roomCode}/join`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ displayName: profile.username }),
      });
      const data = await joinRes.json().catch(() => ({}));
      if (!joinRes.ok) {
        return { error: data.error ?? 'Failed to join invite.' };
      }

      joinRoomSession(data.roomCode, data.playerId, data.sessionId, profile.username);
      await fetch(`${SOCKET_URL}/api/invites/${invite.id}`, {
        method: 'DELETE',
        headers: authHeaders(token),
      }).catch(() => {});
      set((s) => ({ invites: s.invites.filter((i) => i.id !== invite.id) }));

      return { error: null, roomCode: data.roomCode };
    } catch {
      return { error: 'Network error.' };
    }
  },

  dismissInvite: async (inviteId) => {
    const token = getToken();
    if (!token) return;
    try {
      await fetch(`${SOCKET_URL}/api/invites/${inviteId}`, {
        method: 'DELETE',
        headers: authHeaders(token),
      });
      set((s) => ({ invites: s.invites.filter((i) => i.id !== inviteId) }));
    } catch {
      // Keep stale data; polling retries shortly.
    }
  },
}));
