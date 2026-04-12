import { describe, test, expect } from 'vitest';
// Pointing directly to your single source of truth
import { 
    getNextHead, 
    isWallCollision, 
    isSelfCollision, 
    getCoordsFromIndex,
    // Ensure these two are exported in logic.js
    isEatingFood, 
    isValidDirection 
} from '../../js/logic.js';

describe('Snake System Core Logic', () => {

    // Test 1: Movement Math
    test('getNextHead should correctly move Up', () => {
        const head = [10, 10];
        const dir = { x: 0, y: -1 };
        expect(getNextHead(head, dir)).toEqual([10, 9]);
    });

    // Test 2: Movement Math (Horizontal)
    test('getNextHead should correctly move Right', () => {
        const head = [10, 10];
        const dir = { x: 1, y: 0 };
        expect(getNextHead(head, dir)).toEqual([11, 10]);
    });

    // Test 3: Wall Collision (Upper Bound)
    test('isWallCollision should detect hitting the top wall', () => {
        const head = [10, 0];
        expect(isWallCollision(head)).toBe(true);
    });

    // Test 4: Wall Collision (Lower Bound)
    test('isWallCollision should detect hitting the right wall', () => {
        const head = [21, 10];
        expect(isWallCollision(head)).toBe(true);
    });

    // Test 5: Self-Collision
    test('isSelfCollision should return true if head hits body', () => {
        const head = [10, 11];
        const snake = [[10, 10], [10, 11], [10, 12]];
        expect(isSelfCollision(head, snake)).toBe(true);
    });

    // Test 6: Safe Movement
    test('isSelfCollision should return false if head is in clear space', () => {
        const head = [5, 5];
        const snake = [[10, 10], [10, 11]];
        expect(isSelfCollision(head, snake)).toBe(false);
    });

    // Test 7: Food Detection
    test('isEatingFood should detect food at same coordinates', () => {
        // Simple equality check: head[0] === food[0] && head[1] === food[1]
        expect(isEatingFood([5,5], [5,5])).toBe(true);
    });

    // Test 8: Direction Validation (The "Illegal Turn" Rule)
    test('isValidDirection should prevent 180-degree flip (Up to Down)', () => {
        const current = { x: 0, y: -1 }; // Up
        const next = { x: 0, y: 1 };    // Down
        expect(isValidDirection(current, next)).toBe(false);
    });

    // Test 9: Grid Coordinate Math
    test('getCoordsFromIndex should correctly map index 21 to x=1, y=2', () => {
        const coords = getCoordsFromIndex(21, 20);
        expect(coords).toEqual({ x: 1, y: 2 });
    });

    // Test 10: Grid Coordinate Math (Edge case)
    test('getCoordsFromIndex should map index 400 to x=20, y=20', () => {
        const coords = getCoordsFromIndex(400, 20);
        expect(coords).toEqual({ x: 20, y: 20 });
    });
});