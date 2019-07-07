const AUTODELETE_ENABLED_KEY = '__let_me_read_autodelete_enabled';
const AUTODELETE_THRESHOLD = '__let_me_read_autodelete_threshold';
const BOOKMARK_DIRNAME = '__let_me_read_bookmark_dirname';

async function initFunc() {
    let data = await storageGet(AUTODELETE_ENABLED_KEY);
    let autodeleteEnabled = data[AUTODELETE_ENABLED_KEY] || true;
    data = await storageGet(AUTODELETE_THRESHOLD);
    let autodeleteThreshold = data[AUTODELETE_THRESHOLD] || 150;
    data = await storageGet(BOOKMARK_DIRNAME);
    let bookmarkDirname = data[BOOKMARK_DIRNAME] || 'let-me-read';
    $('#enable-autodelete').prop('checked', autodeleteEnabled);
    $('#autodelete-threshold').val(autodeleteThreshold);
    $('#bookmark-dirname').val(bookmarkDirname);
}

$('#enable-autodelete').change(function () {
    let checked = $(this).prop('checked');
    $('#autodelete-threshold').attr('disabled', checked);
});

$('#save').click(async function () {
    let autodeleteEnabled = $('#enable-autodelete').prop('checked');
    let autodeleteThreshold = $('#autodelete-threshold').val();
    let bookmarkDirname = $('#bookmark-dirname').val();
    await storageSet({
        [AUTODELETE_ENABLED_KEY]: autodeleteEnabled,
        [AUTODELETE_THRESHOLD]: Number(autodeleteThreshold),
        [BOOKMARK_DIRNAME]: bookmarkDirname
    });
});

initFunc();