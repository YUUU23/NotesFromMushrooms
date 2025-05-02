import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { requestAPI } from './handler';

/**
 * Initialization data for the rerun-server extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'rerun-server:plugin',
  description: 'A JupyterLab extension.',
  autoStart: true,
  activate: (app: JupyterFrontEnd) => {
    console.log('JupyterLab extension rerun-server is activated!');

    requestAPI<any>('get-example')
      .then(data => {
        console.log(data);
      })
      .catch(reason => {
        console.error(
          `The rerun_server server extension appears to be missing.\n${reason}`
        );
      });
  }
};

export default plugin;
