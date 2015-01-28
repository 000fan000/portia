/**
	Displays an html document as the content of an iframe which
	id is given by the iframeId property. A new document can be set at
	any time by calling the displayDocument method.

	Using the config method, it can be told to forward selection and browse
	events to a registered event listener. It can also be configured to
	render ASTool.Sprite instances by specifying an appropriate datasource.
*/


/**
	Datasources must include and implement this Mixin.
*/
ASTool.DocumentViewDataSource = Em.Mixin.create({
	sprites: Em.required(),
}),


/**
	Event listeners must include and implement this Mixin.
*/
ASTool.DocumentViewListener = Em.Mixin.create({
	documentActions: {

		// Browse mode.
		linkClicked: function(href) {},

		// Selection mode.
		elementSelected: function(element, mouseX, mouseY) {},

		// Selection mode.
		elementHovered: function(element, mouseX, mouseY) {},

		// Selection mode with partial selections enabled.
		partialSelection: function(textSelection, mouseX, mouseY) {},
	}
}),


ASTool.DocumentView = Em.Object.extend({

	iframeId: 'scraped-doc-iframe',

	dataSource: null,

	listener: null,

	canvas: null,

	ignoredElementTags: ['html', 'body'],

	mouseDown: false,

	loader: null,

	loadingDoc: false,

	cssEnabled: true,

	/**
		Attaches this documentview to a datasource and event listener
		configuring it according to the options dictionary.
		The options dictionary may contain:

		datasource: the datasource that will be attached.
		listener: the event listener will be attached.
		mode: a string. Possible values are 'select' and 'browse'.
		partialSelects: boolean. Whether to allow partial selections. It only
			has effect for the 'select' mode.
	*/
	config: function(options) {
		this.set('dataSource', options.dataSource);
		this.set('listener', options.listener);
		if (options.mode == 'select') {
			this.set('elementSelectionEnabled', true);
			this.set('partialSelectionEnabled', options.partialSelects);
		} else if (options.mode == 'browse') {
			this.installEventHandlersForBrowsing();
		}
	},

	/**
		Detaches the datasource and event listener. Internally,
		it also unbinds all event handlers.
	*/
	reset: function() {
		this.uninstallEventHandlers();
		this.set('elementSelectionEnabled', false);
		this.set('partialSelectionEnabled', false);
		this.set('dataSource', null);
		this.set('listener', null);
	},

	/**
		Set this property to a DOM element if you want to restrict element
		selection to the children of the given element.
	*/
	restrictToDescendants: null,

	/**
		Returns the document iFrame contents.
	*/
	getIframe: function() {
		return $('#' + this.get('iframeId')).contents();
	},

	/**
		Redraws all datasource sprites and the hovered element (if in select
		mode). This method can be called manually but it gets called
		automatically:

			- Once 10 seconds.
			- After a window resize or iframe scroll.
			- The sprites exposed by the datasource change.
	*/
	redrawNow: function() {
		var canvas = this.get('canvas');
		if (!canvas || this.loadingDoc) {
			return;
		}
		canvas = this.get('canvas');
		if (this.get('dataSource')) {
			var sprites = this.get('dataSource.sprites') || [];
			if (this.get('hoveredSprite')) {
				sprites = sprites.concat([this.get('hoveredSprite')]);
			}
			canvas.draw(sprites,
						this.getIframe().scrollLeft(),
						this.getIframe().scrollTop());
		} else {
			canvas.clear();
		}
	}.observes('dataSource', 'dataSource.sprites.@each'),

	/**
		Blocks/unblocks interactions with the document.
	*/
	setInteractionsBlocked: function(blocked) {
		this.set('canvas.interactionsBlocked', blocked);
	},

	/**
		Displays a document by setting it as the content of the iframe.
		readyCallback will be called when the document finishes rendering.
	*/
	displayDocument: function(documentContents, readyCallback) {
		Em.run.schedule('afterRender', this, function() {
			this.set('loadingDoc', true);
			this.setIframeContent(documentContents);
			// We need to disable all interactions with the document we are loading
			// until we trigger the callback.
			this.setInteractionsBlocked(true);
			Em.run.later(this, function() {
				var doc = document.getElementById(this.get('iframeId')).contentWindow.document;
				doc.onscroll = this.redrawNow.bind(this);
				this.setInteractionsBlocked(false);
				if (readyCallback) {
					readyCallback(this.getIframe());
				}
				this.set('loadingDoc', false);
			}, 1000);
		});
	},

	/**
		Returns the content of the document currently displayed by the
		iframe.
	*/
	getAnnotatedDocument: function() {
		return this.getIframe().find('html').get(0).outerHTML;
	},


	getAnnotations: function() {
		var iframe = this.getIframe();
		var annotations = {};
		// Find all annotated elements
		var inline = iframe.find(':hasAttrWithPrefix("data-scrapy-")');
		for (i=0; i < inline.length; i++) {
			elem = inline[i];
			annotation = [];
			tagid = 0;
			that = $(elem);
			// Handle extra processing for generated tags
			if (elem.tagName == 'INS') {
				var previous_tag = that.prev();
				var nodes;
				insert_after = true;
				// Next nearest tag is the parent of this element
				if (previous_tag.length === 0) {
					previous_tag = that.parent();
					nodes = previous_tag[0].childNodes;
					insert_after = false;
				} else {
					// Find the next nearest non generated tag
					while (previous_tag.prop('tagName') === 'INS') {
						previous_tag = previous_tag.prev();
					}
					// Loop over all text nodes and generated tags until the
					// next tag is found
					nodes = [];
					node = previous_tag[0].nextSibling;
					while (node) {
						nodes.push(node);
						node = node.nextSibling;
						if (node === null ||
								(node.nodeType === node.ELEMENT_NODE &&
								 node.tagName !== 'INS')) {
							break;
						}
					}
				}
				if (!!previous_tag.data('tagid')) {
					tagid = '' + previous_tag.data('tagid');
					a = {};
					for (idx=0; idx < elem.attributes.length; idx++) {
						attr = elem.attributes[idx];
						if (attr.name.indexOf('data-scrapy-') === 0) {
							a[attr.name] = attr.value;
						}
					}
					a['generated'] = true;
					a['insert_after'] = insert_after;
					ins_json = elem.attributes['data-scrapy-annotate'].value;
					last_node_ins = false;
					start = 0;
					// Calculate the length and start position of the slice
					// ignoring the ins tag and with leading whitespace removed
					for (idx=0; idx < nodes.length; idx++) {
						node = nodes[idx];
						if (node.nodeType === node.ELEMENT_NODE &&
							node.tagName === 'INS') {
							last_node_ins = true;
							if (node.attributes['data-scrapy-annotate'].value === ins_json) {
								a['slice'] = [start, start + node.innerHTML.length];
								annotation.push(a);
								break;
							} else {
								// No need to strip ins elements
								start += node.innerHTML.length;
							}
						} else {
							// Need to remove external whitespace so that there
							// is no ambiguity in the start position of the
							// slice
							if (last_node_ins) {
								start += node.textContent.length;
							} else {
								start += node.textContent.lstrip().length;
							}
							last_node_ins = false;
						}
					}
				}
			} else {
				tagid = '' + that.data('tagid');
				for (idx=0; idx < elem.attributes.length; idx++) {
					attr = elem.attributes[idx];
					if (attr.name.indexOf('data-scrapy-') === 0) {
						a = {};
						if (attr.name.indexOf('data-scrapy-ignore') === 0)
							a[attr.name] = "true";
						else
							a[attr.name] = attr.value;
						annotation.push(a);
					}
				}
			}
			// Add annotation(s) for final output
			if (Array.isArray(annotations[tagid])) {
				for (j=0; j < annotation.length; j++) {
					annotations[tagid].push(annotation[j]);
				}
			} else {
				annotations[tagid] = annotation;
			}
		}
		return annotations;
	},

	/**
		Displays a loading widget on top of the iframe. It should be removed
		by calling hideLoading.
	*/
	showLoading: function() {
		this.setInteractionsBlocked(true);
		var loader = this.get('loader');
		if (!loader) {
			loader = new CanvasLoader('loader-container');
			loader.setColor('#2398b2');
			loader.setShape('spiral');
			loader.setDiameter(90);
			loader.setRange(0.9);
			loader.setSpeed(1.0);
			loader.setFPS(60);
			var loaderObj = document.getElementById("canvasLoader");
			loaderObj.style.position = "absolute";
			loaderObj.style["margin-left"] = -loader.getDiameter() / 2 + "px";
			loaderObj.style["margin-top"] = '180px';
			loaderObj.style["width"] = loader.getDiameter() + "px";
			loaderObj.style["left"] = '50%';
			this.set('loader', loader);
		}
		loader.show();
	},

	/**
		Hides the loading widget displayed by a previous call to showLoading.
	*/
	hideLoading: function() {
		if (this.get('loader')) {
			this.get('loader').hide();
		}
		this.setInteractionsBlocked(false);
	},

	/**
		Displays an error message as the content of the iframe.
	*/
	showError: function(error) {
		error = '<div style="color:red;font-size:1.2em;padding:15px">' + error + '</div>';
		Em.run.schedule('afterRender', this, function() {
			this.setIframeContent(error);
		});
	},

	/**
		Displays the spider image place holder as the content of the
		iframe.
	*/
	showSpider: function() {
		Em.run.schedule('afterRender', this, function() {
			if (!Ember.testing){
				ic.ajax('start.html').then(function(page) {
					this.setIframeContent(page);
				}.bind(this));
			}
		});
	},

	toggleCSS: function() {
		iframe = this.getIframe();
		if (this.cssEnabled) {
			iframe.find('link[rel="stylesheet"]').each(function() {
				$(this).renameAttr('href', '_href');
			});
			iframe.find('style').each(function() {
				that = $(this);
				that.renameAttr('type', '_type');
				that.attr('type', 'text/disabled');
			});
			iframe.find('[style]').each(function() {
				$(this).renameAttr('style', '_style');
			});
		} else {
			iframe.find('link[rel="stylesheet"]').each(function() {
				$(this).renameAttr('_href', 'href');
			});
			iframe.find('style').each(function() {
				$(this).renameAttr('_type', 'type');
			});
			iframe.find('*[_style]').each(function() {
				$(this).renameAttr('_style', 'style');
			});
		}
		this.redrawNow();
		this.cssEnabled = !this.cssEnabled;
	},

	/**
		Scrolls the iframe so the given element appears in the current
		viewport.
	*/
	scrollToElement: function(element) {
		var rect = $(element).boundingBox();
		if (Em.browser.isMozilla) {
			// Just scroll in FF as I couldn't make the animation work.
			this.getIframe().scrollTop(rect.top - 100);
			this.getIframe().scrollLeft(rect.left - 100);
		} else {
			this.getIframe().contents().children().animate(
				{ 'scrollTop': (rect.top - 100) + 'px', 'scrollLeft': (rect.left - 100) + 'px'},
				150);
		}
		this.updateHoveredInfo(element);
	},

	_elementSelectionEnabled: null,

	elementSelectionEnabled: function(key, selectionEnabled) {
		if (arguments.length > 1) {
			if (selectionEnabled) {
				if (!this.get('_elementSelectionEnabled')) {
					this.set('_elementSelectionEnabled', true);
					this.showHoveredInfo();
					this.installEventHandlersForSelecting();
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

	installEventHandlersForBrowsing: function() {
		this.uninstallEventHandlers();
		this.getIframe().bind('click', this.clickHandlerBrowse.bind(this));
	},

	installEventHandlersForSelecting: function() {
		this.uninstallEventHandlers();
		this.getIframe().bind('click', this.clickHandler.bind(this));
		this.getIframe().bind('mouseover', this.mouseOverHandler.bind(this));
		this.getIframe().bind('mouseout', this.mouseOutHandler.bind(this));
		this.getIframe().bind('mousedown', this.mouseDownHandler.bind(this));
		this.getIframe().bind('mouseup', this.mouseUpHandler.bind(this));
		this.getIframe().bind('hover', function(event) {event.preventDefault();});
		this.redrawNow();
	},

	uninstallEventHandlers: function() {
		this.getIframe().unbind('click');
		this.getIframe().unbind('mouseover');
		this.getIframe().unbind('mouseout');
		this.getIframe().unbind('mousedown');
		this.getIframe().unbind('mouseup');
		this.getIframe().unbind('hover');
		this.set('hoveredSprite', null);
	},

	setIframeContent: function(contents) {
		if (Ember.testing || Ember.browser.isMozilla) {
			this.getIframe().find('html').html(contents);
		} else {
			document.getElementById(this.get('iframeId')).srcdoc = contents;
		}
	},

	showHoveredInfo: function() {
		$("#hovered-element-info").css('display', 'inline');
	},

	hideHoveredInfo: function() {
		$("#hovered-element-info").css('display', 'none');
	},

	initHoveredInfo: function() {
		var contents = '<div>' +
			'<span class="path"/>' +
			'<button class="btn btn-light fa fa-icon fa-arrow-right"/>' +
			'</div>' +
			'<div class="attributes"/>';
		$('#hovered-element-info').html(contents);
		$('#hovered-element-info button').button()
			.click(function() {
				element = $('#hovered-element-info');
				button = element.find('button');
				button.removeClass('fa-arrow-right');
				button.removeClass('fa-arrow-left');
				var floatPos = element.css('float');
				var icon;
				if (floatPos == 'left') {
					floatPos = 'right';
					button.addClass('fa-arrow-left');
				} else {
					floatPos = 'left';
					button.addClass('fa-arrow-right');
				}
				element.css('float', floatPos);
			});
	},

	updateHoveredInfo: function(element) {
		var path = $(element).getPath();
		var attributes = $(element).getAttributeList();
		var attributesHtml = '';
		$(attributes).each(function(i, attribute) {
			var value = trim(attribute.get('value'), 50);
			attributesHtml += '<div class="attribute" style="margin:2px 0px 2px 0px">' +
							  	'<span>' + attribute.get('name') + ": </span>" +
							  	'<span style="color:#AAA">' + value + '</span>' +
							  '</div>';
		});
		$('#hovered-element-info .attributes').html(attributesHtml);
		$('#hovered-element-info .path').html(path);
	},

	sendElementHoveredEvent: function(element, delay, mouseX, mouseY) {
		var handle = this.get('elementHoveredHandle');
		if (handle) {
			Em.run.cancel(handle);
			this.set('elementHoveredHandle', null);
		}
		if (delay) {
			handle = Em.run.later(this, function() {
				this.sendDocumentEvent('elementHovered', element, mouseX, mouseY);
			}, delay);
			this.set('elementHoveredHandle', handle);
		} else {
			this.sendDocumentEvent('elementHovered', element, mouseX, mouseY);
		}
	},

	mouseOverHandler:  function(event) {
		event.preventDefault();
		var target = event.target;
		var tagName = $(target).prop("tagName").toLowerCase();
		if ($.inArray(tagName, this.get('ignoredElementTags')) == -1 &&
			!this.mouseDown) {
			if (!this.get('restrictToDescendants') ||
				$(target).isDescendant(this.get('restrictToDescendants'))) {
				if (!this.get('hoveredSprite')) {
					this.updateHoveredInfo(target);
					this.set('hoveredSprite',
							 ASTool.ElementSprite.create({'element': target}));
					this.redrawNow();
					this.sendElementHoveredEvent(target, 0, event.clientX, event.clientY);
				}
			}
		}
	},

	mouseOutHandler: function(event) {
		this.set('hoveredSprite', null);
		if (!Em.browser.isMozilla) {
			// Firefox fires this event when the annotation widget
			// pops up, causing for the widget to disappear. Supressing
			// the call to sendElementHoveredEvent deals with the issue
			// but may prevent the widget from hiding appropriately.
			this.sendElementHoveredEvent(null, 0);
		}
		this.redrawNow();
	},

	clickHandler: function(event) {
		event.preventDefault();
	},

	clickHandlerBrowse: function(event) {
		event.preventDefault();
		var linkingElement = $(event.target).closest('[href]');
		if (linkingElement.length) {
			var href = $(linkingElement).get(0).href;
			this.sendDocumentEvent('linkClicked', href);
		}
	},

	mouseDownHandler: function(event) {
		if (event.target.draggable) {
			// Disable dragging of images, links, etc...
			// This interferes with partial selection of links,
			// but it's a lesser evil than dragging.
			event.preventDefault();
		}
		this.set('hoveredSprite', null);
		this.set('mouseDown', true);
		this.redrawNow();
	},

	mouseUpHandler: function(event) {
		this.set('mouseDown', false);
		var selectedText = this.getIframeSelectedText();
		if (selectedText) {
			if (this.get('partialSelectionEnabled')) {
				if (selectedText.anchorNode == selectedText.focusNode) {
					this.sendDocumentEvent(
						'partialSelection', selectedText, event.clientX, event.clientY);
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
					this.sendDocumentEvent('elementSelected', target, event.clientX, event.clientY);
				} else {
					this.sendDocumentEvent('elementSelected', null);
				}
			}
		}
	},

	sendDocumentEvent: function(name) {
		var actions = this.get('listener.documentActions');
		var args = Array.prototype.slice.call(arguments, 1);
		if (actions && actions[name]) {
			Em.run(function(){
				actions[name].apply(this.get('listener'), args);
			}.bind(this));
		}
	},

	getIframeSelectedText: function() {
		var range = this.getIframe().get(0).getSelection();
		if (range && !range.isCollapsed) {
			return range;
		} else {
			return null;
		}
	},

	initCanvas: function() {
		if (!this.get('canvas')) {
			this.set('canvas', ASTool.Canvas.create({ canvasId: 'infocanvas' }));
			this.initHoveredInfo();
			if (!Ember.testing){
				// Disable automatic redrawing during tests.
				var self = this;
				this.set('autoRedrawId', setInterval(function() {
					Ember.run(function(){
						self.redrawNow();
					});
				}, 5000));
				window.resize = function() {
					this.redrawNow();
				}.bind(this);
			}
		}
	},
});
