import Ember from 'ember';
import ApplicationUtils from '../mixins/application-utils';
import Annotation from '../models/annotation';

export default Ember.Object.extend(ApplicationUtils, {

    iframe: function() {
        return this.get('document.iframe');
    }.property('document.iframe'),

    findAll: function() {
        var annotatedElements = this.get('iframe').findAnnotatedElements();
        var annotationJSONs = [];
        annotatedElements.each(function(i, element) {
            var annotationJSON = Ember.$.parseJSON(Ember.$(element).attr('data-scrapy-annotate'));
            if (!annotationJSON['id']) {
                // This looks like an old Austoscraping project annotation as it doesn't have
                // an assigned id. Create one for it.
                annotationJSON['id'] = this.shortGuid();
                Ember.$(element).attr('data-scrapy-annotate', JSON.stringify(annotationJSON));
            }
            annotationJSON['element'] = element;
            annotationJSONs.pushObject(annotationJSON);
        }.bind(this));
        this._findIgnoresParentAnnotation();
        return annotationJSONs.map(function(annotationJSON) {
            return Annotation.create(annotationJSON);
        });
    },

    _findIgnoresParentAnnotation: function() {
        var ignoredElements = this.get('iframe').findIgnoredElements();
        ignoredElements.each(function(index, ignoredElement) {
            var ignore;
            var attributeName;
            if (Ember.$(ignoredElement).attr('data-scrapy-ignore')) {
                attributeName = 'data-scrapy-ignore';
            } else {
                attributeName = 'data-scrapy-ignore-beneath';
            }
            ignore = Ember.$.parseJSON(Ember.$(ignoredElement).attr(attributeName));
            if (!ignore['id']) {
                ignore = {};
                Ember.$(ignoredElement).parents().each(function(index, parent) {
                    if (Ember.$(parent).attr('data-scrapy-annotate')) {
                        ignore['id'] = Ember.$.parseJSON(Ember.$(parent).attr('data-scrapy-annotate'))['id'];
                        Ember.$(ignoredElement).attr(attributeName, JSON.stringify(ignore));
                        return false;
                    }
                });
            }
        });
    },

    _prepareToSave: function() {
        var ignoredElements = this.get('iframe').findIgnoredElements();
        ignoredElements.removeAttr('data-scrapy-ignore');
        ignoredElements.removeAttr('data-scrapy-ignore-beneath');
        var annotatedElements = this.get('iframe').findAnnotatedElements();
        annotatedElements.each(function(i, element) {
            Ember.$(element).attr('data-scrapy-annotate', null);
        }.bind(this));
    },

    saveAll: function(annotations) {
        this._prepareToSave();
        annotations.forEach(function(annotation) {
            annotation.get('ignores').forEach(function(ignore) {
                var attrName = ignore.get('ignoreBeneath') ? 'data-scrapy-ignore-beneath' : 'data-scrapy-ignore';
                Ember.$(ignore.get('element')).attr(attrName, 'true');
            });
            Ember.$(annotation.get('element')).attr('data-scrapy-annotate',
                JSON.stringify(annotation.serialize()));
        }.bind(this));
    },
});