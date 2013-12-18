ASTool.RouteBrowseMixin = Ember.Mixin.create({

	pushRoute: function(route, label, animation, model) {
		this.get('controllers.application').pushRoute(route, label, animation, model);
	},

	popRoutes: function(route, animation) {
		this.get('controllers.application').popRoutes(route, animation);
	},

	popRoute: function(animation) {
		this.get('controllers.application').popRoute(animation);
	},

	transitionToRouteAnimated: function(route, animation, model) {
		if (Ember.testing) {
			// Disable animations during testing.
			if (model) {
				return this.transitionToRoute(route, model);
			} else {
				return this.transitionToRoute(route);
			}
		} else {
			return this._super.apply(this, arguments);
		}
	},

	openAccordion: function(accordionNumber) {
		$( ".accordion" ).accordion("option", "active", accordionNumber);
	},

	actions: {

		back: function(animation) {
			this.popRoute(animation);	
		},
	},
});


ASTool.AnnotationsController = Em.ArrayController.extend(ASTool.RouteBrowseMixin, {
	
	needs: ['application', 'annotation'],

	template: null,
	
	documentViewBinding: 'controllers.application.documentView',

	currentlySelectedElement: null,

	sprites: function() {
		return this.get('content').map(function(annotation) {
			if (annotation.get('element')) {
				return ASTool.AnnotationSprite.create({'annotation': annotation});
			} else {
				return null;
			}
		}).filter(function(annotation) {return annotation});
	}.property('content.@each.element', 'content.@each.highlighted'),
		
	addAnnotation: function() {
		var annotation = this.store.createRecord('annotation');
		annotation.set('name', 'Annotation ' + annotation.get('id').substring(0, 5));
		annotation.save().then(function() {
			this.editAnnotation(annotation);
		}.bind(this));
	},
	
	editAnnotation: function(annotation) {
		annotation.set('highlighted', false);
		this.pushRoute('annotation', annotation.get('name'), 'flip', annotation);
	},
	
	deleteAllAnnotations: function() {
		var annotations = this.get('content').toArray();
		annotations.invoke('deleteRecord');
		annotations.invoke('save');
	},

	saveAnnotations: function() {
		if (this.get('template')) {
			this.set('template.annotated_body', this.get('documentView').getAnnotatedDocument());
		}
	},

	actions: {
		
		editAnnotation: function(annotation) {
			this.editAnnotation(annotation);
		},

		addAnnotation: function() {
			this.addAnnotation();
		},
		
		deleteAnnotation: function(annotation) {
			annotation.deleteRecord();
			annotation.save().then(this.saveAnnotations.bind(this));
		},

		annotationHighlighted: function(annotation) {
			this.get('documentView').scrollToElement(annotation.get('element'));
		},
	},

	willEnter: function() {
		this.get('documentView').config({ mode: 'browse',
										  listener: this,
										  dataSource: this, });
	},
});


