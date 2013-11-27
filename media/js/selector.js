ASTool.DocumentView = Em.Object.extend({

	dataSource: null,

	listener: null,

	iframe: null,
	
	restrictToDescendants: false,
	
	_spritesBinding: 'dataSource.sprites',

	canvas: null,

	ignoredElementTags: ['html', 'body'],

	mouseDown: 0,

	sprites: function() {
		if (!this.get('dataSource')) {
			return [];
		} else {
			return this.get('_sprites');
		}
	}.property('_sprites.@each'),

	_elementSelectionEnabled: null,
	
	elementSelectionEnabled: function(key, selectionEnabled) {
		if (arguments.length > 1) {
			if (selectionEnabled) {
			    if (!this.get('_elementSelectionEnabled')) {
					this.set('_elementSelectionEnabled', true);
					this.showHoveredInfo();
					this.installEventHandlers();
				}
			} else {
				this.set('_elementSelectionEnabled', false);
				this.uninstallEventHandlers();
				this.hideHoveredInfo();
			}
		} else {
			return this.get('_elementSelectionEnabled');
		}
	}.property('_elementSelectionEnabled'),

	partialSelectionEnabled: false,
	
	redrawNow: function() {
		this.get('canvas').draw();
	}.observes('sprites'),

	installEventHandlers: function() {
		this.uninstallEventHandlers();
		this.iframe.bind('click', null, this.clickHandler.bind(this));
		this.iframe.bind('mouseover', null, this.mouseOverHandler.bind(this));
		this.iframe.bind('mouseout', null, this.mouseOutHandler.bind(this));
		this.iframe.bind('mousedown', null, this.mouseDownHandler.bind(this));
		this.iframe.bind('mouseup', null, this.mouseUpHandler.bind(this));
		this.iframe.bind('hover', null, function(event) {event.preventDefault()});
		this.get('canvas').draw();
	},

	uninstallEventHandlers: function() {
		this.iframe.unbind('click');
		this.iframe.unbind('mouseover');
		this.iframe.unbind('mouseout');
		this.iframe.unbind('mousedown');
		this.iframe.unbind('mouseup');
		this.iframe.unbind('hover');	
		this.set('hoveredSprite', null);
	},

	showHoveredInfo: function() {
		$("#hoveredInfo").css('display', 'inline');
	},

	hideHoveredInfo: function() {
		$("#hoveredInfo").css('display', 'none');
	},

	updateHoveredInfo: function(element) {
		var path = $(element).getPath();
		var attributes = $(element).getAttributeList();
		var contents = '<div>' + path + '</div><hr style="background-color:#FCDDB1;"/>';
		$(attributes).each(function(i, attribute) {
			var value = attribute.get('value');
			if (value.length > 100) {
				value = value.substring(0, 100) + '...';
			}
			contents += '<div class="hoveredInfoLine">' + attribute.get('name') + ": " + value + '</div>';
		});
		$("#hoveredInfo").html(contents);
	},

	mouseOverHandler:  function(event) {
		event.preventDefault();
		var target = event.target;
		var tagName = $(target).prop("tagName").toLowerCase();
		if ($.inArray(tagName, this.get('ignoredElementTags')) == -1 &&
			this.mouseDown == 0) {
			if (!this.get('restrictToDescendants') ||
				$(target).isDescendant(this.get('restrictToDescendants'))) {
				if (!this.get('hoveredSprite')) {
					this.updateHoveredInfo(target);
					this.set('hoveredSprite',
							 ASTool.ElementSprite.create({'element': target}));
					this.get('canvas').draw();
				}
			}
		}
	},
	
	mouseOutHandler: function(event) {
		this.set('hoveredSprite', null);
		this.get('canvas').draw();
	},

	clickHandler: function(event) {
		event.preventDefault();
	},

	mouseDownHandler: function(event) {
		this.set('hoveredSprite', null);
		++this.mouseDown;
		this.get('canvas').draw();
	},

	mouseUpHandler: function(event) {
		--this.mouseDown;
		var selectedText = this.getIframeSelectedText();
		if (selectedText) {
			if (this.get('partialSelectionEnabled')) {
				if (selectedText.anchorNode == selectedText.focusNode) {
					this.sendEvent('partialSelection', selectedText);
				} else {
					alert('The selected text must belong to a single HTML element');
					selectedText.collapse();
				}
			} else {
				selectedText.collapse();
			}
		} else {
			var target = event.target;
			var tagName = $(target).prop("tagName").toLowerCase();
			if ($.inArray(tagName, this.get('ignoredElementTags')) == -1) {
				if (!this.get('restrictToDescendants') ||
					$(target).isDescendant(this.get('restrictToDescendants'))) {
					this.sendEvent('elementSelected', target);
				} else {
					this.sendEvent('elementSelected', null);
				}
			}
		}
	},

	sendEvent: function(name, target) {
		var actions = this.get('listener.documentActions');
		if (actions && actions[name]) {
			actions[name].bind(this.get('listener'))(target);
		}
	},

	getIframeSelectedText: function() {
		var range = this.iframe.get(0).getSelection();
		if (range && !range.isCollapsed) {
			return range;
		} else {
			return null;
		}
	},

	initCanvas: function() {
		var canvas = ASTool.Canvas.create({canvasId: 'infocanvas',
										   datasource: this})
		this.set('canvas', canvas);
		this.set('autoRedrawId', setInterval(canvas.draw.bind(canvas), 1000));
		window.onresize = function() {
			$('#scraped-doc-iframe').height(window.innerHeight * 0.99);
			$('#toolbar').height(window.innerHeight);
			this.get('canvas').draw().bind(this);
		};
		var doc = document.getElementById('scraped-doc-iframe').contentWindow.document;
		doc.onscroll = canvas.draw.bind(canvas);
	},

	loadAnnotatedDocument: function(pageUrl, loadedCallback) {
		this.iframe = $('#scraped-doc-iframe').contents();
		this.iframe.find('html').html('<html><body>Loading...</body></html>');
		if (this.get('autoRedrawId')) {
			clearInterval(this.get('autoRedrawId'));
		}
		hash = {};
		hash.type = 'POST';
		hash.data = JSON.stringify({spider: 'test', request: {url: pageUrl}});
		hash.success = function(data) {
			$('#scraped-doc-iframe').contents().find('html').html(data.page);
			// FIXME
			setTimeout(loadedCallback, 1000, this.iframe);
			this.initCanvas();
		}.bind(this);
		hash.error = function(req, status, error) {
			console.log(error);
		};
		// FIXME: hardcode dummy 'test' project
		hash.url = 'http://localhost:9001/api/test/bot/fetch';
		$.ajax(hash);
	},
});

window.onresize = function() {
	$('#scraped-doc-iframe').height(window.innerHeight * 0.99);
	$('#toolbar').height(window.innerHeight);
}
