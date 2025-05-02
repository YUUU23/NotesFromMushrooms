import { requestAPI } from './handler';

function saveNotebook() {}

function runCorrectnessScript() {
  requestAPI<any>('correctness')
    .then(data => {
      console.log(data);
    })
    .catch(reason => {
      console.error(
        `The rerunServerExtension server extension appears to be missing.\n${reason}`
      );
    });
}

function checkCorrectness() {
  console.log('checking correctness after rerun ... ');
  saveNotebook();
  runCorrectnessScript();
}

export { checkCorrectness };
