const STORAGE_KEY = '__let_me_read_pages';
const AUTODELETE_ENABLED_KEY = '__let_me_read_autodelete_enabled';
const AUTODELETE_THRESHOLD = '__let_me_read_autodelete_threshold';
const BOOKMARK_DIRNAME = '__let_me_read_bookmark_dirname';
const BOOKMARK_DIRID = '__let_me_read_bookmark_dirid';

async function storageGet(keys) {
    return new Promise(resolve => {
        chrome.storage.sync.get(keys, function (data) {
            resolve(data);
        });
    });
}

async function storageSet(data) {
    return new Promise(resolve => {
        chrome.storage.sync.set(data, resolve);
    });
}

async function getAutodeleteInfo() {
    let data = await storageGet([AUTODELETE_ENABLED_KEY, AUTODELETE_THRESHOLD]);
    return {
        enabled: data[AUTODELETE_ENABLED_KEY] || false,
        threshold: data[AUTODELETE_THRESHOLD] || 150
    };
}

async function getSavedBookmarkInfo() {
    let data = await storageGet([BOOKMARK_DIRNAME, BOOKMARK_DIRID]);
    return {
        title: data[BOOKMARK_DIRNAME] || 'let-me-read',
        id: data[BOOKMARK_DIRID]
    };
}

async function getBookmark(id) {
    return new Promise(resolve => {
        chrome.bookmarks.get(id, function (bookmarks) {
            if (bookmarks && bookmarks[0]) {
                resolve(bookmarks[0]);
            } else {
                resolve();
            }
        });
    });
}

async function bookmarkFindChild(id, title) {
    return new Promise(resolve => {
        chrome.bookmarks.getChildren(id, (results) => {
            for (let r of results) {
                if (r.title === title) {
                    resolve(r);
                    return;
                }
            }
            resolve();
        });
    });
}

async function createNewBookmark(bookmark) {
    return new Promise(resolve => {
        chrome.bookmarks.create(bookmark, (result) => {
            resolve(result);
        });
    });
}

async function updateBookmark(id, changes) {
    return new Promise(resolve => {
        chrome.bookmarks.update(id, changes, (result) => {
            resolve(result);
        });
    });
}

async function createBookmarkDirIfNotExists() {
    let {id, title} = await getSavedBookmarkInfo();
    if (!id) {
        let bookmark = await createNewBookmark({
            title
        });
        await storageSet({
            [BOOKMARK_DIRID]: bookmark.id
        });
        return;
    }
    let bookmark = await getBookmark(id);
    if (!bookmark) {
        bookmark = await createNewBookmark({
            title
        });
        await storageSet({
            [BOOKMARK_DIRID]: bookmark.id
        });
        return;
    }
    if (bookmark.title !== title) {
        await updateBookmark(id, {
            title
        });
    }
}

async function setBadgeText(detail) {
    return new Promise(resolve => {
        chrome.browserAction.setBadgeText(detail, resolve);
    });
}

async function rearrangePages() {
    let pages = await getPages();
    let now = new Date();
    now.setHours(0);
    now.setMinutes(0);
    now.setSeconds(0);
    now.setMilliseconds(0);
    now = now.getTime();
    let pagesExpired = pages.filter(p => p.endTime < now);
    let pagesNormal = pages.filter(p => p.endTime >= now);
    await storageSet({
        [STORAGE_KEY]: pagesNormal
    });
    for (let p of pagesExpired) {
        await addToBookmark(p, false);
    }

    let outdated = pagesNormal.reduce((cnt, item) => {
        let notifyTime = item.notifyTime;
        if (notifyTime < now) {
            return cnt + 1;
        }
        return cnt;
    }, 0);

    if (outdated > 0) {
        await setBadgeText({
            text: '' + outdated
        });
    } else {
        await setBadgeText({
            text: ''
        });
    }
}

async function setPages(pages) {
    return new Promise(resolve => {
        chrome.storage.sync.set({
            [STORAGE_KEY]: pages
        }, async function () {
            await rearrangePages();
            resolve();
        });
    })
}

async function getPages() {
    return new Promise(resolve => {
        chrome.storage.sync.get(STORAGE_KEY, function (data) {
            resolve(data[STORAGE_KEY] || []);
        });
    });
}

async function addPage(page) {
    await deletePage(page.url, page);
}

async function deletePage(url, newPage) {
    let pages = await getPages();
    let index = pages.findIndex(p => p.url === url);
    if (index >= 0) {
        pages.splice(index, 1);
    }
    if (newPage) {
        pages.push(newPage);
    }
    await setPages(pages);
}

async function addToBookmark(page, needDelete = true) {
    await createBookmarkDirIfNotExists();
    let {id, title} = await getSavedBookmarkInfo();
    if (!page.type) {
        await createNewBookmark({
            parentId: id,
            title: page.title,
            url: page.url
        });
        if (needDelete) {
            await deletePage(page.url);
        }
    } else {
        let parent = await bookmarkFindChild(id, page.type);
        if (!parent) {
            parent = await createNewBookmark({
                parentId: id,
                title: page.type
            });
        }
        await createNewBookmark({
            parentId: parent.id,
            title: page.title,
            url: page.url
        });
        if (needDelete) {
            await deletePage(page.url);
        }
    }
}

function injectIntoTab(tab) {
    let manifest = chrome.app.getDetails();
    let scripts = manifest.content_scripts[0].js;
    for (let i = 0; i < scripts.length; i++) {
        chrome.tabs.executeScript(tab.id, {
            file: scripts[i]
        });
    }
}

chrome.runtime.onInstalled.addListener(async function () {
    await rearrangePages();
    chrome.tabs.query({}, function (tabs) {
        for (let tab of tabs) {
            if (!tab.url.match(/^chrome/gi)) {
                injectIntoTab(tab);
            }
        }
    });
});

let tabsList = [];
window.tabsList = tabsList;

chrome.tabs.onCreated.addListener(function (tab) {
    tabsList.push({
        tabId: tab.id,
        windowId: tab.windowId
    });
});

chrome.tabs.onRemoved.addListener(function (tabId, removeInfo) {
    let index = tabsList.findIndex(tab => tab.tabId === tabId && tab.windowId === removeInfo.windowId);
    if (index >= 0) {
        tabsList.splice(index, 1);
    }
});

chrome.runtime.onMessage.addListener(async function (message, sender, sendResponse) {
    let tabId = sender.tab.id;
    let windowId = sender.tab.windowId;
    let index = tabsList.findIndex(tab => tab.tabId === tabId && tab.windowId === windowId);
    // 插件更新后，单页面不是新打开的
    if (index === -1) {
        tabsList.push({
            tabId,
            windowId
        });
        index = tabsList.length - 1;
    }
    let data = message.data;
    switch (message.type) {
        case 'scroll-top':
            tabsList[index].scrollTop = data.scrollTop;
            break;
        case 'page-end':
            let autodeleteInfo = await getAutodeleteInfo();
            if (autodeleteInfo.enabled) {
                await deletePage(sender.tab.url);
                sendResponse();
            }
            break;
        case 'delete-page':
            await deletePage(sender.tab.url);
            sendResponse();
            break;       
    }
});
