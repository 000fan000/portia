// Create a new Ember view for the jQuery UI Button widget
JQ.ButtonView = Em.View.extend(JQ.Widget, {
	uiType: 'button',
  
	uiOptions: ['label', 'disabled', 'icons', 'text'],
  
	tagName: 'button',

	classNames: ['controlShadow'],

	minWidth: null,

	maxWidth: null,
  
	icons: function() {
		return this.get('icon') ? {primary: this.get('icon')} : {};
	}.property('icon'),
  
	click: function() {
  		this.get('controller').send(this.get('action'), this.get('argument'));
	},

	_label: null,

	label: function(key, label) {
		if (arguments.length > 1) {
			label = trim(label, 40);
			this.set('_label', label);
		} 
		return this.get('_label');
	}.property('_label'),

	didInsertElement: function() {
		this._super();
		if (this.minWidth) {
			var ui = $(this.get('element'));
			ui.css('min-width', this.minWidth);
		}
		if (this.maxWidth) {
			var ui = $(this.get('element'));
			ui.css('max-width', this.maxWidth);
		}
	},
});

JQ.AnnotationWidget = JQ.ButtonView.extend({

	mouseEnter: function() {
		this.set('argument.highlighted', true);
	},

	mouseLeave: function() {
		this.set('argument.highlighted', false);
	},	
});


JQ.ButtonSetView = Em.View.extend(JQ.Widget, {
	uiType: 'buttonset',
	uiOptions: [],
	tagName: 'div',
});

JQ.TabNavigator = Em.View.extend({
	
});

// Create a new Ember view for the jQuery UI Menu widget.
// Because it wraps a collection, we extend from
// Ember's CollectionView rather than a normal view.
//
// This means that you should use `#collection` in your template to
// create this view.
JQ.MenuView = Em.CollectionView.extend(JQ.Widget, {
  uiType: 'menu',
  uiOptions: ['disabled'],
  uiEvents: ['select'],

  tagName: 'ul',

  // Whenever the underlying Array for this `CollectionView` changes,
  // refresh the jQuery UI widget.
  arrayDidChange: function(content, start, removed, added) {
    this._super(content, start, removed, added);

    var ui = this.get('ui');
    if (ui) {
      // Schedule the refresh for after Ember has completed it's
      // render cycle
      Em.run.scheduleOnce('afterRender', ui, ui.refresh);
    }
  },
  itemViewClass: Em.View.extend({
    // Make it so that the default context for evaluating handlebars
    // bindings is the content of this child view.
    context: function(){
      return this.get('content');
    }.property('content')
  })
});

// Create a new Ember view for the jQuery UI Progress Bar widget
JQ.ProgressBarView = Em.View.extend(JQ.Widget, {
  uiType: 'progressbar',
  uiOptions: ['value', 'max'],
  uiEvents: ['change', 'complete']
});

JQ.TextField = Em.TextField.extend({
	uiOptions: [],
	
	uiType: null,

	width:null,
	
	didInsertElement: function() {
		this._super();
		var ui = $(this.get('element'));
		ui.addClass('ui-corner-all');
		if (this.width) {
			var ui = $(this.get('element'));
			ui.css('width', this.width);
		}
	},
});

JQ.IgnoreWidget = JQ.TextField.extend({
	ignore: null,
	valueBinding: 'ignore.name',
	
	mouseEnter: function() {
		console.log(this.get('ignore'));
		this.set('ignore.highlighted', true);
	},

	mouseLeave: function() {
		this.set('ignore.highlighted', false);
	},

	click: null,
});


/*************************** Components **************************/

ASTool.MyButtonComponent = Ember.Component.extend({
	click: function() {
		this.sendAction();
	}
});

/*************************** Views ********************************/

ASTool.ElemAttributeView = JQ.ButtonView.extend({
	name: null,
	value: null,
	attribute: null,
	
	/*label: function() {
		var label = this.get('attribute').name + ": " + trim(this.get('attribute').value, 60);
		label += this.mapped ? ' >> ' + this.attribute.mappedField : '';
		return label;
	}.property('attribute'),*/



	didInsertElement: function() {
		this._super();
		var attribute = this.get('attribute');
		var ui = $(this.get('element'));
		var content = $('<div/>').
			append($('<span/>', { text:attribute.name + ': ', class:'elementAttributeName' })).
			append($('<span/>', { text:trim(attribute.value, 40), class:'elementAttributeValue' }));
		if (this.mapped) {
			content.append($('<div/>').
			append($('<span/>', { text:'mapped to: ', class:'elementAttributeName' })).
			append($('<span/>', { text:attribute.mappedField, class:'elementAttributeValue' })));
		}
		content.css('text-align', 'left').css('margin-left', '5px');
		ui.find('[class=ui-button-text]').html(
			content);
	},
});

ASTool.ItemView = Ember.View.extend({
	templateName: 'item',
	item: null,
	mappingAttribute: null,
});

JQ.EditField = JQ.TextField.extend({
	change: function(evt) {
		this.get('owner').save();
	}
});

ASTool.EditBox = Ember.Checkbox.extend({
	owner: null,
	change: function(evt) {
	}
});

ASTool.TypeSelect = Ember.Select.extend({
	owner: null,
	content: ['geopoint', 'image', 'number', 'price', 'raw html', 'safe html', 'text', 'url'],
	change: function(evt) {
		this.get('owner').save();
	}
});

ASTool.AnnotatedDocumentView = Ember.View.extend({
	templateName: 'annotated-document-view',
	
	didInsertElement: function() {
		this._super();
		this.get('controller').pushRoute('project', 'Project');
		$('#scraped-doc-iframe').height(window.innerHeight * 0.99);
		$('#toolbar').height(window.innerHeight);
	},
});

ASTool.ViewNotifyingMixin = Ember.Mixin.create({
	willInsertElement: function() {
		if (this.get('controller.willEnter')) {
			this.controller.willEnter();	
		};
	},

	willDestroyElement: function() {
		if (this.get('controller.willLeave')) {
			this.controller.willLeave();
		};
	},
});


ASTool.AnnotationsView = Ember.View.extend(ASTool.ViewNotifyingMixin);
ASTool.AnnotationView = Ember.View.extend(ASTool.ViewNotifyingMixin);
ASTool.ItemsView = Ember.View.extend(ASTool.ViewNotifyingMixin);
ASTool.SpiderView = Ember.View.extend(ASTool.ViewNotifyingMixin);
ASTool.ProjectView = Ember.View.extend(ASTool.ViewNotifyingMixin);


/*************************** Helpers ******************************/
function trim(text, maxLength) {
	if (text.length > maxLength) {
		text = text.substring(0, maxLength) + '...';
	}
	return text;
}

Ember.Handlebars.helper('trim', function(text, length) {
	return trim(text, length);
});
