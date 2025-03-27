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

// On cell execution:
//  1. Get execution number from global idToExec map before executing (using cell id)
//  2. Get all cells that has an execution number higher than this
//  and add the cell ids into a rerun list
//  3. Run all cells whose cell id is in the rerun list
class CellRerun {
  idToCodeCell: Map<string, Cell<ICodeCellModel>>;
  idToExecCount: Map<string, number>;
  panel: NotebookPanel;
  rerunActive: boolean;
  listenerOn: boolean;
  activeCellId: string;

  constructor(panel: NotebookPanel) {
    this.idToCodeCell = new Map<string, Cell<ICodeCellModel>>();
    this.idToExecCount = new Map<string, number>();
    this.panel = panel;
    this.rerunActive = false;
    this.listenerOn = false;
    this.activeCellId = '';
  }

  // Toggle whether or not we should have the rerun functionality on.
  // This will also change the frontend represenation to notify users
  // if rerun functionality is on or not.
  toggleRerunActive(): void {
    this.rerunActive = !this.rerunActive;
    console.log('rrActive', this.rerunActive);
    let element = document.querySelector(
      '[aria-label="✅ Activate Rerun"]'
    ) as HTMLElement;
    console.log(element);
    if (element) {
      if (this.rerunActive) {
        element.textContent = '❌ Deactivate Rerun';
      } else {
        element.textContent = '✅ Activate Rerun';
        element.style.color = 'white';
      }
    }
  }

  // Update maps to get all current exec counts to cells.
  private currExecutionNums(): void {
    if (this.panel) {
      const notebook = this.panel.content as Notebook;
      if (notebook) {
        const cellList = notebook.widgets;
        cellList.forEach(cell => {
          if (cell.model.type === 'code') {
            const codeCell = cell.model as ICodeCellModel;
            const id = cell.model.id;
            const EC = codeCell.executionCount ?? 0;
            const setEC = Math.max(this.idToExecCount.get(id) ?? 0, EC);
            this.idToCodeCell.set(id, cell as Cell<ICodeCellModel>);
            this.idToExecCount.set(id, setEC);
          }
        });
      }
    }
  }

  // Based on the old EC passed in, get a list of ids to rerun.
  // This list is all cells that have ECs greater than the passed in EC.
  private getRerunIds(oldEC: number): string[] {
    let idToRerun = [];
    for (const [id, ec] of this.idToExecCount.entries()) {
      if (ec > oldEC) {
        idToRerun.push(id);
      }
    }
    return idToRerun;
  }

  // Rerun all cells needed based on the old EC of the cell to run.
  private rerunCells(oldEC: number): Cell<ICellModel>[] {
    let notebook = this.panel.content as Notebook;
    let idsToRR = this.getRerunIds(oldEC);
    let cellToRun: Cell<ICellModel>[] = [];
    idsToRR.forEach(id => {
      let cell = this.idToCodeCell.get(id);
      if (cell) {
        cellToRun.push(cell);
      }
    });
    console.log('CELLS TO RERUN: ', idsToRR);
    NotebookActions.runCells(notebook, cellToRun, this.panel.sessionContext);
    return cellToRun;
  }

  // Rerun all cells that has greater EC than the given cell.
  private startRerun(c: Cell<ICodeCellModel>, cid: string): Cell<ICellModel>[] {
    let cellsReran: Cell<ICellModel>[] = [];
    const oldEC = this.idToExecCount.get(cid) ?? 0;
    const newEC = c.model.executionCount ?? 0;
    if (oldEC != newEC && this.rerunActive) {
      // We should only rerun cells if we toggle active
      // and ensure that the oldEC is not the newEC.
      console.log(
        'ACT. CELL EC CHANGED: ',
        cid,
        'old: ',
        oldEC,
        'new: ',
        newEC
      );
      cellsReran = this.rerunCells(oldEC);
    }
    return cellsReran;
  }

  // Set up cell rerun listeners.
  listenCellExecuted(): void {
    // We need to keep track of cell and its execution number prior to a
    // cell being executed. Therefore, we should call this once at the start.
    this.currExecutionNums();

    // Function that will execute whenever a cell gets executed.
    let onExecuted = (nb: any, data: any) => {
      const c = data.cell;
      if (c && c instanceof CodeCell) {
        const id = c.model.id;
        console.log(
          'ACTIVE CELL ID: ',
          this.activeCellId,
          'CELL ON EXECUTED: ',
          id
        );
        if (id == this.activeCellId) {
          // Only call the rerun routine if the cell on executed
          // is the current active cell.
          this.startRerun(c, id);
        }

        // Update the map whenever we have a cell executed to
        // track global data for rerun.
        this.currExecutionNums();
      }
    };

    // Connect to listen to whenever a cell gets executed.
    // The onExecuted cb will run to check if the cell executed
    // is the current active cell.
    // If it is, we will call the rerun routine.
    NotebookActions.executed.connect(onExecuted);
  }

  updateActiveCell(): void {
    if (this.panel.content.activeCell) {
      this.activeCellId = this.panel.content.activeCell.model.id;
    }
    console.log('ACTIVE CELL AFTER UPDATE: ', this.activeCellId);
  }
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

    let rerunCtrl: CellRerun;

    commands.addCommand(command, {
      label: '✅ Activate Rerun',
      caption: 'Listens and rerun cells when necessary',
      execute: (args: any) => {
        if (app && app.shell && app.shell.currentWidget) {
          const panel = app.shell.currentWidget as NotebookPanel;

          if (!rerunCtrl) {
            rerunCtrl = new CellRerun(panel);
          }

          rerunCtrl.toggleRerunActive();
          rerunCtrl.updateActiveCell();

          if (!rerunCtrl.listenerOn) {
            rerunCtrl.listenerOn = true;
            rerunCtrl.listenCellExecuted();

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

export default plugin;
