function absoluteUrl(url) {
	if (!url) {
		return url;
	}

	const protocol = url.toLowerCase().split(':')[0];
	if (['http', 'https', 'file'].indexOf(protocol) >= 0) {
		return url;
	}

	if (url.indexOf('//') === 0) {
		return location.protocol + url;
	} else if (url[0] === '/') {
		return location.protocol + '//' + location.host + url;
	} else {
		return getBaseUrl() + '/' + url;
	}
}

function pageTitle() {
	const titleElements = document.getElementsByTagName("title");

	return titleElements.length ? titleElements[0].text.trim() : document.title.trim();
}

function getReadableDocument() {
	// Readability directly change the passed document, so clone to preserve the original web page.
	const documentCopy = document.cloneNode(true);
	const readability = new Readability(documentCopy, {
		serializer: el => el // so that .content is returned as DOM element instead of HTML
	});

	const article = readability.parse();

	if (!article) {
		throw new Error('Could not parse HTML document with Readability');
	}

	return {
		title: article.title,
		body: article.content,
	}
}

function getDocumentDates() {
	var dates = {
		publishedDate: null,
		modifiedDate: null,  
	};
	
	const articlePublishedTime = document.querySelector("meta[property='article:published_time']");
	if (articlePublishedTime && articlePublishedTime.getAttribute('content')) {
		dates.publishedDate = new Date(articlePublishedTime.getAttribute('content'));
	}
	
	const articleModifiedTime = document.querySelector("meta[property='article:modified_time']");
	if (articleModifiedTime && articleModifiedTime.getAttribute('content')) {
		dates.modifiedDate = new Date(articleModifiedTime.getAttribute('content'));
	}
	
	// TODO: if we didn't get dates from meta, then try to get them from JSON-LD

	return dates;
}

function getRectangleArea() {
	return new Promise(async (resolve, reject) => {
		const overlay = document.createElement('div');
		overlay.style.opacity = '0.6';
		overlay.style.background = 'black';
		overlay.style.width = '100%';
		overlay.style.height = '100%';
		overlay.style.zIndex = 99999999;
		overlay.style.top = 0;
		overlay.style.left = 0;
		overlay.style.position = 'fixed';

		document.body.appendChild(overlay);

		const messageComp = document.createElement('div');

		const messageCompWidth = 300;
		messageComp.setAttribute("tabindex", "0"); // so that it can be focused
		messageComp.style.position = 'fixed';
		messageComp.style.opacity = '0.95';
		messageComp.style.fontSize = '14px';
		messageComp.style.width = messageCompWidth + 'px';
		messageComp.style.maxWidth = messageCompWidth + 'px';
		messageComp.style.border = '1px solid black';
		messageComp.style.background = 'white';
		messageComp.style.color = 'black';
		messageComp.style.top = '10px';
		messageComp.style.textAlign = 'center';
		messageComp.style.padding = '10px';
		messageComp.style.left = Math.round(document.body.clientWidth / 2 - messageCompWidth / 2) + 'px';
		messageComp.style.zIndex = overlay.style.zIndex + 1;

		// Load i18n for content script
		await requireLib('i18n/i18n.js');
		await initI18n();
		messageComp.textContent = t('drag_release_screenshot');

		document.body.appendChild(messageComp);

		const selection = document.createElement('div');
		selection.style.opacity = '0.5';
		selection.style.border = '1px solid red';
		selection.style.background = 'white';
		selection.style.border = '2px solid black';
		selection.style.zIndex = overlay.style.zIndex - 1;
		selection.style.top = 0;
		selection.style.left = 0;
		selection.style.position = 'fixed';

		document.body.appendChild(selection);

		messageComp.focus(); // we listen on keypresses on this element to cancel on escape

		let isDragging = false;
		let draggingStartPos = null;
		let selectionArea = {};

		function updateSelection() {
			selection.style.left = selectionArea.x + 'px';
			selection.style.top = selectionArea.y + 'px';
			selection.style.width = selectionArea.width + 'px';
			selection.style.height = selectionArea.height + 'px';
		}

		function setSelectionSizeFromMouse(event) {
			if (event.clientX < draggingStartPos.x) {
				selectionArea.x = event.clientX;
			}

			if (event.clientY < draggingStartPos.y) {
				selectionArea.y = event.clientY;
			}

			selectionArea.width = Math.max(1, Math.abs(event.clientX - draggingStartPos.x));
			selectionArea.height = Math.max(1, Math.abs(event.clientY - draggingStartPos.y));
			updateSelection();
		}

		function selection_mouseDown(event) {
			selectionArea = {x: event.clientX, y: event.clientY, width: 0, height: 0};
			draggingStartPos = {x: event.clientX, y: event.clientY};
			isDragging = true;
			updateSelection();
		}

		function selection_mouseMove(event) {
			if (!isDragging) return;
			setSelectionSizeFromMouse(event);
		}

		function removeOverlay() {
			isDragging = false;

			overlay.removeEventListener('mousedown', selection_mouseDown);
			overlay.removeEventListener('mousemove', selection_mouseMove);
			overlay.removeEventListener('mouseup', selection_mouseUp);

			document.body.removeChild(overlay);
			document.body.removeChild(selection);
			document.body.removeChild(messageComp);
		}

		function selection_mouseUp(event) {
			setSelectionSizeFromMouse(event);

			removeOverlay();

			console.info('selectionArea:', selectionArea);

			if (!selectionArea || !selectionArea.width || !selectionArea.height) {
				return;
			}

			// Need to wait a bit before taking the screenshot to make sure
			// the overlays have been removed and don't appear in the
			// screenshot. 10ms is not enough.
			setTimeout(() => resolve(selectionArea), 100);
		}

		function cancel(event) {
			if (event.key === "Escape") {
				removeOverlay();
			}
		}

		overlay.addEventListener('mousedown', selection_mouseDown);
		overlay.addEventListener('mousemove', selection_mouseMove);
		overlay.addEventListener('mouseup', selection_mouseUp);
		overlay.addEventListener('mouseup', selection_mouseUp);
		messageComp.addEventListener('keydown', cancel);
	});
}

