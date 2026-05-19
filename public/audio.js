(() => {
  "use strict";

  const SFX = {
    red: {
      move: "/audio/red_move_1.wav",
      jump: "/audio/red_jump_1.wav",
      kinged: "/audio/red_kinged_1.wav",
      kingMove: "/audio/red_king_move_1.wav",
      kingJump: "/audio/red_king_jump_1.wav",
    },
    blue: {
      move: "/audio/blue_move_1.wav",
      jump: "/audio/blue_jump_1.wav",
      kinged: "/audio/blue_kinged_1.wav",
      kingMove: "/audio/blue_king_move_1.wav",
      kingJump: "/audio/blue_king_jump_1.wav",
    },
  };

  const cache = {};
  const pool = {};
  let bgm = null;
  let unlocked = false;
  let muted = false;
  let musicOn = true;

  function load(src) {
    if (!cache[src]) {
      const audio = new Audio(src);
      audio.preload = "auto";
      cache[src] = audio;
      pool[src] = [];
    }
    return cache[src];
  }

  function warmPool(src, count = 3) {
    load(src);
    while (pool[src].length < count) {
      const inst = cache[src].cloneNode();
      inst.volume = 0.85;
      pool[src].push(inst);
    }
  }

  function playSrc(src) {
    if (muted || !src) return;
    try {
      warmPool(src);
      const inst = pool[src].pop() || cache[src].cloneNode();
      inst.volume = 0.85;
      inst.currentTime = 0;
      const done = () => {
        if (pool[src].length < 4) pool[src].push(inst);
      };
      inst.addEventListener("ended", done, { once: true });
      inst.play().catch(done);
    } catch (_) {
      /* ignore */
    }
  }

  function pieceColorKey(piece) {
    if (!piece) return null;
    return piece.toLowerCase() === "r" ? "red" : "blue";
  }

  function isKing(piece) {
    return piece === "R" || piece === "B";
  }

  function playMoveSound({ colorKey, jump, promoted, king }) {
    const set = SFX[colorKey];
    if (!set) return;

    if (promoted) {
      playSrc(set.kinged);
      return;
    }

    if (king) {
      playSrc(jump ? set.kingJump : set.kingMove);
      return;
    }

    playSrc(jump ? set.jump : set.move);
  }

  function analyzeBoardChange(oldBoard, newBoard) {
    const emptied = [];
    const filled = [];

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (oldBoard[r][c] && !newBoard[r][c]) {
          emptied.push({ r, c, piece: oldBoard[r][c] });
        }
        if (oldBoard[r][c] !== newBoard[r][c] && newBoard[r][c]) {
          filled.push({ r, c, piece: newBoard[r][c] });
        }
      }
    }

    if (!filled.length || !emptied.length) return null;

    const to = filled[0];
    const from =
      emptied.find((e) => pieceColorKey(e.piece) === pieceColorKey(to.piece)) ||
      emptied[0];

    const moverColor = pieceColorKey(to.piece);
    const jump = emptied.length > 1;
    const promoted = !isKing(from.piece) && isKing(to.piece);
    const king = isKing(to.piece);

    return {
      colorKey: moverColor,
      jump,
      promoted,
      king,
      from: { row: from.r, col: from.c },
      to: { row: to.r, col: to.c },
    };
  }

  function moveKey(from, to) {
    return `${from.row},${from.col}-${to.row},${to.col}`;
  }

  function soundFromMove(board, move, playerColor) {
    const piece = board[move.from.row][move.from.col];
    if (!piece) return null;

    const colorKey = playerColor === "red" ? "red" : "blue";
    const wasKing = isKing(piece);
    const promoted =
      !wasKing &&
      ((colorKey === "red" && move.to.row === 0) ||
        (colorKey === "blue" && move.to.row === 7));

    return {
      colorKey,
      jump: move.type === "jump",
      promoted,
      king: wasKing,
      from: move.from,
      to: move.to,
    };
  }

  function startBgm() {
    if (!musicOn || muted || !unlocked) return;
    if (!bgm) {
      bgm = load("/audio/bgmusic.m4a");
      bgm.loop = true;
      bgm.volume = 0.35;
    }
    if (bgm.paused) bgm.play().catch(() => {});
  }

  function stopBgm() {
    if (bgm && !bgm.paused) {
      bgm.pause();
      bgm.currentTime = 0;
    }
  }

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    Object.values(SFX.red).forEach((src) => warmPool(src));
    Object.values(SFX.blue).forEach((src) => warmPool(src));
    load("/audio/bgmusic.m4a");
    startBgm();
  }

  function setMuted(value) {
    muted = value;
    if (muted) stopBgm();
    else if (unlocked && musicOn) startBgm();
  }

  function toggleMusic() {
    musicOn = !musicOn;
    if (musicOn && unlocked && !muted) startBgm();
    else stopBgm();
    return musicOn;
  }

  window.SchmeckersAudio = {
    unlock,
    setMuted,
    toggleMusic,
    playMoveSound,
    analyzeBoardChange,
    soundFromMove,
    moveKey,
    isMusicOn: () => musicOn,
    isMuted: () => muted,
  };
})();
