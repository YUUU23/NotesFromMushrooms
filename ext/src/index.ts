import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ICommandPalette } from '@jupyterlab/apputils';

import {
  Notebook,
  NotebookPanel,
  INotebookTracker,
  NotebookActions
} from '@jupyterlab/notebook';

import { ICodeCellModel, ICellModel, Cell, CodeCell } from '@jupyterlab/cells';

// import { NotebookActions } from '@jupyterlab/notebook';

let activeCellId: string = '';

function currExecutionNums(
  panel: NotebookPanel,
  idToCodeCell: Map<string, Cell<ICodeCellModel>>,
  idToExecNum: Map<string, number>
): void {
  if (panel) {
    const notebook = panel.content as Notebook;
    if (notebook) {
      const cellList = notebook.widgets;
      cellList.forEach(cell => {
        if (cell.model.type === 'code') {
          const codeCell = cell.model as ICodeCellModel;
          const id = cell.model.id;
          const EC = codeCell.executionCount ?? 0;
          const setEC = Math.max(idToExecNum.get(id) ?? 0, EC);
          idToCodeCell.set(id, cell as Cell<ICodeCellModel>);
          idToExecNum.set(id, setEC);
        }
      });
    }
  }
}

function getRerunIds(
  oldEC: number,
  idToExecCount: Map<string, number>
): string[] {
  let idToRerun = [];
  for (const [id, ec] of idToExecCount.entries()) {
    if (ec > oldEC) {
      idToRerun.push(id);
    }
  }
  return idToRerun;
}

function rerunCells(
  panel: NotebookPanel,
  oldEC: number,
  idToCodeCell: Map<string, Cell<ICodeCellModel>>,
  idToExecCount: Map<string, number>
): string[] {
  let notebook = panel.content as Notebook;
  let idsToRR = getRerunIds(oldEC, idToExecCount);
  let cellToRun: Cell<ICellModel>[] = [];
  idsToRR.forEach(id => {
    let cell = idToCodeCell.get(id);
    if (cell) {
      cellToRun.push(cell);
    }
  });
  console.log('CELLS TO RERUN: ', idsToRR);
  NotebookActions.runCells(notebook, cellToRun, panel.sessionContext);
  return idsToRR;
}

function listenCellChanges(
  panel: NotebookPanel,
  notebookTracker: INotebookTracker,
  idToCodeCell: Map<string, Cell<ICodeCellModel>>,
  idToExecCount: Map<string, number>
) {
  currExecutionNums(panel, idToCodeCell, idToExecCount);
  // idToCodeCell.forEach((v, k) => {
  //   console.log(
  //     'CELL ID: ',
  //     k,
  //     'CELL MODEL: ',
  //     v,
  //     'EXEC NUM: ',
  //     v.model.executionCount
  //   );
  // });
  let func = (nb: any, data: any) => {
    console.log(
      'cell executed based on nb actions: ',
      data.cell,
      data.cell.model.id,
      typeof data.cell
    );
    const c = data.cell;
    if (c && c instanceof CodeCell) {
      const id = c.model.id;
      console.log('ACTIVE CELL ID: ', activeCellId, 'CELL: ', id);
      if (id == activeCellId) {
        let oldEC = idToExecCount.get(id) ?? 0;
        const newEC = c.model.executionCount ?? 0;
        if (oldEC != newEC) {
          console.log(
            'CELL EXEC CHANGEEDDD: ',
            id,
            'oldEC: ',
            oldEC,
            'newEC: ',
            newEC
          );
          rerunCells(panel, oldEC, idToCodeCell, idToExecCount);
        }
      }
    }
  };

  NotebookActions.executed.connect(func);

  return func;
}

/**
 * Initialization data for the ext extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'ext:plugin',
  description: 'A JupyterLab extension.',
  autoStart: true,
  requires: [ICommandPalette, INotebookTracker],
  activate: (
    app: JupyterFrontEnd,
    palette: ICommandPalette,
    notebookTracker: INotebookTracker
  ) => {
    console.log('JupyterLab extension ext is activated!');

    const { commands } = app;
    const command = 'Dependencies:get-all-execution';

    commands.addCommand(command, {
      label: 'Activate Rerun',
      caption: 'Listens and rerun cells when necessary',
      execute: (args: any) => {
        // console.log('Getting all code cells and execution number');
        if (app && app.shell && app.shell.currentWidget) {
          const panel = app.shell.currentWidget as NotebookPanel;
          let idToCodeCell = new Map<string, Cell<ICodeCellModel>>();
          let idToExecCount = new Map<string, number>();

          if (panel.content.activeCell) {
            activeCellId = panel.content.activeCell.model.id;
          }

          listenCellChanges(
            panel,
            notebookTracker,
            idToCodeCell,
            idToExecCount
          );
          notebookTracker.activeCellChanged.connect((_, cell) => {
            console.log('active cell', cell?.model.id);
            if (cell && cell.model.id) {
              activeCellId = cell.model.id;
              // listenCellChanges(
              //   panel,
              //   notebookTracker,
              //   idToCodeCell,
              //   idToExecCount
              // );
            }
          });
        }
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
