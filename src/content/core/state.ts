// Shared runtime state for the content script.
//
// The original extension grew around mutable globals. These interfaces keep that
// public surface explicit while we gradually move features toward smaller modules.

import type {
	ExpressionRegistry,
	SplashState,
	TTDBState,
	UtilityRegistry
} from '@/types';

export type {
	ExpressionRegistry,
	SplashMessage,
	SplashOptions,
	SplashState,
	TTDBEnvironment,
	TTDBLogger,
	TTDBLoggerNamespace,
	TTDBMode,
	TTDBObserverRegistry,
	TTDBState,
	TTDBTimerRegistry,
	UtilityRegistry
} from '@/types';

export const TTDB = {} as TTDBState;
export const EXPR = {} as ExpressionRegistry;
export const UTIL = {} as UtilityRegistry;
export const SPLASH = {} as SplashState;

TTDB.observers = {};
TTDB.timers = {};
TTDB.stats = {
	downloadAttemptsByVideo: {}
};

TTDB.interval = {
	counter: 25,
	delay: 1000
};

TTDB.MODE = {
	FEED: '0',
	GRID: '1',
	BROWSER: '2',
	BASIC_PLAYER: '4'
};

TTDB.setInterval = (count) => {
	if (TTDB.interval.counter < count) {
		TTDB.interval.counter = count;
	}
};

TTDB.ENV = {
	APP: Symbol('APP'),
	__NEXT: Symbol('__NEXT')
};

TTDB.DEFAULT_ENV = TTDB.ENV.APP;

TTDB.headers = {
	method: 'GET',
	mode: 'cors',
	cache: 'no-cache',
	credentials: 'include',
	redirect: 'follow'
};
