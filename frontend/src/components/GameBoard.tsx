import { useGameStore } from '../stores/gameStore.js';
import { getValidTargets } from '@tic-tac-gulp/shared';
import { emitMove } from '../stores/socketStore.js';
import BoardCell from './BoardCell.js';

export default function GameBoard() {
  const gameState = useGameStore((s) => s.gameState);
  const selectedPieceSize = useGameStore((s) => s.selectedPieceSize);
  const yourPlayerId = useGameStore((s) => s.yourPlayerId);
  const selectPiece = useGameStore((s) => s.selectPiece);

  if (!gameState || !yourPlayerId) return null;

  const validTargets =
    selectedPieceSize !== null
      ? getValidTargets(gameState, yourPlayerId, selectedPieceSize)
      : [];

  const validSet = new Set(validTargets.map(([r, c]) => `${r},${c}`));

  function handleCellClick(row: number, col: number) {
    if (selectedPieceSize === null) return;
    if (!validSet.has(`${row},${col}`)) {
      // Invalid click — shake animation handled in BoardCell
      return;
    }
    emitMove(selectedPieceSize, row, col);
    selectPiece(null);
  }

  const winLineSet = new Set(
    (gameState.winLine ?? []).map(([r, c]) => `${r},${c}`)
  );

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '0.5rem',
      padding: '1rem',
      background: 'var(--surface)',
      borderRadius: '1rem',
      border: '2px solid var(--border)',
    }}>
      {gameState.board.map((row, rIdx) =>
        row.map((cell, cIdx) => {
          const key = `${rIdx},${cIdx}`;
          const isValidTarget = validSet.has(key);
          const isWinCell = winLineSet.has(key);
          const isSelecting = selectedPieceSize !== null;
          return (
            <BoardCell
              key={key}
              cell={cell}
              isValidTarget={isValidTarget}
              isInvalidTarget={isSelecting && !isValidTarget}
              isWinCell={isWinCell}
              onClick={() => handleCellClick(rIdx, cIdx)}
            />
          );
        })
      )}
    </div>
  );
}
