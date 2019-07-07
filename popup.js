function clearTime(d) {
    d.setHours(0);
    d.setMinutes(0);
    d.setSeconds(0);
    d.setMilliseconds(0);
}

function today() {
    let d = new Date();
    clearTime(d);
    return d.getTime();
}

function getDateString(timestamp) {
    let dateObj = new Date(timestamp);
    let year = dateObj.getFullYear();
    let month = String(dateObj.getMonth() + 1).padStart(2, '0');
    let date = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${date}`;
}

async function getPages() {
    let background = await runtimeGetBackgroundPage();
    let pages = await background.getPages();
    return pages;
}

async function setPages(pages) {
    let background = await runtimeGetBackgroundPage();
    await background.setPages(pages);
}

async function addPage(page) {
    let background = await runtimeGetBackgroundPage();
    await background.addPage(page);
}

async function deletePage(url) {
    let background = await runtimeGetBackgroundPage();
    await background.deletePage(url);
}

async function addToBookmark(page) {
    let background = await runtimeGetBackgroundPage();
    await background.addToBookmark(page);
}

function generateBookmark(page) {
    return `<li class="bookmark-item" data-url="${page.url}">
        <span class="bookmark-title">${page.title}</span>
        <i class="bookmark-operator bookmark-operator-add"></i>
        <i class="bookmark-operator bookmark-operator-delete"></i>
    </li>`;
}

async function getPagesRecent() {
    let now = today();
    let pages = await getPages();
    pages = pages.filter(p => p.notifyTime <= now);
    return [{
        pages
    }];
}

async function getPagesByTime() {
    let items = [];
    let pages = await getPages();
    pages.sort((a, b) => {
        if (a.notifyTime > b.notifyTime) return 1;
        if (a.notifyTime === b.notifyTime) return 0;
        return -1;
    });
    let item;
    let lastTime;
    for (let page of pages) {
        if (page.notifyTime !== lastTime) {
            if (item) {
                items.push(item);
            }
            lastTime = page.notifyTime;
            item = {
                title: getDateString(lastTime),
                pages: []
            }
        }
        item.pages.push(page)
    }
    if (item) {
        items.push(item);
    }
    return items;
}

async function getPagesByType() {
    let items = [];
    let pages = await getPages();
    let typeObj = {};
    for (let page of pages) {
        let obj = typeObj[page.type] || [];
        obj.push(page);
        typeObj[page.type] = obj;
    }
    for (let type in typeObj) {
        items.push({
            title: type,
            pages: typeObj[type]
        });
    }
    return items;
}

async function generateBookmarks() {
    let type = $('.list-type-item.is-current').data('type');
    let list;
    if (type === 'time') {
        list = await getPagesByTime();
    } else if (type === 'type') {
        list = await getPagesByType();
    } else {
        list = await getPagesRecent();
    }
    $('#bookmarks-container').empty();
    for (let item of list) {
        let section = $('<div class="bookmarks-section"></div>');
        if (item.title) {
            $(`<h2 class="bookmarks-section-title">${item.title}</h2>`).appendTo(section);
        }
        let ul = $('<ul class="bookmarks-group"></ul>');
        for (let page of item.pages) {
            $(`${generateBookmark(page)}`).appendTo(ul);
        }
        $(ul).appendTo(section);
        $(section).appendTo($('#bookmarks-container'));
    }
}

function toggleContentArea() {
    $('.tab').each(function () {
        let id = $(this).attr('id');
        let isCurrent = $(this).hasClass('is-current');
        let contentId = `#${id}-content`;
        if (isCurrent) {
            $(contentId).show();
            if (contentId === '#tab-reading-content') {
                toggleTypeListArea(false);
                toggleBookmarkType();
            }
        } else {
            $(contentId).hide();
        }
    });
}

function toggleTypeListArea(show) {
    if (show) {
        $('#type-selector').removeClass('triangle-down');
        $('#type-selector').addClass('triangle-up');
        $('#list-type-list').show();
    } else {
        $('#type-selector').removeClass('triangle-up');
        $('#type-selector').addClass('triangle-down');
        $('#list-type-list').hide();
    }
}

async function toggleBookmarkType() {
    let type = $('.list-type-item.is-current').data('type');
    $('#type-name-span').text($('.list-type-item.is-current').text());
    await generateBookmarks();
}

function initAddContent() {
    $('#notify-time').val(getDateString(Date.now() + 7 * 24 * 60 * 60 * 1000));
    $('#end-time').val(getDateString(Date.now() + 14 * 24 * 60 * 60 * 1000));
}

$('#tab-div').on('click', '.tab', async function (eve) {
    let targetId = $(this).attr('id');
    $('.tab').each(function () {
        let id = $(this).attr('id');
        if (id === targetId) {
            $(this).addClass('is-current');
        } else {
            $(this).removeClass('is-current');
        }
    });
    toggleContentArea();
});

$('#add-button').on('click', async function () {
    let background = await runtimeGetBackgroundPage();
    let tabsList = background.tabsList;
    log('clicked');
    log(tabsList);
    let timestamp = Date.now();
    let type = $('#type').val() || '';
    let notifyTime = $('#notify-time').val();
    if (notifyTime) {
        notifyTime = new Date(notifyTime).getTime();
    } else {
        notifyTime = today() + 7 * 24 * 60 * 60 * 1000;
    }
    let endTime = $('#end-time').val();
    if (endTime) {
        endTime = new Date(endTime).getTime();
    } else {
        endTime = today() + 14 * 24 * 60 * 60 * 1000;
    }
    let addAll = $('#add-all').is(':checked');
    let addTime = Date.now();

    let tabs;
    if (addAll) {
        tabs = await tabsQuery({ currentWindow: true });
    } else {
        tabs = await tabsQuery({ active: true, currentWindow: true });
    }
    for (let tab of tabs) {
        if (tab.incognito) {
            continue;
        }
        if (tab.url.match(/^chrome/gi)) {
            continue;
        }
        let {
            id,
            windowId,
            url,
            title
        } = tab;
        let tData = tabsList.find(t => t.tabId === id && t.windowId === windowId) || {};
        await addPage({
            title,
            url,
            scrollTop: tData.scrollTop,
            type,
            notifyTime,
            addTime,
            endTime,
            tag: timestamp
        });
    }
    $('#tab-reading').click();
});

$('#type-selector').on('click', function () {
    let isShown = $(this).hasClass('triangle-up');
    toggleTypeListArea(!isShown);
});

$('#list-type-list').on('click', '.list-type-item', function () {
    let type = $(this).data('type');
    $('.list-type-item').each(function () {
        let cType = $(this).data('type');
        if (type === cType) {
            $(this).addClass('is-current');
        } else {
            $(this).removeClass('is-current');
        }
    });
    toggleTypeListArea(false);
    toggleBookmarkType();
});

$('#bookmarks-container').on('click', '.bookmark-title', async function () {
    let url = $(this).parent().data('url');
    await tabsCreate({
        url
    });
});

$('#bookmarks-container').on('click', '.bookmark-operator-delete', async function () {
    let url = $(this).parent().data('url');
    await deletePage(url);
    await generateBookmarks();
});

$('#bookmarks-container').on('click', '.bookmark-operator-add', async function () {
    let url = $(this).parent().data('url');
    let pages = await getPages();
    let page = pages.find(p => p.url === url);
    await addToBookmark(page);
    await generateBookmarks();
});

async function initFunc() {
    toggleContentArea();
    initAddContent();
}
initFunc();