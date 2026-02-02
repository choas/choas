#!/usr/bin/env node
// Mandelbrot ASCII Art Generator
// Uses ANSI escape codes for colors - no external libraries needed

import * as fs from 'fs';
import * as path from 'path';

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

// Julia set mode
let juliaMode = false;
let juliaC = { real: -0.7, imag: 0.27015 }; // Classic Julia set parameter

// Color schemes
type ColorScheme = 'rainbow' | 'fire' | 'ice' | 'grayscale' | 'green';
const COLOR_SCHEMES: ColorScheme[] = ['rainbow', 'fire', 'ice', 'grayscale', 'green'];
let colorSchemeIndex = 0;

// Bookmarks
interface Bookmark {
  x: number;
  y: number;
  zoom: number;
}
const bookmarks: Map<string, Bookmark> = new Map();

// Crosshair
let showCrosshair = false;

// Help overlay
let showHelp = false;

// Last rendered output for screenshots
let lastRenderedOutput = '';

// Animation speed presets
interface SpeedPreset {
  name: string;
  delay: number;
}
const SPEED_PRESETS: SpeedPreset[] = [
  { name: 'very slow', delay: 400 },
  { name: 'slower', delay: 300 },
  { name: 'slow', delay: 200 },
  { name: 'normal', delay: 150 },
  { name: 'fast', delay: 100 },
  { name: 'faster', delay: 50 },
  { name: 'very fast', delay: 25 },
];
let speedIndex = 3; // Start at 'normal'

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

  if (iter === maxIter) return iter;
  
  // Smooth coloring using logarithmic escape
  const log_zn = Math.log(zReal * zReal + zImag * zImag) / 2;
  const nu = Math.log(log_zn / Math.log(2)) / Math.log(2);
  return iter + 1 - nu;
}

function julia(zReal: number, zImag: number, cReal: number, cImag: number, maxIter: number): number {
  let iter = 0;

  while (iter < maxIter && zReal * zReal + zImag * zImag < 4) {
    const tempReal = zReal * zReal - zImag * zImag + cReal;
    zImag = 2 * zReal * zImag + cImag;
    zReal = tempReal;
    iter++;
  }

  if (iter === maxIter) return iter;
  
  // Smooth coloring using logarithmic escape
  const log_zn = Math.log(zReal * zReal + zImag * zImag) / 2;
  const nu = Math.log(log_zn / Math.log(2)) / Math.log(2);
  return iter + 1 - nu;
}

function hslToAnsi256(h: number, s: number, l: number): string {
  // Convert HSL to RGB
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  
  // Convert to 0-255 range
  const ri = Math.round((r + m) * 255);
  const gi = Math.round((g + m) * 255);
  const bi = Math.round((b + m) * 255);
  
  // Use true color ANSI escape
  return `\x1b[38;2;${ri};${gi};${bi}m`;
}

function getColor(iter: number, maxIter: number): string {
  if (iter === maxIter) {
    return '\x1b[38;5;16m'; // Inside the set - black
  }
  
  const scheme = COLOR_SCHEMES[colorSchemeIndex];
  let hue: number, saturation: number, lightness: number;
  
  switch (scheme) {
    case 'fire':
      hue = 60 - (iter * 2) % 60; // Yellow to red
      saturation = 1.0;
      lightness = 0.3 + 0.3 * Math.sin(iter * 0.1);
      break;
    case 'ice':
      hue = 180 + (iter * 3) % 60; // Cyan to blue
      saturation = 0.9;
      lightness = 0.4 + 0.2 * Math.sin(iter * 0.1);
      break;
    case 'grayscale':
      const gray = Math.floor(40 + (iter / maxIter) * 200);
      return `\x1b[38;2;${gray};${gray};${gray}m`;
    case 'green':
      hue = 90 + (iter * 2) % 60; // Green range (90-150)
      saturation = 0.9;
      lightness = 0.3 + 0.3 * Math.sin(iter * 0.1);
      break;
    case 'rainbow':
    default:
      hue = (iter * 7) % 360;
      saturation = 0.8;
      lightness = 0.4 + 0.2 * Math.sin(iter * 0.1);
      break;
  }
  
  return hslToAnsi256(hue, saturation, lightness);
}

function getChar(iter: number, maxIter: number): string {
  if (iter === maxIter) {
    return ' '; // Inside the set
  }
  const charIndex = Math.floor((iter / maxIter) * (chars.length - 1));
  return chars[Math.min(charIndex, chars.length - 1)];
}

