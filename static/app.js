import interact from 'https://cdn.interactjs.io/v1.10.11/interactjs/index.js';

let scaling_factor_w;
let scaling_factor_h;
let origW;
let origH;
let currentPointsOnDisplayedImage = []; // Stores [x1,y1,x2,y2,x3,y3,x4,y4] for displayed image

const imageElement = document.getElementById('imageToCrop');
const wrapperElement = document.getElementById('wrapper');
const svgOverlayElement = document.getElementById('svgOverlay');
// console.log('DEBUG: svgOverlayElement right after declaration:', svgOverlayElement); 
const fogPathElement = document.getElementById('fogPath');
// console.log('DEBUG: fogPathElement right after declaration:', fogPathElement); 
const imageUploadElement = document.getElementById('imageUpload');
const submitBtn = document.getElementById('submitBtn');
const processedImageElement = document.getElementById('processedImage');
const statusMessageElement = document.getElementById('statusMessage');

const draggableElements = {
    p1: document.getElementById('p1'),
    p2: document.getElementById('p2'),
    p3: document.getElementById('p3'),
    p4: document.getElementById('p4'),
};

function updatePolygonAndPoints() {
    const displayedPoints = [];
    // Order: p1 (TL), p2 (TR), p3 (BR), p4 (BL)
    console.log("--- Updating Polygon ---"); // General log to see if function is called

    ['p1', 'p2', 'p3', 'p4'].forEach((id, index) => {
        const dragEl = draggableElements[id];

        // Detailed logging for the first point (p1) for clarity during debugging
        if (index === 0) { // Only log verbosely for p1 to avoid console spam
            console.log(`--- Debug Point ${id} ---`);
            console.log(`Element style.left: '${dragEl.style.left}', style.top: '${dragEl.style.top}'`);
        }

        const initialLeft = parseFloat(dragEl.style.left || "0"); // Ensure string "0" if style is empty
        const initialTop = parseFloat(dragEl.style.top || "0");  // Ensure string "0" if style is empty
        
        const dataX = dragEl.getAttribute('data-x');
        const dataY = dragEl.getAttribute('data-y');
        const translateX = parseFloat(dataX || "0");
        const translateY = parseFloat(dataY || "0");

        if (index === 0) {
            console.log(`InitialLeft: ${initialLeft}, InitialTop: ${initialTop}`);
            console.log(`Attribute data-x: '${dataX}', data-y: '${dataY}'`);
            console.log(`TranslateX: ${translateX}, TranslateY: ${translateY}`);
            console.log(`OffsetWidth: ${dragEl.offsetWidth}, OffsetHeight: ${dragEl.offsetHeight}`);
        }

        const x = initialLeft + translateX + (dragEl.offsetWidth / 2);
        const y = initialTop + translateY + (dragEl.offsetHeight / 2);
        
        if (index === 0) {
            console.log(`Calculated center x: ${x}, y: ${y}`);
        }
        
        displayedPoints.push(x, y);
    });
    currentPointsOnDisplayedImage = displayedPoints;
    // console.log("Displayed Points for SVG:", JSON.stringify(currentPointsOnDisplayedImage));


    const imgWidth = imageElement.offsetWidth;
    const imgHeight = imageElement.offsetHeight;

    if (!fogPathElement) {
        console.error("ERROR: fogPathElement is null in updatePolygonAndPoints. Cannot draw fog.");
        return;
    }

    if (imgWidth > 0 && imgHeight > 0 && currentPointsOnDisplayedImage.length === 8) {
        const p = currentPointsOnDisplayedImage;
        const pathData = `M0,0 H${imgWidth} V${imgHeight} H0 Z ` +
                         `M${p[0]},${p[1]} L${p[2]},${p[3]} L${p[4]},${p[5]} L${p[6]},${p[7]} Z`;
        // console.log("SVG Path Data:", pathData);
        fogPathElement.setAttribute('d', pathData);
    } else {
        // console.log("Skipping fog path update (imgWidth/Height or points invalid)");
        fogPathElement.setAttribute('d', '');
    }
}

