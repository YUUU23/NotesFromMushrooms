import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ICommandPalette } from '@jupyterlab/apputils';

import { LabShell } from '@jupyterlab/application';

import { NotebookPanel } from '@jupyterlab/notebook';

import { ICodeCellModel } from '@jupyterlab/cells';

function logExecutionNums(app: JupyterFrontEnd) {
  const labShell = app.shell as LabShell;
  labShell.currentChanged.connect(() => {
    const notebook = app.shell.currentWidget as NotebookPanel;

    if (notebook) {
      notebook.revealed.then(() => {
        if (notebook.content && notebook.content.model) {
          const cellList = notebook.content.model.cells;
          if (cellList != null) {
            for (const cell of cellList) {
              console.log('CELL: ', cell, cell.type);
              if (cell.type === 'code') {
                const exec_num = (cell as ICodeCellModel).executionCount;
                console.log('EXECUTION COUNT: ', exec_num);
              }
            }
          }
        }
      });
    }
  });
}

/**
 * Initialization data for the ext extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'ext:plugin',
  description: 'A JupyterLab extension.',
  autoStart: true,
  requires: [ICommandPalette],
  activate: (
    app: JupyterFrontEnd,
    palette: ICommandPalette,
    notebookPanel: NotebookPanel
  ) => {
    console.log('JupyterLab extension ext is activated!');
    console.log('ICP: ', palette);

    const { commands } = app;
    const command = 'Dependencies:get-all-execution';

    logExecutionNums(app);

    commands.addCommand(command, {
      label: 'Execution Numbers',
      caption: 'Get all current execution numbers.',
      execute: (args: any) => {
        console.log(`HELLO`);
      }
    });

    const category = 'Dependency Tracking';
    palette.addItem({ command, category, args: { origin: 'from palette' } });
  }
};

export default plugin;
