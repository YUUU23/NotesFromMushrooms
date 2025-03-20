import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ICommandPalette } from '@jupyterlab/apputils';

import { NotebookPanel } from '@jupyterlab/notebook';

import { ICodeCellModel } from '@jupyterlab/cells';

import { LabShell } from '@jupyterlab/application';

function currExecutionNums(app: JupyterFrontEnd) {
  let idToExec = new Map<string, number>();
  if (app && app.shell && app.shell.currentWidget) {
    const notebook = app.shell.currentWidget as NotebookPanel;
    if (
      notebook.content &&
      notebook.content.model &&
      notebook.content.model.cells
    ) {
      const cellList = notebook.content.model.cells;
      for (const cell of cellList) {
        if (cell.type === 'code') {
          const exec_num = (cell as ICodeCellModel).executionCount;
          if (exec_num) {
            idToExec.set(cell.id, exec_num);
          }
        }
      }
    }
  }
  return idToExec;
}

/**
 * Initialization data for the ext extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'ext:plugin',
  description: 'A JupyterLab extension.',
  autoStart: true,
  requires: [ICommandPalette],
  activate: (app: JupyterFrontEnd, palette: ICommandPalette) => {
    console.log('JupyterLab extension ext is activated!');
    console.log('ICP: ', palette);

    let currIdToExec: Map<string, number> = new Map();
    const labShell = app.shell as LabShell;
    labShell.currentChanged.connect(() => {
      const notebook = app.shell.currentWidget as NotebookPanel;
      if (notebook) {
        notebook.revealed.then(() => {
          let out = currExecutionNums(app);
          console.log('START OUT: ', out);
          currIdToExec.clear();
          out.forEach((v, k) => currIdToExec.set(k, v));
        });
      }
    });

    const { commands } = app;
    const command = 'Dependencies:get-all-execution';

    commands.addCommand(command, {
      label: 'Execution Numbers',
      caption: 'Get all current execution numbers.',
      execute: (args: any) => {
        console.log('Getting all code cells and execution number');
        let out = currExecutionNums(app);
        out.forEach((v, k) => {
          console.log('CELL ID: ', k, ' EXEC NUM: ', v);
        });
      }
    });

    // On cell execution:
    //  1. Get execution number from global idToExec map before executing (using cell id)
    //  2. Get all cells that has an execution number higher than this
    //  and add the cell ids into a rerun list
    //  3. Run all cells whose cell id is in the rerun list

    const category = 'Dependency Tracking';
    palette.addItem({ command, category, args: { origin: 'from palette' } });
  }
};

export default plugin;
