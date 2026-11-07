// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setupScrollInputPercent } from './scrollInputHelper';

function makeInput(id: string, value = '50'): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'number';
  input.id = id;
  input.value = value;
  document.body.appendChild(input);
  return input;
}

function fireWheel(input: HTMLInputElement, deltaY: number) {
  input.focus();
  const event = new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true });
  input.dispatchEvent(event);
}

describe('setupScrollInputPercent', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    vi.useFakeTimers();
  });

  it('increments value on scroll up (negative deltaY)', () => {
    const input = makeInput('test-input', '50');
    setupScrollInputPercent('test-input');
    fireWheel(input, -100);
    expect(input.value).toBe('51');
  });

  it('decrements value on scroll down (positive deltaY)', () => {
    const input = makeInput('test-input', '50');
    setupScrollInputPercent('test-input');
    fireWheel(input, 100);
    expect(input.value).toBe('49');
  });

  it('does not exceed 100', () => {
    const input = makeInput('test-input', '100');
    setupScrollInputPercent('test-input');
    fireWheel(input, -100);
    expect(input.value).toBe('100');
  });

  it('does not go below 0', () => {
    const input = makeInput('test-input', '0');
    setupScrollInputPercent('test-input');
    fireWheel(input, 100);
    expect(input.value).toBe('0');
  });

  it('uses custom step', () => {
    const input = makeInput('test-input', '50');
    setupScrollInputPercent('test-input', 5);
    fireWheel(input, -100);
    expect(input.value).toBe('55');
  });

  it('uses fallback when value is NaN', () => {
    const input = makeInput('test-input', 'abc');
    setupScrollInputPercent('test-input', 1, 30);
    fireWheel(input, -100);
    expect(input.value).toBe('31');
  });

  it('does not add duplicate listeners on repeated setup calls', () => {
    const input = makeInput('test-input', '50');
    setupScrollInputPercent('test-input');
    setupScrollInputPercent('test-input');
    fireWheel(input, -100);
    // Only one increment applied, not two
    expect(input.value).toBe('51');
  });

  it('dispatches change event after scroll via timer', () => {
    const input = makeInput('test-input', '50');
    setupScrollInputPercent('test-input');
    const changeHandler = vi.fn();
    input.addEventListener('change', changeHandler);
    fireWheel(input, -100);
    expect(changeHandler).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(changeHandler).toHaveBeenCalledTimes(1);
  });

  it('does nothing if input element does not exist', () => {
    expect(() => setupScrollInputPercent('nonexistent-id')).not.toThrow();
  });
});
