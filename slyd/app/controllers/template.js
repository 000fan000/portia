import Ember from 'ember';
import BaseController from './base-controller';
import Extractor from '../models/extractor';
import MappedFieldData from '../models/mapped-field-data';
import SpriteStore from '../utils/sprite-store';

export default BaseController.extend({

    model: null,

    needs: ['application', 'projects', 'project', 'spider', 'spider/index'],

    breadCrumb: function() {
        return this.get('content.name');
    }.property('content.name'),

    annotations: [],

    plugins: {},

    showContinueBrowsing: true,

    showToggleCSS: true,

    showFloatingAnnotationWidgetAt: null,

    floatingAnnotation: null,

    extractionTools: {},

    activeExtractionTool: {
        data: {extracts: []},
        pluginState: {},
        sprites: new SpriteStore()
    },

<<<<<<< HEAD
    enableExtractionTool: function(tool) {
        // Convert old format to new
        var tool_parts = tool.split('.'),
            tool_name = tool_parts[tool_parts.length - 1];
        if (tool_name === 'annotations-plugin' &&
                !this.get('model.plugins.annotations-plugin')) {
            this.set('model.plugins.annotations-plugin', {
                'extracts': this.get('annotationsStore').findAll()
            });
        } else if (!this.get('model.plugins.' + tool_name)){
            this.set('model.plugins.' + tool_name, {
                'extracts': []
            });
        }
        if (!this.get('extractionTools.' + tool_name)) {
            this.set('extractionTools.' + tool_name, {
                data: this.get('model.plugins.' + tool_name),
                pluginState: {},
                sprites: new SpriteStore({}),
                component: tool_name,
                options: this.getWithDefault('plugins.' + tool.replace(/\./g, '_'), {})
            });
        }

        this.set('activeExtractionTool', this.get('extractionTools.' + tool_name));
        this.get('documentView').config({
            mode: 'select',
            listener: this,
            dataSource: this,
            partialSelects: true,
        });
        this.set('documentView.sprites', this.get('activeExtractionTool.sprites'));
    },

=======
>>>>>>> Port App to Ember-Cli. Start Plugin System. Adds #133 and #136
    items: Ember.computed.alias('project_models.items'),
    extractors: Ember.computed.alias('project_models.extractors'),

    scrapedItem: function() {
        if (!Ember.isEmpty(this.get('items'))) {
            return this.get('items').findBy('name', this.get('content.scrapes'));
        } else {
            return null;
        }
    }.property('content.scrapes', 'items.@each'),

    displayExtractors: function() {
        return this.get('extractors').map(function(ext) {
            return {
                type: ext.get('regular_expression') ? '<RegEx>' : '<Type>',
                label: ext.get('regular_expression') || ext.get('type_extractor'),
                extractor: ext
            };
        });
    }.property('extractors.@each', 'content.extractors.@each'),

    currentlySelectedElement: null,

    sprites: function() {
        this.set('documentView.sprites', this.get('activeExtractionTool.sprites'));
        return this.get('activeExtractionTool.sprites');
    }.property('activeExtractionTool', 'activeExtractionTool.sprites'),

    saveTemplate: function() {
        if (this.get('content')) {
            this.set('content.extractors', this.validateExtractors());
        }
        // TODO: Re-add support for warning about missing required fields
        return this.get('slyd').saveTemplate(
            this.get('controllers.spider.name'), this.get('content'));
    },

    saveExtractors: function() {
        // Cleanup extractor objects.
        this.get('extractors').forEach(function(extractor) {
            delete extractor['dragging'];
        });
        this.get('slyd').saveExtractors(this.get('extractors'));
    },

    validateExtractors: function() {
        var annotations = this.get('annotations'),
            extractors = this.get('extractors'),
            template_ext = this.get('content.extractors'),
            new_extractors = {},
            extractor_ids = {};
        extractors.forEach(function(extractor) {
            extractor_ids[extractor.id] = true;
        });
        annotations.forEach(function(annotation) {
            annotation.get('mappedAttributes').forEach(function(mapping) {
                var field = mapping.mappedField,
                    item_extractors = template_ext[field];
                if (item_extractors instanceof Array) {
                    item_extractors.forEach(function(extractor_id) {
                        if (extractor_ids[extractor_id]) {
                            new_extractors[field] = new_extractors[field] || [];
                            new_extractors[field].push(extractor_id);
                        }
                    });
                }
            });
        });
        return new_extractors;
    },

    getAppliedExtractors: function(fieldName) {
        var extractorIds = this.get('content.extractors.' + fieldName) || [];
        return extractorIds.map(function(extractorId) {
                var extractor = this.get('extractors').filterBy('name', extractorId)[0];
                if (extractor) {
                    extractor = extractor.copy();
                    extractor['fieldName'] = fieldName;
                    extractor['type'] = extractor.get('regular_expression') ? '<RegEx>' : '<Type>';
                    extractor['label'] = extractor.get('regular_expression') || extractor.get('type_extractor');
                    return extractor;
                } else {
                    return null;
                }
            }.bind(this)
        ).filter(function(extractor){ return !!extractor; });
    },

    mappedFieldsData: function() {
        var mappedFieldsData = [],
            seenFields = new Set(),
            item_required_fields = new Set(),
            scraped_item = this.get('scrapedItem');
        if (scraped_item) {
            scraped_item.fields.forEach(function(field) {
                if (field.required) {
                    item_required_fields.add(field.name);
                }
            });
        }
        if (scraped_item) {
            this.get('scrapedItem').fields.forEach(function(field) {
                var fieldName = field.name;
                if (!seenFields.has(fieldName)) {
                    var mappedFieldData = MappedFieldData.create();
                    mappedFieldData.set('fieldName', fieldName);
                    mappedFieldData.set('required', field.required);
                    mappedFieldData.set('disabled', true);
                    mappedFieldData.set('extractors', this.getAppliedExtractors(fieldName));
                    mappedFieldsData.pushObject(mappedFieldData);
                }
            }.bind(this));
        }
        return mappedFieldsData;
    }.property('annotations.@each.mappedAttributes',
               'content.extractors.@each',
               'extractors.@each'),

    createExtractor: function(extractorType, extractorDefinition) {
        var extractor = Extractor.create({
            name: this.shortGuid(),
        });
        if (extractorType === 'regular_expression') {
            try {
                new RegExp(extractorDefinition);
            } catch (e) {
                if (e instanceof SyntaxError) {
                    this.showAlert('Save Error','The text, "' + extractorDefinition + '", you provided is not a valid regex.');
                }
                return;
            }
        }
        extractor.set(extractorType, extractorDefinition);
        this.get('extractors').pushObject(extractor);
    },

    showFloatingAnnotationWidget: function(_, element, x, y) {
        this.set('showFloatingAnnotationWidgetAt', { x: x, y: y });
        this.set('floatingElement', Ember.$(element));
    },

    hideFloatingAnnotationWidget: function() {
        this.set('showFloatingAnnotationWidgetAt', null);
    },

    actions: {

        createField: function(fieldName, fieldType) {
            this.get('controllers.items').addField(this.get('scrapedItem'), fieldName, fieldType);
            this.get('slyd').saveItems(this.get('items').toArray()).then(function() { },
                function(reason) {
                    this.showHTTPAlert('Save Error', reason);
                }.bind(this)
            );
        },

        rename: function(oldName, newName) {
            this.set('name', oldName);
            var saveFuture = this.saveTemplate();
            if (!saveFuture) {
                return;
            }
            saveFuture.then(function() {
                var templateNames = this.get('controllers.spider.content.template_names');
                newName = this.getUnusedName(newName, templateNames);
                var spiderName = this.get('controllers.spider.name');
                this.get('slyd').renameTemplate(spiderName, oldName, newName).then(
                    function() {
                        templateNames.removeObject(oldName);
                        templateNames.addObject(newName);
                        this.replaceRoute('template', newName);
                    }.bind(this),
                    function() {
                        this.showHTTPAlert('Save Error', 'The name ' + newName + ' is not a valid template name.');
                    }.bind(this)
                );
            }.bind(this));
        },

        createExtractor: function(text, option) {
            if (text && text.length > 0) {
                this.createExtractor('regular_expression', text);
                this.saveExtractors();
            } else if (option && option.length > 0) {
                this.createExtractor('type_extractor', option);
                this.saveExtractors();
            }
        },

        deleteExtractor: function(extractor) {
            // Remove all references to this extractor.
            var extractors = this.get('content.extractors');
            Object.keys(extractors).forEach(function(fieldName) {
                extractors[fieldName].removeObject(extractor.extractor.id);
            }.bind(this));
            this.get('extractors').removeObject(extractor.extractor);
            this.saveExtractors();
        },

        applyExtractor: function(fieldName, extractorId) {
            var currentExtractors = this.get('content.extractors')[fieldName];
            if (!currentExtractors) {
                currentExtractors = [];
                this.set('content.extractors.' + fieldName, currentExtractors);
            }
            if (currentExtractors.indexOf(extractorId) === -1) {
                currentExtractors.pushObject(extractorId);
                this.notifyPropertyChange('content.extractors');
            }
            this.notifyPropertyChange('mappedFieldsData');
        },

        removeAppliedExtractor: function(appliedExtractor) {
            // TODO: we need to automatically remove extractors when the field they
            // extract is no longer mapped from any annotation.
            var fieldName = appliedExtractor['fieldName'];
            this.get('content.extractors')[fieldName].removeObject(appliedExtractor['name']);
            this.notifyPropertyChange('content.extractors');
            this.notifyPropertyChange('mappedFieldsData');
        },

        editItems: function() {
            this.transitionToRoute('items');
        },

        continueBrowsing: function() {
            var saveFuture = this.saveTemplate();
            if (!saveFuture) {
                return;
            }
            var sprites = this.get('documentView.sprites');
            this.set('documentView.sprites', []);
            saveFuture.then(function() {
                this.transitionToRoute('spider', {
                    queryParams: {
                        url: this.get('model.url')
                    }
                });
            }.bind(this),
            function(reason) {
                this.set('documentView.sprites', sprites);
                this.showHTTPAlert('Save Error', reason);
            }.bind(this));
        },

        hideFloatingAnnotationWidget: function() {
            this.hideFloatingAnnotationWidget();
        },

        toggleCSS: function() {
            this.documentView.toggleCSS();
        },

        setRequired: function() {

        }
    },

    documentActions: {

        elementSelected: function(element, mouseX, mouseY) {
            if (element) {
                this.showFloatingAnnotationWidget(null, element, mouseX, mouseY);
            }
        },

        partialSelection: function(selection, mouseX, mouseY) {
            var element = Ember.$('<ins/>').get(0);
            selection.getRangeAt(0).surroundContents(element);
            this.showFloatingAnnotationWidget(null, element, mouseX, mouseY);
        },

        elementHovered: function() {
            this.get('documentView').redrawNow();
        },
    },

    setDocument: function() {
        if (!this.get('model') || !this.get('model.annotated_body') || this.toString().indexOf('template/index') < 0) {
            return;
        }
        this.get('documentView').displayDocument(this.get('model.annotated_body'),
        function() {
<<<<<<< HEAD
            if (!this.get('model.plugins')) {
                this.set('model.plugins', Ember.Object.create({
                }));
            }
            this.enableExtractionTool(this.get('capabilities.plugins').get(0)['component'] || 'annotations-plugin');
=======
            // Convert old format annotations to new format
            if (!this.get('model.plugins')) {
                this.set('model.plugins', Ember.Object.create({
                    annotations: null,
                }));
            }
            if (!this.get('model.plugins.annotations')) {
                this.set('model.plugins.annotations', {
                    'extracts': this.get('annotationsStore').findAll()
                });
            }
            this.set('extractionTools.annotations', {
                data: this.get('model.plugins.annotations'),
                pluginState: {},
                sprites: new SpriteStore({})
            });
            this.set('activeExtractionTool', this.get('extractionTools.annotations'));
            this.get('documentView').config({
                mode: 'select',
                listener: this,
                dataSource: this,
                partialSelects: true,
            });
            this.set('documentView.sprites', this.get('activeExtractionTool.sprites'));
>>>>>>> Port App to Ember-Cli. Start Plugin System. Adds #133 and #136
        }.bind(this));
    }.observes('model', 'model.annotated_body'),

    willEnter: function() {
<<<<<<< HEAD
        var plugins = {};
        this.get('capabilities.plugins').forEach(function(plugin) {
            plugins[plugin['component'].replace(/\./g, '_')] = plugin['options'];
        });
        this.set('plugins', plugins);
=======
>>>>>>> Port App to Ember-Cli. Start Plugin System. Adds #133 and #136
        this.setDocument();
    },

    willLeave: function() {
        this.hideFloatingAnnotationWidget();
        this.get('documentView').hideHoveredInfo();
    }
});