function makeLinksAbsolute(container) {
	for (const link of container.getElementsByTagName('a')) {
		if (link.href) {
			link.href = absoluteUrl(link.href);
		}
	}
}

function getImages(container) {
	const images = [];

	for (const img of container.getElementsByTagName('img')) {
		if (!img.src) {
			continue;
		}

		const existingImage = images.find(image => image.src === img.src);

		if (existingImage) {
			img.src = existingImage.imageId;
		}
		else {
			const imageId = randomString(20);

			images.push({
				imageId: imageId,
				src: img.src
			});

			img.src = imageId;
		}
	}

	return images;
}

function createLink(clickAction, text, color = "lightskyblue") {
	const link = document.createElement('a');
	link.href = "javascript:";
	link.style.color = color;
	link.appendChild(document.createTextNode(text));
	link.addEventListener("click", () => {
		browser.runtime.sendMessage(null, clickAction)
	});

	return link
}

async function prepareMessageResponse(message) {
	console.info('Message: ' + message.name);

	if (message.name === "toast") {
		let messageText;

		if (message.noteId) {
			messageText = document.createElement('p');
			messageText.setAttribute("style", "padding: 0; margin: 0; font-size: larger;")
			messageText.appendChild(document.createTextNode(message.message + " "));
			// Load i18n for toast messages
			await requireLib('i18n/i18n.js');
			await initI18n();

			messageText.appendChild(createLink(
				{name: 'openNoteInTrilium', noteId: message.noteId},
				t("open_in_trilium")
			));

			// only after saving tabs
			if (message.tabIds) {
				messageText.appendChild(document.createElement("br"));
				messageText.appendChild(createLink(
					{name: 'closeTabs', tabIds: message.tabIds},
					t("close_saved_tabs"),
					"tomato"
				));
			}
		}
		else {
			messageText = message.message;
		}

		await requireLib('lib/toast.js');

		showToast(messageText, {
			settings: {
				duration: 7000
			}
		});
	}
	else if (message.name === "trilium-save-selection") {
		const container = document.createElement('div');

		const selection = window.getSelection();

		for (let i = 0; i < selection.rangeCount; i++) {
			const range = selection.getRangeAt(i);

			container.appendChild(range.cloneContents());
		}

		makeLinksAbsolute(container);

		const images = getImages(container);

		return {
			title: pageTitle(),
			content: container.innerHTML,
			images: images,
			pageUrl: getPageLocationOrigin() + location.pathname + location.search + location.hash
		};

	}
	else if (message.name === 'trilium-get-rectangle-for-screenshot') {
		return getRectangleArea();
	}
	else if (message.name === 'get-device-pixel-ratio') {
		return window.devicePixelRatio || 1;
	}
	else if (message.name === "trilium-save-page") {
		try {
			console.log("Starting to save page...");

			await requireLib("lib/JSDOMParser.js");
			console.log("JSDOMParser loaded");

			await requireLib("lib/Readability.js");
			console.log("Readability loaded");

			await requireLib("lib/Readability-readerable.js");
			console.log("Readability-readerable loaded");

			const {title, body} = getReadableDocument();
			console.log("Document parsed with Readability");

			makeLinksAbsolute(body);
			console.log("Links made absolute");

			const images = getImages(body);
			console.log("Images processed");

	        var labels = {};
			const dates = getDocumentDates();
			if (dates.publishedDate) {
				labels['publishedDate'] = dates.publishedDate.toISOString().substring(0, 10);
			}
			if (dates.modifiedDate) {
				labels['modifiedDate'] = dates.publishedDate.toISOString().substring(0, 10);
			}
			console.log("Dates processed");

			const result = {
				title: title,
				content: body.innerHTML,
				images: images,
				pageUrl: getPageLocationOrigin() + location.pathname + location.search,
				clipType: 'page',
				labels: labels
			};

			console.log("Page save completed successfully");
			return result;
		} catch (error) {
			console.error("Error in trilium-save-page:", error);
			throw error;
		}
	}
	else {
		throw new Error('Unknown command: ' + JSON.stringify(message));
	}
}

