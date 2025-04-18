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

import { PERFLOG } from './log';

// On cell execution:
//  1. Get execution number from global idToExec map before executing (using cell id)
//  2. Get all cells that has an execution number higher than this
//  and add the cell ids into a rerun list
//  3. Run all cells whose cell id is in the rerun list
class CellRerun {
  idToCodeCell: Map<string, Cell<ICodeCellModel>>;
  idToExecCount: Map<string, number>;
  curReRunSet: Set<string>; // For perf
  panel: NotebookPanel;
  rerunActive: boolean;
  listenerOn: boolean;
  activeCellId: string;

  constructor(panel: NotebookPanel) {
    this.idToCodeCell = new Map<string, Cell<ICodeCellModel>>();
    this.idToExecCount = new Map<string, number>();
    this.curReRunSet = new Set<string>(); // For perf
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

    // Sync with the global map before we start rerunning if activated.
    this.currExecutionNums();
    console.log('map on toggle: ', this.idToExecCount);

    let element = document.querySelector(
      '[aria-label="✅ Activate Rerun"]'
    ) as HTMLElement;
    if (element) {
      if (this.rerunActive) {
        element.textContent = '❌ Deactivate Rerun';
      } else {
        element.textContent = '✅ Activate Rerun';
        element.style.color = 'white';
      }
    }
  }

  // ****** FUNCTIONS FOR RERUN ROUTINE ****** //
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
  private rerunCells(oldEC: number): string[] {
    let notebook = this.panel.content as Notebook;
    let idsToRR = this.getRerunIds(oldEC);
    let cellToRun: Cell<ICellModel>[] = [];
    idsToRR.forEach(id => {
      let cell = this.idToCodeCell.get(id);
      if (cell) {
        cellToRun.push(cell);
        // Add to global array to track the cells currently being reran.
        this.curReRunSet.add(id);
      }
    });
    console.log('CELLS TO RERUN: ', idsToRR);
    NotebookActions.runCells(notebook, cellToRun, this.panel.sessionContext);
    return idsToRR;
  }

  // Rerun all cells that has greater EC than the given cell.
  private startRerun(c: Cell<ICodeCellModel>, cid: string): string[] {
    const reRunStartTime = performance.now(); // Start timer for current rerun event.
    let cellIdsReran: string[] = [];
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
      cellIdsReran = this.rerunCells(oldEC);
    }

    // Perf event to log the rerun start time.
    PERFLOG('Rerun start=%d|Rerun cells=%s', [
      reRunStartTime,
      cellIdsReran.join(',')
    ]);
    return cellIdsReran;
  }

  // Set up cell rerun listeners.
  listenCellExecuted(): void {
    // We need to keep track of cell and its execution number prior to a
    // cell being executed.
    // Therefore, we should call this once at the start -- this is done in
    // the toggle function as we activate the rerun functionality.

    // Function that will execute whenever a cell gets executed.
    let onExecuted = (nb: any, data: any) => {
      const executedTime = performance.now();
      const c = data.cell;
      if (c && c instanceof CodeCell) {
        const id = c.model.id;

        // Perf event: We need to know whenver a cell finished executing --
        // just in case it's the cells we have scheduled for reran.
        PERFLOG('Executed time=%f|exec_id=%d|cell_id=%s', [
          executedTime,
          c.model.executionCount,
          id
        ]);

        if (this.curReRunSet.has(id)) {
          this.curReRunSet.delete(id); // The cell executed is a rerun cell -- remove this.
          if (this.curReRunSet.size == 0) {
            // Perf event: When the entire rerun task has completed.
            // We assume that no 2 rerun tasks will happen at the same time.
            const endTime = performance.now();
            PERFLOG('Rerun end=%f', [endTime]);
          }
        }

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
        console.log('finished rerun routine: ', this.idToExecCount);
      }
    };

    // Connect to listen to whenever a cell gets executed.
    // The onExecuted cb will run to check if the cell executed
    // is the current active cell.
    // If it is, we will call the rerun routine.
    NotebookActions.executed.connect(onExecuted);
  }

  listenCellExecutionScheduled(): void {
    let onScheduled = (nb: any, data: any) => {
      const c = data.cell;
      if (c && c instanceof CodeCell) {
        // Perf event to log when a cell is scheduled to execute. This event
        // + the cell ID will help us determine when the first cell we want
        // to rerun starts rerunning.
        const scheduledTime = performance.now();
        PERFLOG('Scheduled time=%f|exec id=%d|cell id=%s', [
          scheduledTime,
          c.model.executionCount,
          c.model.id
        ]);
      }
    };

    NotebookActions.executionScheduled.connect(onScheduled);
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

export default plugin;
