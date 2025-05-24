# Perspective crop
Simple vanilla javascript image crop with perspective adjust.

## Frontend

This project uses [Interact.JS](https://github.com/taye/interact.js) for handling the dragging corners. The code doesn't actually do the crop, but rather allows the user to set freely four corners of the image and gets the coordinates of the four adjusted points. 

The front end has been refactored partially with AI help. All Javascript is now in separated file `static/app.js`

The form submits the following parameters:
`original_height` and `original_width`  size of the original image  (width,height)
`points`  array containing x an y of the four adjusted points (top-left, top-right, bottom-right, bottom-left)
`image_file`  original uploaded file


## Backend

Python's FastApi and Gunicorn server which processes the image:
 - cropping the image according to the user adjusted points
 - adjusting the perspective
 - applying sharp mask to clean any blurring


### Installing backend

```
cd project-dir
python3 -m venv env
source env/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### Run backend

`uvicorn main:app`

You could use other server-side languages or tools for this processing (e.g. Imagemagick).

![perspective crop image javascript](example.png "Interface")