function initializeDraggablePoints(imgDisplayWidth, imgDisplayHeight) {
    const pointSize = draggableElements.p1.offsetWidth;

    Object.values(draggableElements).forEach(el => {
        el.style.transform = 'translate(0px, 0px)';
        el.setAttribute('data-x', '0');
        el.setAttribute('data-y', '0');
    });
    
    draggableElements.p1.style.top = `0px`;
    draggableElements.p1.style.left = `0px`;
    draggableElements.p2.style.top = `0px`;
    draggableElements.p2.style.left = `${imgDisplayWidth - pointSize}px`;
    draggableElements.p3.style.top = `${imgDisplayHeight - pointSize}px`;
    draggableElements.p3.style.left = `${imgDisplayWidth - pointSize}px`;
    draggableElements.p4.style.top = `${imgDisplayHeight - pointSize}px`;
    draggableElements.p4.style.left = `0px`;

    updatePolygonAndPoints();
}

function setupImage(imageUrl) {
    imageElement.src = imageUrl;
    imageElement.style.display = 'block';
    wrapperElement.style.display = 'block';
    processedImageElement.style.display = 'none';
    statusMessageElement.textContent = 'Loading image...';

    imageElement.onload = () => {
        origW = imageElement.naturalWidth;
        origH = imageElement.naturalHeight;

        if (origW === 0 || origH === 0) {
            console.error("Image natural dimensions are zero. Image might be invalid or not loaded.");
            statusMessageElement.textContent = "Error: Image data is invalid or not fully loaded.";
            wrapperElement.style.display = 'none';
            return;
        }

        let displayWidthForWrapper;
        let displayHeightForWrapper;
        const MAX_DISPLAY_WIDTH = Math.min(window.innerWidth * 0.9, 800);
        const MAX_DISPLAY_HEIGHT = Math.min(window.innerHeight * 0.8, 700);

        if (origW > MAX_DISPLAY_WIDTH || origH > MAX_DISPLAY_HEIGHT) {
            const widthRatio = MAX_DISPLAY_WIDTH / origW;
            const heightRatio = MAX_DISPLAY_HEIGHT / origH;
            const scale = Math.min(widthRatio, heightRatio); 
            displayWidthForWrapper = origW * scale;
            displayHeightForWrapper = origH * scale;
        } else {
            displayWidthForWrapper = origW;
            displayHeightForWrapper = origH;
        }
        
        wrapperElement.style.width = `${displayWidthForWrapper}px`;
        wrapperElement.style.height = `${displayHeightForWrapper}px`;

        setTimeout(() => {
            const actualDisplayedWidth = imageElement.offsetWidth;
            const actualDisplayedHeight = imageElement.offsetHeight;

            // console.log(`Image Loaded: Natural WxH: ${origW}x${origH}`);
            // console.log(`Wrapper target WxH: ${displayWidthForWrapper.toFixed(2)}x${displayHeightForWrapper.toFixed(2)}`);
            // console.log(`Image actual displayed WxH: ${actualDisplayedWidth}x${actualDisplayedHeight}`);
            
            // console.log('DEBUG: svgOverlayElement inside setTimeout, before setAttribute:', svgOverlayElement);
            if (!svgOverlayElement) {
                console.error('ERROR: svgOverlayElement is NULL or UNDEFINED at the point of setAttribute!');
                statusMessageElement.textContent = "Critical Error: SVG Overlay element not found. Cannot draw fog.";
                return; 
            }
            if (!fogPathElement) {
                 console.error('ERROR: fogPathElement is NULL or UNDEFINED before initializeDraggablePoints!');
                 statusMessageElement.textContent = "Critical Error: SVG Fog Path element not found.";
                 return;
            }

            if (actualDisplayedWidth === 0 || actualDisplayedHeight === 0) {
                console.error("Image displayed dimensions are zero even after setting wrapper. Check CSS or layout timing.");
                statusMessageElement.textContent = "Error: Image failed to render with correct dimensions.";
                return;
            }

            scaling_factor_w = origW / actualDisplayedWidth;
            scaling_factor_h = origH / actualDisplayedHeight;

            // console.log(`Scaling factors: W=${scaling_factor_w}, H=${scaling_factor_h}`);

            svgOverlayElement.setAttribute('viewBox', `0 0 ${actualDisplayedWidth} ${actualDisplayedHeight}`);
            svgOverlayElement.setAttribute('width', actualDisplayedWidth);
            svgOverlayElement.setAttribute('height', actualDisplayedHeight);
            
            initializeDraggablePoints(actualDisplayedWidth, actualDisplayedHeight);
            statusMessageElement.textContent = 'Image loaded. Adjust points.';
        }, 50); 

    };

    imageElement.onerror = () => {
        console.error("Error loading image source.");
        statusMessageElement.textContent = "Error: Could not load the selected image file.";
        wrapperElement.style.display = 'none';
    };
}


