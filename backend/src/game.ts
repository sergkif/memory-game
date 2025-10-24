export type Card = {
  color: string;
  flipped: boolean;
  matched: boolean;
};

export type GameState = {
  grid: Card[][];
  moves: number;
  win: boolean;
  lastFlipped: [number, number][];
  userMoves?: Array<{ row: number, col: number, color: string, matched: boolean }>;
  aiMoves?: Array<{ row: number, col: number, color: string, matched: boolean }>;
  userScore?: number;
  aiScore?: number;
  winner?: 'user' | 'ai' | 'draw';
  _currentPlayer?: 'user' | 'ai';
};

function generateColors(count: number): string[] {
  // Generate visually distinct colors using a color palette
  const palette = [
    '#FF5733', // Red
    '#33C1FF', // Blue
    '#33FF57', // Green
    '#FF33A8', // Pink
    '#FFD133', // Yellow
    '#8D33FF', // Purple
    '#FF8633', // Orange
    '#33FFF6', // Cyan
    '#FF3333', // Bright Red
    '#33FFB5', // Mint
    '#FFB533', // Gold
    '#335BFF', // Deep Blue
    '#A833FF', // Violet
    '#FF33F6', // Magenta
    '#33FF8D', // Lime
    '#FF3380'  // Hot Pink
  ];
  if (count <= palette.length) {
    return palette.slice(0, count);
  }
  // Fallback: use HSL with large hue steps for more colors
  return Array.from({ length: count }, (_, i) => `hsl(${(360 / count) * i}, 90%, 55%)`);
}

export function createGrid(rows: number, cols: number): Card[][] {
  const total = rows * cols;
  if (total % 2 !== 0) throw new Error('Grid must have an even number of cards');
  const colorPairs = generateColors(total / 2).flatMap(c => [c, c]);
  // Shuffle
  for (let i = colorPairs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [colorPairs[i], colorPairs[j]] = [colorPairs[j], colorPairs[i]];
  }
  // Build grid
  const grid: Card[][] = [];
  let idx = 0;
  for (let r = 0; r < rows; r++) {
    const row: Card[] = [];
    for (let c = 0; c < cols; c++) {
      row.push({ color: colorPairs[idx++], flipped: false, matched: false });
    }
    grid.push(row);
  }
  return grid;
}

export function createGame(rows: number, cols: number): GameState {
  return {
    grid: createGrid(rows, cols),
    moves: 0,
    win: false,
    lastFlipped: [],
    userMoves: [],
    aiMoves: [],
    userScore: 0,
    aiScore: 0,
    winner: undefined,
  };
}

export function flipCard(state: GameState, row: number, col: number): GameState {
  const card = state.grid[row][col];
  if (card.flipped || card.matched) return state;
  card.flipped = true;
  state.lastFlipped.push([row, col]);
  // Track move (caller must specify player)
  if ((state as any)._currentPlayer === 'ai') {
    if (state.aiMoves) state.aiMoves.push({ row, col, color: card.color, matched: card.matched });
  } else {
    if (state.userMoves) state.userMoves.push({ row, col, color: card.color, matched: card.matched });
  }
  if (state.lastFlipped.length === 2) {
    state.moves++;
    const [a, b] = state.lastFlipped;
    const cardA = state.grid[a[0]][a[1]];
    const cardB = state.grid[b[0]][b[1]];
    if (cardA.color === cardB.color) {
      cardA.matched = true;
      cardB.matched = true;
      // Score for player
      if ((state as any)._currentPlayer === 'ai') {
        state.aiScore = (state.aiScore ?? 0) + 1;
      } else {
        state.userScore = (state.userScore ?? 0) + 1;
      }
    }
    state.lastFlipped = [];
  }
  // Check win
  state.win = state.grid.flat().every((card: Card) => card.matched);
  // If win, set winner
  if (state.win) {
    if ((state.userScore ?? 0) > (state.aiScore ?? 0)) state.winner = 'user';
    else if ((state.aiScore ?? 0) > (state.userScore ?? 0)) state.winner = 'ai';
    else state.winner = 'draw';
  }
  return state;
}

export function resetUnmatchedCards(state: GameState): GameState {
  // Find all flipped but not matched cards and flip them back
  for (const row of state.grid) {
    for (const card of row) {
      if (card.flipped && !card.matched) {
        card.flipped = false;
      }
    }
  }
  return state;
}
