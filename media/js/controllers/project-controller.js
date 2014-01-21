ASTool.ProjectController = Em.ArrayController.extend(ASTool.RouteBrowseMixin, {

	needs: ['application'],

	documentView: null,

	nameBinding: 'slyd.project',

	addSpider: function() {
		// Find a unique spider name.
		var newSpiderName = ASTool.guid().substring(0, 5);
		while(this.content.any(function(spiderName){ return spiderName == newSpiderName })) {
			newSpiderName += '0';
		}
		var spider = this.store.createRecord('spider', 
			{ 'id': newSpiderName,
			  'start_urls': [],
			  'follow_patterns': [],
			  'exclude_patterns': [],
			  'init_requests': [] });
		this.pushObject(spider.get('name'));
		return spider.save();
	},

	editSpider: function(spiderName) {
		this.pushRoute('spider', 'Spider: ' + spiderName, 'fade', spiderName);
	},

	actions: {

		editSpider: function(spiderName) {
			this.editSpider(spiderName);
		},

		addSpider: function() {
			this.addSpider();
		},

		deleteSpider: function(spiderName) {
			if (confirm('Are you sure you want to delete spider ' + spiderName + '?')) {
				this.get('slyd').deleteSpider(spiderName);
				this.removeObject(spiderName);
			}
		},

		gotoItems: function() {
			this.pushRoute('items', 'Items');
		},

		rename: function(oldName, newName) {
			if (confirm('Are you sure you want to rename this project? This operation cannot be undone.')) {
				this.get('slyd').renameProject(oldName, newName).then(
					function() {
						this.updateTop('Project: ' + newName, newName);
					}.bind(this),
					function(reason) {
						this.set('name', oldName);
						alert('The name ' + newName + ' is not a valid project name.');
					}.bind(this)
				);
			} else {
				this.set('name', oldName);
			}
		},
	},

	willEnter: function() {
		this.get('documentView').showSpider();
		if (this.get('controllers.application.newProjectSite')) {
			Em.run.next(this, function() {
				this.addSpider().then(function(spider) {
					this.editSpider(spider.get('id'));
				}.bind(this));
			});
		}
	},
});