function renderHelpOverlay(): void {
  const width = process.stdout.columns || 80;
  const height = process.stdout.rows || 24;
  
  process.stdout.write('\x1b[2J\x1b[H');
  
  const helpText = `
  ╔══════════════════════════════════════════════════════════════╗
  ║           MANDELBROT / JULIA SET EXPLORER                    ║
  ╠══════════════════════════════════════════════════════════════╣
  ║  NAVIGATION                                                  ║
  ║    Arrow keys     Pan the view                               ║
  ║    +, =           Zoom in (1.5x)                             ║
  ║    -, _           Zoom out (1.5x)                            ║
  ║    Mouse click    Center on clicked location                 ║
  ║                                                              ║
  ║  MODES & DISPLAY                                             ║
  ║    j              Toggle Mandelbrot / Julia set              ║
  ║    c              Cycle color schemes                        ║
  ║    x              Toggle crosshair                           ║
  ║    [, ]           Adjust iteration depth (50-1000)           ║
  ║    r              Reset to default view                      ║
  ║                                                              ║
  ║  ANIMATION                                                   ║
  ║    a              Start animation / cycle speed              ║
  ║    Enter          Stop animation                             ║
  ║                                                              ║
  ║  BOOKMARKS                                                   ║
  ║    Shift+1-9      Save current view                          ║
  ║    1-9            Load saved bookmark                        ║
  ║                                                              ║
  ║  OTHER                                                       ║
  ║    s              Save screenshot as bash script             ║
  ║    h              Toggle this help                           ║
  ║    q, Ctrl+C      Quit                                       ║
  ╚══════════════════════════════════════════════════════════════╝

                    Press any key to continue...
`;
  
  console.log('\x1b[36m' + helpText + RESET);
}

function renderMandelbrot(): void {
  if (showHelp) {
    renderHelpOverlay();
    return;
  }
  
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

  const centerCol = Math.floor(width / 2);
  const centerRow = Math.floor((height - 1) / 2);

  for (let row = 0; row < height - 1; row++) { // Leave one row for status
    for (let col = 0; col < width; col++) {
      // Map pixel position to complex plane
      const cReal = xMin + (col / width) * (xMax - xMin);
      const cImag = yMax - (row / (height - 1)) * (yMax - yMin) * aspectRatio + (yMax - yMin) * (aspectRatio - 1) / 2;

      const iter = juliaMode 
        ? julia(cReal, cImag, juliaC.real, juliaC.imag, maxIter)
        : mandelbrot(cReal, cImag, maxIter);
      const color = getColor(iter, maxIter);
      let char = getChar(iter, maxIter);

      // Draw crosshair at center
      if (showCrosshair && col === centerCol && row === centerRow) {
        output += '\x1b[38;5;15m+'; // White crosshair
      } else if (showCrosshair && (col === centerCol || row === centerRow) && 
                 Math.abs(col - centerCol) <= 2 && Math.abs(row - centerRow) <= 2) {
        output += '\x1b[38;5;15m' + (col === centerCol ? '|' : '-');
      } else {
        output += color + char;
      }
    }
    if (row < height - 2) {
      output += RESET + '\n';
    }
  }

  output += RESET;
  lastRenderedOutput = output; // Store for screenshots
  process.stdout.write(output);

  // Status line
  const speedName = SPEED_PRESETS[speedIndex].name;
  const animStatus = animating ? ` [ANIM: ${speedName} - a: speed, Enter: stop]` : ' [a: animate]';
  const modeStr = juliaMode ? 'Julia' : 'Mandelbrot';
  const scheme = COLOR_SCHEMES[colorSchemeIndex];
  const bookmarkStr = bookmarks.size > 0 ? ` [Bookmarks: ${Array.from(bookmarks.keys()).join('')}]` : '';
  console.log(`\n${RESET}[Arrows] [+/-] [j] [c] [[] []] [r] [s] [h] [q]${animStatus} ${modeStr} (${centerX.toFixed(4)}, ${centerY.toFixed(4)}) Zoom: ${zoom.toFixed(2)}x${bookmarkStr}`);
}

function saveScreenshot(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `screenshot-${timestamp}.sh`;
  const screenshotsDir = path.join(process.cwd(), 'screenshots');
  
  // Create screenshots directory if it doesn't exist
  try {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  } catch {
    // If we can't create in cwd, try home directory
    const homeScreenshots = path.join(process.env.HOME || '/tmp', 'choas-screenshots');
    if (!fs.existsSync(homeScreenshots)) {
      fs.mkdirSync(homeScreenshots, { recursive: true });
    }
    return saveToPath(homeScreenshots, filename);
  }
  
  return saveToPath(screenshotsDir, filename);
}

