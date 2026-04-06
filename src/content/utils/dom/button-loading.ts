// Shared helpers for button loading states.
//
// These helpers keep the loading indicator stable so download buttons read as
// acknowledged (visually) even when the underlying work resolves immediately.

const buttonLoadingStartedAt = new WeakMap<HTMLElement, number>();
const buttonLoadingRevision  = new WeakMap<HTMLElement, number>();

const nextRevision = (button: HTMLElement) => {
	const current = buttonLoadingRevision.get(button) || 0;
	const next = current + 1;
	buttonLoadingRevision.set(button, next);
	return next;
};

export const startButtonLoading = (button: HTMLElement | null) => {
	if (!button) return;

	button.classList.add('loading');
	buttonLoadingStartedAt.set(button, Date.now());
	nextRevision(button);
};

export const clearButtonLoading = (
	button: HTMLElement | null,
	minVisibleMs = 1000
) => {
	if (!button) return;

	const startedAt = buttonLoadingStartedAt.get(button) || Date.now();
	const revision = buttonLoadingRevision.get(button) || nextRevision(button);
	const elapsedMs = Date.now() - startedAt;
	const remainingMs = Math.max(0, minVisibleMs - elapsedMs);

	const finish = () => {
		if ((buttonLoadingRevision.get(button) || 0) !== revision) {
			return;
		}

		button.classList.remove('loading');
		buttonLoadingStartedAt.delete(button);
	};

	if (remainingMs <= 0) {
		finish();
		return;
	}

	setTimeout(finish, remainingMs);
};
