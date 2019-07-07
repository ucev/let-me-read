const log = chrome.extension.getBackgroundPage().console.log;

// tabs
async function tabsQuery(options) {
    return new Promise(resolve => {
        chrome.tabs.query(options, function (tabs) {
            resolve(tabs);
        });
    });
}

async function tabsSendMessage(tabId, msg) {
    return new Promise(resolve => {
        chrome.tabs.sendMessage(tabId, msg, function (response) {
            resolve(response);
        });
    })
}

async function tabsCreate(options) {
    return new Promise(resolve => {
        chrome.tabs.create(options, function (tab) {
            resolve(tab);
        });
    });
}

// storage
async function storageGet(key) {
    return new Promise(resolve => {
        chrome.storage.sync.get(key, function (data) {
            resolve(data);
        });
    });
}

async function storageSet(data) {
    return new Promise(resolve => {
        chrome.storage.sync.set(data, resolve);
    });
}

// runtime
async function runtimeGetBackgroundPage() {
    return new Promise(resolve => {
        chrome.runtime.getBackgroundPage(function (bg) {
            resolve(bg);
        });
    })
}