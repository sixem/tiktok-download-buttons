// Network validation helpers for download responses.
import { UTIL } from '../state';

export const setupNetworkUtils = () => {
	// Confirm a response looks like a usable video payload.
	// FIX: TikTok CDN часто usa chunked transfer sem Content-Length — não pode exigir >1000.
	UTIL.validateVideoRequest = (t) => {
		if (!t || !t.ok || !t.body) return false;
		const contentType = (t.headers.get('Content-Type') || '').toLowerCase();
		const hasVideoType = contentType.includes('video/') || contentType.includes('application/octet-stream');
		// Se Content-Type é video, aceita mesmo sem Content-Length (chunked)
		// Se Content-Type está vazio mas URL parece vídeo, deixa passar para fallback validar pelo blob
		if (hasVideoType) {
			const cl = t.headers.get('Content-Length');
			// Se Content-Length existe, exige >1000, senão aceita (chunked)
			if (cl !== null && cl !== '') {
				const n = Number(cl);
				return Number.isFinite(n) ? n > 1000 : true;
			}
			return true;
		}
		// Fallback: aceita se Content-Type vazio mas status ok e body existe (alguns CDNs não enviam header imediatamente)
		// Mas exige pelo menos que não seja text/html (challenge)
		if (!contentType || contentType.includes('text/html')) return false;
		return false;
	};

	// Validação leniente para fallback in-page (sem exigir Content-Length)
	UTIL.validateVideoRequestLenient = (t) => {
		if (!t || !t.ok || !t.body) return false;
		const ct = (t.headers.get('Content-Type') || '').toLowerCase();
		return ct.includes('video/') || ct.includes('application/octet-stream') || ct.includes('binary');
	};
};
