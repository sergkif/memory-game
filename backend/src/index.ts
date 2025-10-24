import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { createGame, flipCard, resetUnmatchedCards, GameState } from './game';
import { getGeminiMove, resetGeminiContext } from './gemini';

const app = express();
const port = process.env.PORT || 3001;
app.use(cors());
app.use(bodyParser.json());


let game: GameState | null = null;
let gameId: string | null = null;

app.post('/api/ai-move', async (req, res) => {
  if (!game || !gameId) return res.status(400).json({ success: false, error: 'No game started' });
  const { difficulty } = req.body;
  try {
    let allMoves: { row: number, col: number }[] = [];
    let keepGoing = true;
    while (keepGoing && game && !game.win) {
      // Collect full history of revealed cards
      const userMoves = game.userMoves || [];
      const aiMoves = game.aiMoves || [];
      const flipped = game.grid.flat().filter(card => card.flipped && !card.matched);
      let moves: { row: number, col: number }[] = [];
      let validMoves: { row: number, col: number }[] = [];
      if (flipped.length === 0) {
        moves = await getGeminiMove(game, difficulty || 'easy', gameId, userMoves, aiMoves);
        if (Array.isArray(moves) && moves.length > 0) {
          validMoves = moves.filter(m => {
            const card = game!.grid[m.row]?.[m.col];
            return card && !card.matched && !card.flipped;
          });
          if (validMoves.length > 0) {
            (game as any)._currentPlayer = 'ai';
            game = flipCard(game, validMoves[0].row, validMoves[0].col);
            allMoves.push(validMoves[0]);
            if (validMoves.length > 1) {
              (game as any)._currentPlayer = 'ai';
              game = flipCard(game, validMoves[1].row, validMoves[1].col);
              allMoves.push(validMoves[1]);
            }
          }
        }
      } else if (flipped.length === 1) {
        moves = await getGeminiMove(game, difficulty || 'easy', gameId, userMoves, aiMoves);
        if (Array.isArray(moves) && moves.length > 0) {
          validMoves = moves.filter(m => {
            const card = game!.grid[m.row]?.[m.col];
            return card && !card.matched && !card.flipped;
          });
          if (validMoves.length > 0) {
            (game as any)._currentPlayer = 'ai';
            const m = validMoves[0];
            game = flipCard(game, m.row, m.col);
            allMoves.push(m);
          }
        }
      } else {
        moves = [];
      }
      // After a pair, check if last pair was a match
      let matched = false;
      if (game && game.lastFlipped.length === 0) {
        // Find last two moves
        if (allMoves.length >= 2) {
          const lastTwo = allMoves.slice(-2);
          const cardA = game.grid[lastTwo[0].row][lastTwo[0].col];
          const cardB = game.grid[lastTwo[1].row][lastTwo[1].col];
          if (cardA.matched && cardB.matched) {
            // Correct match, let AI continue
            matched = true;
          }
        }
      }
      // If not matched, stop loop
      if (!matched) {
        keepGoing = false;
      }
    }
    res.json({ success: true, game, moves: allMoves });
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message });
  }
});

import { randomUUID } from 'crypto';

app.post('/api/new', (req, res) => {
  const { rows, cols } = req.body;
  try {
    game = createGame(rows, cols);
    gameId = randomUUID();
    resetGeminiContext(gameId);
    res.json({ success: true, game, gameId });
  } catch (e) {
    res.status(400).json({ success: false, error: (e as Error).message });
  }
});

app.post('/api/flip', (req, res) => {
  if (!game) return res.status(400).json({ success: false, error: 'No game started' });
  game._currentPlayer = 'user';
  const { row, col } = req.body;
  game = flipCard(game, row, col);
  res.json({ success: true, game });
});


app.post('/api/reset', (_req, res) => {
  if (!game) return res.status(400).json({ success: false, error: 'No game started' });
  game = resetUnmatchedCards(game);
  res.json({ success: true, game });
});

app.get('/api/state', (_req, res) => {
  if (!game) return res.status(400).json({ success: false, error: 'No game started' });
  res.json({ success: true, game });
});

// Only start an HTTP listener in local/dev environments. On Vercel the
// serverless function runtime invokes the exported handler instead.
if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

export default app; // For Vercel serverless
