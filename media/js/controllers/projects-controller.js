ASTool.ProjectsController = Em.ArrayController.extend(ASTool.RouteBrowseMixin, {
	needs: ['application'],

	actions: {
		
		openProject: function(projectName) {
			this.pushRoute('project', 'Project: ' + projectName, 'fade', projectName);
		},

		deleteProject: function(projectName) {
			if (confirm('Are you sure you want to delete this project? This operation cannot be undone.')) {
				this.get('slyd').deleteProject(projectName);
				this.removeObject(projectName);
			} 
		},

		createProject: function() {
			var newProjectName = 'new_project_';
			var i = 1;
			while(this.content.any(function(projectName){ return projectName == newProjectName + i })) {
				i++;
			}
			newProjectName += i;			
			this.get('slyd').createProject(newProjectName).then(function() {
				this.pushRoute('project', 'Project: ' + newProjectName, 'fade', newProjectName);
			}.bind(this));
		}
	},
});
