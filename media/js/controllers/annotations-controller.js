ASTool.MappedFieldData = Em.Object.extend({
	fieldName: null,
	extractors: [],
	required: false,
}),


ASTool.AnnotationsController = Em.ArrayController.extend(ASTool.RouteBrowseMixin,
	ASTool.DocumentViewDataSource, ASTool.DocumentViewListener, {
	
	needs: ['application', 'annotation'],

	template: null,

	items: null,

	scrapedItem: function() {
		if (!Em.isEmpty(this.get('items'))) {
			return this.get('items').findBy('name', this.get('template.scrapes'));	
		} else {
			return null;
		}
	}.property('template.scrapes', 'items.@each'),
	
	documentView: null,

	currentlySelectedElement: null,

	nameBinding: 'template.templateName',

	newReExtractor: null,

	_newTypeExtractor: 'null',

	url: function() {
		var url = this.get('template.url');
		if (url.length > 80) {
			url = url.substring(0, 80) + '...';
		}
		return url;
	}.property('template.url'),

	newTypeExtractor: function(key, type) {
		if (arguments.length > 1) {
			this.set('_newTypeExtractor', type);
			if (type) {
				this.set('newReExtractor', null);
			}
		}
		return this.get('_newTypeExtractor');
	}.property('_newTypeExtractor'),

	createExtractorDisabled: function() {
		return !this.get('newTypeExtractor') && !this.get('newReExtractor');
	}.property('newReExtractor', 'newTypeExtractor'),

	sprites: function() {
		return this.get('content').map(function(annotation) {
			if (annotation.get('element')) {
				return ASTool.AnnotationSprite.create({'annotation': annotation});
			} else {
				return null;
			}
		}).filter(function(sprite) { return !!sprite; });
	}.property('content.@each.element', 'content.@each.highlighted'),

	guessInitialMapping: function(annotation) {
		// Very simple implementation. Only works if we are scraping the 
		// default item.
		if (this.get('template.scrapes') != 'default') {
			annotation.addMapping('content', this.get('scrapedItem.fields').get('firstObject.name'));
		} else {
			var element = annotation.get('element');
			var attributes = annotation.get('attributes');
			if (attributes.findBy('name', 'src')) {
				annotation.addMapping('src', 'image');
			} else if (attributes.findBy('name', 'href')) {
				annotation.addMapping('href', 'link');
			} else {
				annotation.addMapping('content', 'text');
			}
		}
	},
		
	addAnnotation: function(element, isPartial) {
		var annotation = this.store.createRecord('annotation');
		annotation.set('selectedElement', element);
		annotation.set('annotations', {});
		annotation.set('required', []);
		annotation.set('isPartial', !!isPartial);
		this.guessInitialMapping(annotation);
		annotation.save().then(function() {
			annotation.set('selectedElement', null);
			this.saveAnnotations();
		}.bind(this));
	},

	mapAttribute: function(annotation, attribute, field) {
		annotation.removeMappings();
		annotation.addMapping(attribute, field);
		annotation.save().then(this.saveAnnotations.bind(this));
	},
	
	editAnnotation: function(annotation) {
		annotation.set('highlighted', false);
		annotation.set('template', this.get('template'));
		this.pushRoute('annotation', 'Editing annotation', 'fade', annotation);
	},
	
	deleteAllAnnotations: function() {
		var annotations = this.get('content').toArray();
		annotations.invoke('deleteRecord');
		annotations.invoke('save');
	},

	removeMappings: function() {
		var annotations = this.get('content').toArray();
		annotations.invoke('removeMappings');
		annotations.invoke('save');
	},

	saveAnnotations: function() {
		console.log('saving annotations...');
		if (this.get('template')) {
			this.set('template.annotated_body', this.get('documentView').getAnnotatedDocument());
		}
	},

	saveExtractors: function() {
		// Cleanup extractor objects.
		this.get('extractors').forEach(function(extractor) {
			delete extractor['dragging'];
		});
		this.get('slyd').saveExtractors(this.get('extractors'));
	},

	maxVariant: function() {
		var maxVariant = 0;
		this.get('content').forEach(function(annotation) {
			var stringVariant = annotation.get('variant');
			var variant = stringVariant ? parseInt(stringVariant) : 0;
			maxVariant = variant > maxVariant ? variant : maxVariant;
		});
		return maxVariant;
	}.property('content.@each.variant'),

	maxSticky: function() {
		var maxSticky = 0;
		this.get('content').forEach(function(annotation) {
			annotation.get('stickyAttributes').forEach(function(stickyAttribute) {
				var sticky = parseInt(
					stickyAttribute.get('mappedField').substring('_sticky'.length));
				if (sticky > maxSticky) {
					maxSticky = sticky;
				}
			});
		});
		return maxSticky;
	}.property('content.@each.stickyAttributes.@each'),

	getAppliedExtractors: function(fieldName) {
		var extractorIds = this.get('template.extractors.' + fieldName) || [];
		return extractorIds.map(function(extractorId) {
				var extractor = this.get('extractors').filterBy('name', extractorId)[0];
				if (extractor) {
					extractor = extractor.copy();
					extractor['fieldName'] = fieldName;
					return extractor;
				} else {
					return null;	
				}
			}.bind(this)
		).filter(function(extractor){ return !!extractor });
	},

	mappedFieldsData: function() {
		var mappedFieldsData = [];
		var seenFields = new Em.Set();
		this.get('content').forEach(function(annotation) {
			var mappedAttributes = annotation.get('mappedAttributes');
			mappedAttributes.forEach(function(attribute) {
				var fieldName = attribute.get('mappedField');
				// Avoid duplicates.
				if (!seenFields.contains(fieldName)) {
					seenFields.add(fieldName);
					var mappedFieldData = ASTool.MappedFieldData.create();
					mappedFieldData.set('fieldName', fieldName);
					mappedFieldData.set('required', annotation.get('required').indexOf(fieldName) > -1);
					mappedFieldData.set('extractors', this.getAppliedExtractors(fieldName));
					mappedFieldsData.pushObject(mappedFieldData);
				}
			}.bind(this));
		}.bind(this));
		return mappedFieldsData;
	}.property('content.@each.mappedAttributes','template.extractors', 'extractors.@each'),

	annotationsMappingField: function(fieldName) {
		var annotations = new Em.Set();
		this.get('content').forEach(function(annotation) {
			var mappedAttributes = annotation.get('mappedAttributes');
			mappedAttributes.forEach(function(attribute) {
				if (attribute.get('mappedField') == fieldName) {
					annotations.add(annotation);
				}
			}.bind(this));
		}.bind(this));
		return annotations;
	},

	createExtractor: function(extractorType, extractorDefinition) {
		var extractor = ASTool.Extractor.create({
			name: ASTool.guid(),
		});
		extractor.set(extractorType, extractorDefinition);
		this.get('extractors').pushObject(extractor);
	},

	draggingExtractor: function() {
		return this.get('extractors').anyBy('dragging');
	}.property('extractors.@each.dragging'),

	actions: {
		
		editAnnotation: function(annotation) {
			this.editAnnotation(annotation);
		},

		mapAttribute: function(annotation, attribute, field) {
			this.mapAttribute(annotation, attribute, field);
		},
		
		deleteAnnotation: function(annotation) {
			annotation.deleteRecord();
			annotation.save().then(this.saveAnnotations.bind(this));
		},

		annotationHighlighted: function(annotation) {
			if (annotation.get('element')) {
				this.get('documentView').scrollToElement(annotation.get('element'));	
			}
		},

		rename: function(oldName, newName) {
			this.updateTop('Template: ' + newName);
		},

		createExtractor: function() {
			if (this.get('newReExtractor')) {
				this.createExtractor('regular_expression', this.get('newReExtractor'));
				this.set('newReExtractor', null);
			} else if (this.get('newTypeExtractor')) {
				this.createExtractor('type_extractor', this.get('newTypeExtractor'));	
			}
			this.saveExtractors();
		},

		deleteExtractor: function(extractor) {
			this.get('extractors').removeObject(extractor);
			this.saveExtractors();
		},

		applyExtractor: function(fieldName, extractorId) {
			var currentExtractors = this.get('template.extractors')[fieldName];
			if (!currentExtractors) {
				currentExtractors = [];
				this.set('template.extractors.' + fieldName, currentExtractors);
			}
			if (currentExtractors.indexOf(extractorId) == -1) {
				currentExtractors.pushObject(extractorId);
				this.notifyPropertyChange('template.extractors');
			}
		},

		removeAppliedExtractor: function(appliedExtractor) {
			// TODO: we need to automatically remove extractors when the field they
			// extract is no longer mapped from any annotation.
			var fieldName = appliedExtractor['fieldName'];
			this.get('template.extractors')[fieldName].removeObject(appliedExtractor['name']);
			this.notifyPropertyChange('template.extractors');
		},

		setRequired: function(fieldName, required) {
			var annotations = this.annotationsMappingField(fieldName);
			annotations.forEach(function(annotation) {
				if (required) {
					annotation.addRequired(fieldName);
				} else {
					annotation.removeRequired(fieldName);
				}
			});
			this.get('content').invoke('save');
			Ember.run.next(this, this.saveAnnotations);
		},

		editItems: function() {
			this.pushRoute('items', 'Items');
		},
	},

	documentActions: {
		
		elementSelected: function(element, partialSelection) {
			this.addAnnotation(element);
		},
		
		partialSelection: function(selection) {
			var element = $('<ins/>').get(0);
			selection.getRangeAt(0).surroundContents(element);
			this.addAnnotation(element, true);
			selection.collapse();
		},
	},

	willEnter: function() {
		this.get('documentView').config({ mode: 'select',
								  listener: this,
								  dataSource: this,
								  partialSelects: true });
	},
});
