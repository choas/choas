#!/usr/bin/env node
// Mandelbrot ASCII Art Generator
// Uses ANSI escape codes for colors - no external libraries needed

// ANSI color codes for a gradient palette
const colors = [
  '\x1b[38;5;16m',   // Black (inside the set)
  '\x1b[38;5;17m',   // Dark blue
  '\x1b[38;5;18m',   // Blue
  '\x1b[38;5;19m',   // Medium blue
  '\x1b[38;5;20m',   // Lighter blue
  '\x1b[38;5;21m',   // Blue
  '\x1b[38;5;27m',   // Bright blue
  '\x1b[38;5;33m',   // Cyan-blue
  '\x1b[38;5;39m',   // Cyan
  '\x1b[38;5;45m',   // Light cyan
  '\x1b[38;5;51m',   // Bright cyan
  '\x1b[38;5;50m',   // Teal
  '\x1b[38;5;49m',   // Green-cyan
  '\x1b[38;5;48m',   // Green
  '\x1b[38;5;47m',   // Bright green
  '\x1b[38;5;46m',   // Lime
  '\x1b[38;5;82m',   // Yellow-green
  '\x1b[38;5;118m',  // Light green
  '\x1b[38;5;154m',  // Yellow-green
  '\x1b[38;5;190m',  // Yellow
  '\x1b[38;5;226m',  // Bright yellow
  '\x1b[38;5;220m',  // Gold
  '\x1b[38;5;214m',  // Orange
  '\x1b[38;5;208m',  // Dark orange
  '\x1b[38;5;202m',  // Red-orange
  '\x1b[38;5;196m',  // Red
  '\x1b[38;5;197m',  // Pink-red
  '\x1b[38;5;198m',  // Pink
  '\x1b[38;5;199m',  // Magenta-pink
  '\x1b[38;5;200m',  // Magenta
  '\x1b[38;5;201m',  // Bright magenta
  '\x1b[38;5;165m',  // Purple
];

const RESET = '\x1b[0m';

// ASCII characters for density visualization
const chars = ' .:-=+*#%@';

// View state
let centerX = -0.75;
let centerY = 0.0;
let zoom = 1.0;
let maxIter = 100;
let animating = false;
let animationInterval: NodeJS.Timeout | null = null;

// Interesting points to auto-zoom into
const INTERESTING_POINTS = [
  { x: -0.7436447860, y: 0.1318252536 },  // Seahorse valley
  { x: -0.16, y: 1.0405 },                 // Spiral
  { x: -1.25066, y: 0.02012 },             // Mini-brot
  { x: -0.748, y: 0.1 },                   // Another seahorse
];
let targetPoint = INTERESTING_POINTS[0];

// Default bounds
const DEFAULT_X_RANGE = 3.5;
const DEFAULT_Y_RANGE = 2.0;

function mandelbrot(cReal: number, cImag: number, maxIter: number): number {
  let zReal = 0;
  let zImag = 0;
  let iter = 0;

  while (iter < maxIter && zReal * zReal + zImag * zImag < 4) {
    const tempReal = zReal * zReal - zImag * zImag + cReal;
    zImag = 2 * zReal * zImag + cImag;
    zReal = tempReal;
    iter++;
  }

  return iter;
}

function getColor(iter: number, maxIter: number): string {
  if (iter === maxIter) {
    return colors[0]; // Inside the set - darkest color
  }
  const colorIndex = Math.floor((iter / maxIter) * (colors.length - 1)) + 1;
  return colors[Math.min(colorIndex, colors.length - 1)];
}

function getChar(iter: number, maxIter: number): string {
  if (iter === maxIter) {
    return ' '; // Inside the set
  }
  const charIndex = Math.floor((iter / maxIter) * (chars.length - 1));
  return chars[Math.min(charIndex, chars.length - 1)];
}

