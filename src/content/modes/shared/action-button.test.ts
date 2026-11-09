// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { injectActionButton } from '@/content/modes/shared/action-button';

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	document.body.replaceChildren();
});

describe('action button observer', () => {
	it('continues repairing mounted controls and disconnects after their parent is removed', () => {
		vi.useFakeTimers();
		const disconnect = vi.fn();
		let onMutation: MutationCallback = () => {};
		vi.stubGlobal('MutationObserver', class {
			constructor(callback: MutationCallback) { onMutation = callback; }
			observe() {}
			disconnect = disconnect;
		});
		const container = document.createElement('div');
		const rail = document.createElement('section');
		const button = document.createElement('a');
		container.append(rail);
		document.body.append(container);
		injectActionButton({
			resolveSlot: () => rail,
			button,
			init: () => {},
			place: (slot, nextButton) => slot.append(nextButton),
			observerDisconnectMs: 100
		});

		vi.advanceTimersByTime(150);
		expect(disconnect).not.toHaveBeenCalled();
		button.remove();
		onMutation([], {} as MutationObserver);
		expect(rail.contains(button)).toBe(true);

		container.remove();
		vi.advanceTimersByTime(100);
		expect(disconnect).toHaveBeenCalledOnce();
	});
});
