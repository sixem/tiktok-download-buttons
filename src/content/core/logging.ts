import { TTDB } from '@/content/core/state';

export const setupLogging = () => {
	if (TTDB.LOG) {
		return TTDB.LOG;
	}

	const styles = {
		prefix    : 'color: #fff; background: #fe2c55; padding: 1px 4px; border-radius: 3px; font-weight: 600;',
		namespace : 'color: #fe2c55; font-weight: 600;',
		reset     : 'color: inherit;'
	};

	const getMethod = (level) => (console?.[level] ? level : 'log');

	const write = (level, namespace, ...args) => {
		const method = getMethod(level);
		const ns     = namespace ? String(namespace) : 'core';
		const label  = `%cTTDB%c %c${ns}%c`;

		try {
			console[method](label, styles.prefix, styles.reset, styles.namespace, styles.reset, ...args);
		} catch (_) {
			console.log('[TTDB]', `[${ns}]`, ...args);
		}
	};

	const ns = (namespace) => ({
		info  : (...args) => write('info', namespace, ...args),
		warn  : (...args) => write('warn', namespace, ...args),
		error : (...args) => write('error', namespace, ...args),
		debug : (...args) => write('debug', namespace, ...args),
		log   : (...args) => write('log', namespace, ...args)
	});

	TTDB.LOG = {
		write,
		info  : (namespace, ...args) => write('info', namespace, ...args),
		warn  : (namespace, ...args) => write('warn', namespace, ...args),
		error : (namespace, ...args) => write('error', namespace, ...args),
		debug : (namespace, ...args) => write('debug', namespace, ...args),
		ns,
		styles
	};

	return TTDB.LOG;
};

export const pipe = (...args) => {
	if (!TTDB.LOG) setupLogging();
	TTDB.LOG.info('core', ...args);
};
