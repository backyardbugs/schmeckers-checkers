(() => {
  "use strict";

  const boardEl = document.getElementById("chessboard");
  const statusEl = document.getElementById("status-text");
  const turnEl = document.getElementById("turn-text");

  const socket = io();

  let myColor = null;
  let board = createInitialBoard();
  let currentTurn = "red";
  let mustJumpFrom = null;
  let winner = null;
  let gameStatus = "waiting";

  let selected = null;
  let validTargets = [];
  let drag = null;
  let pointerId = null;
  let suppressClick = false;
  const DRAG_THRESHOLD = 12;

  const squares = [];

  function createInitialBoard() {
    const b = Array.from({ length: 8 }, () => Array(8).fill(null));
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if ((row + col) % 2 !== 1) continue;
        if (row < 3) b[row][col] = "b";
        else if (row > 4) b[row][col] = "r";
      }
    }
    return b;
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
    return color === "red" ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
  }

  function inBounds(row, col) {
    return row >= 0 && row < 8 && col >= 0 && col < 8;
  }

  function opponent(color) {
    return color === "red" ? "black" : "red";
  }

  function getLegalMoves(stateBoard, row, col, forcedJumpFrom) {
    const piece = stateBoard[row][col];
    if (!piece) return [];

    const color = pieceColor(piece);
    const king = isKing(piece);
    const moves = [];
    const jumps = [];
    const dirs = forwardDirs(color, king);

    for (const [dr, dc] of dirs) {
      const nr = row + dr;
      const nc = col + dc;
      if (!inBounds(nr, nc) || !isDarkSquare(nr, nc) || stateBoard[nr][nc]) continue;

      const jr = row + dr * 2;
      const jc = col + dc * 2;
      const mr = row + dr;
      const mc = col + dc;

      if (
        inBounds(jr, jc) &&
        isDarkSquare(jr, jc) &&
        !stateBoard[jr][jc] &&
        stateBoard[mr][mc] &&
        pieceColor(stateBoard[mr][mc]) === opponent(color)
      ) {
        jumps.push({
          from: { row, col },
          to: { row: jr, col: jc },
          jumped: { row: mr, col: mc },
          type: "jump",
        });
      } else if (!forcedJumpFrom) {
        moves.push({
          from: { row, col },
          to: { row: nr, col: nc },
          type: "slide",
        });
      }
    }

    if (forcedJumpFrom) {
      if (forcedJumpFrom.row !== row || forcedJumpFrom.col !== col) return [];
      return jumps;
    }

    if (hasJumpAvailable(stateBoard, color)) return jumps;
    return jumps.length ? jumps : moves;
  }

  function hasJumpAvailable(stateBoard, color) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = stateBoard[r][c];
        if (!piece || pieceColor(piece) !== color) continue;
        const jumps = getLegalMoves(stateBoard, r, c, null).filter((m) => m.type === "jump");
        if (jumps.length) return true;
      }
    }
    return false;
  }

  function buildBoardDom() {
    boardEl.innerHTML = "";
    squares.length = 0;

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const sq = document.createElement("div");
        sq.className = "square";
        sq.dataset.row = String(row);
        sq.dataset.col = String(col);
        boardEl.appendChild(sq);
        squares.push(sq);
      }
    }
  }

  function squareAt(row, col) {
    return squares[row * 8 + col];
  }

  function updateHighlights() {
    for (const sq of squares) {
      sq.classList.remove("selected", "valid-target", "playable");
    }
    if (!canInteract()) return;

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if (board[row][col] && pieceColor(board[row][col]) === myColor) {
          squareAt(row, col).classList.add("playable");
        }
      }
    }
    if (!selected) return;
    squareAt(selected.row, selected.col).classList.add("selected");
    for (const move of validTargets) {
      squareAt(move.to.row, move.to.col).classList.add("valid-target");
    }
  }

  function renderBoard() {
    for (const sq of squares) {
      sq.querySelectorAll(".piece").forEach((p) => p.remove());
    }

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (!piece) continue;
        const sq = squareAt(row, col);
        const el = document.createElement("div");
        el.className = "piece";
        const color = pieceColor(piece);
        el.classList.add(color === "black" ? "blue" : color);
        if (isKing(piece)) el.classList.add("king");
        el.classList.add(myColor === color ? "mine" : "opponent");
        sq.appendChild(el);
      }
    }
    updateHighlights();
  }

  function canInteract() {
    return gameStatus === "playing" && !winner && myColor === currentTurn;
  }

  function isMyTurn() {
    return myColor && myColor === currentTurn;
  }

  function updateHud() {
    if (winner) {
      const label = winner === myColor ? "You win!" : "You lose.";
      turnEl.textContent = label;
      return;
    }

    if (gameStatus === "waiting") {
      turnEl.textContent = myColor
        ? "Connecting… open this link on a second device for 2-player."
        : "";
      return;
    }

    if (!myColor) {
      turnEl.textContent = "";
      return;
    }

    if (mustJumpFrom && isMyTurn()) {
      turnEl.textContent = "Continue your jump!";
      return;
    }

    turnEl.textContent = isMyTurn()
      ? "Your turn"
      : "Opponent's turn";
  }

  function clearSelection() {
    selected = null;
    validTargets = [];
  }

  function forcedJumpSquare() {
    return mustJumpFrom && isMyTurn() ? mustJumpFrom : null;
  }

  function selectPiece(row, col) {
    const forced = forcedJumpSquare();
    if (forced && (forced.row !== row || forced.col !== col)) return false;

    const piece = board[row][col];
    if (!piece || pieceColor(piece) !== myColor) return false;

    selected = { row, col };
    validTargets = getLegalMoves(board, row, col, forced);
    updateHighlights();
    return true;
  }

  function tryMoveTo(row, col) {
    const move = validTargets.find(
      (m) => m.to.row === row && m.to.col === col
    );
    if (!move) return false;
    socket.emit("makeMove", { from: move.from, to: move.to });
    clearSelection();
    updateHighlights();
    return true;
  }

  function squareFromPoint(x, y) {
    const el = document.elementFromPoint(x, y);
    const sq = el?.closest?.(".square");
    if (!sq || !boardEl.contains(sq)) return null;
    return { row: Number(sq.dataset.row), col: Number(sq.dataset.col) };
  }

  function beginDrag(pieceEl, x, y) {
    const ghost = pieceEl.cloneNode(true);
    ghost.classList.add("drag-ghost");
    ghost.classList.remove("dragging", "mine");
    document.body.appendChild(ghost);
    pieceEl.classList.add("dragging");
    ghost.style.left = `${x}px`;
    ghost.style.top = `${y}px`;
    drag = { pieceEl, ghost, clientX: x, clientY: y, moved: true };
  }

  function endDrag(x, y) {
    if (!drag?.ghost) return;
    if (drag.pieceEl) drag.pieceEl.classList.remove("dragging");
    drag.ghost.remove();

    const target = squareFromPoint(x, y);
    if (target) tryMoveTo(target.row, target.col);
    else updateHighlights();
  }

  function handleBoardTap(row, col) {
    if (!canInteract()) return;

    const forced = forcedJumpSquare();
    if (forced) {
      tryMoveTo(row, col);
      return;
    }

    if (selected && tryMoveTo(row, col)) return;

    const piece = board[row][col];
    if (piece && pieceColor(piece) === myColor) {
      selectPiece(row, col);
      return;
    }

    clearSelection();
    updateHighlights();
  }

  function setupBoardInput() {
    // Reliable click/tap on desktop and mobile
    boardEl.addEventListener("click", (e) => {
      if (!canInteract() || suppressClick) return;
      const sq = e.target.closest(".square");
      if (!sq) return;
      handleBoardTap(Number(sq.dataset.row), Number(sq.dataset.col));
    });

    boardEl.addEventListener(
      "pointerdown",
      (e) => {
        if (!canInteract() || e.button > 0) return;
        const sq = e.target.closest(".square");
        if (!sq) return;

        const row = Number(sq.dataset.row);
        const col = Number(sq.dataset.col);
        const piece = board[row][col];
        const isMine = piece && pieceColor(piece) === myColor;
        if (!isMine) return;

        boardEl.setPointerCapture(e.pointerId);
        pointerId = e.pointerId;

        const pieceEl = sq.querySelector(".piece.mine");
        drag = {
          pieceEl,
          ghost: null,
          startX: e.clientX,
          startY: e.clientY,
          clientX: e.clientX,
          clientY: e.clientY,
          moved: false,
        };
      },
      { passive: true }
    );

    boardEl.addEventListener(
      "pointermove",
      (e) => {
        if (!drag || e.pointerId !== pointerId || !drag.pieceEl) return;
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;

        if (!drag.ghost && Math.hypot(dx, dy) >= DRAG_THRESHOLD) {
          e.preventDefault();
          if (!selected) selectPiece(
            Number(drag.pieceEl.closest(".square").dataset.row),
            Number(drag.pieceEl.closest(".square").dataset.col)
          );
          beginDrag(drag.pieceEl, e.clientX, e.clientY);
        }

        if (drag.ghost) {
          e.preventDefault();
          drag.ghost.style.left = `${e.clientX}px`;
          drag.ghost.style.top = `${e.clientY}px`;
        }
      },
      { passive: false }
    );

    const finishPointer = (e) => {
      if (!drag || e.pointerId !== pointerId) return;
      try {
        boardEl.releasePointerCapture(e.pointerId);
      } catch (_) {
        /* already released */
      }

      if (drag.ghost) {
        e.preventDefault();
        suppressClick = true;
        endDrag(e.clientX, e.clientY);
        setTimeout(() => {
          suppressClick = false;
        }, 50);
      }

      drag = null;
      pointerId = null;
    };

    boardEl.addEventListener("pointerup", finishPointer);
    boardEl.addEventListener("pointercancel", finishPointer);
  }

  function applyServerState(state) {
    board = state.board;
    currentTurn = state.currentTurn;
    mustJumpFrom = state.mustJumpFrom;
    winner = state.winner;
    gameStatus = state.status;
    clearSelection();

    if (mustJumpFrom && isMyTurn() && canInteract()) {
      selected = { ...mustJumpFrom };
      validTargets = getLegalMoves(
        board,
        mustJumpFrom.row,
        mustJumpFrom.col,
        mustJumpFrom
      );
    }

    renderBoard();
    updateHud();
  }

  socket.on("joined", ({ color, state }) => {
    myColor = color;
    statusEl.textContent =
      color === "red"
        ? "You are Red — Player 1"
        : "You are Blue — Player 2";
    applyServerState(state);
    updateStatusMessage(state);
  });

  function updateStatusMessage(state) {
    const shareUrl = window.location.href;
    const waitingForFriend =
      state.status === "playing" &&
      !(state.players.red && state.players.black);

    if (state.winner) return;

    if (waitingForFriend) {
      statusEl.textContent =
        "Practice mode — send this link to your friend: " + shareUrl;
      return;
    }

    if (state.status === "playing") {
      statusEl.textContent = "Game in progress — " + shareUrl;
    }
  }

  socket.on("stateUpdate", (state) => {
    applyServerState(state);
    updateStatusMessage(state);
  });

  socket.on("playerDisconnected", ({ message }) => {
    statusEl.textContent = message;
    clearSelection();
  });

  socket.on("gameFull", () => {
    statusEl.textContent = "Room full — only two players at a time.";
  });

  socket.on("connect", () => {
    if (!myColor) statusEl.textContent = "Connected. Waiting for assignment…";
  });

  buildBoardDom();
  setupBoardInput();
  renderBoard();
  updateHud();
})();
