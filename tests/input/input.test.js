import { describe, test, expect } from 'vitest';
import { keyToAction, ACTION_VECTORS, isValidDirection } from '../../js/logic.js';

describe('Input Action Mapping', () => {

    test('keyToAction maps each arrow key to its action', () => {
        expect(keyToAction('ArrowUp')).toBe('up');
        expect(keyToAction('ArrowDown')).toBe('down');
        expect(keyToAction('ArrowLeft')).toBe('left');
        expect(keyToAction('ArrowRight')).toBe('right');
    });

    test('keyToAction returns null for keys the games ignore', () => {
        expect(keyToAction('a')).toBeNull();
        expect(keyToAction(' ')).toBeNull();
        expect(keyToAction('Enter')).toBeNull();
        expect(keyToAction(undefined)).toBeNull();
    });

    // The touch pads pass their data-action straight through, so the pad and the
    // keyboard only stay in step as long as these are the same four names.
    test('every action a key produces has a movement vector', () => {
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].forEach((key) => {
            expect(ACTION_VECTORS[keyToAction(key)]).toBeDefined();
        });
    });

    test('action vectors point the way their names say', () => {
        expect(ACTION_VECTORS.up).toEqual({ x: 0, y: -1 });
        expect(ACTION_VECTORS.down).toEqual({ x: 0, y: 1 });
        expect(ACTION_VECTORS.left).toEqual({ x: -1, y: 0 });
        expect(ACTION_VECTORS.right).toEqual({ x: 1, y: 0 });
    });

    // Snake feeds these vectors straight into isValidDirection, so an opposite
    // pair has to read as a banned 180-degree turn.
    test('opposite action vectors are rejected as reversals', () => {
        expect(isValidDirection(ACTION_VECTORS.up, ACTION_VECTORS.down)).toBe(false);
        expect(isValidDirection(ACTION_VECTORS.left, ACTION_VECTORS.right)).toBe(false);
        expect(isValidDirection(ACTION_VECTORS.up, ACTION_VECTORS.left)).toBe(true);
    });
});
