Original prompt: Debug and fix Tic-Tac-Gulp auth, lobby, matchmaking, friends, profile, stats, and gameplay UX issues.

## Notes
- Current work is on top of commit `1370b4b Add profiles friends and auth fixes`.
- Local dev ports in use during this session: frontend `3010`, backend `3012`.
- Stats writes currently tolerate missing gulp columns, but full gulp totals need the Supabase metrics migration applied.
- Backend watcher restarted after the latest socket changes; Vite HMR loaded the frontend changes.

## Current TODO
- Manually test authenticated friend add from the in-game opponent card with real Supabase users.
- Manually test the private lobby browser Back behavior in two tabs.
- Run the Supabase metrics migration before expecting persisted career gulp totals.

## Completed In Latest Pass
- Friend search input clears immediately after request send, while the green sent state stays visible briefly.
- Public matchmaking now broadcasts the matched lobby state to both sockets before auto-starting.
- Private pregame lobbies preserve the room while one player remains; P2 leaving clears the slot, P1 leaving promotes P2.
- Browser Back from a waiting/lobby room now disconnects that tab and clears its local session.
- Opponent popover now shows career profile stats for signed-in opponents or session-only stats for guests, and includes an add-friend action when valid.
- Validation: frontend build, backend build, backend tests, shared tests all pass.
- Follow-up fix: RoomPage no longer disconnects on React unmount cleanup because StrictMode dev remounts were breaking create/join/find flows. Browser Back/page close now uses explicit `popstate`/`pagehide` handlers instead.
- Follow-up validation: frontend build passes, socket tests pass on rerun, direct localhost API/socket smoke passes for private create/join and public matchmaking auto-start.
