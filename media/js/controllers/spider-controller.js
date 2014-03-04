ASTool.SpiderIndexController = Em.ObjectController.extend(ASTool.BaseControllerMixin,
	ASTool.DocumentViewDataSource, ASTool.DocumentViewListener, {
	
	needs: ['application', 'template-index'],

	documentView: null,

	newStartUrl: '',

	newExcludePattern: '',

	browseHistory: [],

	pageMap: {},

	loadedPageFp: null,

	autoloadTemplate: null,

	pendingFetches: [],

	hasStartUrl: function() {
		return !this.get('newStartUrl');
	}.property('newStartUrl'),

	hasExcludePattern: function() {
		return !this.get('newExcludePattern');
	}.property('newExcludePattern'),

	hasFollowPattern: function() {
		return !this.get('newFollowPattern');
	}.property('newFollowPattern'),

	displayEditPatterns: function() {
		return this.get('links_to_follow') == 'patterns';
	}.property('links_to_follow'),

	displayNofollow: function() {
		return this.content.get('links_to_follow') != 'none';
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

	_showLinks: false,

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

	showItems: true,

	addTemplateDisabled: function() {
		return !this.get('loadedPageFp');
	}.property('loadedPageFp'),

	browseBackDisabled: function() {
		return this.get('browseHistory').length <= 1;
	}.property('browseHistory.@each'),

	showItemsDisabled: function() {
		var loadedPageFp = this.get('loadedPageFp');
		if (this.pageMap[loadedPageFp]) {
			return !loadedPageFp ? true : !this.pageMap[loadedPageFp].items.length;	
		}
		return true;
	}.property('loadedPageFp'),

	itemsButtonLabel: function() {
		return this.get('showItems') ? "Hide Items " : "Show Items";
	}.property('showItems'),

	links_to_follow: function(key, follow) {
		// The spider spec only supports 'patterns' or 'none' for the
		// 'links_to_follow' attribute; 'all' is only used for UI purposes.
		var model = this.get('model');
		var retVal = follow;
		if (arguments.length > 1) {
			if (follow != 'patterns') {
				model.get('exclude_patterns').setObjects([]);
				model.get('follow_patterns').setObjects([]);
			}
            model.set('links_to_follow', follow == 'none' ? 'none' : 'patterns');
        } else {
        	retVal = model.get('links_to_follow');
	        if (retVal == 'patterns' &&
	        	Em.isEmpty(model.get('follow_patterns')) &&
				Em.isEmpty(model.get('exclude_patterns'))) {
	        	retVal = 'all';
	        }
    	}
    	return retVal;
	}.property('model.links_to_follow',
	 		   'model.follow_patterns',
	 		   'model.exclude_patterns'),

	extractedItems: function() {
		var items = [];
		var loadedPageFp = this.get('loadedPageFp');
		if (this.pageMap[loadedPageFp]) {
			items = this.pageMap[loadedPageFp].items;
			if (items) {
				items = items.toArray();
			}
		}
		return items;
	}.property('loadedPageFp'),

	spiderDomains: function() {
		var spiderDomains = new Em.Set();
		this.get('content.start_urls').forEach(function(startUrl) {
			spiderDomains.add(URI.parse(startUrl)['hostname']);
		});
		return spiderDomains;
	}.property('content.start_urls.@each'),

	sprites: function() {
		if (!this.get('loadedPageFp') || !this.get('showLinks')) {
			return [];
		}
		var currentPageData = this.get('pageMap')[this.get('loadedPageFp')];
		var allLinks = $($('#scraped-doc-iframe').contents().get(0).links);
		var followedLinks = currentPageData.links;
		var sprites = [];
		allLinks.each(function(i, link) {
			var followed = followedLinks.indexOf(link.href) >= 0 &&
				this.get('spiderDomains').contains(URI.parse(link.href)['hostname']);
			sprites.pushObject(ASTool.ElementSprite.create({
				element: link,
				hasShadow: false,
				fillColor: followed ? 'rgba(0,255,0,0.3)' : 'rgba(255,0,0,0.3)',
				strokeColor: 'rgba(50, 50, 50, 1)' }));
		}.bind(this));
		return sprites;
	}.property('loadedPageFp', 'showLinks', 'spiderDomains'),

	currentUrl: function() {
		if (!Em.isEmpty(this.get('pendingFetches'))) {
			return 'Fetching page...';
		} else if (this.get('loadedPageFp')) {
			var url = this.get('pageMap')[this.get('loadedPageFp')].url;	
			if (url.length > 80) {
				url = url.substring(0, 80) + '...';
			}
			return url;
		} else {
			return 'No page loaded';
		}
	}.property('loadedPageFp', 'pendingFetches.@each'),

	editTemplate: function(template) {
		this.transitionToRoute('template', template);
		this.set('autoloadTemplate', template);
	},

	fetchPage: function(url, parentFp) {
		this.set('loadedPageFp', null);
		var documentView = this.get('documentView');
		documentView.showLoading();
		var fetchId = ASTool.guid();
		this.get('pendingFetches').pushObject(fetchId);
		this.get('slyd').fetchDocument(url, this.get('content.name'), parentFp).
			then(function(data) {
				if (this.get('pendingFetches').indexOf(fetchId) == -1) {
					// This fetch has been cancelled.
					return;
				}
				if (!data.error) {
					data.url = url;
					this.get('browseHistory').pushObject(data.fp);
					documentView.displayDocument(data.page,
						function(docIframe){
							documentView.hideLoading();
							this.get('pendingFetches').removeObject(fetchId);
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
					documentView.hideLoading();
					this.get('pendingFetches').removeObject(fetchId);
					documentView.showError(data.error);
				}
			}.bind(this)
		);
	},

	displayPage: function(fp) {
		this.set('loadedPageFp', null);
		var documentView = this.get('documentView');
		documentView.displayDocument(this.get('pageMap')[fp].page,
			function(){
				this.get('documentView').reset();		
				this.get('documentView').config({ mode: 'browse',
					listener: this,
					dataSource: this });
				this.set('loadedPageFp', fp);
			}.bind(this));
	},

	addTemplate: function() {
		var page = this.get('pageMap')[this.get('loadedPageFp')];
		var template = ASTool.Template.create( 
			{ name: ASTool.shortGuid(),
			  extractors: {},
			  annotated_body: page.page,
			  original_body: page.page,
			  page_id: page.fp,
			  url: page.url });
		this.get('content.templates').pushObject(template);
		this.get('controllers.template-index').deleteAllAnnotations();
		this.saveSpider().then(
			function() {
				this.editTemplate(template);
			}.bind(this)
		);
	},

	addStartUrl: function(url) {
		var parsedUrl = URI.parse(url);

		if (!parsedUrl.protocol) {
			parsedUrl.protocol = 'http';
			url = URI.build(parsedUrl);
		}
		this.content.get('start_urls').pushObject(url);
		return url;
	},

	addExcludePattern: function(pattern) {
		this.content.get('exclude_patterns').pushObject(pattern);
	},

	addFollowPattern: function(pattern) {
		this.content.get('follow_patterns').pushObject(pattern);
	},

	autoFetch: function() 
	{
		if (this.get('loadedPageFp') && this.get('showLinks')) {
			this.saveSpider().then(function() {
				this.fetchPage(this.get('pageMap')[this.get('loadedPageFp')].url);	
			}.bind(this));
		}
	}.observes('follow_patterns.@each',
			   'exclude_patterns.@each',
			   'links_to_follow'),

	saveSpider: function() {
		return this.get('slyd').saveSpider(this.get('content'));
	},

	reset: function() {
		// TODO: This is hacky and needs to be improved.
		this.set('autoloadTemplate', null);
		this.set('browseHistory', []);
		this.set('pageMap', {});
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
			this.saveSpider().then(function() {
				if (this.get('loadedPageFp')) {
					this.fetchPage(
						this.get('pageMap')[this.get('loadedPageFp')].url);
				}
			}.bind(this));
		},

		fetchPage: function(url) {
			// Cancel all pending fetches.
			this.get('pendingFetches').setObjects([]);
			this.saveSpider().then(function() {
				this.fetchPage(url);	
			}.bind(this));
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

		toggleShowItems: function() {
			this.set('showItems', !this.get('showItems'));
		},

		rename: function(oldName, newName) {
			if (confirm('Are you sure you want to rename this spider? This operation cannot be undone.')) {
				this.get('slyd').renameSpider(oldName, newName).then(
					function() {
						this.replaceRoute('spider', this.get('model'));
					}.bind(this),
					function(reason) {
						this.set('id', oldName);
						alert('The name ' + newName + ' is not a valid spider name.');
					}.bind(this)
				);
			} else {
				this.set('id', oldName);
			}
		},

		undoChanges: function() {
			if (confirm('Are you sure you want to abandon your changes?')) {
				this.content.rollback();
				this.content.reload();
			}
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
			// TODO: remove save on fetch.
			this.get('documentView').showLoading();
			this.saveSpider().then(function() {
				this.fetchPage(url, this.get('loadedPageFp'));	
			}.bind(this));
		}
	},

	willEnter: function() {
		this.set('loadedPageFp', null);
		this.get('documentView').config({ mode: 'browse',
										  listener: this,
										  dataSource: this });
		this.get('documentView').showSpider();
		/*if (!ASTool.graph) {
			ASTool.set('graph', ASTool.CrawlGraph.create());
		}
		ASTool.graph.set('hidden', true);*/
		var newSpiderSite = this.get('controllers.application.newSpiderSite')
		if (newSpiderSite) {
			Ember.run.next(this, function() {
				this.fetchPage(this.addStartUrl(newSpiderSite));
				this.set('controllers.application.newSpiderSite', null);
				this.saveSpider();
			});
		}
		if (this.get('autoloadTemplate')) {
			Ember.run.next(this, function() {
				this.saveSpider().then(function() {
					this.fetchPage(this.get('autoloadTemplate.url'));	
					this.set('autoloadTemplate', null);
				}.bind(this));
			});	
		}
	},

	willLeave: function() {
		/*ASTool.graph.clear();
		ASTool.graph.set('hidden', true);*/
		// Cancel all pending fetches.
		this.get('pendingFetches').setObjects([]);
		this.get('documentView').hideLoading();
	},
});