function saveToPath(dir: string, filename: string): string {
  const filepath = path.join(dir, filename);
  
  // Use $'...' syntax for proper ANSI escape handling in bash
  // Escape backslashes and single quotes
  const escapedOutput = lastRenderedOutput
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\x1b/g, '\\x1b');
  
  const script = `#!/bin/bash
# Mandelbrot/Julia Screenshot
# Generated: ${new Date().toISOString()}
# Mode: ${juliaMode ? 'Julia' : 'Mandelbrot'}
# Center: (${centerX.toFixed(6)}, ${centerY.toFixed(6)})
# Zoom: ${zoom.toFixed(2)}x

clear
echo -e $'${escapedOutput}'
echo ""
echo "Screenshot from choas fractal explorer"
`;
  
  fs.writeFileSync(filepath, script);
  fs.chmodSync(filepath, '755');
  
  return `${path.basename(dir)}/${filename}`;
}

function findBoundaryPoint(): { x: number, y: number } {
  // Sample the current view to find high-iteration boundary regions
  const samples = 20;
  const xRange = DEFAULT_X_RANGE / zoom;
  const yRange = DEFAULT_Y_RANGE / zoom;
  const xMin = centerX - xRange / 2;
  const yMin = centerY - yRange / 2;
  
  let bestX = centerX, bestY = centerY;
  let bestScore = 0;
  
  for (let i = 0; i < samples; i++) {
    for (let j = 0; j < samples; j++) {
      const x = xMin + (i / samples) * xRange;
      const y = yMin + (j / samples) * yRange;
      const iter = mandelbrot(x, y, 200);
      
      // High iteration but not inside set = interesting boundary
      if (iter > 50 && iter < 200) {
        const score = iter + Math.random() * 10; // Add randomness for variety
        if (score > bestScore) {
          bestScore = score;
          bestX = x;
          bestY = y;
        }
      }
    }
  }
  
  return { x: bestX, y: bestY };
}

function startAnimation(): void {
  // If already animating, cycle speed instead
  if (animating) {
    speedIndex = (speedIndex + 1) % SPEED_PRESETS.length;
    // Restart interval with new speed
    if (animationInterval) {
      clearInterval(animationInterval);
    }
    animationInterval = setInterval(animationTick, SPEED_PRESETS[speedIndex].delay);
    renderMandelbrot();
    return;
  }
  
  animating = true;
  
  // Either use predefined points or find boundary regions dynamically
  if (juliaMode) {
    // For Julia, animate around center with small movements
    targetPoint = { x: (Math.random() - 0.5) * 0.5, y: (Math.random() - 0.5) * 0.5 };
  } else if (zoom < 5) {
    targetPoint = INTERESTING_POINTS[Math.floor(Math.random() * INTERESTING_POINTS.length)];
  } else {
    const boundary = findBoundaryPoint();
    targetPoint = { x: boundary.x, y: boundary.y };
  }
  
  animationInterval = setInterval(animationTick, SPEED_PRESETS[speedIndex].delay);
}

