// Import dependencies for service worker
importScripts('lib/browser-polyfill.js', 'utils.js', 'trilium_server_facade.js', 'i18n/i18n.js');

// Ensure triliumServerFacade is available globally
function getTriliumServerFacade() {
    // @ts-ignore
    return globalThis.triliumServerFacade || window?.triliumServerFacade;
}

// Initialize i18n for service worker
let i18nInitialized = false;
async function ensureI18nInitialized() {
    if (!i18nInitialized) {
        await initI18n();
        i18nInitialized = true;
    }
}

// Keyboard shortcuts
chrome.commands.onCommand.addListener(async function (command) {
    if (command == "saveSelection") {
        await saveSelection();
    } else if (command == "saveWholePage") {
        await saveWholePage();
    } else if (command == "saveTabs") {
        await saveTabs();
    } else if (command == "saveCroppedScreenshot") {
        const activeTab = await getActiveTab();

        await saveCroppedScreenshot(activeTab.url);
    } else {
        console.log("Unrecognized command", command);
    }
});

async function cropImage(newArea, dataUrl) {
	// Use offscreen document for DOM operations in service worker
	try {
		await chrome.offscreen.createDocument({
			url: 'offscreen.html',
			reasons: ['DOM_SCRAPING'],
			justification: 'Image cropping operations'
		});
	} catch (error) {
		// Document may already exist
		if (!error.message.includes('Only a single offscreen')) {
			throw error;
		}
	}

	return new Promise((resolve, reject) => {
		const messageId = Math.random().toString(36);

		const messageHandler = (message) => {
			if (message.id === messageId) {
				chrome.runtime.onMessage.removeListener(messageHandler);
				if (message.error) {
					reject(new Error(message.error));
				} else {
					resolve(message.result);
				}
			}
		};

		chrome.runtime.onMessage.addListener(messageHandler);

		chrome.runtime.sendMessage({
			type: 'CROP_IMAGE',
			id: messageId,
			newArea: newArea,
			dataUrl: dataUrl
		});
	});
}

async function takeCroppedScreenshot(cropRect) {
	const activeTab = await getActiveTab();
	const zoom = await browser.tabs.getZoom(activeTab.id);

	// Get device pixel ratio from content script since service workers don't have access to window
	const devicePixelRatio = await browser.tabs.sendMessage(activeTab.id, {name: 'get-device-pixel-ratio'});
	const totalZoom = zoom * (devicePixelRatio || 1);

	const newArea = Object.assign({}, cropRect);
	newArea.x *= totalZoom;
	newArea.y *= totalZoom;
	newArea.width *= totalZoom;
	newArea.height *= totalZoom;

	const dataUrl = await browser.tabs.captureVisibleTab(null, { format: 'png' });

	return await cropImage(newArea, dataUrl);
}

async function takeWholeScreenshot() {
	// this saves only visible portion of the page
	// workaround to save the whole page is to scroll & stitch
	// example in https://github.com/mrcoles/full-page-screen-capture-chrome-extension
	// see page.js and popup.js
	return await browser.tabs.captureVisibleTab(null, { format: 'png' });
}

browser.runtime.onInstalled.addListener(() => {
	if (isDevEnv()) {
		browser.action.setIcon({
			path: 'icons/logo3-dev_128x128.png',
		});
	}
});

// Create context menus with i18n support
async function createContextMenus() {
	await ensureI18nInitialized();

	browser.contextMenus.create({
		id: "trilium-save-selection",
		title: t("save_selection_context"),
		contexts: ["selection"]
	});

	browser.contextMenus.create({
		id: "trilium-clip-screenshot",
		title: t("clip_screenshot_context"),
		contexts: ["page"]
	});

	browser.contextMenus.create({
		id: "trilium-save-cropped-screenshot",
		title: t("crop_screenshot_context"),
		contexts: ["page"]
	});

	browser.contextMenus.create({
		id: "trilium-save-whole-screenshot",
		title: t("save_whole_screenshot_context"),
		contexts: ["page"]
	});

	browser.contextMenus.create({
		id: "trilium-save-page",
		title: t("save_page_context"),
		contexts: ["page"]
	});

	browser.contextMenus.create({
		id: "trilium-save-link",
		title: t("save_link_context"),
		contexts: ["link"]
	});

	browser.contextMenus.create({
		id: "trilium-save-image",
		title: t("save_image_context"),
		contexts: ["image"]
	});
}

