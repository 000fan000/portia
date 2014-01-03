ASTool.SpiderController = Em.ObjectController.extend(ASTool.RouteBrowseMixin, {
	
	needs: ['application', 'annotations'],

	documentViewBinding: 'controllers.application.documentView',

	newStartUrl: '',

	newExcludePattern: '',

	browseHistory: [],

	pageMap: {},

	loadedPageFp: null,

	hasHistory: function() {
		return this.get('browseHistory').length > 1;
	}.property('browseHistory.@each'),

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

	showCrawlGraph: function(key, show) {
		if (!ASTool.graph) {
			return false;
		}
		if (arguments.length > 1) {
            if (show) {
                ASTool.graph.set('hidden', false);
            } else {
                ASTool.graph.set('hidden', true);
            }
        }
        return  !ASTool.graph.get('hidden');
	}.property('ASTool.graph.hidden'),

	_showLinks: true,

	showLinks: function(key, show) {
		if (arguments.length > 1) {
            if (show) {
                this.set('_showLinks', true);
            } else {
                this.set('_showLinks', false);
            }
        }
        return  this.get('_showLinks');
	}.property('_showLinks'),

	sprites: function() {
		//FIXME: get this from slyd.
		if (!this.get('loadedPageFp') || !this.get('showLinks')) {
			return [];
		}
		var currentPageUrl = this.get('pageMap')[this.get('loadedPageFp')].url;
		var parsedCurrentUrl = URI.parse(currentPageUrl);
		var links = $($('#scraped-doc-iframe').contents().get(0).links);
		var sprites = [];
		links.each(function(i, link) {
			var parsedHref = URI.parse(link.href);
			var inDomain = parsedCurrentUrl['hostname'] == parsedHref['hostname'] ||
				parsedHref['hostname'] == 'localhost';
			sprites.pushObject(ASTool.ElementSprite.create({
				element: link,
				fillColor: inDomain ? 'rgba(0,255,0,0.3)' : 'rgba(255,0,0,0.3)',
				strokeColor: 'clear' }));
		});
		return sprites;
	}.property('loadedPageFp', 'showLinks'),

	editTemplate: function(template) {
		this.set('controllers.annotations.template', template);
		this.pushRoute('annotations', 'Template: ' + template.get('name'));
	},

	loadTemplate: function(template) {
		var pageFp = template.get('page_id');
		this.set('loadedPageFp', pageFp);
		this.pageMap[pageFp] = { page: template.get('original_body'),
								 url: template.get('url'),
								 fp: template.get('page_id') };
		this.get('browseHistory').pushObject(pageFp);
		this.get('documentView').displayAnnotatedDocument(template.get('original_body'));
	},

	fetchPage: function(url, parentFp) {
		this.set('loadedPageFp', null);
		var documentView = this.get('documentView');
		documentView.showLoading();
		this.get('slyd').fetchDocument(url, this.content.get('name')).then(function(data) {
			documentView.hideLoading();
			if (!data.error) {
				data.url = url;
				this.get('browseHistory').pushObject(data.fp);
				documentView.displayAnnotatedDocument(data.page,
					function(docIframe){
						this.get('documentView').reset();
						this.get('documentView').config({ mode: 'browse',
										  listener: this,
										  dataSource: this });
						this.set('loadedPageFp', data.fp);
						this.get('pageMap')[data.fp] = data;
						if (ASTool.graph) {
							ASTool.graph.addPage(data, parentFp);
						}
					}.bind(this)
				);
			} else {
				documentView.showError(data.error);
			}
		}.bind(this));
	},

	displayPage: function(fp) {
		this.set('loadedPageFp', null);
		var documentView = this.get('documentView');
		documentView.displayAnnotatedDocument(this.get('pageMap')[fp].page,
			function(){
				this.get('documentView').reset();		
				this.get('documentView').config({ mode: 'browse',
					listener: this,
					dataSource: this });
				this.set('loadedPageFp', fp);
			}.bind(this));
	},

	addTemplate: function() {
		var template = this.store.createRecord('template');
		template.set('id', ASTool.guid());
		this.content.get('templates').pushObject(template);
		this.get('controllers.annotations').deleteAllAnnotations();
		var page = this.get('pageMap')[this.get('loadedPageFp')];
		template.set('annotated_body', page.page);
		template.set('original_body', page.page);
		template.set('page_id', page.fp);
		template.set('url', page.url);
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

		loadTemplate: function(template) {
			this.loadTemplate(template);
		},

		saveSpider: function() {
			this.content.save();
		},

		fetchPage: function(url) {
			this.fetchPage(url);
		},

		browseBack: function() {
			var history = this.get('browseHistory');
			history.removeAt(history.length - 1);
			var lastPageFp = history.get('lastObject');
			this.displayPage(lastPageFp);
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

		editExcludePattern: function() {
			//TODO: implement this.
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
			var parsedCurrentUrl = URI.parse(this.get('pageMap')[this.get('loadedPageFp')].url);

			if (!parsedUrl.protocol) {
				if (url.indexOf('/') == 0) {
					parsedCurrentUrl.path = parsedUrl.path.substring(1);
				} else {
					parsedCurrentUrl.path += parsedUrl.path;	
				}
				url = URI.build(parsedCurrentUrl);
			}
			console.log(url);
			this.fetchPage(url, this.get('loadedPageFp'));	
		}
	},

	willEnter: function() {
		this.get('browseHistory').setObjects([]);
		this.set('pageMap', {});
		this.set('loadedPageFp', null);
		this.get('documentView').config({ mode: 'browse',
										  listener: this,
										  dataSource: this });
		this.get('documentView').showSpider();
		if (!ASTool.graph) {
			ASTool.set('graph', ASTool.CrawlGraph.create());
		}
		ASTool.graph.set('hidden', false);
	},

	willLeave: function() {
		ASTool.graph.clear();
		ASTool.graph.set('hidden', true);
	},
});