imageUploadElement.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            setupImage(e.target.result);
        }
        reader.readAsDataURL(file);
    }
});

interact('.draggable').draggable({
    modifiers: [
        interact.modifiers.restrictRect({
            restriction: 'parent',
            endOnly: false
        })
    ],
    listeners: {
        move(event) {
            const target = event.target;
            let x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
            let y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;

            target.style.transform = `translate(${x}px, ${y}px)`;
            target.setAttribute('data-x', x);
            target.setAttribute('data-y', y);

            updatePolygonAndPoints();
        }
    }
});


submitBtn.addEventListener('click', () => {
    if (!imageUploadElement.files || imageUploadElement.files.length === 0) {
        statusMessageElement.textContent = 'Please upload an image first.';
        return;
    }
    if (currentPointsOnDisplayedImage.length !== 8) {
        statusMessageElement.textContent = 'Points not initialized correctly or image not fully loaded.';
        return;
    }
     if (!origW || !origH || !scaling_factor_w || !scaling_factor_h ) {
        statusMessageElement.textContent = 'Image properties (origW, origH, scaling factors) not set. Please re-upload.';
        return;
    }

    statusMessageElement.textContent = 'Processing...';

    const pointsForBackend = currentPointsOnDisplayedImage.map((coord, index) => {
        const scale = index % 2 === 0 ? Number(scaling_factor_w) : Number(scaling_factor_h);
        return coord * scale;
    });

    // console.log("--- Frontend Data for Backend ---");
    // console.log("currentPointsOnDisplayedImage (displayed GUI coords):", JSON.stringify(currentPointsOnDisplayedImage));
    // console.log(`scaling_factor_w: ${scaling_factor_w}, scaling_factor_h: ${scaling_factor_h}`);
    // console.log(`origW (natural): ${origW}, origH (natural): ${origH}`);
    // console.log("pointsForBackend (scaled to original image):", JSON.stringify(pointsForBackend));

    const formData = new FormData();
    formData.append('image_file', imageUploadElement.files[0]);
    formData.append('points', JSON.stringify(pointsForBackend));
    formData.append('original_width', Math.round(origW));
    formData.append('original_height', Math.round(origH));

    fetch('/process-image/', {
        method: 'POST',
        body: formData,
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { throw new Error(err.detail || err.message || `HTTP error! status: ${response.status}`) });
        }
        return response.json();
    })
    .then(data => {
        // console.log('Response from backend:', data);
        if (data.processed_image) {
            processedImageElement.src = data.processed_image;
            processedImageElement.style.display = 'block';
            statusMessageElement.textContent = 'Image processed successfully!';
        } else {
            statusMessageElement.textContent = data.message || 'Failed to process image.';
        }
    })
    .catch(error => {
        console.error('Error submitting for processing:', error);
        statusMessageElement.textContent = `Error: ${error.message}`;
    });
});

if (window.safari) {
    history.pushState(null, null, location.href);
    window.onpopstate = function(event) {
        history.go(1);
    };
}