// Initialize context menus
createContextMenus();

async function getActiveTab() {
	const tabs = await browser.tabs.query({
		active: true,
		currentWindow: true
	});

	return tabs[0];
}

async function getWindowTabs() {
	const tabs = await browser.tabs.query({
		currentWindow: true
	});

	return tabs;
}

async function sendMessageToActiveTab(message) {
	const activeTab = await getActiveTab();

	if (!activeTab) {
		throw new Error("No active tab.");
	}

	try {
		return await browser.tabs.sendMessage(activeTab.id, message);
	}
	catch (e) {
		throw e;
	}
}

function toast(message, noteId = null, tabIds = null) {
	sendMessageToActiveTab({
		name: 'toast',
		message: message,
		noteId: noteId,
		tabIds: tabIds
	});
}

function blob2base64(blob) {
	return new Promise(resolve => {
		const reader = new FileReader();
		reader.onloadend = function() {
			resolve(reader.result);
		};
		reader.readAsDataURL(blob);
	});
}

async function fetchImage(url) {
	const resp = await fetch(url);
	const blob = await resp.blob();

	return await blob2base64(blob);
}

async function postProcessImage(image) {
	if (image.src.startsWith("data:image/")) {
		image.dataUrl = image.src;
		image.src = "inline." + image.src.substr(11, 3); // this should extract file type - png/jpg
	}
	else {
		try {
			image.dataUrl = await fetchImage(image.src, image);
		}
		catch (e) {
			console.log(`Cannot fetch image from ${image.src}`);
		}
	}
}

async function postProcessImages(resp) {
	if (resp.images) {
		for (const image of resp.images) {
			await postProcessImage(image);
		}
	}
}

async function saveSelection() {
	const payload = await sendMessageToActiveTab({name: 'trilium-save-selection'});

	await postProcessImages(payload);

	const resp = await getTriliumServerFacade().callService('POST', 'clippings', payload);

	if (!resp) {
		return;
	}

	await ensureI18nInitialized();
	toast(t("selection_saved"), resp.noteId);
}

async function getImagePayloadFromSrc(src, pageUrl) {
	const image = {
		imageId: randomString(20),
		src: src
	};

	await postProcessImage(image);

	const activeTab = await getActiveTab();

	return {
		title: activeTab.title,
		content: `<img src="${image.imageId}">`,
		images: [image],
		pageUrl: pageUrl
	};
}

async function saveCroppedScreenshot(pageUrl) {
	const cropRect = await sendMessageToActiveTab({name: 'trilium-get-rectangle-for-screenshot'});

	const src = await takeCroppedScreenshot(cropRect);

	const payload = await getImagePayloadFromSrc(src, pageUrl);

	const resp = await getTriliumServerFacade().callService("POST", "clippings", payload);

	if (!resp) {
		return;
	}

	await ensureI18nInitialized();
	toast(t("screenshot_saved"), resp.noteId);
}

async function saveWholeScreenshot(pageUrl) {
	const src = await takeWholeScreenshot();

	const payload = await getImagePayloadFromSrc(src, pageUrl);

	const resp = await getTriliumServerFacade().callService("POST", "clippings", payload);

	if (!resp) {
		return;
	}

	await ensureI18nInitialized();
	toast(t("screenshot_saved"), resp.noteId);
}

async function saveImage(srcUrl, pageUrl) {
	const payload = await getImagePayloadFromSrc(srcUrl, pageUrl);

	const resp = await getTriliumServerFacade().callService("POST", "clippings", payload);

	if (!resp) {
		return;
	}

	await ensureI18nInitialized();
	toast(t("image_saved"), resp.noteId);
}

