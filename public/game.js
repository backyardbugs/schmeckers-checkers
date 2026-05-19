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
  let previousBoard = null;
  let audioReady = false;

  const squares = [];
  const audio = () => window.SchmeckersAudio;

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

  function isMyPiece(piece) {
    return piece && myColor && pieceColor(piece) === myColor;
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

  function collectJumpsForPiece(stateBoard, row, col) {
    const piece = stateBoard[row][col];
    if (!piece) return [];

    const color = pieceColor(piece);
    const king = isKing(piece);
    const jumps = [];
    const dirs = forwardDirs(color, king);

    for (const [dr, dc] of dirs) {
      const nr = row + dr;
      const nc = col + dc;
      const jr = row + dr * 2;
      const jc = col + dc * 2;

      if (
        inBounds(jr, jc) &&
        isDarkSquare(jr, jc) &&
        !stateBoard[jr][jc] &&
        inBounds(nr, nc) &&
        stateBoard[nr][nc] &&
        pieceColor(stateBoard[nr][nc]) === opponent(color)
      ) {
        jumps.push({
          from: { row, col },
          to: { row: jr, col: jc },
          jumped: { row: nr, col: nc },
          type: "jump",
        });
      }
    }
    return jumps;
  }

  function collectSlidesForPiece(stateBoard, row, col) {
    const piece = stateBoard[row][col];
    if (!piece) return [];

    const color = pieceColor(piece);
    const king = isKing(piece);
    const slides = [];
    const dirs = forwardDirs(color, king);

    for (const [dr, dc] of dirs) {
      const nr = row + dr;
      const nc = col + dc;
      if (!inBounds(nr, nc) || !isDarkSquare(nr, nc) || stateBoard[nr][nc]) continue;
      slides.push({
        from: { row, col },
        to: { row: nr, col: nc },
        type: "slide",
      });
    }
    return slides;
  }

  function hasJumpAvailable(stateBoard, color) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = stateBoard[r][c];
        if (!piece || pieceColor(piece) !== color) continue;
        if (collectJumpsForPiece(stateBoard, r, c).length) return true;
      }
    }
    return false;
  }

  function getLegalMoves(stateBoard, row, col, forcedJumpFrom) {
    const piece = stateBoard[row][col];
    if (!piece) return [];

    const color = pieceColor(piece);
    const jumps = collectJumpsForPiece(stateBoard, row, col);

    if (forcedJumpFrom) {
      if (forcedJumpFrom.row !== row || forcedJumpFrom.col !== col) return [];
      return jumps;
    }

    const jumpRequired = hasJumpAvailable(stateBoard, color);
    const slides = collectSlidesForPiece(stateBoard, row, col);
    return jumpRequired ? jumps : jumps.length ? jumps : slides;
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

        const onActivate = (e) => {
          e.preventDefault();
          e.stopPropagation();
          onSquareActivated(row, col);
        };

        sq.addEventListener("mousedown", onActivate);
        sq.addEventListener("touchend", onActivate, { passive: false });

        boardEl.appendChild(sq);
        squares.push(sq);
      }
    }
  }

  function squareAt(row, col) {
    return squares[row * 8 + col];
  }

  function canInteract() {
    return gameStatus === "playing" && !winner && myColor && myColor === currentTurn;
  }

  function isMyTurn() {
    return myColor && myColor === currentTurn;
  }

  function updateHighlights() {
    for (const sq of squares) {
      sq.classList.remove("selected", "valid-target", "playable");
      sq.querySelectorAll(".move-dot").forEach((d) => d.remove());
    }

    if (!canInteract()) return;

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if (isMyPiece(board[row][col])) {
          squareAt(row, col).classList.add("playable");
        }
      }
    }

    if (!selected) return;

    squareAt(selected.row, selected.col).classList.add("selected");

    for (const move of validTargets) {
      const sq = squareAt(move.to.row, move.to.col);
      sq.classList.add("valid-target");
      const dot = document.createElement("div");
      dot.className = "move-dot";
      sq.appendChild(dot);
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
        el.classList.add(isMyPiece(piece) ? "mine" : "opponent");
        sq.appendChild(el);
      }
    }

    updateHighlights();
  }

  function updateHud() {
    if (winner) {
      turnEl.textContent = winner === myColor ? "You win!" : "You lose.";
      return;
    }

    if (!myColor) {
      turnEl.textContent = "Connecting…";
      return;
    }

    if (gameStatus !== "playing") {
      turnEl.textContent = "Waiting for game to start…";
      return;
    }

    if (mustJumpFrom && isMyTurn()) {
      turnEl.textContent = "Continue your jump!";
      return;
    }

    if (isMyTurn()) {
      turnEl.textContent = selected
        ? "Tap a green square to move"
        : "Tap one of your pieces";
    } else {
      turnEl.textContent = "Opponent's turn";
    }
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
    if (!isMyPiece(board[row][col])) return false;

    selected = { row, col };
    validTargets = getLegalMoves(board, row, col, forced);
    updateHighlights();
    updateHud();
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
    updateHud();
    return true;
  }

  function onSquareActivated(row, col) {
    if (!audioReady && window.SchmeckersAudio) {
      audio().unlock();
      audioReady = true;
    }

    if (!myColor) {
      turnEl.textContent = "Not connected yet — wait a moment and refresh.";
      return;
    }

    if (!canInteract()) {
      turnEl.textContent =
        myColor !== currentTurn
          ? `Not your turn — you are ${myColor}, waiting for ${currentTurn}.`
          : "You can't move right now.";
      updateHud();
      return;
    }

    const forced = forcedJumpSquare();
    if (forced) {
      tryMoveTo(row, col);
      return;
    }

    if (selected && tryMoveTo(row, col)) return;

    if (isMyPiece(board[row][col])) {
      selectPiece(row, col);
      return;
    }

    clearSelection();
    updateHighlights();
    updateHud();
  }

  function cloneBoard(b) {
    return b.map((row) => row.slice());
  }

  function applyServerState(state) {
    const newBoard = state.board;

    if (previousBoard && audioReady) {
      const moveInfo = audio().analyzeBoardChange(previousBoard, newBoard);
      if (moveInfo) audio().playMoveSound(moveInfo);
    }

    previousBoard = cloneBoard(newBoard);
    board = newBoard;
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
      color === "red" ? "You are Red (move first)" : "You are Blue";
    applyServerState(state);
  });

  socket.on("stateUpdate", (state) => {
    applyServerState(state);
    if (state.status === "playing" && !state.winner) {
      statusEl.textContent = "Game in progress";
    }
  });

  socket.on("playerDisconnected", ({ message }) => {
    statusEl.textContent = message;
    clearSelection();
    updateHud();
  });

  socket.on("gameFull", () => {
    statusEl.textContent = "Room full — only 2 players at a time.";
  });

  socket.on("connect_error", () => {
    statusEl.textContent = "Connection error — refresh the page.";
  });

  function setupAudioControls() {
    const muteBtn = document.getElementById("mute-btn");
    const musicBtn = document.getElementById("music-btn");
    if (!muteBtn || !musicBtn) return;

    const refreshButtons = () => {
      if (!window.SchmeckersAudio) return;
      muteBtn.textContent = audio().isMuted() ? "Sound: Off" : "Sound: On";
      musicBtn.textContent = audio().isMusicOn()
        ? "Music: On"
        : "Music: Off";
    };

    muteBtn.addEventListener("click", () => {
      if (!audioReady) {
        audio().unlock();
        audioReady = true;
      }
      audio().setMuted(!audio().isMuted());
      refreshButtons();
    });

    musicBtn.addEventListener("click", () => {
      if (!audioReady) {
        audio().unlock();
        audioReady = true;
      }
      audio().toggleMusic();
      refreshButtons();
    });

    refreshButtons();
  }

  buildBoardDom();
  setupAudioControls();
  previousBoard = cloneBoard(board);
  renderBoard();
  updateHud();
})();
