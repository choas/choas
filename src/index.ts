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

  // Mandelbrot set bounds (classic view)
  const xMin = -2.5;
  const xMax = 1.0;
  const yMin = -1.0;
  const yMax = 1.0;

  // Adjust for aspect ratio (terminal characters are taller than wide)
  const aspectRatio = 2.0; // Approximate character aspect ratio

  const maxIter = 100;

  // Clear screen and move cursor to top-left
  process.stdout.write('\x1b[2J\x1b[H');

  let output = '';

  for (let row = 0; row < height - 1; row++) { // Leave one row for prompt
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
}

// Run the visualization
renderMandelbrot();
