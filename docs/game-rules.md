# Game Rules — Tic-Tac-Gulp

## Objective

Get **3 of your visible top pieces in a row** — horizontally, vertically, or diagonally — on a 3×3 grid.

---

## Players & Colors

| Player | Color  | Goes First? |
|--------|--------|-------------|
| P1     | Blue   | Yes         |
| P2     | Orange | No          |

The host of the room is always P1 (Blue).

---

## Piece Inventory

Each player starts with **9 pieces** in three sizes:

| Size   | Quantity | Can Cover     |
|--------|----------|---------------|
| Small  | 3        | Nothing       |
| Medium | 3        | Small         |
| Large  | 3        | Small, Medium |

- Once placed, a piece is **permanently removed from your inventory** — even if it is later covered.
- Covered pieces **cannot** be reclaimed.

---

## Turn Structure

1. Turns alternate strictly: **P1 → P2 → P1 → ...**
2. On your turn, you **must** place exactly one piece from your inventory onto the board.
3. There is no passing (unless you have no legal moves — see Draw Conditions).

---

## Legal Moves

A move is the placement of one of your pieces on a board cell.

**A move is legal if:**
- It is your turn.
- You have at least one piece of that size remaining.
- The target cell is:
  - **Empty** (no pieces), OR
  - The **top visible piece** on the cell has a **strictly smaller** size than the piece you are placing.

**A move is illegal if:**
- The top piece on the target cell is the **same size or larger** than the piece you are placing.
- You have no remaining pieces of that size.
- The game is not in progress.

---

## Covering (Gulping)

"Gulping" occurs when you place a piece on a cell that already has a piece on top.

**Rules:**
- You can gulp **your own** pieces and **your opponent's** pieces.
- The gulped piece remains in the stack but is **no longer visible** — the larger piece fully covers it.
- Only the **topmost visible piece** on a cell counts.
- A **Large** piece (size 3) **cannot be covered** — nothing is bigger.

**Visual representation (3D board):**
- The top piece renders fully and sits at board level, as if it were placed on an empty cell.
- Buried pieces are hidden — the larger piece covers them completely.
- A faint colored ring at the cell's base indicates a buried piece exists (and its owner's color), providing strategic information without obscuring the top piece.

---

## Win Condition

After each move, the board is checked for a winner.

**Win lines (8 total):**
- 3 rows: `(0,0)-(0,1)-(0,2)`, `(1,0)-(1,1)-(1,2)`, `(2,0)-(2,1)-(2,2)`
- 3 columns: `(0,0)-(1,0)-(2,0)`, `(0,1)-(1,1)-(2,1)`, `(0,2)-(1,2)-(2,2)`
- 2 diagonals: `(0,0)-(1,1)-(2,2)`, `(0,2)-(1,1)-(2,0)`

**A player wins if all 3 cells in any win line show that player's piece as the visible top.**

An empty cell breaks a win line — it does not count for either player.

**The win is checked immediately after a move, before the turn passes.** If a cover move creates a win for the moving player, the game ends instantly.

---

## Draw Conditions

The game is a draw if:

1. **Both players' inventories are empty** and no win condition has been met after the final move.
2. **The active player has no legal moves** (all 9 cells have a top piece of equal or greater size than any piece remaining in their inventory), AND the other player is also stuck or out of pieces.

Draw condition 2 is rare in practice but must be handled correctly.

---

## Disconnect & Forfeit

- If a player disconnects, their opponent waits up to **60 seconds**.
- If the disconnected player reconnects within 60 seconds, the game resumes.
- If the timer expires, the disconnected player **forfeits** and their opponent wins.

---

## Edge Cases

| Situation | Resolution |
|---|---|
| A cover move simultaneously creates a win | Moving player wins immediately |
| Player covers their own piece, creating their opponent's win | Opponent wins immediately (win check runs on the resulting board) |
| Large piece placed — can anything cover it? | No. Large (size 3) is the maximum. |
| All cells occupied by medium/large tops, player only has smalls | Player has no legal moves (see Draw Conditions) |
| Both players have no legal moves | Draw |

---

## Quick Reference

```
Sizes:   Small (1) < Medium (2) < Large (3)
Cover:   pieceSize_yours > pieceSize_top  →  legal
Win:     3 visible top pieces of same player in a line
Draw:    all pieces placed + no winner  OR  no legal moves for both
```
