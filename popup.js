/**
 * popup.js
 * Handles user selection of XDebug mode.
 */

const ICON_PATHS = {
  off: {
    16: "icons/bug-gray-16.png",
    48: "icons/bug-gray-48.png",
    128: "icons/bug-gray-128.png",
  },
  debug: {
    16: "icons/bug-green-16.png",
    48: "icons/bug-green-48.png",
    128: "icons/bug-green-128.png",
  },
  profile: {
    16: "icons/bug-purple-16.png",
    48: "icons/bug-purple-48.png",
    128: "icons/bug-purple-128.png",
  },
};

// Wire up click handlers for each mode button
["off", "debug", "profile"].forEach((mode) => {
  document.getElementById(mode)
          .addEventListener("click", () => applyMode(mode));
});

/**
 * Apply the selected mode:
 * 1) Remove any existing XDEBUG cookies
 * 2) Set the new cookie if needed
 * 3) Update the icon, save mode, reload tab, and close popup
 * @param {"off"|"debug"|"profile"} mode
 */
function applyMode(mode) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    if (!currentTab?.url.startsWith("http")) {
      window.close();
      return;
    }

    const { protocol, host } = new URL(currentTab.url);
    const siteUrl = `${protocol}//${host}`;

    // 1) Clear existing cookies
    ["XDEBUG_SESSION", "XDEBUG_PROFILE"].forEach((name) => {
      chrome.cookies.remove({ url: siteUrl, name });
    });

    // 2) Set the selected cookie
    if (mode === "debug") {
      chrome.cookies.set({ url: siteUrl, name: "XDEBUG_SESSION", value: "1" });
    } else if (mode === "profile") {
      chrome.cookies.set({ url: siteUrl, name: "XDEBUG_PROFILE", value: "1" });
    }

    // 3) Update UI and storage, then reload
    chrome.action.setIcon({ tabId: currentTab.id, path: ICON_PATHS[mode] }, () => {
      chrome.storage.local.set({ [siteUrl]: mode }, () => {
        chrome.tabs.reload(currentTab.id);
        window.close();
      });
    });
  });
}
