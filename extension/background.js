const DETAIL_PAGE_PATTERN = /^https?:\/\/detail\.1688\.com\/offer\//i;

async function updateActionState(tabId, url) {
  if (typeof tabId !== "number") {
    return;
  }

  if (url && DETAIL_PAGE_PATTERN.test(url)) {
    await chrome.action.enable(tabId);
    return;
  }

  await chrome.action.disable(tabId);
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.action.disable();
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);
  await updateActionState(tab.id, tab.url);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const nextUrl = changeInfo.url || tab.url;
  await updateActionState(tabId, nextUrl);
});