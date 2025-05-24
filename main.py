import base64
import io
import logging
import json
import math

import cv2
import numpy as np
import uvicorn
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Mount static files directory
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/", response_class=HTMLResponse)
async def read_root():
    try:
        with open("static/index.html") as f:
            return HTMLResponse(content=f.read(), status_code=200)
    except FileNotFoundError:
        logger.error("static/index.html not found")
        return HTMLResponse(content="Frontend not found.", status_code=500)


@app.post("/process-image/")
async def process_image(
    image_file: UploadFile = File(...),
    points: str = Form(...), # JSON string of points: "[x1,y1,x2,y2,x3,y3,x4,y4]"
    original_width: int = Form(...),
    original_height: int = Form(...)
):
    logger.info(f"Received image: {image_file.filename}, original_width: {original_width}, original_height: {original_height}")
    logger.info(f"Received points string (raw form data): {points}")

    try:
        # Read image
        contents = await image_file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img_cv = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img_cv is None:
            logger.error("Failed to decode image.")
            return JSONResponse(status_code=400, content={"message": "Invalid image file"})

        logger.info(f"Image decoded successfully. Shape: {img_cv.shape} (HxWxC)")

        # Parse points from JSON string
        # Points are expected as a flat list: [p1x, p1y, p2x, p2y, p3x, p3y, p4x, p4y]
        # Frontend order: Top-Left, Top-Right, Bottom-Right, Bottom-Left
        try:
            scaled_points_flat = json.loads(points)
        except json.JSONDecodeError:
            logger.error(f"Failed to parse points JSON: {points}")
            return JSONResponse(status_code=400, content={"message": "Invalid points JSON format."})

        if not isinstance(scaled_points_flat, list) or len(scaled_points_flat) != 8:
            logger.error(f"Invalid number of points or format: {len(scaled_points_flat)} points, type: {type(scaled_points_flat)}")
            return JSONResponse(status_code=400, content={"message": "Requires an array of 8 coordinates for 4 points."})

        # Reshape points to (4, 2) for OpenCV
        # Ensure points are float32
        src_pts = np.array(scaled_points_flat, dtype=np.float32).reshape((4, 2))
        logger.info(f"Source points for perspective transform (scaled to original image, TL, TR, BR, BL order expected): \n{src_pts}")


        # Define destination points for perspective transform (output rectangle)
        # The order of these points must correspond to the order of src_pts
        # src_pts order: Top-Left, Top-Right, Bottom-Right, Bottom-Left

        tl, tr, br, bl = src_pts # Unpack for clarity in dimension calculation

        # Calculate width of the new image based on the longer of the top/bottom edges of the selection
        width_a = np.sqrt(((br[0] - bl[0])**2) + ((br[1] - bl[1])**2)) # Length of bottom edge
        width_b = np.sqrt(((tr[0] - tl[0])**2) + ((tr[1] - tl[1])**2)) # Length of top edge
        max_width = max(int(width_a), int(width_b))


        # Let's calculate height based on the selected left/right edges first,
        # then decide if we override it with a fixed aspect ratio.
        height_from_selection_a = np.sqrt(((tr[0] - br[0])**2) + ((tr[1] - br[1])**2)) # Length of right edge
        height_from_selection_b = np.sqrt(((tl[0] - bl[0])**2) + ((tl[1] - bl[1])**2)) # Length of left edge
        max_height_from_selection = max(int(height_from_selection_a), int(height_from_selection_b))


        # For this example, let's enforce a portrait A4-like aspect ratio.
        # If the calculated max_width is likely the shorter dimension of the paper:
        A4_PORTRAIT_RATIO_H_W = math.sqrt(2)
        max_height = int(max_width * A4_PORTRAIT_RATIO_H_W)

        logger.info(f"Max width from selection: {max_width}")
        logger.info(f"Max height from selection (before aspect ratio adjustment): {max_height_from_selection}")
        logger.info(f"Target max height (after A4 portrait aspect ratio adjustment): {max_height}")


        if max_width <= 0 or max_height <=0: # Check adjusted max_height
            logger.error(f"Calculated max_width or max_height is zero or negative. Width: {max_width}, Adjusted Height: {max_height}. Points: {src_pts.tolist()}")
            # Fallback to selection height if adjusted height is problematic
            max_height = max_height_from_selection
            if max_height <=0:
                 return JSONResponse(status_code=400, content={"message": "Invalid points leading to zero/negative output dimensions even after fallback."})
            logger.warning(f"Falling back to max_height_from_selection: {max_height}")


        # Define the 4 corners of the output rectangle using the potentially adjusted max_height
        dst_pts = np.array([
            [0, 0],                          # Top-left corner of output
            [max_width - 1, 0],              # Top-right corner of output
            [max_width - 1, max_height - 1], # Bottom-right corner of output
            [0, max_height - 1]              # Bottom-left corner of output
        ], dtype=np.float32)

        logger.info(f"Destination points for perspective transform (output rectangle corners): \n{dst_pts}")
        logger.info(f"Calculated output dimensions for warped image: Width={max_width}, Height={max_height}")

        # Perform the perspective transform
        matrix = cv2.getPerspectiveTransform(src_pts, dst_pts)

        if matrix is None:
            logger.error("Failed to compute perspective transform matrix. Points might be collinear or invalid.")
            return JSONResponse(status_code=400, content={"message": "Could not compute perspective transform. Check point alignment."})

        logger.info(f"Perspective transform matrix: \n{matrix}")

        warped_image = cv2.warpPerspective(img_cv, matrix, (max_width, max_height))
        logger.info(f"Image warped successfully. Warped shape: {warped_image.shape}")

        # ---- Image Sharpening Step ----
        kernel = np.array([[-1,-1,-1],
                           [-1, 9,-1],
                           [-1,-1,-1]])

        # Apply the kernel to the warped image
        sharpened_image = cv2.filter2D(warped_image, -1, kernel)
        logger.info(f"Image sharpened successfully. Sharpened shape: {sharpened_image.shape}")


        # Encode processed image (now the sharpened one) to base64 to send to frontend
        success, img_encoded_buffer = cv2.imencode(".png", sharpened_image) # Use sharpened_image
        if not success:
            logger.error("Failed to encode sharpened image to PNG.")
            return JSONResponse(status_code=500, content={"message": "Failed to encode processed image."})

        img_base64 = base64.b64encode(img_encoded_buffer).decode("utf-8")

        return JSONResponse(content={
            "message": "Image processed successfully",
            "processed_image": "data:image/png;base64," + img_base64
        })

    except json.JSONDecodeError as e:
        logger.exception(f"JSON parsing error: {e}")
        return JSONResponse(status_code=400, content={"message": f"Invalid points format: {e}"})
    except Exception as e:
        logger.exception("An error occurred during image processing.")
        return JSONResponse(status_code=500, content={"message": f"An internal error occurred: {str(e)}"})

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
