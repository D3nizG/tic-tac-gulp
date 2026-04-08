# Multiplayer Flow — Tic-Tac-Gulp

Sequence diagrams for all realtime flows.

---

## 1. Room Creation & Lobby

```
Host (P1)                        Server                       Guest (P2)
─────────                        ──────                       ──────────
POST /api/rooms ───────────────► create room (WAITING)
◄─ { roomCode, P1, sessionId } ──
socket.connect()
emit('room:join') ─────────────► mark P1 connected
◄─ room:joined { gameState } ───
[shares room code with P2]
                                                  POST /api/rooms/:code/join ──►
                                                  ◄── { roomCode, P2, sessionId }
                                                  socket.connect()
                                                  emit('room:join') ──────────►
                                 addSecondPlayer()
                                 status → LOBBY
                                 ◄─ room:joined ─────────────────────────────
◄─ room:updated ─────────────── broadcast room:updated
```

---

## 2. Game Start

```
Host (P1)                        Server                       Guest (P2)
─────────                        ──────                       ──────────
[clicks Start Game]
emit('game:start') ────────────► validate (P1, LOBBY, both connected)
                                 startGame() → status: IN_PROGRESS
◄─ game:started { gameState } ─ broadcast ──────────────────► game:started
[renders board, P1 turn active] [renders board, P2 turn inactive]
```

---

## 3. Move Flow

```
Active Player                    Server                       Other Player
─────────────                    ──────                       ────────────
[selects piece]
getValidTargets() → highlights
[clicks valid cell]
emit('move:attempt') ──────────► getMoveError() → null (valid)
                                 applyMove()
                                 resolveAfterMove()
                                   checkWin() → no winner
                                   nextTurn() → other player
                                 roomStore.set(newState)
◄─ game:state { gameState } ─── broadcast ──────────────────► game:state
[re-renders, opponent's turn]   [re-renders, your turn active]
```

### Invalid Move

```
Active Player                    Server
─────────────                    ──────
emit('move:attempt') ──────────► getMoveError() → "Cannot place size-1 on size-2"
◄─ move:error { message } ─────  (no broadcast — state unchanged)
[shakes cell, shows error]
```

---

## 4. Win / Draw

```
Active Player                    Server                       Other Player
─────────────                    ──────                       ────────────
emit('move:attempt') ──────────► applyMove()
                                 resolveAfterMove()
                                   checkWin() → winner: P1
                                   status → ENDED
◄─ game:state ─────────────────  broadcast ──────────────────► game:state
◄─ game:ended { winner, reason } broadcast ──────────────────► game:ended
[shows Win overlay]                                           [shows Lose overlay]
```

---

## 5. Rematch Flow

```
Player A                         Server                       Player B
────────                         ──────                       ────────
[clicks Rematch]
emit('rematch:accept') ────────► record A accepted
                                 ◄─ rematch:requested ───────────────────────►
                                                              [sees "A wants rematch"]
                                                              emit('rematch:accept') ──►
                                 both accepted
                                 resetGameState()
                                 status → IN_PROGRESS
◄─ rematch:started ────────────  broadcast ──────────────────► rematch:started
[board resets, P1 goes first]                                [board resets]
```

---

## 6. Disconnect & Reconnect

```
Player A (disconnects)           Server                       Player B
──────────────────────           ──────                       ────────
[network drops / closes tab]
                                 socket.on('disconnect')
                                 mark A: connected=false
                                 start 60s forfeit timer
                                 ◄─ player:disconnected ─────────────────────►
                                                              [shows "Opponent disconnected — 60s"]

--- If A reconnects within 60s ---

[revisits room URL]
socket.connect()
emit('room:rejoin') ───────────► match sessionId → P1
                                 clearForfeitTimer()
                                 mark A: connected=true
◄─ room:joined { gameState } ── (full state restored)
                                 broadcast player:reconnected ──────────────►
[renders board from server state][hides disconnect banner]
```

### Forfeit (timeout expires)

```
Server                           Player B
──────                           ────────
[60s timer fires]
forfeitGame(state, 'P1')
status → ENDED, winner: P2
broadcast game:ended ──────────────────────────────────────► game:ended { winner: P2, reason: 'forfeit' }
                                                             [shows Win overlay]
```

---

## 7. Event Reference Summary

| Direction        | Event               | When                                       |
|---|---|---|
| Client → Server  | `room:join`         | After HTTP create/join, on connect         |
| Client → Server  | `room:rejoin`       | On reconnect                               |
| Client → Server  | `game:start`        | Host starts from lobby                     |
| Client → Server  | `move:attempt`      | Player submits a move                      |
| Client → Server  | `rematch:accept`    | Player accepts rematch                     |
| Client → Server  | `rematch:decline`   | Player declines rematch                    |
| Server → Client  | `room:joined`       | Sent to joining/rejoining player           |
| Server → Client  | `room:updated`      | Broadcast when lobby state changes         |
| Server → Client  | `game:started`      | Broadcast when game begins                 |
| Server → Client  | `game:state`        | Broadcast after every valid move           |
| Server → Client  | `game:ended`        | Broadcast on win/draw/forfeit              |
| Server → Client  | `move:error`        | Sent only to the invalid-move submitter    |
| Server → Client  | `player:disconnected` | Broadcast to room when player drops      |
| Server → Client  | `player:reconnected`  | Broadcast to room when player returns    |
| Server → Client  | `rematch:requested` | Broadcast when one player accepts rematch  |
| Server → Client  | `rematch:started`   | Broadcast when both accept                 |
| Server → Client  | `rematch:declined`  | Broadcast when one declines               |
| Server → Client  | `error`             | General error (auth, room, etc.)           |
