async function sendMessage(message) {
    try {
        return await browser.runtime.sendMessage(message);
    }
    catch (e) {
        console.log("Calling browser runtime failed:", e);

        alert(t("calling_runtime_failed"));
    }
}

const $showOptionsButton = $("#show-options-button");
const $saveCroppedScreenShotButton = $("#save-cropped-screenshot-button");
const $saveWholeScreenShotButton = $("#save-whole-screenshot-button");
const $saveWholePageButton = $("#save-whole-page-button");
const $saveTabsButton = $("#save-tabs-button");

$showOptionsButton.on("click", () => browser.runtime.openOptionsPage());

$saveCroppedScreenShotButton.on("click", () => {
    sendMessage({name: 'save-cropped-screenshot'});

    window.close();
});

$saveWholeScreenShotButton.on("click", () => {
    sendMessage({name: 'save-whole-screenshot'});

    window.close();
});

$saveWholePageButton.on("click", () => sendMessage({name: 'save-whole-page'}));

$saveTabsButton.on("click", () => sendMessage({name: 'save-tabs'}));

const $saveLinkWithNoteWrapper = $("#save-link-with-note-wrapper");
const $textNote = $("#save-link-with-note-textarea");
const $keepTitle = $("#keep-title-checkbox");

$textNote.on('keypress', function (event) {
    if ((event.which === 10 || event.which === 13) && event.ctrlKey) {
        saveLinkWithNote();
        return false;
    }

    return true;
});

$("#save-link-with-note-button").on("click", () => {
    $saveLinkWithNoteWrapper.show();

    $textNote[0].focus();
});

$("#cancel-button").on("click", () => {
    $saveLinkWithNoteWrapper.hide();
    $textNote.val("");

    window.close();
});

async function saveLinkWithNote() {
    const textNoteVal = $textNote.val().trim();
    let title, content;

    if (!textNoteVal) {
        title = '';
        content = '';
    }
    else if ($keepTitle[0].checked){
        title = '';
        content = textNoteVal;
    }
    else {
        const match = /^(.*?)([.?!]\s|\n)/.exec(textNoteVal);

        if (match) {
            title = match[0].trim();
            content = textNoteVal.substr(title.length).trim();
        }
        else {
            title = textNoteVal;
            content = '';
        }
    }

    content = escapeHtml(content);

    const result = await sendMessage({name: 'save-link-with-note', title, content});

    if (result) {
        $textNote.val('');

        window.close();
    }
}

$("#save-button").on("click", saveLinkWithNote);

$("#show-help-button").on("click", () => {
    window.open("https://github.com/zadam/trilium/wiki/Web-clipper", '_blank');
});

function escapeHtml(string) {
    const pre = document.createElement('pre');
    const text = document.createTextNode(string);
    pre.appendChild(text);

    const htmlWithPars = pre.innerHTML.replace(/\n/g, "</p><p>");

    return '<p>' + htmlWithPars + '</p>';
}

const $connectionStatus = $("#connection-status");
const $needsConnection = $(".needs-connection");
const $alreadyVisited = $("#already-visited");

browser.runtime.onMessage.addListener(request => {
    if (request.name === 'trilium-search-status') {
        const {triliumSearch} = request;

        let statusText = triliumSearch.status;
        let isConnected;

        if (triliumSearch.status === 'not-found') {
            statusText = `<span style="color: red">${t("not_found")}</span>`;
            isConnected = false;
        }
        else if (triliumSearch.status === 'version-mismatch') {
            const whatToUpgrade = triliumSearch.extensionMajor > triliumSearch.triliumMajor ? t("trilium_notes") : t("this_extension");

            statusText = `<span style="color: orange">${t("version_mismatch", {whatToUpgrade})}</span>`;
            isConnected = true;
        }
        else if (triliumSearch.status === 'found-desktop') {
            statusText = `<span style="color: green">${t("connected_port", {port: triliumSearch.port})}</span>`;
            isConnected = true;
        }
        else if (triliumSearch.status === 'found-server') {
            statusText = `<span style="color: green" title="Connected to ${triliumSearch.url}">${t("connected_server")}</span>`;
            isConnected = true;
        }

        $connectionStatus.html(statusText);

        if (isConnected) {
            $needsConnection.removeAttr("disabled");
            $needsConnection.removeAttr("title");
            browser.runtime.sendMessage({name: "trigger-trilium-search-note-url"});
        }
        else {
            $needsConnection.attr("disabled", "disabled");
            $needsConnection.attr("title", t("action_needs_connection"));
        }
    }
    else if (request.name == "trilium-previously-visited"){
        const {searchNote} = request;
        if (searchNote.status === 'found'){
            const a = createLink({name: 'openNoteInTrilium', noteId: searchNote.noteId},
            t("open_in_trilium"))
            noteFound = t("already_visited");
            $alreadyVisited.html(noteFound);
            $alreadyVisited[0].appendChild(a);
        }else{
            $alreadyVisited.html('');
        }
        

    }
});

const $checkConnectionButton = $("#check-connection-button");

$checkConnectionButton.on("click", () => {
    browser.runtime.sendMessage({
        name: "trigger-trilium-search"
    })
});

// Initialize i18n and then send trilium search status
$(async () => {
    await initI18n();
    browser.runtime.sendMessage({name: "send-trilium-search-status"});
});
