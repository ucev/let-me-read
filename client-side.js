const STORAGE_KEY = '__let_me_read_pages';
const AUTODELETE_THRESHOLD = '__let_me_read_autodelete_threshold';
const DELETE_IMAGE = chrome.runtime.getURL('images/delete-white.png');
const VIEW_IMAGE = chrome.runtime.getURL('images/headline-white.png');
const LESS_IMAGE = chrome.runtime.getURL('images/unfold-less.png');
const MORE_IMAGE = chrome.runtime.getURL('images/unfold-more.png');

function debounce(func, time) {
    let ctx = window;
    let handler = undefined;
    return function(...args) {
        if (handler) {
            clearTimeout(handler);
        }
        handler = setTimeout(function () {
            func.apply(ctx, args);
        }, time);
    }
}

async function storageGet(key) {
    return new Promise(resolve => {
        chrome.storage.sync.get(key, function (data) {
            resolve(data);
        });
    });
}

async function storageSet(data) {
    return new Promise(resolve => {
        chrome.storage.sync.set(data, function () {
            resolve();
        });
    });
}

async function getPages() {
    let data = await storageGet(STORAGE_KEY);
    return data[STORAGE_KEY] || [];
}

async function deletePage() {
    chrome.runtime.sendMessage({
        type: 'delete-page', 
    }, function () {
        unloadCleaner();
    });
}

let scrollCallback = debounce(async function () {
    let scrollTop = document.documentElement.scrollTop;
    let clientHeight = document.documentElement.clientHeight;
    let scrollHeight = document.documentElement.scrollHeight;
    let data = await storageGet(AUTODELETE_THRESHOLD);
    let threshold = data[AUTODELETE_THRESHOLD] || 150;
    let reachEnd = scrollTop + clientHeight + threshold > scrollHeight;
    if (!reachEnd) {
        chrome.runtime.sendMessage({
            type: 'scroll-top',
            data: {
                scrollTop
            }
        });
    } else {
        chrome.runtime.sendMessage({
            type: 'page-end'
        }, function () {
            unloadCleaner();
        });
    }
}, 3000);

async function toLastRead() {
    let pages = await getPages();
    let page = pages.find(p => p.url === location.href);
    if (page) {
        window.scrollTo(0, page.scrollTop);
    }
    $('.__let_me_read_operator[data-type=last_read]').parent().remove();
}

function toggleVisibleState() {
    let isVisible = $('.__let_me_read_operator.__operator_toggle').data('visible') === 'is-shown';
    if (isVisible) {
        $('.__let_me_read_item[data-can-toggle=true]').hide();
        $('.__let_me_read_operator.__operator_toggle').data('visible', 'is-hide');
        $('.__let_me_read_operator.__operator_toggle').find('img').attr('src', MORE_IMAGE);
        $('.__let_me_read_operator.__operator_toggle').parent().find('.__let_me_read_title').text('显示');
    } else {
        $('.__let_me_read_item[data-can-toggle=true]').show();
        $('.__let_me_read_operator.__operator_toggle').data('visible', 'is-shown');
        $('.__let_me_read_operator.__operator_toggle').find('img').attr('src', LESS_IMAGE);
        $('.__let_me_read_operator.__operator_toggle').parent().find('.__let_me_read_title').text('隐藏');
    }
}

function unloadCleaner() {
    window.removeEventListener('scroll', scrollCallback);
    removeLetMeReadContainer();
}
function initFunc() {
    unloadCleaner();
    window.addEventListener('scroll', scrollCallback);
    addLetMeReadContainer();
}
async function addLetMeReadContainer() {
    removeLetMeReadContainer();
    let pages = await getPages();
    let page = pages.find(p => p.url === location.href);
    if (page) {
        let div = $(`<div class="__let_me_read_container">
            <div class="__let_me_read_item" data-can-toggle="true">
                <span class="__let_me_read_operator" data-type="delete">
                    <img src="${DELETE_IMAGE}">
                </span>
                <span class="__let_me_read_title">删除</span>
            </div>
            <div class="__let_me_read_item" data-can-toggle="true">
                <span class="__let_me_read_operator" data-type="last_read">
                    <img src="${VIEW_IMAGE}">
                </span>
                <span class="__let_me_read_title">上次阅读位置</span>
            </div>
            <div class="__let_me_read_item" data-can-toggle="false">
                <span class="__let_me_read_operator __operator_toggle" data-type="visible_toggle" data-visible="is-shown">
                    <img src="${LESS_IMAGE}">
                </span>
                <span class="__let_me_read_title">隐藏</span>
            </div>
        </div>`);
        $(div).on('click', '.__let_me_read_operator', async function() {
            let type = $(this).data('type');
            switch (type) {
                case 'delete':
                    await deletePage();
                    return;
                case 'last_read':
                    await toLastRead();
                    return;
                case 'visible_toggle':
                    toggleVisibleState();
                    return;
            }
        });
        $(div).find('.__let_me_read_operator').hover(function () {
            $(this).parent().find('.__let_me_read_title').css('visibility', 'visible');
        }, function () {
            $(this).parent().find('.__let_me_read_title').css('visibility', 'hidden');
        });
        $(div).appendTo($('body'));
    }
};
function removeLetMeReadContainer() {
    $('.__let_me_read_container').off('click');
    $('.__let_me_read_container').find('.__let_me_read_operator').off('mouseenter').unbind('mouseleave');
    $('.__let_me_read_container').remove();
}

window.addEventListener('beforeunload', unloadCleaner);
if (document.readyState === 'complete') {
    initFunc();
} else {
    window.onload = initFunc();
}