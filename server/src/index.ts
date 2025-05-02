import { JupyterFrontEndPlugin } from '@jupyterlab/application';

import { pluginExecutionCount } from './plugins/rerunECPlugin';

const plugins: JupyterFrontEndPlugin<any>[] = [pluginExecutionCount];

export default plugins;