browser.runtime.onMessage.addListener(prepareMessageResponse);

const loadedLibs = [];

async function requireLib(libPath) {
	if (!loadedLibs.includes(libPath)) {
		// Check if the library is already available globally
		const libName = libPath.split('/').pop().split('.')[0];

		// For known libraries, check if they're already loaded
		if (libName === 'JSDOMParser' && typeof JSDOMParser !== 'undefined') {
			loadedLibs.push(libPath);
			return;
		}
		if (libName === 'Readability' && typeof Readability !== 'undefined') {
			loadedLibs.push(libPath);
			return;
		}
		if (libName === 'Readability-readerable' && typeof isProbablyReaderable !== 'undefined') {
			loadedLibs.push(libPath);
			return;
		}

		try {
			console.log(`Loading library: ${libPath}`);

			// Try background script method first
			try {
				const response = await browser.runtime.sendMessage({name: 'load-script', file: libPath});
				console.log(`Response for ${libPath}:`, response);

				if (response && response.success) {
					loadedLibs.push(libPath);
					console.log(`Successfully loaded library via background script: ${libPath}`);
					return;
				}
			} catch (bgError) {
				console.log(`Background script method failed for ${libPath}, trying direct injection:`, bgError);
			}

			// Fallback: try direct script injection
			const script = document.createElement('script');
			script.src = browser.runtime.getURL(libPath);

			return new Promise((resolve, reject) => {
				script.onload = () => {
					loadedLibs.push(libPath);
					console.log(`Successfully loaded library via direct injection: ${libPath}`);
					document.head.removeChild(script);
					resolve();
				};

				script.onerror = (error) => {
					console.error(`Failed to load library via direct injection: ${libPath}`, error);
					if (document.head.contains(script)) {
						document.head.removeChild(script);
					}
					reject(new Error(`Failed to load ${libPath}`));
				};

				document.head.appendChild(script);
			});

		} catch (error) {
			console.error(`Failed to load library ${libPath}:`, error);
			throw error;
		}
	}
}
