
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GameState } from "./game";

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  throw new Error("Missing Gemini API key. Set GEMINI_API_KEY in your environment.");
}
const genAI = new GoogleGenerativeAI(API_KEY);

// Simple in-memory chat session store (keyed by gameId)
const chatSessions: Record<string, any> = {};

function getGridString(game: GameState): string {
  return game.grid.map(row => row.map(card => card.matched ? card.color : card.flipped ? card.color : "?").join(",")).join("\n");
}

export async function getGeminiMove(
  game: GameState,
  difficulty: string,
  gameId: string,
  userMoves: { row: number, col: number, color: string, matched: boolean }[] = [],
  aiMoves: { row: number, col: number, color: string, matched: boolean }[] = []
): Promise<{ row: number, col: number }[]> {
  // If no chat session for this game, create one with initial instructions
  if (!chatSessions[gameId]) {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    chatSessions[gameId] = model.startChat({
      history: [
        {
          role: "user",
          parts: [{
            text:
              `You are playing a card matching game. The grid is ${game.grid.length}x${game.grid[0].length}.
              Each card has a color, and every card has exactly one matching pair somewhere on the grid.
              The goal is to find and match more pairs than your opponent.
              At the end, all cards should be matched and open.
              Your difficulty is ${difficulty}. Here is the starting grid:\n${getGridString(game)}\n` +
              `Here is the history of revealed cards by the user: ${JSON.stringify(userMoves)}\n` +
              `Here is the history of revealed cards by the AI: ${JSON.stringify(aiMoves)}\n` +
              `Remember all previously revealed cards and their positions,
               including the user's moves. Use this memory to make optimal moves.`
          }]
        }
      ]
    });
  }

  // Prepare incremental prompt for this turn
  const prompt =
    `The user's last moves were: ${JSON.stringify(game.lastFlipped)} (row, col positions).\n` +
    `Here is the updated grid:\n${getGridString(game)}\n` +
    `Here is the history of revealed cards by the user: ${JSON.stringify(userMoves)}\n` +
    `Here is the history of revealed cards by the AI: ${JSON.stringify(aiMoves)}\n` +
    `If you know a matching pair, select those cards. If you do not know any matches, pick any two random valid cards that are not matched or flipped. Give me two moves as JSON array of objects: [{"row":0,"col":1},{"row":2,"col":3}]. Only pick cards that are not matched or flipped.`;

  const chat = chatSessions[gameId];
  const result = await chat.sendMessage(prompt);
  const text = result.response.text();
  // Extract JSON array from Gemini response
  try {
    const match = text.match(/\[.*\]/s);
    if (match) {
      const moves = JSON.parse(match[0]);
      if (Array.isArray(moves) && moves.length === 2 && moves[0].row !== undefined && moves[0].col !== undefined) {
        return moves;
      }
    }
  } catch (e) {
    // fallback: return empty
  }
  return [];
}

// Optionally, add a function to reset chat context for a game
export function resetGeminiContext(gameId: string) {
  delete chatSessions[gameId];
}
