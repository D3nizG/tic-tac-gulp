# API Specification — Tic-Tac-Gulp

## Overview

The API has two layers:
1. **HTTP REST** — room lifecycle (create, join, query)
2. **WebSocket (Socket.IO)** — all realtime game events

All WebSocket payloads include a `sessionId` for authentication.

---

## HTTP REST API

Base URL: `http://localhost:3001/api`

### `POST /api/rooms`

Create a new room. The caller becomes P1 (Blue, goes first).

**Request body:**
```json
{ "displayName": "Alice" }
```

**Validation:**
- `displayName`: required, 3–16 characters

**Response `201`:**
```json
{
  "roomCode": "ABCDE2",
  "playerId": "P1",
  "sessionId": "uuid-v4"
}
```

**Errors:**
- `400` — invalid displayName

---

### `POST /api/rooms/:code/join`

Join an existing room as P2.

**Request body:**
```json
{ "displayName": "Bob" }
```

**Response `200`:**
```json
{
  "roomCode": "ABCDE2",
  "playerId": "P2",
  "sessionId": "uuid-v4"
}
```

**Errors:**
- `400` — invalid displayName
- `404` — room not found (`ROOM_NOT_FOUND`)
- `409` — room already has 2 players (`ROOM_FULL`)
- `410` — game already in progress (`GAME_IN_PROGRESS`)

---

### `GET /api/rooms/:code`

Fetch lightweight room status. Used on reconnect page load.

**Response `200`:**
```json
{
  "roomCode": "ABCDE2",
  "status": "IN_PROGRESS",
  "players": {
    "P1": { "name": "Alice", "connected": true },
    "P2": { "name": "Bob",   "connected": false }
  }
}
```

**Errors:**
- `404` — room not found

---

## WebSocket Events

Transport: Socket.IO over `http://localhost:3001`

All events include identifying fields (`sessionId`, `roomCode`) so the server can authenticate and route correctly.

---

### Client → Server

#### `room:join`

Fired after HTTP create/join, once the socket connects. Registers the player in the room.

```json
{
  "sessionId": "uuid",
  "roomCode": "ABCDE2",
  "displayName": "Alice",
  "playerId": "P1"
}
```

---

#### `room:rejoin`

Fired on reconnect to restore an existing session.

```json
{
  "sessionId": "uuid",
  "roomCode": "ABCDE2"
}
```

---

#### `game:start`

Fired by host (P1) to begin the game from lobby state.

```json
{
  "sessionId": "uuid",
  "roomCode": "ABCDE2"
}
```

**Server validation:** Only accepted from P1. Both players must be connected. Status must be `LOBBY`.

---

#### `move:attempt`

Submit a move. Server validates, applies, and broadcasts the result.

```json
{
  "sessionId": "uuid",
  "roomCode": "ABCDE2",
  "pieceSize": 2,
  "row": 1,
  "col": 1
}
```

**Validation:**
- `pieceSize`: `1 | 2 | 3`
- `row`, `col`: `0 | 1 | 2`
- Session must match the current turn's player
- Move must pass `isLegalMove()` on the server

---

#### `rematch:accept`

Accept a rematch proposal.

```json
{ "sessionId": "uuid", "roomCode": "ABCDE2" }
```

Both players must accept before the game resets.

---

#### `rematch:decline`

Decline a rematch.

```json
{ "sessionId": "uuid", "roomCode": "ABCDE2" }
```

---

### Server → Client

#### `room:joined`

Sent to the joining player after `room:join` or `room:rejoin` succeeds.

```json
{
  "roomCode": "ABCDE2",
  "yourPlayerId": "P1",
  "gameState": { ...GameState }
}
```

---

#### `room:updated`

Broadcast to all room members when the lobby state changes (e.g., P2 joins).

```json
{ "gameState": { ...GameState } }
```

---

#### `game:started`

Broadcast when the host starts the game.

```json
{ "gameState": { ...GameState } }
```

`gameState.status` will be `"IN_PROGRESS"`.

---

#### `game:state`

Broadcast after every valid move. Contains the full authoritative game state.

```json
{ "gameState": { ...GameState } }
```

---

#### `game:ended`

Broadcast when the game concludes (win, draw, or forfeit).

```json
{
  "gameState": { ...GameState },
  "winner": "P1",
  "reason": "normal"
}
```

`winner`: `"P1" | "P2" | "DRAW"`
`reason`: `"normal" | "forfeit"`

---

#### `move:error`

Sent **only** to the player whose move was rejected.

```json
{
  "message": "Cannot place size-1 piece on a cell with a size-2 piece on top.",
  "code": "INVALID_MOVE"
}
```

---

#### `player:disconnected`

Broadcast to the other player when a player drops.

```json
{
  "playerId": "P2",
  "timeoutSeconds": 60
}
```

---

#### `player:reconnected`

Broadcast to the other player when a disconnected player reconnects.

```json
{ "playerId": "P2" }
```

---

#### `rematch:requested`

Broadcast to the other player when one player accepts a rematch.

```json
{ "byPlayerId": "P1" }
```

---

#### `rematch:started`

Broadcast to all when both players accept. Contains fresh game state.

```json
{ "gameState": { ...GameState } }
```

---

#### `rematch:declined`

Broadcast to the other player when a rematch is declined.

```json
{}
```

---

#### `error`

General-purpose error event.

```json
{
  "message": "Only the host can start the game.",
  "code": "SESSION_INVALID"
}
```

---

## Error Code Reference

| Code               | Meaning                                      |
|---|---|
| `INVALID_MOVE`     | Move violates game rules                     |
| `NOT_YOUR_TURN`    | Move sent on the wrong player's turn         |
| `ROOM_NOT_FOUND`   | No room with that code exists                |
| `ROOM_FULL`        | Room already has 2 players                   |
| `GAME_IN_PROGRESS` | Cannot join a game that has started          |
| `SESSION_INVALID`  | Session ID not recognized or not authorized  |
| `GAME_NOT_STARTED` | Move sent before game is in progress         |
| `PIECE_UNAVAILABLE`| Player has 0 remaining pieces of that size   |
| `CELL_BLOCKED`     | Target cell's top piece is equal or larger   |

---

## GameState Shape (sent to clients)

Full `GameState` as defined in `state-model.md`, with `Player.socketId` omitted.

```json
{
  "roomCode": "ABCDE2",
  "status": "IN_PROGRESS",
  "board": [
    [
      { "row": 0, "col": 0, "stack": [{ "owner": "P1", "size": 1 }] },
      { "row": 0, "col": 1, "stack": [] },
      { "row": 0, "col": 2, "stack": [] }
    ],
    ...
  ],
  "players": {
    "P1": { "id": "P1", "displayName": "Alice", "sessionId": "...", "connected": true, "inventory": { "small": 2, "medium": 3, "large": 3 } },
    "P2": { "id": "P2", "displayName": "Bob",   "sessionId": "...", "connected": true, "inventory": { "small": 3, "medium": 3, "large": 3 } }
  },
  "currentTurn": "P2",
  "moveCount": 1,
  "winner": null,
  "winLine": null,
  "endReason": null,
  "createdAt": 1712345678000,
  "updatedAt": 1712345680000
}
```