function renderMandelbrot(): void {
  // Get terminal size, with fallbacks
  const width = process.stdout.columns || 80;
  const height = process.stdout.rows || 24;

  // Calculate bounds based on center, zoom, and aspect ratio
  const aspectRatio = 2.0; // Terminal character aspect ratio
  const xRange = DEFAULT_X_RANGE / zoom;
  const yRange = DEFAULT_Y_RANGE / zoom;
  
  const xMin = centerX - xRange / 2;
  const xMax = centerX + xRange / 2;
  const yMin = centerY - yRange / 2;
  const yMax = centerY + yRange / 2;

  // Clear screen and move cursor to top-left
  process.stdout.write('\x1b[2J\x1b[H');

  let output = '';

  for (let row = 0; row < height - 1; row++) { // Leave one row for status
    for (let col = 0; col < width; col++) {
      // Map pixel position to complex plane
      const cReal = xMin + (col / width) * (xMax - xMin);
      const cImag = yMax - (row / (height - 1)) * (yMax - yMin) * aspectRatio + (yMax - yMin) * (aspectRatio - 1) / 2;

      const iter = mandelbrot(cReal, cImag, maxIter);
      const color = getColor(iter, maxIter);
      const char = getChar(iter, maxIter);

      output += color + char;
    }
    if (row < height - 2) {
      output += RESET + '\n';
    }
  }

  output += RESET;
  process.stdout.write(output);

  // Status line
  const animStatus = animating ? ' [ANIMATING - Enter to stop]' : ' [a: animate]';
  console.log(`\n${RESET}[Arrows: pan] [+/-: zoom] [q: quit]${animStatus} Center: (${centerX.toFixed(4)}, ${centerY.toFixed(4)}) Zoom: ${zoom.toFixed(2)}x`);
}

function startAnimation(): void {
  if (animating) return;
  animating = true;
  
  // Pick a random interesting point
  targetPoint = INTERESTING_POINTS[Math.floor(Math.random() * INTERESTING_POINTS.length)];
  
  animationInterval = setInterval(() => {
    // Smoothly move toward target
    centerX += (targetPoint.x - centerX) * 0.05;
    centerY += (targetPoint.y - centerY) * 0.05;
    
    // Zoom in
    zoom *= 1.02;
    
    // Increase iterations as we zoom
    maxIter = Math.min(1000, 100 + Math.floor(zoom * 10));
    
    renderMandelbrot();
  }, 100);
}

function stopAnimation(): void {
  if (!animating) return;
  animating = false;
  if (animationInterval) {
    clearInterval(animationInterval);
    animationInterval = null;
  }
}

function handleKeypress(key: Buffer): void {
  const keyStr = key.toString();
  const panAmount = 0.1 / zoom;

  // Arrow keys (escape sequences)
  if (keyStr === '\x1b[A') { // Up
    centerY += panAmount;
    renderMandelbrot();
  } else if (keyStr === '\x1b[B') { // Down
    centerY -= panAmount;
    renderMandelbrot();
  } else if (keyStr === '\x1b[C') { // Right
    centerX += panAmount;
    renderMandelbrot();
  } else if (keyStr === '\x1b[D') { // Left
    centerX -= panAmount;
    renderMandelbrot();
  } else if (keyStr === '+' || keyStr === '=') { // Zoom in
    zoom *= 1.5;
    renderMandelbrot();
  } else if (keyStr === '-' || keyStr === '_') { // Zoom out
    zoom = Math.max(0.1, zoom / 1.5);
    renderMandelbrot();
  } else if (keyStr === 'a') { // Start animation
    startAnimation();
  } else if (keyStr === '\r' || keyStr === '\n') { // Enter - stop animation
    stopAnimation();
    renderMandelbrot();
  } else if (keyStr === 'q' || keyStr === '\x03') { // q or Ctrl+C
    stopAnimation();
    cleanup();
    process.exit(0);
  }
}

function cleanup(): void {
  process.stdin.setRawMode(false);
  process.stdin.pause();
  process.stdout.write(RESET + '\x1b[?25h'); // Show cursor
}

function startInteractive(): void {
  // Enable raw mode for keyboard input
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', handleKeypress);
    
    // Hide cursor
    process.stdout.write('\x1b[?25l');
    
    // Initial render
    renderMandelbrot();
    
    // Handle process exit
    process.on('exit', cleanup);
    process.on('SIGINT', () => {
      cleanup();
      process.exit(0);
    });
  } else {
    // Non-interactive mode - just render once
    renderMandelbrot();
  }
}

// Run the visualization
startInteractive();
