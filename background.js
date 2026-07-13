const RULE_ID = 1;

function buildRedirectRule() {
  const extensionOrigin = `chrome-extension://${chrome.runtime.id}`;
  return {
    id: RULE_ID,
    priority: 1,
    action: {
      type: "redirect",
      redirect: {
        regexSubstitution: `${extensionOrigin}/viewer.html?file=\\0`,
      },
    },
    condition: {
      regexFilter: "^(?:https?|file)://.*\\.pdf(?:[?#].*)?$",
      resourceTypes: ["main_frame"],
    },
  };
}

async function registerRedirectRule() {
  const rule = buildRedirectRule();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [RULE_ID],
    addRules: [rule],
  });
}

chrome.runtime.onInstalled.addListener(registerRedirectRule);
chrome.runtime.onStartup.addListener(registerRedirectRule);
