import { useState, useEffect, useRef, useCallback } from "react";

interface FlappyBirdProps {
  onClose: () => void;
}

const GRAVITY = 0.5;
const JUMP = -8;
const PIPE_WIDTH = 50;
const GAP = 150;
const PIPE_SPEED = 3;
const BIRD_SIZE = 30;
const CANVAS_W = 320;
const CANVAS_H = 480;

const FlappyBird = ({ onClose }: FlappyBirdProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const stateRef = useRef({
    birdY: CANVAS_H / 2,
    birdVel: 0,
    pipes: [] as { x: number; topH: number; scored: boolean }[],
    score: 0,
    running: true,
    frame: 0,
  });

  const jump = useCallback(() => {
    if (gameOver) return;
    if (!started) setStarted(true);
    stateRef.current.birdVel = JUMP;
  }, [gameOver, started]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "ArrowUp") { e.preventDefault(); jump(); }
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [jump, onClose]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const s = stateRef.current;
    s.birdY = CANVAS_H / 2;
    s.birdVel = 0;
    s.pipes = [];
    s.score = 0;
    s.running = true;
    s.frame = 0;

    const loop = () => {
      if (!s.running) return;
      s.frame++;

      if (started) {
        s.birdVel += GRAVITY;
        s.birdY += s.birdVel;

        if (s.frame % 90 === 0) {
          const topH = 50 + Math.random() * (CANVAS_H - GAP - 100);
          s.pipes.push({ x: CANVAS_W, topH, scored: false });
        }

        for (const p of s.pipes) {
          p.x -= PIPE_SPEED;
          if (!p.scored && p.x + PIPE_WIDTH < CANVAS_W / 4) {
            p.scored = true;
            s.score++;
            setScore(s.score);
          }
        }
        s.pipes = s.pipes.filter((p) => p.x > -PIPE_WIDTH);

        // Collision
        const birdX = CANVAS_W / 4;
        for (const p of s.pipes) {
          if (birdX + BIRD_SIZE / 2 > p.x && birdX - BIRD_SIZE / 2 < p.x + PIPE_WIDTH) {
            if (s.birdY - BIRD_SIZE / 2 < p.topH || s.birdY + BIRD_SIZE / 2 > p.topH + GAP) {
              s.running = false;
              setGameOver(true);
              return;
            }
          }
        }
        if (s.birdY > CANVAS_H || s.birdY < 0) {
          s.running = false;
          setGameOver(true);
          return;
        }
      }

      // Draw
      ctx.fillStyle = "#080B12";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Pipes
      ctx.fillStyle = "#1a2535";
      for (const p of s.pipes) {
        ctx.fillRect(p.x, 0, PIPE_WIDTH, p.topH);
        ctx.fillRect(p.x, p.topH + GAP, PIPE_WIDTH, CANVAS_H - p.topH - GAP);
      }

      // Bird (the letter A)
      ctx.font = "bold 24px Unbounded";
      ctx.fillStyle = "#FF2D78";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("A", CANVAS_W / 4, s.birdY);

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
    return () => { s.running = false; };
  }, [started]);

  const handleShare = () => {
    navigator.clipboard.writeText(`I scored ${score} beats on PLAI 🎵 plai.app`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget && !started) onClose(); }}>
      <div className="flex flex-col items-center gap-4">
        {!gameOver ? (
          <>
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              className="rounded-xl border border-border cursor-pointer"
              onClick={jump}
            />
            {!started && (
              <p className="text-sm text-muted-foreground">tap or press space to fly</p>
            )}
            <p className="font-display text-xl text-primary">{score} beats</p>
          </>
        ) : (
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="font-display text-4xl text-primary">{score}</p>
            <p className="text-muted-foreground">beats</p>
            <button onClick={handleShare} className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-all duration-150 hover:bg-primary/80">
              share your beats
            </button>
            <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150">
              close
            </button>
          </div>
        )}
        <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground text-lg">✕</button>
      </div>
    </div>
  );
};

export default FlappyBird;
