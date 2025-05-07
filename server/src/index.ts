import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

/**
 * Initialization data for the rerun-server extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'rerun-server:plugin',
  description: 'A JupyterLab extension.',
  autoStart: true,
  activate: (app: JupyterFrontEnd) => {}
};

export default plugin;
