const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

app.use(express.static(PUBLIC_DIR));

function createInitialBoard() {
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 !== 1) continue;
      if (row < 3) board[row][col] = "b";
      else if (row > 4) board[row][col] = "r";
    }
  }
  return board;
}

function isDarkSquare(row, col) {
  return (row + col) % 2 === 1;
}

function pieceColor(piece) {
  if (!piece) return null;
  return piece.toLowerCase() === "r" ? "red" : "black";
}

function isKing(piece) {
  return piece === "R" || piece === "B";
}

function forwardDirs(color, king) {
  if (king) return [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  return color === "red"
    ? [[-1, -1], [-1, 1]]
    : [[1, -1], [1, 1]];
}

function inBounds(row, col) {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

function opponent(color) {
  return color === "red" ? "black" : "red";
}

function getLegalMoves(board, row, col, mustJumpFrom = null) {
  const piece = board[row][col];
  if (!piece) return [];

  const color = pieceColor(piece);
  const king = isKing(piece);
  const moves = [];
  const jumps = [];

  const dirs = forwardDirs(color, king);

  for (const [dr, dc] of dirs) {
    const nr = row + dr;
    const nc = col + dc;
    if (!inBounds(nr, nc) || !isDarkSquare(nr, nc) || board[nr][nc]) continue;

    const jr = row + dr * 2;
    const jc = col + dc * 2;
    const mr = row + dr;
    const mc = col + dc;

    if (
      inBounds(jr, jc) &&
      isDarkSquare(jr, jc) &&
      !board[jr][jc] &&
      board[mr][mc] &&
      pieceColor(board[mr][mc]) === opponent(color)
    ) {
      jumps.push({
        from: { row, col },
        to: { row: jr, col: jc },
        jumped: { row: mr, col: mc },
        type: "jump",
      });
    } else if (!mustJumpFrom) {
      moves.push({
        from: { row, col },
        to: { row: nr, col: nc },
        type: "slide",
      });
    }
  }

  if (mustJumpFrom) {
    if (mustJumpFrom.row !== row || mustJumpFrom.col !== col) return [];
    return jumps;
  }

  const anyJumpOnBoard = hasJumpAvailable(board, color);
  if (anyJumpOnBoard) return jumps;
  return jumps.length ? jumps : moves;
}

function hasJumpAvailable(board, color) {
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (!piece || pieceColor(piece) !== color) continue;
      const jumps = getLegalMoves(board, row, col, null).filter((m) => m.type === "jump");
      if (jumps.length) return true;
    }
  }
  return false;
}

function applyMove(board, move) {
  const next = board.map((r) => r.slice());
  const piece = next[move.from.row][move.from.col];
  next[move.from.row][move.from.col] = null;
  next[move.to.row][move.to.col] = piece;

  if (move.type === "jump" && move.jumped) {
    next[move.jumped.row][move.jumped.col] = null;
  }

  const color = pieceColor(piece);
  if (color === "red" && move.to.row === 0) next[move.to.row][move.to.col] = "R";
  if (color === "black" && move.to.row === 7) next[move.to.row][move.to.col] = "B";

  return next;
}

function findMatchingMove(board, from, to, mustJumpFrom) {
  const moves = getLegalMoves(board, from.row, from.col, mustJumpFrom);
  return moves.find(
    (m) => m.to.row === to.row && m.to.col === to.col
  );
}

function countPieces(board, color) {
  let count = 0;
  const letter = color === "red" ? "r" : "b";
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const p = board[row][col];
      if (p && p.toLowerCase() === letter) count++;
    }
  }
  return count;
}

function createGameState() {
  return {
    board: createInitialBoard(),
    currentTurn: "red",
    mustJumpFrom: null,
    winner: null,
    players: { red: null, black: null },
    status: "waiting",
  };
}

let game = createGameState();

