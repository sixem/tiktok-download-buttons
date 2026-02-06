# TikTok Download Buttons

_An addon that adds download buttons to the web version of TikTok_

I made this mostly for my own needs, but it's also published here:

* [Chrome Web Store](https://chrome.google.com/webstore/detail/tiktok-download-buttons/kcnchleajedobajlpgkcinfcdmdnfejd)

* [Add-ons for Firefox](https://addons.mozilla.org/en-US/firefox/addon/tiktok-download-buttons/)

## Download strategy

TikTok is a moving target, and different pages expose video URLs in different ways. This addon uses a small set of explicit strategies and falls back when needed:

- **API**: Prefer signed MP4 URLs from TikTok's web APIs when available. This is usually the most reliable path (and is the only path that *can* be watermark-free).
- **DOM**: If the page exposes a normal `https://...mp4` video URL, download that directly.
- **INTERCEPT**: If the page only exposes a `blob:` URL, cache the signed preview URL that TikTok fetches (often on hover or autoplay) and download that instead.
- **BLOB**: Last resort. On Chromium we can sometimes fetch the media and trigger a blob download. On Firefox this is frequently blocked by browser/extension constraints, so we'll ask you to hover the card to load a preview URL.

When a strategy fails, it'll try the next one and the toast will show what was used (for example `API`, `INTERCEPT`, or `API->BLOB`).

### Constraints

This addon will _not_ use any **third-party** downloaders/APIs to download videos. All methods that the addon uses strictly rely on TikTok's way of exposing video data. This is both due to me not wanting to rely on third-party applications (which _can_ behave maliciously, leak data, and so on), and the fact that it can be even more unreliable to depend on multiple external APIs with changing endpoints or unpredictable behaviours.

Due to the constraints mentioned, this is a best-effort addon, and it may not always be able to download every video.

## Development

```sh
pnpm install
pnpm run dev
```

## Not working?

TikTok is known for changing their site often, something that may break the addon from time to time. If it isn't working, feel free to submit an issue (or a PR with a fix), and I'll look into it if/when I have time.
