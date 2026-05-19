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
  let bgm = null;
  let unlocked = false;
  let muted = false;
  let musicOn = true;

  function load(src) {
    if (!cache[src]) {
      const audio = new Audio(src);
      audio.preload = "auto";
      cache[src] = audio;
    }
    return cache[src];
  }

  function playSrc(src) {
    if (muted || !src) return;
    try {
      const sound = load(src);
      const inst = sound.cloneNode();
      inst.volume = 0.85;
      inst.play().catch(() => {});
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

    return { colorKey: moverColor, jump, promoted, king };
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
    Object.values(SFX.red).forEach((src) => load(src));
    Object.values(SFX.blue).forEach((src) => load(src));
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
    isMusicOn: () => musicOn,
    isMuted: () => muted,
  };
})();
