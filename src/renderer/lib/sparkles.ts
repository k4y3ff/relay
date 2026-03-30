import { Terminal } from '@xterm/xterm';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  hue: number;
}

interface ConfettiParticle {
  x: number; y: number;
  vx: number; vy: number;
  rotation: number; rotationSpeed: number;
  w: number; h: number;
  hue: number; life: number; maxLife: number;
}

let particles: Particle[] = [];
let confettiParticles: ConfettiParticle[] = [];
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let rafId: number | null = null;
let enabled = false;

export function setCanvas(c: HTMLCanvasElement | null): void {
  canvas = c;
  ctx = c ? c.getContext('2d') : null;
}

export function setEnabled(e: boolean): void {
  enabled = e;
  if (!e) {
    particles = [];
    ctx?.clearRect(0, 0, canvas!.width, canvas!.height);
  }
}

export function isEnabled(): boolean {
  return enabled;
}

export function spawnSparkles(x: number, y: number): void {
  if (!enabled || !canvas) return;
  const count = 6 + Math.floor(Math.random() * 5);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 3;
    const maxLife = 30 + Math.floor(Math.random() * 11);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: maxLife,
      maxLife,
      size: 3 + Math.random() * 3,
      hue: Math.random() * 360,
    });
  }
  if (rafId === null) rafId = requestAnimationFrame(frame);
}

export function spawnConfetti(): void {
  if (!canvas) return;
  const count = 120;
  for (let i = 0; i < count; i++) {
    const maxLife = 240 + Math.floor(Math.random() * 60);
    confettiParticles.push({
      x: Math.random() * canvas.width,
      y: -10,
      vx: (Math.random() - 0.5) * 4,
      vy: 3 + Math.random() * 4,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.3,
      w: 8 + Math.random() * 6,
      h: 5 + Math.random() * 4,
      hue: Math.random() * 360,
      life: maxLife,
      maxLife,
    });
  }
  if (rafId === null) rafId = requestAnimationFrame(frame);
}

// Also exported for use in terminal components
export function spawnSparklesAtXTermCursor(term: Terminal, container: HTMLElement, screenEl: HTMLElement | null): void {
  const rect = container.getBoundingClientRect();
  const cellW = screenEl ? screenEl.offsetWidth / term.cols : 8;
  const cellH = screenEl ? screenEl.offsetHeight / term.rows : 16;
  spawnSparkles(
    rect.left + term.buffer.active.cursorX * cellW,
    rect.top + term.buffer.active.cursorY * cellH,
  );
}

function drawStar(c: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  c.beginPath();
  c.moveTo(x, y - size);
  c.lineTo(x + size * 0.3, y - size * 0.3);
  c.lineTo(x + size, y);
  c.lineTo(x + size * 0.3, y + size * 0.3);
  c.lineTo(x, y + size);
  c.lineTo(x - size * 0.3, y + size * 0.3);
  c.lineTo(x - size, y);
  c.lineTo(x - size * 0.3, y - size * 0.3);
  c.closePath();
  c.fill();
}

function frame(): void {
  if (!ctx || !canvas) { rafId = null; return; }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  particles = particles.filter((p) => p.life > 0);
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.15;
    p.life--;

    ctx.globalAlpha = p.life / p.maxLife;
    ctx.fillStyle = `hsl(${p.hue}, 100%, 70%)`;
    drawStar(ctx, p.x, p.y, p.size);
  }

  confettiParticles = confettiParticles.filter((p) => p.life > 0);
  for (const p of confettiParticles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.1;
    p.rotation += p.rotationSpeed;
    p.life--;

    ctx.globalAlpha = p.life / p.maxLife;
    ctx.fillStyle = `hsl(${p.hue}, 90%, 60%)`;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    ctx.restore();
  }

  ctx.globalAlpha = 1;

  rafId = (particles.length > 0 || confettiParticles.length > 0) ? requestAnimationFrame(frame) : null;
}

export function stopLoop(): void {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  particles = [];
  confettiParticles = [];
}
