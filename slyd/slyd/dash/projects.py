from slyd.gitstorage import Repoman
from slyd.gitstorage.projects import GitProjectsManager, run_in_thread, Repoman
from .dashclient import import_project, export_project, set_dash_url


class ProjectsManager(GitProjectsManager):

    @classmethod
    def setup(cls, storage_backend, location, dash_url):
        GitProjectsManager.setup(storage_backend, location)
        set_dash_url(dash_url)

    def __init__(self, *args, **kwargs):
        GitProjectsManager.__init__(self, *args, **kwargs)
        self.project_commands['export'] = self.export_project

    @run_in_thread
    def edit_project(self, name, revision):
        if not Repoman.repo_exists(name):
            import_project(name, self.auth_info['service_token'])
        GitProjectsManager.edit_project(self, name, revision)

    @run_in_thread
    def export_project(self, name):
        export_project(name, self.auth_info['service_token'])
        return 'OK'