function getPublicState() {
  return {
    board: game.board,
    currentTurn: game.currentTurn,
    mustJumpFrom: game.mustJumpFrom,
    winner: game.winner,
    status: game.status,
    players: {
      red: Boolean(game.players.red),
      black: Boolean(game.players.black),
    },
  };
}

function resetGame() {
  game = createGameState();
}

function assignPlayer(socketId) {
  if (!game.players.red) {
    game.players.red = socketId;
    return "red";
  }
  if (!game.players.black && game.players.red !== socketId) {
    game.players.black = socketId;
    return "black";
  }
  if (game.players.red === socketId) return "red";
  if (game.players.black === socketId) return "black";
  return null;
}

function playerColorForSocket(socketId) {
  if (game.players.red === socketId) return "red";
  if (game.players.black === socketId) return "black";
  return null;
}

function bothPlayersConnected() {
  return game.players.red && game.players.black;
}

io.on("connection", (socket) => {
  const color = assignPlayer(socket.id);

  if (!color) {
    socket.emit("gameFull");
    return;
  }

  if (bothPlayersConnected()) {
    const players = { ...game.players };
    game = createGameState();
    game.players = players;
    game.status = "playing";
  } else {
    game.status = "playing";
  }

  socket.emit("joined", { color, state: getPublicState() });
  io.emit("stateUpdate", getPublicState());

  socket.on("makeMove", ({ from, to }) => {
    if (game.status !== "playing" || game.winner) return;

    const playerColor = playerColorForSocket(socket.id);
    if (!playerColor || playerColor !== game.currentTurn) return;

    if (
      !from ||
      !to ||
      typeof from.row !== "number" ||
      typeof from.col !== "number" ||
      typeof to.row !== "number" ||
      typeof to.col !== "number"
    ) {
      return;
    }

    const move = findMatchingMove(game.board, from, to, game.mustJumpFrom);
    if (!move) return;

    game.board = applyMove(game.board, move);

    const movedPiece = game.board[move.to.row][move.to.col];
    const furtherJumps = getLegalMoves(
      game.board,
      move.to.row,
      move.to.col,
      null
    ).filter((m) => m.type === "jump");

    if (move.type === "jump" && furtherJumps.length) {
      game.mustJumpFrom = { row: move.to.row, col: move.to.col };
    } else {
      game.mustJumpFrom = null;
      game.currentTurn = opponent(game.currentTurn);
    }

    const redLeft = countPieces(game.board, "red");
    const blackLeft = countPieces(game.board, "black");
    if (redLeft === 0) game.winner = "black";
    else if (blackLeft === 0) game.winner = "red";
    else if (
      !hasJumpAvailable(game.board, game.currentTurn) &&
      !game.mustJumpFrom
    ) {
      let hasMove = false;
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          if (getLegalMoves(game.board, r, c, null).length) {
            hasMove = true;
            break;
          }
        }
        if (hasMove) break;
      }
      if (!hasMove) game.winner = opponent(game.currentTurn);
    }

    io.emit("stateUpdate", getPublicState());
  });

  socket.on("requestReset", () => {
    if (!bothPlayersConnected()) return;
    game = {
      ...createGameState(),
      players: { ...game.players },
      status: "playing",
    };
    io.emit("stateUpdate", getPublicState());
  });

  socket.on("disconnect", () => {
    const wasRed = game.players.red === socket.id;
    const wasBlack = game.players.black === socket.id;

    if (wasRed) game.players.red = null;
    if (wasBlack) game.players.black = null;

    if (!game.players.red && !game.players.black) {
      resetGame();
    } else {
      game.status = "playing";
      game.mustJumpFrom = null;
      game.winner = null;
    }

    io.emit("playerDisconnected", {
      message: "Opponent left — you can still play. Send the link to a friend to join as Player 2.",
    });
    io.emit("stateUpdate", getPublicState());
  });
});

server.listen(PORT, () => {
  console.log(`Hand-drawn checkers running at http://localhost:${PORT}`);
});
