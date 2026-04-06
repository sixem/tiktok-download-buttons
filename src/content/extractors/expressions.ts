import { EXPR } from '@/content/core/state';

export const setupExpressions = () => {
	EXPR.vanillaVideoUrl = (haystack, options = {}) => {
		let expression = ('https?:\\/\\/(?:www\\.)?tiktok\\.com\\/@([^\\/]+)\\/video\\/([0-9]+)');

		if (options.strict) {
			expression = (`^${expression}$`);
		}

		const matches = new RegExp(expression).exec(haystack);
		return matches ? matches : null;
	};

	return EXPR;
};

