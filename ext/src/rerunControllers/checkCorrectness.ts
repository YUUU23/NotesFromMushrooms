import { URLExt } from '@jupyterlab/coreutils';
import { NotebookPanel } from '@jupyterlab/notebook';

import { requestAPI } from './handler';

function getCurrentNotebookPath(): String | null {
  const fullURL = URLExt.normalize(window.location.pathname);
  const relativeFilePath = fullURL.split('tree/')[1];
  console.log('RELATIVE: ', relativeFilePath);
  if (relativeFilePath) {
    return relativeFilePath;
  } else {
    return null;
  }
}

function saveAfterRun(panel: NotebookPanel, cb: Function): void {
  if (panel && panel.context && panel.context.save) {
    panel.context.save().then(cb());
  }
}

function establishServerConnection(
  service: string,
  currentNotebookPath: String,
  cb: Function
) {
  console.log('service: ', service);
  console.log('nbPath, ', currentNotebookPath);
  console.log('cb: ', cb);
  let enpointPath = `${service}?${currentNotebookPath}`;
  requestAPI<any>(enpointPath).then(data => console.log('DATA Found: ', data));
}

function processCorrectnessData() {}

function checkCellCorrectness(panel: NotebookPanel): void {
  // 1. Save the notebook first, as we need to check the ouptut of the most
  //    up to date version.
  saveAfterRun(panel, () => {
    let nbPath = getCurrentNotebookPath();
    let msg = '';
    if (nbPath == undefined || nbPath == null || nbPath.length == 0) {
      msg += `No current running notebook. nbPath is null.`;
      console.log(msg);
      return;
    } else {
      // 2. Establish HTTP connection with the backend to run python correctness
      //    script.
      establishServerConnection('get-example', nbPath, processCorrectnessData);
    }
  });
}

export { checkCellCorrectness };
