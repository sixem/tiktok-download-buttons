// Slideshow URL extraction helpers.
//
// TikTok photo-mode cards use swiper and duplicate slide nodes for loop behavior.
// This module collects one URL per real slide index while keeping a stable fallback
// order for cards that do not expose `data-swiper-slide-index`.

export type SlideshowDomSelectors = {
	wrappers: string;
	slides: string;
	image: string;
};

export const SWIPER_SLIDESHOW_SELECTORS: SlideshowDomSelectors = {
	wrappers: 'div.swiper-wrapper',
	slides: 'div.swiper-slide',
	image: 'img[src]'
};

const normalizeSlideshowImageUrl = (value: string | null) => {
	if (!value) return null;
	const url = String(value).trim();
	if (!url || url.startsWith('data:')) return null;

	return url.replace(/&amp;/g, '&');
};

export const collectSlideshowImageUrls = (
	root: ParentNode,
	selectors: SlideshowDomSelectors = SWIPER_SLIDESHOW_SELECTORS
) => {
	const swiperWrappers = root.querySelectorAll(selectors.wrappers);
	if (!swiperWrappers.length) return [];

	const bySlideIndex = new Map<number, string>();
	const fallbackUrls: string[] = [];
	const fallbackSeen = new Set<string>();

	swiperWrappers.forEach((wrapper) => {
		const slides = wrapper.querySelectorAll(selectors.slides);

		slides.forEach((slide) => {
			if (slide.classList.contains('swiper-slide-duplicate')) {
				return;
			}

			const image = slide.querySelector(selectors.image);
			if (!image) return;

			const imageUrl = normalizeSlideshowImageUrl(image.getAttribute('src'));
			if (!imageUrl) return;

			const slideIndexRaw = slide.getAttribute('data-swiper-slide-index');
			const slideIndex = slideIndexRaw === null ? NaN : Number.parseInt(slideIndexRaw, 10);

			if (Number.isFinite(slideIndex)) {
				if (!bySlideIndex.has(slideIndex)) {
					bySlideIndex.set(slideIndex, imageUrl);
				}
				return;
			}

			if (!fallbackSeen.has(imageUrl)) {
				fallbackSeen.add(imageUrl);
				fallbackUrls.push(imageUrl);
			}
		});
	});

	if (bySlideIndex.size > 0) {
		const ordered = [...bySlideIndex.entries()]
			.sort((a, b) => a[0] - b[0])
			.map(([, url]) => url);

		const orderedSet = new Set(ordered);
		fallbackUrls.forEach((url) => {
			if (!orderedSet.has(url)) {
				ordered.push(url);
			}
		});

		return ordered;
	}

	return fallbackUrls;
};
