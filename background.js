/**
 * background.js
 * Service worker for XDebug Cookie Toggler
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

/**
 * Retrieve the saved mode ("off"/"debug"/"profile") for a given site.
 * @param {string} siteUrl e.g. "https://example.com"
 * @param {function(string)} callback
 */
function getModeForSite(siteUrl, callback) {
  chrome.storage.local.get(siteUrl, (items) => {
    callback(items[siteUrl] || "off");
  });
}

/**
 * Persist the selected mode for a given site.
 * @param {string} siteUrl
 * @param {"off"|"debug"|"profile"} mode
 */
function setModeForSite(siteUrl, mode) {
  chrome.storage.local.set({ [siteUrl]: mode });
}

/**
 * Inspect cookies to determine actual XDebug mode.
 * @param {string} siteUrl
 * @param {function(string)} callback
 */
function detectCookieMode(siteUrl, callback) {
  // Check for profiling cookie first
  chrome.cookies.get({ url: siteUrl, name: "XDEBUG_PROFILE" }, (prof) => {
    if (prof?.value === "1") {
      return callback("profile");
    }
    // Then check for debug cookie
    chrome.cookies.get({ url: siteUrl, name: "XDEBUG_SESSION" }, (dbg) => {
      if (dbg?.value === "1") {
        return callback("debug");
      }
      // Default to off
      callback("off");
    });
  });
}

/**
 * Update the action icon for a tab based on stored vs. actual cookie state.
 * @param {number} tabId
 * @param {string} pageUrl
 */
function refreshIcon(tabId, pageUrl) {
  if (!pageUrl.startsWith("http")) {
    return chrome.action.setIcon({ tabId, path: ICON_PATHS.off });
  }

  const { protocol, host } = new URL(pageUrl);
  const siteUrl = `${protocol}//${host}`;

  // 1) Immediately set stored icon (avoids flicker)
  getModeForSite(siteUrl, (storedMode) => {
    chrome.action.setIcon({ tabId, path: ICON_PATHS[storedMode] });
  });

  // 2) Then double-check cookies and correct if needed
  detectCookieMode(siteUrl, (actualMode) => {
    getModeForSite(siteUrl, (storedMode) => {
      if (actualMode !== storedMode) {
        setModeForSite(siteUrl, actualMode);
        chrome.action.setIcon({ tabId, path: ICON_PATHS[actualMode] });
      }
    });
  });
}

// — Event Listeners —

// When the user switches to a different tab
chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => {
    if (tab.url) refreshIcon(tabId, tab.url);
  });
});

// When the tab starts or finishes loading
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!tab.url) return;

  const { protocol, host } = new URL(tab.url);
  const siteUrl = `${protocol}//${host}`;

  if (changeInfo.status === "loading") {
    // Show stored icon immediately on load start
    getModeForSite(siteUrl, (mode) => {
      chrome.action.setIcon({ tabId, path: ICON_PATHS[mode] });
    });
  }

  if (changeInfo.status === "complete") {
    // Re-check cookies on load finish
    refreshIcon(tabId, tab.url);
  }
});
