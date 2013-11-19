How to try it:
--------------

The recommended way to install dependencies is to use virtualenv and
then do:

	pip install -r requirements.txt

Run the server using:

	twistd -n slyd

and point your browser to:
	http://localhost:9001/static/main.html

Only chrome is tested

What to expect:
---------------

It will load the now classical hoffman.html document. You will be able
to add annotations, delete them and map the attributes from the selected
document to item fields.

Most of the code is still an early prototype - expect it to be messy and
buggy for a while.


Slyd API Notes
--------------

This will be moved to separate docs - it's currently some notes for developers

bot/fetch

Accepts json object with the following fields:
* request - same as scrapy requst object. At least needs a url
* project - project for which to fetch the page
* spider - spider name within in the project
* page_id - unique ID for this page, must match the id used in templates (not yet implemented)

Returns a json object containing (so far:
* page - page content, not yet annotated but will be
* items - array of items extracted

To run put some data in data/projects/PROJECTID, these can be downloaded from dash or by:

$ bin/sh2sly data/projects -p 78 -k YOURAPIKEY

Then you can extract data:

$ curl -d '{"request": {"url": "http://www.pinterest.com/pin/339740365610932893/"}, "project": 78, "spider": "pinterest.com"}' http://localhost:9001/bot/fetch
{
   "items": [
      {
         "url": "http://www.pinterest.com/pin/339740365610932893/", 
         "_template": "527387aa4d6c7133c6551481", 
         "image": [
            "http://media-cache-ak0.pinimg.com/736x/6c/c5/35/6cc5352046df0f8d8852cbdfb31542bb.jpg"
         ], 
         "_type": "pin", 
         "name": [
            "Career Driven"
         ]
      }
   ], 
   "page": "<!DOCTYPE html>\n ...."
}