ASTool.AnnotationController = Em.ObjectController.extend(ASTool.RouteBrowseMixin, {

	needs: ['application', 'annotations'],
	
	mappingAttribute: null,
	
	documentViewBinding: 'controllers.application.documentView',

	currentlySelectedElement: null,

	_selectingIgnore: null,

	openAttributesOnShow: false,

	highlightedElement: null,
	
	selectingIgnore: function(key, selectingIgnore) {
		// FIXME: move this to the view.
		if (arguments.length > 1) {
			this.set('_selectingIgnore', selectingIgnore);
			$('#addIgnore').toggleClass('activeControlShadow');
		}
		return this._selectingIgnore;
	}.property('_selectingIgnore'),

	sprites: function() {
		var sprites = [];
		if (this.get('currentlySelectedElement')) {
			sprites.pushObject(ASTool.AnnotationSprite.create(
				{'annotation': this.content,
				 'highlighted': 'true'}));
		}

		if (this.highlightedElement) {
			sprites.pushObject(ASTool.ElementSprite.create({
				element: this.highlightedElement,
				fillColor: 'rgba(255,149,0,0.2)',
				strokeColor: 'rgba(255,149,0,0.6)',
				zPosition: 1000,
			}));
		}

		var annotationSprites = this.get('controllers.annotations.sprites').filter(function(sprite) {
			return sprite.get('annotation.id') != this.content.get('id');
		}.bind(this));

		var ignoredElements = this.get('model.ignores').map(function(ignore) {
			return ASTool.IgnoreSprite.create({ ignore: ignore });
		});

		return sprites.concat(annotationSprites).concat(ignoredElements);
	}.property('currentlySelectedElement',
			   'controllers.annotations.sprites',
			   'model.ignores.@each.highlighted',
			   'highlightedElement'),
	
	clearGeneratedIns: function(insElement) {
		$(insElement).removePartialAnnotation();
	},
	
	cancelEdit: function(annotation) {
		// FIXME: If we are editing a partial annotation and we cancel we
		// may lose the partial annotation.
		this.set('selectingIgnore', false);
		this.set('documentView.restrictToDescendants', false);
		this.set('documentView.partialSelectionEnabled', true);
		annotation.set('selectedElement', null);
		var isPartial = this.get('isPartial');

		if (!annotation.get('element')) {
			annotation.deleteRecord();
			annotation.save();	
		} else {
			annotation.rollback();
			annotation.reload();
		}
		if (isPartial &&
			annotation.get('element') != this.get('currentlySelectedElement')) {
			this.clearGeneratedIns(this.get('currentlySelectedElement'));
		}
		this.set('currentlySelectedElement', null);
		this.popRoute('flip');
	},
	
	actions: {
		
		doneEditing: function(annotation) {
			annotation.save().then(function() {
				annotation.set('selectedElement', null);
				this.get('controllers.annotations').saveAnnotations();
				this.popRoute('flip');
			}.bind(this));
		},
		
		cancelEdit: function(annotation) {
			this.cancelEdit(annotation);
		},
		
		mapAttribute: function(attribute) {
			attribute.set('annotation', this.get('model'));
			this.set('mappingAttribute', attribute);
			this.set('openAttributesOnShow', true);
			this.pushRoute('items', 'Items', 'flip');
		},

		unmapAttribute: function(attribute) {
			this.content.removeMapping(attribute.name);
		},
		
		addIgnore: function() {
			this.set('documentView.restrictToDescendants', this.get('element'));
			this.set('documentView.partialSelectionEnabled', false);
			this.set('selectingIgnore', true);
		},

		deleteIgnore: function(ignore) {
			var ignores = this.get('ignores');
			ignores.removeObject(ignore);
		},

		highlightElement: function(element) {
			this.set('highlightedElement', element);
		},

		selectElement: function(element) {
			this.documentActions['elementSelected'].call(this, element);
		}
	},

	confirmChangeSelection: function() {
		return confirm('If you select a different region you will lose all the ignored regions and attribute mappings you defined, proceed anyway?');
	},
	
	documentActions: {
		
		elementSelected: function(element, partialSelection) {
			if (this.get('selectingIgnore')) {
				if (element) {
					this.content.addIgnore(element);	
				}
				this.set('selectingIgnore', false);
				this.set('documentView.restrictToDescendants', false);
				this.set('documentView.partialSelectionEnabled', true);
			} else {
				var needsConfirmation = this.get('ignores').length || this.get('mappedAttributes').length;
				if (!needsConfirmation || this.confirmChangeSelection()) {
					if (this.get('isPartial')) {
						this.clearGeneratedIns(this.get('currentlySelectedElement'));	
					}
					this.openAccordion(0);
					this.set('highlightedElement', null);
					this.content.set('selectedElement', element);
					this.content.set('isPartial', !!partialSelection);
					this.content.removeIgnores();
					this.content.removeMappings();
					this.set('currentlySelectedElement', element);
				}
			}
		},
		
		partialSelection: function(selection) {
			var element = $('<ins/>').get(0);
			selection.getRangeAt(0).surroundContents(element);
			this.documentActions['elementSelected'].call(this, element, true);
			selection.collapse();
		},
	},

	willEnter: function() {
		this.get('documentView').config({ mode: 'select',
										  listener: this,
										  dataSource: this,
										  partialSelects: true });
		this.set('currentlySelectedElement', this.get('element'));
		if (this.get('openAttributesOnShow')) {
			Em.run.later(this, function() {
				this.openAccordion(1);
			}, 100);
			this.set('openAttributesOnShow', false);
		}
	},

	willLeave: function() {
		this.set('selectingIgnore', false);
	},
});


