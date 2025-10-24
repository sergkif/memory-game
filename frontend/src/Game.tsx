import React, { useEffect, useState } from 'react';
import Card from './Card';

export type Card = {
  color: string;
  flipped: boolean;
  matched: boolean;
};

export type GameMove = { row: number, col: number, color: string, matched: boolean };
export type GameState = {
  grid: Card[][];
  moves: number;
  win: boolean;
  lastFlipped: [number, number][];
  userScore?: number;
  aiScore?: number;
  winner?: 'user' | 'ai' | 'draw';
  userMoves?: GameMove[];
  aiMoves?: GameMove[];
};

export type Mode = 'light' | 'dark';

const API = 'http://localhost:3001/api';

function Game() {
  const [game, setGame] = useState<GameState | null>(null);
  const [rows, setRows] = useState(4);
  const [cols, setCols] = useState(4);
  const [mode, setMode] = useState<Mode>('light');
  const [loading, setLoading] = useState(false);
  const [turn, setTurn] = useState<'player' | 'ai'>('player');
  const [aiDifficulty, setAIDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [aiThinking, setAIThinking] = useState(false);

  useEffect(() => {
    startNewGame(rows, cols);
    // eslint-disable-next-line
  }, []);

  function startNewGame(r: number, c: number) {
    setLoading(true);
    fetch(`${API}/new`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: r, cols: c })
    })
      .then(res => res.json())
      .then(data => {
        setGame(data.game);
        setLoading(false);
        setTurn('player');
      });
  }

  function flip(row: number, col: number) {
    if (loading || !game || turn !== 'player' || game.grid[row][col].flipped || game.grid[row][col].matched) return;
    setLoading(true);
    fetch(`${API}/flip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ row, col })
    })
      .then(res => res.json())
      .then(data => {
        setGame(data.game);
        // If two cards are flipped and not matched, block clicks and reset after 500ms, then AI moves
        if (data.game && data.game.lastFlipped.length === 0) {
          const flipped = data.game.grid.flat().filter((card: Card) => card.flipped && !card.matched);
          if (flipped.length === 2) {
            setTimeout(() => {
              fetch(`${API}/reset`, { method: 'POST' })
                .then(res => res.json())
                .then(resetData => {
                  console.log(resetData)
                  setGame(resetData.game);
                  setLoading(false);
                  setTurn('ai');
                  aiMove(resetData.game ?? game);
                });
            }, 500);
            return; // block further clicks until reset
          }
        }
        // If not a pair, just unlock and keep turn as player
        setLoading(false);
        setTurn('player');
      });
  }

  async function aiMove(currentGame: GameState | null = null) {
  setLoading(true);
  setAIThinking(true);
    const res = await fetch(`${API}/ai-move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ difficulty: aiDifficulty })
    });
    const data = await res.json();


    // Animate only the pair from AI, then update to backend state to reset unmatched cards
    if (Array.isArray(data.moves) && data.moves.length > 0 && currentGame) {
      let tempGame = { ...currentGame };
      // Reveal matched pairs first
      for (let i = 0; i < data.moves.length; i += 2) {
        const pair = data.moves.slice(i, i + 2);
        if (pair.length === 2) {
          // Reveal first card
          tempGame = {
            ...tempGame,
            grid: tempGame.grid.map((row, r) =>
              row.map((card, c) =>
                r === pair[0].row && c === pair[0].col ? { ...card, flipped: true } : card
              )
            )
          };
          setGame(tempGame);
          await new Promise(resolve => setTimeout(resolve, 500));

          // Reveal second card
          tempGame = {
            ...tempGame,
            grid: tempGame.grid.map((row, r) =>
              row.map((card, c) =>
                r === pair[1].row && c === pair[1].col ? { ...card, flipped: true } : card
              )
            )
          };
          setGame(tempGame);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      // Reveal any remaining single moves (if odd number)
      if (data.moves.length % 2 === 1) {
        const lastMove = data.moves[data.moves.length - 1];
        tempGame = {
          ...tempGame,
          grid: tempGame.grid.map((row, r) =>
            row.map((card, c) =>
              r === lastMove.row && c === lastMove.col ? { ...card, flipped: true } : card
            )
          )
        };
        setGame(tempGame);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // After animating, update to backend state (which will reset unmatched cards)
    setGame(data.game);

    // If two cards are flipped and not matched, block clicks and reset after 1s
    if (data.game && data.game.lastFlipped.length === 0) {
      const flipped = data.game.grid.flat().filter((card: Card) => card.flipped && !card.matched);
      if (flipped.length === 2) {
        setTimeout(() => {
          fetch(`${API}/reset`, { method: 'POST' })
            .then(res => res.json())
            .then(resetData => {
              setGame(resetData.game);
              setLoading(false);
              setAIThinking(false);
              setTurn('player');
            });
        }, 500);
        return;
      }
    }
  setLoading(false);
  setAIThinking(false);
  setTurn('player');
  }

  function handleModeToggle() {
    setMode(m => (m === 'light' ? 'dark' : 'light'));
  }

  return (
  <div className={`game-root ${mode} w-100 min-vh-100 p-0 m-0`} style={{maxWidth: '100vw', overflowX: 'auto'}}>
      {/* Title row */}
      <div className="row my-2">
        <div className="col-12 text-center">
          <h1 className="mb-0">Card Matching Game</h1>
        </div>
      </div>
      {/* Controls row */}
      <div className="game-header row align-items-center mb-4 gx-2 gy-2 flex-wrap">
        <div className="col-auto">
          <label className="form-label mb-0 me-2">Grid Size:</label>
          <div className="input-group d-inline-flex w-auto align-items-center">
            <select
              className="form-select"
              value={rows && cols ? `${rows}x${cols}` : ''}
              onChange={e => {
                const [r, c] = e.target.value.split('x').map(Number);
                setRows(r);
                setCols(c);
                startNewGame(r, c);
              }}
              style={{maxWidth: '100px'}}
            >
              <option value="4x4">4x4</option>
              <option value="6x6">6x6</option>
              <option value="8x8">8x8</option>
              {rows && cols && !['4x4','6x6','8x8'].includes(`${rows}x${cols}`) ? (
                <option value={`${rows}x${cols}`}>{`${rows}x${cols}`}</option>
              ) : null}
            </select>
            <input
              type="number"
              min={2}
              max={20}
              step={2}
              className={`form-control ${rows % 2 !== 0 || rows < 2 || rows > 20 ? 'is-invalid' : ''}`}
              value={rows === 0 ? '' : rows}
              onChange={e => {
                const val = e.target.value === '' ? 0 : Number(e.target.value);
                setRows(val);
                setCols(val);
              }}
              onBlur={e => {
                const val = Number(e.target.value);
                if (val % 2 === 0 && val >= 2 && val <= 20) {
                  setRows(val);
                  setCols(val);
                  startNewGame(val, val);
                }
              }}
              style={{maxWidth: '80px'}}
            />
          </div>
          <div className="invalid-feedback d-block" style={{fontSize: '0.9em'}}>
            {rows % 2 !== 0 || rows < 2 || rows > 20 ? 'Only even numbers between 2 and 20 allowed.' : ''}
          </div>
        </div>
        <div className="col-auto">
          <button className="btn btn-primary" onClick={() => startNewGame(rows, cols)}>🔄 Restart</button>
        </div>
        <div className="col-auto ms-auto">
          <button className="btn btn-outline-secondary" onClick={handleModeToggle}>
            {mode === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
          </button>
        </div>
      </div>
      {/* Score containers row */}
      <div className="row px-3 mb-3 gx-2 gy-2 d-flex justify-content-between align-items-stretch">
        <div className="col-6">
          <div className={`score-container p-4 border rounded bg-light flex-grow-1 me-2${turn === 'player' ? ' score-active' : ''}`} style={{minWidth: 220}}>
            <div className="d-flex align-items-center mb-2" style={{minHeight: 32}}>
              <h4 className="mb-0">🧑 You</h4>
            </div>
            <div className="mb-1 d-flex align-items-center" style={{minHeight: 32}}>
              <span className="badge bg-primary">Score: {game?.userScore ?? 0}</span>
            </div>
          </div>
        </div>
        <div className="col-6">
          <div className={`score-container p-4 border rounded bg-light flex-grow-1 ms-2${turn === 'ai' ? ' score-active' : ''}`} style={{minWidth: 220}}>
            <div className="d-flex align-items-center justify-content-between mb-2">
              <div className="d-flex align-items-center">
                <h4 className="mb-0">🤖 AI</h4>
                {aiThinking && (
                  <span className="ai-spinner ms-2" title="AI is thinking">
                    <span className="spinner-border spinner-border-sm text-secondary" role="status" />
                  </span>
                )}
              </div>
              <select
                className="form-select form-select-sm d-inline-block w-auto ms-2"
                style={{fontSize: '0.85em', minWidth: 70, paddingRight: 24}}
                value={aiDifficulty}
                title="Select AI Difficulty"
                onChange={e => setAIDifficulty(e.target.value as any)}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div className="mb-1 d-flex align-items-center" style={{minHeight: 32}}>
              <span className="badge bg-secondary">Score: {game?.aiScore ?? 0}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="game-grid d-flex flex-column align-items-center position-relative" style={{width: '100%', overflowX: 'auto', minHeight: '320px'}}>
        {game && game.grid.map((row, rIdx) => (
          <div className="game-row d-flex justify-content-center flex-wrap" key={rIdx}>
            {row.map((card, cIdx) => (
              <Card
                key={cIdx}
                card={card}
                onClick={() => flip(rIdx, cIdx)}
                crackFall={!!game.win}
              />
            ))}
          </div>
        ))}
        {game?.win && (
          <div className="winner-modal">
            {game.winner === 'user' && <>🎉 You win!<br/>Score: {game.userScore} vs AI: {game.aiScore}</>}
            {game.winner === 'ai' && <>🤖 AI wins!<br/>Score: {game.aiScore} vs You: {game.userScore}</>}
            {game.winner === 'draw' && <>🤝 Draw!<br/>Score: {game.userScore} - {game.aiScore}</>}
            <button
              className="btn btn-primary mt-4 px-4 py-2"
              style={{fontSize: '1.2rem'}}
              onClick={() => startNewGame(rows, cols)}
            >
              🔄 Restart
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Game;