function animationTick(): void {
  // Smoothly move toward target
  centerX += (targetPoint.x - centerX) * 0.05;
  centerY += (targetPoint.y - centerY) * 0.05;
  
  // Zoom in, but limit for Julia mode to keep set in view
  const maxZoom = juliaMode ? 50 : 10000;
  if (zoom < maxZoom) {
    zoom *= 1.01;
  }
  
  // Keep Julia set centered - it's symmetric around origin
  if (juliaMode) {
    // Constrain to reasonable bounds for Julia set visibility
    centerX = Math.max(-2, Math.min(2, centerX));
    centerY = Math.max(-1.5, Math.min(1.5, centerY));
  }
  
  // Increase iterations as we zoom
  maxIter = Math.min(1000, 100 + Math.floor(zoom * 10));
  
  // Find new boundary target when getting close (only for Mandelbrot)
  if (!juliaMode && zoom > 10 && Math.random() < 0.02) {
    const boundary = findBoundaryPoint();
    targetPoint = { x: boundary.x, y: boundary.y };
  }
  
  renderMandelbrot();
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

  // If help is showing, any key dismisses it
  if (showHelp) {
    showHelp = false;
    renderMandelbrot();
    return;
  }

  // Mouse click handling (SGR format: \x1b[<button;x;yM or m)
  const mouseMatch = keyStr.match(/\x1b\[<(\d+);(\d+);(\d+)([Mm])/);
  if (mouseMatch) {
    const button = parseInt(mouseMatch[1]);
    const mouseX = parseInt(mouseMatch[2]);
    const mouseY = parseInt(mouseMatch[3]);
    const isPress = mouseMatch[4] === 'M';
    
    if (button === 0 && isPress) { // Left click
      const width = process.stdout.columns || 80;
      const height = process.stdout.rows || 24;
      const xRange = DEFAULT_X_RANGE / zoom;
      const yRange = DEFAULT_Y_RANGE / zoom;
      const xMin = centerX - xRange / 2;
      const yMax = centerY + yRange / 2;
      
      centerX = xMin + (mouseX / width) * xRange;
      centerY = yMax - (mouseY / (height - 1)) * yRange;
      renderMandelbrot();
    }
    return;
  }

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
  } else if (keyStr === 'j') { // Toggle Julia/Mandelbrot mode
    juliaMode = !juliaMode;
    if (juliaMode) {
      centerX = 0;
      centerY = 0;
    } else {
      centerX = -0.75;
      centerY = 0;
    }
    zoom = 1.0;
    renderMandelbrot();
  } else if (keyStr === 'c') { // Cycle color scheme
    colorSchemeIndex = (colorSchemeIndex + 1) % COLOR_SCHEMES.length;
    renderMandelbrot();
  } else if (keyStr === '[') { // Decrease iteration depth
    maxIter = Math.max(50, maxIter - 50);
    renderMandelbrot();
  } else if (keyStr === ']') { // Increase iteration depth
    maxIter = Math.min(1000, maxIter + 50);
    renderMandelbrot();
  } else if (keyStr === 'r') { // Reset view
    centerX = juliaMode ? 0 : -0.75;
    centerY = 0;
    zoom = 1.0;
    maxIter = 100;
    renderMandelbrot();
  } else if (keyStr === 'x') { // Toggle crosshair
    showCrosshair = !showCrosshair;
    renderMandelbrot();
  } else if (keyStr === 'h') { // Toggle help overlay
    showHelp = true;
    renderMandelbrot();
  } else if (keyStr === 's') { // Save screenshot
    const savedPath = saveScreenshot();
    // Briefly show save confirmation in status area
    process.stdout.write(`\x1b[${process.stdout.rows || 24};1H\x1b[K\x1b[32mSaved: ${savedPath}${RESET}`);
  } else if (keyStr >= '1' && keyStr <= '9') { // Recall bookmark
    const bookmark = bookmarks.get(keyStr);
    if (bookmark) {
      centerX = bookmark.x;
      centerY = bookmark.y;
      zoom = bookmark.zoom;
      renderMandelbrot();
    }
  } else if (keyStr === '!' || keyStr === '@' || keyStr === '#' || keyStr === '$' || 
             keyStr === '%' || keyStr === '^' || keyStr === '&' || keyStr === '*' || keyStr === '(') {
    // Shift+1-9 to save bookmark
    const numMap: Record<string, string> = { '!': '1', '@': '2', '#': '3', '$': '4', '%': '5', '^': '6', '&': '7', '*': '8', '(': '9' };
    const num = numMap[keyStr];
    bookmarks.set(num, { x: centerX, y: centerY, zoom: zoom });
    renderMandelbrot();
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
  process.stdout.write(RESET + '\x1b[?25h\x1b[?1000l\x1b[?1006l'); // Show cursor and disable mouse
}

function startInteractive(): void {
  // Enable raw mode for keyboard input
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', handleKeypress);
    
    // Hide cursor and enable mouse tracking
    process.stdout.write('\x1b[?25l\x1b[?1000h\x1b[?1006h');
    
    // Initial render
    renderMandelbrot();
    
    // Start animation if --animation or -a flag was passed
    if (process.argv.includes('--animation') || process.argv.includes('-a')) {
      startAnimation();
    }
    
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

function printHelp(): void {
  console.log(`
Mandelbrot/Julia Set Explorer - Interactive Terminal Fractal Viewer

USAGE:
  npx choas [options]

OPTIONS:
  --help, -h        Show this help message
  --animation, -a   Start with animation running

KEYBOARD CONTROLS:
  Navigation:
    Arrow keys    Pan the view (up/down/left/right)
    +, =          Zoom in (1.5x)
    -, _          Zoom out (1.5x)
    Mouse click   Center view on clicked location

  Modes & Display:
    j             Toggle between Mandelbrot and Julia set
    c             Cycle color schemes (rainbow, fire, ice, grayscale)
    x             Toggle crosshair at center
    [, ]          Decrease/increase iteration depth (50-1000)
    r             Reset view to default position

  Animation:
    a             Start animation / cycle speed when running
                  Speeds: very slow → slower → slow → normal → fast → faster → very fast
    Enter         Stop animation

  Bookmarks:
    Shift+1-9     Save current view to bookmark slot
    1-9           Load saved bookmark

  Help & Exit:
    h             Show help overlay
    q, Ctrl+C     Quit

EXAMPLES:
  npx choas           Start interactive explorer
  npx choas --help    Show this help message
`);
}

// Check for --help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  printHelp();
  process.exit(0);
}

// Run the visualization
startInteractive();