ASTool.ItemsController = Em.ArrayController.extend(ASTool.RouteBrowseMixin, {
	
	needs: ['application', 'annotation'],

	documentViewBinding: 'controllers.application.documentView',
	
	mappingAttributeBinding: 'controllers.annotation.mappingAttribute',

	addItem: function() {
		var newItem = ASTool.Item.create({ name: 'new item' });
		this.pushObject(newItem);
	},
	
	addField: function(owner) {
		var newField = ASTool.ItemField.create({ name: 'new field' });
		owner.fields.pushObject(newField);
	},

	actions: {
		
		addItem: function() {
			this.addItem();
		},
		
		addField: function(item) {
			this.addField(item);
		},
		
		deleteItem: function(item) {
		},
	   
		chooseField: function(field) {
			var attribute = this.get('mappingAttribute');
			var annotation = attribute.get('annotation');
			annotation.addMapping(attribute.get('name'), field['name']);
			this.popRoute();
			this.set('mappingAttribute', null);	   
		},

		back: function() {
			this.set('mappingAttribute', null);
			this._super();
		},
	},

	willEnter: function() {
		this.set('documentView.canvas.interactionsBlocked', true);
	},

	willLeave: function() {
		this.set('documentView.canvas.interactionsBlocked', false);
		ASTool.api.saveItems(this.content.toArray());
	},
});


ASTool.SpiderController = Em.ObjectController.extend(ASTool.RouteBrowseMixin, {
	
	needs: ['application', 'annotations'],

	documentViewBinding: 'controllers.application.documentView',

	loadedUrl: null,

	loadedPageData: null,

	newStartUrl: '',

	newExcludePattern: '',

	hasStartUrl: function() {
		return !this.get('newStartUrl');
	}.property('newStartUrl'),

	hasExcludePattern: function() {
		return !this.get('newExcludePattern');
	}.property('newExcludePattern'),

	hasFollowPattern: function() {
		return !this.get('newFollowPattern');
	}.property('newFollowPattern'),

	displayLinksToFollow: function() {
		return this.content.get('links_to_follow') == 'patterns';
	}.property('model.links_to_follow'),

	editTemplate: function(template) {
		this.set('controllers.annotations.template', template);
		this.pushRoute('annotations', template.get('name'));
	},

	loadPage: function(url) {
		this.set('loadedUrl', null);
		var documentView = this.get('documentView');
		documentView.showLoading();
		ASTool.api.fetchDocument(url, this.content.get('name')).then(function(data) {
			documentView.hideLoading();
			if (!data.error) {
				documentView.displayAnnotatedDocument(data.page, 'browse_' + url,
					function(docIframe){
						this.set('loadedUrl', url);
						this.set('loadedPageData', data);
					}.bind(this)
				);
			} else {
				documentView.showError(data.error);
			}
		}.bind(this));
	},

	addTemplate: function() {
		var template = this.store.createRecord('template');
		template.set('id', ASTool.guid());
		this.content.get('templates').pushObject(template);
		this.get('controllers.annotations').deleteAllAnnotations();
		template.set('annotated_body', this.get('loadedPageData.page'));
		template.set('original_body', this.get('loadedPageData.page'));
		template.set('page_id', this.get('loadedPageData.fp'));
		template.set('url', this.get('loadedUrl'));
		this.editTemplate(template);
	},

	addStartUrl: function(url) {
		var parsedUrl = URI.parse(url);

		if (!parsedUrl.protocol) {
			parsedUrl.protocol = 'http';
			url = URI.build(parsedUrl);
		}
		this.content.get('start_urls').pushObject(url);
	},

	addExcludePattern: function(pattern) {
		this.content.get('exclude_patterns').pushObject(pattern);
	},

	addFollowPattern: function(pattern) {
		this.content.get('follow_patterns').pushObject(pattern);
	},
	
	actions: {

		editTemplate: function(template) {
			this.editTemplate(template);
		},

		addTemplate: function() {
			this.addTemplate();
		},

		deleteTemplate: function(template) {
			this.content.get('templates').removeObject(template);
		},

		saveSpider: function() {
			this.content.save();
		},

		loadPage: function(url) {
			this.loadPage(url);
		},

		addStartUrl: function() {
			this.addStartUrl(this.get('newStartUrl'));
			this.set('newStartUrl', '');
		},

		deleteStartUrl: function(url) {
			this.content.get('start_urls').removeObject(url);
		},

		addExcludePattern: function() {
			this.addExcludePattern(this.get('newExcludePattern'));
			this.set('newExcludePattern', '');
		},

		deleteExcludePattern: function(pattern) {
			this.content.get('exclude_patterns').removeObject(pattern);
		},

		addFollowPattern: function() {
			this.addFollowPattern(this.get('newFollowPattern'));
			this.set('newFollowPattern', '');
		},

		deleteFollowPattern: function(pattern) {
			this.content.get('follow_patterns').removeObject(pattern);
		},
	},

	documentActions: {

		linkClicked: function(url) {
			var parsedUrl = URI.parse(url);
			var parsedCurrentUrl = URI.parse(this.get('loadedUrl'));

			if (!parsedUrl.protocol) {
				parsedCurrentUrl.path = parsedUrl.path;
				url = URI.build(parsedCurrentUrl);
			}
			this.loadPage(url);	
		}
	},

	willEnter: function() {
		this.set('loadedUrl', null);
		this.set('loadedPageData',  null);
		this.get('documentView').config({ mode: 'browse',
										  listener: this,
										  dataSource: this });
		this.get('documentView').showSpider();
	},
});

