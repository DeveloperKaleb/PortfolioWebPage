import { describe, test, expect } from 'vitest';
// Import the actual production logic
import { generateGridHtml, getCoordsFromIndex } from '../../js/logic.js';

describe('Grid Array Toy - System Integrity', () => {

    // Test 1: Vertical Scaling (Rows)
    test('generateGridHtml should create the correct number of row containers', () => {
        const html = generateGridHtml(5, 3);
        // We look for the "y" class containers
        const rowCount = (html.match(/class="y/g) || []).length;
        expect(rowCount).toBe(3);
    });

    // Test 2: Total Volume (Buttons)
    test('generateGridHtml should create the correct total number of buttons', () => {
        const html = generateGridHtml(10, 10);
        const buttonCount = (html.match(/<button/g) || []).length;
        expect(buttonCount).toBe(100);
    });

    // Test 3: Structural Integrity (Coordinates)
    test('should generate the correct class for a specific coordinate', () => {
        const html = generateGridHtml(2, 2);
        expect(html).toContain('class="x1y1"');
        expect(html).toContain('class="x2y2"');
    });

    // Test 4: Default State
    test('all buttons should initialize with a white background style', () => {
        const html = generateGridHtml(1, 1);
        expect(html).toContain('style="background-color: white"');
    });

    // Test 5: Mapping Logic (Snake/Grid shared math)
    test('getCoordsFromIndex maps flat index to XY correctly', () => {
        // In a 10-wide grid, index 11 is the first button of the second row
        const coords = getCoordsFromIndex(11, 10);
        expect(coords).toEqual({ x: 1, y: 2 });
    });

    // Test 6: Boundary Handling
    test('should return an empty string for 0x0 dimensions', () => {
        const html = generateGridHtml(0, 0);
        expect(html).toBe('');
    });
});