async function saveWholePage() {
	try {
		console.log("Starting saveWholePage...");

		const payload = await sendMessageToActiveTab({name: 'trilium-save-page'});
		console.log("Received payload from content script:", payload);

		await postProcessImages(payload);
		console.log("Images post-processed");

		const resp = await getTriliumServerFacade().callService('POST', 'notes', payload);
		console.log("Response from Trilium:", resp);

		if (!resp) {
			console.log("No response from Trilium server");
			return;
		}

		await ensureI18nInitialized();
		toast(t("page_saved"), resp.noteId);
		console.log("Page save completed successfully");
	} catch (error) {
		console.error("Error in saveWholePage:", error);
		await ensureI18nInitialized();
		toast(t("failed_to_save", {error: error.message}));
	}
}

async function saveLinkWithNote(title, content) {
	const activeTab = await getActiveTab();

	if (!title.trim()) {
		title = activeTab.title;
	}

	const resp = await getTriliumServerFacade().callService('POST', 'notes', {
		title: title,
		content: content,
		clipType: 'note',
		pageUrl: activeTab.url
	});

	if (!resp) {
		return false;
	}

	await ensureI18nInitialized();
	toast(t("link_saved"), resp.noteId);

	return true;
}

async function getTabsPayload(tabs) {
	let content = '<ul>';
	tabs.forEach(tab => {
		content += `<li><a href="${tab.url}">${tab.title}</a></li>`
	});
	content += '</ul>';

	const domainsCount = tabs.map(tab => tab.url)
		.reduce((acc, url) => {
			const hostname = new URL(url).hostname
			return acc.set(hostname, (acc.get(hostname) || 0) + 1)
		}, new Map());

	let topDomains = [...domainsCount]
		.sort((a, b) => {return b[1]-a[1]})
		.slice(0,3)
		.map(domain=>domain[0])
		.join(', ')

	if (tabs.length > 3) { topDomains += '...' }

	return {
		title: `${tabs.length} browser tabs: ${topDomains}`,
		content: content,
		clipType: 'tabs'
	};
}

async function saveTabs() {
	const tabs = await getWindowTabs();

	const payload = await getTabsPayload(tabs);

	const resp = await getTriliumServerFacade().callService('POST', 'notes', payload);

	if (!resp) {
		return;
	}

	const tabIds = tabs.map(tab=>{return tab.id});

	await ensureI18nInitialized();
	toast(t("tabs_saved"), resp.noteId, tabIds);
}

browser.contextMenus.onClicked.addListener(async function(info) {
	if (info.menuItemId === 'trilium-save-selection') {
		await saveSelection();
	}
	else if (info.menuItemId === 'trilium-clip-screenshot') {
		await saveWholeScreenshot(info.pageUrl);
	}
	else if (info.menuItemId === 'trilium-save-cropped-screenshot') {
		await saveCroppedScreenshot(info.pageUrl);
	}
	else if (info.menuItemId === 'trilium-save-whole-screenshot') {
		await saveWholeScreenshot(info.pageUrl);
	}
	else if (info.menuItemId === 'trilium-save-image') {
		await saveImage(info.srcUrl, info.pageUrl);
	}
	else if (info.menuItemId === 'trilium-save-link') {
		// Create HTML string directly instead of using DOM APIs
		const linkText = info.linkText || info.linkUrl;
		const linkHtml = `<a href="${info.linkUrl}">${linkText}</a>`;

		const activeTab = await getActiveTab();

		const resp = await getTriliumServerFacade().callService('POST', 'clippings', {
			title: activeTab.title,
			content: linkHtml,
			pageUrl: info.pageUrl
		});

		if (!resp) {
			return;
		}

		await ensureI18nInitialized();
		toast(t("link_saved"), resp.noteId);
	}
	else if (info.menuItemId === 'trilium-save-page') {
		await saveWholePage();
	}
	else {
		console.log("Unrecognized menuItemId", info.menuItemId);
	}
});

