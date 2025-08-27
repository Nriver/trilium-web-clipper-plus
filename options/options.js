const $triliumServerUrl = $("#trilium-server-url");
const $triliumServerPassword = $("#trilium-server-password");

const $errorMessage = $("#error-message");
const $successMessage = $("#success-message");

const $autoClipPatterns = $("#auto-clip-patterns");
const $saveAutoClipBtn = $("#save-auto-clip");
const $includeUrlInNote = $("#include-url-in-note");

function showError(message) {
    $errorMessage.html(message).show();
    $successMessage.hide();
}

function showSuccess(message) {
    $successMessage.html(message).show();
    $errorMessage.hide();
}

async function saveTriliumServerSetup(e) {
    e.preventDefault();

    if ($triliumServerUrl.val().trim().length === 0
        || $triliumServerPassword.val().trim().length === 0) {
        showError(t("missing_inputs"));

        return;
    }

    let resp;

    try {
        resp = await fetch($triliumServerUrl.val() + '/api/login/token', {
            method: "POST",
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                password: $triliumServerPassword.val()
            })
        });
    }
    catch (e) {
        showError(t("unknown_error", {message: e.message}));
        return;
    }

    if (resp.status === 401) {
        showError(t("incorrect_credentials"));
    }
    else if (resp.status !== 200) {
        showError(t("unrecognised_response", {status: resp.status}));
    }
    else {
        const json = await resp.json();

        showSuccess(t("auth_successful"));

        $triliumServerPassword.val('');

        browser.storage.sync.set({
            triliumServerUrl: $triliumServerUrl.val(),
            authToken: json.token
        });

        await restoreOptions();
    }
}

const $triliumServerSetupForm = $("#trilium-server-setup-form");
const $triliumServerConfiguredDiv = $("#trilium-server-configured");
const $triliumServerLink = $("#trilium-server-link");
const $resetTriliumServerSetupLink = $("#reset-trilium-server-setup");

$resetTriliumServerSetupLink.on("click", e => {
    e.preventDefault();

    browser.storage.sync.set({
        triliumServerUrl: '',
        authToken: ''
    });

    restoreOptions();
});

$triliumServerSetupForm.on("submit", saveTriliumServerSetup);

const $triliumDesktopPort = $("#trilium-desktop-port");
const $triilumDesktopSetupForm = $("#trilium-desktop-setup-form");

$triilumDesktopSetupForm.on("submit", e => {
    e.preventDefault();

    const port = $triliumDesktopPort.val().trim();
    const portNum = parseInt(port);

    if (port && (isNaN(portNum) || portNum <= 0 || portNum >= 65536)) {
        showError(t("invalid_port"));
        return;
    }

    browser.storage.sync.set({
        triliumDesktopPort: port
    });

    showSuccess(t("port_saved"));
});

function saveAutoClipPatterns() {
    const patterns = $autoClipPatterns.val();
    browser.storage.sync.set({
        autoClipPatterns: patterns
    });
    showSuccess(t("auto_clip_patterns_saved"));
}

function saveIncludeUrlInNote() {
    const includeUrl = $includeUrlInNote.prop('checked');
    browser.storage.sync.set({
        includeUrlInNote: includeUrl
    });
    showSuccess(t("include_url_setting_saved"));
}

async function restoreOptions() {
    const {triliumServerUrl} = await browser.storage.sync.get("triliumServerUrl");
    const {authToken} = await browser.storage.sync.get("authToken");

    $errorMessage.hide();
    $successMessage.hide();

    $triliumServerUrl.val('');
    $triliumServerPassword.val('');

    if (triliumServerUrl && authToken) {
        $triliumServerSetupForm.hide();
        $triliumServerConfiguredDiv.show();

        $triliumServerLink
            .attr("href", triliumServerUrl)
            .text(triliumServerUrl);
    }
    else {
        $triliumServerSetupForm.show();
        $triliumServerConfiguredDiv.hide();
    }

    const {triliumDesktopPort} = await browser.storage.sync.get("triliumDesktopPort");
    $triliumDesktopPort.val(triliumDesktopPort);

    const {autoClipPatterns} = await browser.storage.sync.get("autoClipPatterns");
    $autoClipPatterns.val(autoClipPatterns || '');

    const {includeUrlInNote} = await browser.storage.sync.get("includeUrlInNote");
    $includeUrlInNote.prop('checked', includeUrlInNote || false);
}

// Language selector functionality
const $languageSelect = $("#language-select");

$languageSelect.on("change", async (e) => {
    const selectedLanguage = e.target.value;
    await changeLanguage(selectedLanguage);
});

// Auto-clip pattern save button
$saveAutoClipBtn.on("click", (e) => {
    e.preventDefault();
    saveAutoClipPatterns();
});

// Include URL in note checkbox change handler
$includeUrlInNote.on("change", () => {
    saveIncludeUrlInNote();
});

// Initialize i18n and restore options
$(async () => {
    console.log('Options page initializing...');
    console.log('Available globals:', {
        browser: typeof browser,
        chrome: typeof chrome,
        initI18n: typeof initI18n,
        $: typeof $
    });
    
    try {
        console.log('Initializing i18n...');
        await initI18n();
        console.log('i18n initialized successfully');

        // Set language selector to current language
        $languageSelect.val(getCurrentLanguage());
        console.log('Language selector set to:', getCurrentLanguage());

        console.log('Restoring options...');
        await restoreOptions();
        console.log('Options restored successfully');
    } catch (error) {
        console.error('Error initializing options page:', error);
    }
});