ASTool.ProjectController = Em.ArrayController.extend(ASTool.RouteBrowseMixin, {

	needs: ['application'],

	documentViewBinding: 'controllers.application.documentView',

	actions: {

		editSpider: function(spiderName) {
			this.pushRoute('spider', spiderName, 'fade', spiderName);
		},

		addSpider: function() {
			// Find a unique spider name.
			var newSpiderName = ASTool.guid().substring(0, 5);
			while(this.content.any(function(spiderName){ return spiderName == newSpiderName })) {
				newSpiderName += '0';
			}
			var spider = this.store.createRecord('spider', { 'id': newSpiderName });
			this.pushObject(spider.get('name'));
			spider.save();
		},

		gotoItems: function() {
			this.pushRoute('items', 'Items');
		},
	},

	willEnter: function() {
		this.get('documentView').showSpider();	
	},
});

ASTool.NavRoute = Em.Object.extend({
	route: null,
	label: null,
	model: null,
});

ASTool.ApplicationController = Em.Controller.extend(ASTool.RouteBrowseMixin, {

	modelMap: {},

	labelMap: {},

	routeStack: [],
	
	documentView: null,

	pushRoute: function(route, label, animation, model) {
		if (this.routeStack.filterBy('route', route).length) {
			// Don't go if the route is already in the stack.
			return;
		}
		animation = animation || 'fade';
		var navRoute = ASTool.NavRoute.create({route: route, label: label, model: model});
		this.routeStack.pushObject(navRoute);
		if (model) {
			this.transitionToRouteAnimated(route, {main: animation}, model);		
		} else {
			this.transitionToRouteAnimated(route, {main: animation});
		}
	},

	popRoutes: function(route, animation) {
		animation = animation || 'fade';
		var navRoute = this.routeStack.filterBy('route', route).get('firstObject');
		if (navRoute) {
			var tmp = this.routeStack.toArray();
			var found = false;
			tmp.forEach(function(navRoute) {
				if (found) {
					this.routeStack.removeObject(navRoute);
				}
				if (navRoute.route == route) {
					found = true;
				}
			}.bind(this));
			var lastRoute = this.routeStack.get('lastObject');
			if (lastRoute.model) {
				this.transitionToRouteAnimated(lastRoute.route, {main: animation}, lastRoute.model);	
			} else {
				this.transitionToRouteAnimated(lastRoute.route, {main: animation});
			}
		}
	},

	popRoute: function(animation) {
		if (this.routeStack.length > 1) {
			this.popRoutes(this.routeStack[this.routeStack.length - 2].route, animation);
		}
	},
	
	actions: {

		gotoRoute: function(route, animation) {
			this.popRoutes(route, animation);
		},
	},

	currentPathDidChange: function() {
		// Always reset the document view when leaving a route.
		this.get('documentView').reset();			
  	}.observes('currentPath'),

  	willDestroy: function() {
  		this.routeStack.length = 0;
  	},
});
