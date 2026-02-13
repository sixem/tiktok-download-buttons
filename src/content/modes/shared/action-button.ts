// Shared action-button injection primitive.
//
// Feed and browser modes both need "keep this button injected" behavior:
// - resolve a live slot container
// - initialize button once
// - place/re-place button when DOM mutates
// - observe and self-disconnect after inactivity

type AnySlot = unknown;

type InjectActionButtonArgs<TSlot = AnySlot> = {
	resolveSlot: () => TSlot | null;
	button: HTMLElement;
	init: (button: HTMLElement) => void;
	place: (slot: TSlot, button: HTMLElement) => void;
	resolveObserveTarget?: (slot: TSlot | null) => Node | null;
	isButtonAlreadyPresent?: (slot: TSlot, button: HTMLElement) => boolean;
	observerDisconnectMs?: number;
	fadeInDelayMs?: number;
};

const DEFAULT_DISCONNECT_MS = 1E5;
const DEFAULT_FADE_IN_DELAY_MS = 50;

const isNode = (value: unknown): value is Node => {
	return !!value && typeof value === 'object' && 'nodeType' in (value as any);
};

const defaultObserveTarget = (slot: AnySlot): Node | null => {
	if (!slot || typeof slot !== 'object') return null;

	const container = (slot as any).container;
	if (isNode(container)) {
		return (container as any).parentNode || container;
	}

	if (isNode(slot as any)) {
		return ((slot as any).parentNode || slot) as Node;
	}

	return null;
};

export const injectActionButton = <TSlot = AnySlot>({
	resolveSlot,
	button,
	init,
	place,
	resolveObserveTarget = defaultObserveTarget,
	isButtonAlreadyPresent,
	observerDisconnectMs = DEFAULT_DISCONNECT_MS,
	fadeInDelayMs = DEFAULT_FADE_IN_DELAY_MS
}: InjectActionButtonArgs<TSlot>) => {
	const ensureInjected = () => {
		const slot = resolveSlot();
		if (!slot) return;

		if (!button.ttIsInitialized) {
			init(button);
			button.ttIsInitialized = true;
		}

		const alreadyPresent = typeof isButtonAlreadyPresent === 'function'
			? isButtonAlreadyPresent(slot, button)
			: button.isConnected;
		if (alreadyPresent) return;

		place(slot, button);
		setTimeout(() => {
			button.style.opacity = '1';
		}, fadeInDelayMs);
	};

	ensureInjected();

	let timer: number | null = null;
	const observeTarget = resolveObserveTarget(resolveSlot());
	if (!observeTarget || !isNode(observeTarget)) return;

	const observer = new MutationObserver(() => {
		ensureInjected();

		if (typeof timer === 'number') {
			clearTimeout(timer);
		}

		timer = setTimeout(() => {
			observer.disconnect();
		}, observerDisconnectMs) as unknown as number;
	});

	observer.observe(observeTarget, {
		childList: true,
		subtree: true
	});
};
