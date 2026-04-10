import { create } from 'zustand';
import { useAuthStore } from './authStore.js';

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
  sendRequest: (username: string) => Promise<{ error: string | null }>;
  acceptRequest: (friendshipId: string) => Promise<void>;
  removeOrCancel: (friendshipId: string) => Promise<void>;
  searchUsers: (q: string) => Promise<void>;
  clearSearch: () => void;
  sendGameInvite: (toUsername: string, roomCode: string) => Promise<{ error: string | null }>;
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
    } finally {
      set({ loading: false });
    }
  },

  fetchRequests: async () => {
    const token = getToken();
    if (!token) return;
    const res = await fetch(`${SOCKET_URL}/api/friends/requests`, {
      headers: authHeaders(token),
    });
    if (res.ok) set({ pendingIn: await res.json() });
  },

  fetchInvites: async () => {
    const token = getToken();
    if (!token) return;
    const res = await fetch(`${SOCKET_URL}/api/invites`, {
      headers: authHeaders(token),
    });
    if (res.ok) set({ invites: await res.json() });
  },

  sendRequest: async (username) => {
    const token = getToken();
    if (!token) return { error: 'Not signed in.' };
    const res = await fetch(`${SOCKET_URL}/api/friends/request`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ username }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Failed to send request.' };
    return { error: null };
  },

  acceptRequest: async (friendshipId) => {
    const token = getToken();
    if (!token) return;
    await fetch(`${SOCKET_URL}/api/friends/${friendshipId}/accept`, {
      method: 'POST',
      headers: authHeaders(token),
    });
    // Refresh both lists
    await Promise.all([get().fetchFriends(), get().fetchRequests()]);
  },

  removeOrCancel: async (friendshipId) => {
    const token = getToken();
    if (!token) return;
    await fetch(`${SOCKET_URL}/api/friends/${friendshipId}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
    set((s) => ({
      friends: s.friends.filter((f) => f.friendshipId !== friendshipId),
      pendingIn: s.pendingIn.filter((f) => f.friendshipId !== friendshipId),
    }));
  },

  searchUsers: async (q) => {
    if (q.trim().length < 2) { set({ searchResults: [] }); return; }
    const token = getToken();
    const res = await fetch(
      `${SOCKET_URL}/api/users/search?q=${encodeURIComponent(q.trim())}`,
      { headers: authHeaders(token) }
    );
    if (res.ok) set({ searchResults: await res.json() });
  },

  clearSearch: () => set({ searchResults: [] }),

  sendGameInvite: async (toUsername, roomCode) => {
    const token = getToken();
    if (!token) return { error: 'Not signed in.' };
    const res = await fetch(`${SOCKET_URL}/api/invites`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ toUsername, roomCode }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Failed to send invite.' };
    return { error: null };
  },

  dismissInvite: async (inviteId) => {
    const token = getToken();
    if (!token) return;
    await fetch(`${SOCKET_URL}/api/invites/${inviteId}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
    set((s) => ({ invites: s.invites.filter((i) => i.id !== inviteId) }));
  },
}));
