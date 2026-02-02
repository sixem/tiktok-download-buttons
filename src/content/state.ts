export const TTDB: any = {};
export const EXPR: any = {};
export const UTIL: any = {};
export const SPLASH: any = {};
export const ACTIVE: any = {};

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
	BASIC_PLAYER: '4',
	SHARE_OVERLAY: '-1'
};

TTDB.setInterval = (count) => {
	if (TTDB.interval.counter < count) {
		TTDB.interval.counter = count;
	}
};

ACTIVE.running = {};

TTDB.ENV = {
	APP: Symbol(true),
	__NEXT: Symbol(true)
};

TTDB.DEFAULT_ENV = TTDB.ENV.APP;

TTDB.headers = {
	method: 'GET',
	mode: 'cors',
	cache: 'no-cache',
	credentials: 'include',
	redirect: 'follow'
};