// Remove any existing listeners first
if (browser.runtime.onMessage.hasListeners()) {
	browser.runtime.onMessage.removeListener();
}

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
	console.log("=== BACKGROUND MESSAGE HANDLER ===");
	console.log("Received message:", request);
	console.log("Message name:", request.name);
	console.log("Message type:", typeof request.name);

	// Handle load-script command first and separately
	if (request.name === 'load-script') {
		console.log("=== LOAD-SCRIPT HANDLER TRIGGERED ===");
		console.log("File to load:", request.file);

		(async () => {
			try {
				const activeTab = await getActiveTab();
				console.log("Active tab ID:", activeTab.id);

				const result = await browser.scripting.executeScript({
					target: { tabId: activeTab.id },
					files: [request.file]
				});
				console.log("Script executed successfully:", request.file);
				sendResponse({success: true, result: result});
			} catch (error) {
				console.error("Failed to execute script:", error);
				sendResponse({success: false, error: error.message});
			}
		})();

		return true; // Keep message channel open for async response
	}

	// Handle other async operations
	(async () => {
		try {
			if (request.name === 'openNoteInTrilium') {
				const resp = await getTriliumServerFacade().callService('POST', 'open/' + request.noteId);

				if (!resp) {
					sendResponse({success: false});
					return;
				}

				// desktop app is not available so we need to open in browser
				if (resp.result === 'open-in-browser') {
					const {triliumServerUrl} = await browser.storage.sync.get("triliumServerUrl");

					if (triliumServerUrl) {
						const noteUrl = triliumServerUrl + '/#' + request.noteId;

						console.log("Opening new tab in browser", noteUrl);

						browser.tabs.create({
							url: noteUrl
						});
					}
					else {
						console.error("triliumServerUrl not found in local storage.");
					}
				}
				sendResponse({success: true});
			}
			else if (request.name === 'closeTabs') {
				const result = await browser.tabs.remove(request.tabIds);
				sendResponse({success: true, result: result});
			}
			else if (request.name === 'save-cropped-screenshot') {
				const activeTab = await getActiveTab();
				const result = await saveCroppedScreenshot(activeTab.url);
				sendResponse({success: true, result: result});
			}
			else if (request.name === 'save-whole-screenshot') {
				const activeTab = await getActiveTab();
				const result = await saveWholeScreenshot(activeTab.url);
				sendResponse({success: true, result: result});
			}
			else if (request.name === 'save-whole-page') {
				const result = await saveWholePage();
				sendResponse({success: true, result: result});
			}
			else if (request.name === 'save-link-with-note') {
				const result = await saveLinkWithNote(request.title, request.content);
				sendResponse({success: true, result: result});
			}
			else if (request.name === 'save-tabs') {
				const result = await saveTabs();
				sendResponse({success: true, result: result});
			}
			else if (request.name === 'trigger-trilium-search') {
				getTriliumServerFacade().triggerSearchForTrilium();
				sendResponse({success: true});
			}
			else if (request.name === 'send-trilium-search-status') {
				getTriliumServerFacade().sendTriliumSearchStatusToPopup();
				sendResponse({success: true});
			}
			else if (request.name === 'trigger-trilium-search-note-url') {
				const activeTab = await getActiveTab();
				getTriliumServerFacade().triggerSearchNoteByUrl(activeTab.url);
				sendResponse({success: true});
			}
			else {
				console.log("=== UNKNOWN COMMAND ===");
				console.log("Request name:", request.name);
				console.log("Request name type:", typeof request.name);
				console.log("Full request:", JSON.stringify(request));
				sendResponse({success: false, error: 'Unknown command: ' + request.name});
			}
		} catch (error) {
			console.error("Error in message handler:", error);
			sendResponse({success: false, error: error.message});
		}
	})();

	return true; // Keep message channel open for async response
});
