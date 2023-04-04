<p align="center">
  <img src="./128.png">
</p>

<h1 align="center">TikTok Download Buttons</h1>

<p align="center">An addon that adds download buttons to the web version of TikTok</p>

---

I made this mostly for my own needs, but it's also published here:

* [Chrome Web Store](https://chrome.google.com/webstore/detail/tiktok-download-buttons/kcnchleajedobajlpgkcinfcdmdnfejd)

* [Add-ons for Firefox](https://addons.mozilla.org/en-US/firefox/addon/tiktok-download-buttons/)

---

## Watermarks

This addon will _attempt_ to use the API to download videos without the watermark. This may not always work because TikTok can change how this works and block the way of downloading.

By default it'll prioritize downloading from the API, but this can be turned off in the settings. If the addon detects that the API isn't responding correctly, it'll revert back to the fallbacks (with watermarks) and it'll try again with the API at a later time.

Once the API has failed, there will be a short "cooldown" for when it attempts to use it again. This cooldown can be reset by simply opening the menu and saving your options, or you can wait 15 minutes.

## Not working?

TikTok is known for changing their site often, something that may break the addon from time to time. If it isn't working, feel free to submit an issue (or a PR with a fix), and I'll look into it.

Keeping this addon updated is a priority as long as it's feasible.