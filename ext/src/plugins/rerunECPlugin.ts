import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ICommandPalette } from '@jupyterlab/apputils';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';

import { CellRerun } from '../rerunControllers/rerunExecutionCount';

/**
 * Initialization data for the ext extension.
 */
const pluginExecutionCount: JupyterFrontEndPlugin<void> = {
  id: 'ext:plugin',
  description: 'A JupyterLab extension.',
  autoStart: true,
  requires: [ICommandPalette, INotebookTracker],
  activate: (
    app: JupyterFrontEnd,
    palette: ICommandPalette,
    notebookTracker: INotebookTracker
  ) => {
    const { commands } = app;
    const command = 'Dependencies:get-all-execution';

    let rerunCtrl: CellRerun;

    commands.addCommand(command, {
      label: '✅ Activate Rerun EC',
      caption: 'Listens and rerun cells when necessary',
      execute: (args: any) => {
        if (app && app.shell && app.shell.currentWidget) {
          const panel = app.shell.currentWidget as NotebookPanel;

          if (!rerunCtrl) {
            rerunCtrl = new CellRerun(panel);
          }

          rerunCtrl.toggleRerunOptions();
          rerunCtrl.updateActiveCell();

          if (!rerunCtrl.listenerOn) {
            // We don't need to attach another listener whenever we toggle the
            // activate button.
            rerunCtrl.listenerOn = true;
            rerunCtrl.listenCellExecuted();
            rerunCtrl.listenCellExecutionScheduled();

            notebookTracker.activeCellChanged.connect((_, cell) => {
              console.log('active cell', cell?.model.id);
              rerunCtrl.updateActiveCell();
            });
          }
        }
      }
    });

    const category = 'Dependency Tracking';
    palette.addItem({ command, category, args: { origin: 'from palette' } });
  }
};

export { pluginExecutionCount };
