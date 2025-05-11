# Notes

some exploration for computational notebook reactivity 🍄

# Running Rerun as Jupyter Lab Extension:

1. [Environment Set-Up](#install-conda-environment-1)
2. [Install Frontend Extension](#install-frontend-extension-2)
3. [Install Backend Extension](#optional-install-backend-server-extension-3)
4. [Run Performance Parser](#running-performance-parser)

## Install conda environment (1)

1. Clone this repository.

```
git clone https://github.com/YUUU23/NotesFromMushrooms
```

2. Run to create a conda environment, the example environment will be named `jupyterlab-ext`. This will install all dependencies to run jupyter lab.

```
conda create -n jupyterlab-ext --override-channels --strict-channel-priority -c conda-forge -c nodefaults jupyterlab=4 nodejs=20 git copier=9 jinja2-time
```

3. Run to activate environment.

```
conda activate jupyterlab-ext
```

## Install Frontend Extension (2)

Inside `jupyterlab-ext` environment, to install the rerun extension using rerun with execution count, run the following,

```
cd ext
pip install -e .
cd ..
```

Run to confirm that the extension installed successfully.

```
jupyter labextension list
```

You should see,

```
(jupyterlab-ext) happy2na@The-Happy-2Na ext % jupyter labextension list
JupyterLab v4.4.1
/Users/happy2na/.local/share/jupyter/labextensions
        @jupyter-notebook/lab-extension v7.4.1 enabled OK

/opt/anaconda3/envs/jupyterlab-ext/share/jupyter/labextensions
        ext v0.1.0 enabled OK (python, ext)
```

Open Jupyter lab by running `jupyter lab`. If the extension installed successfully, you should see the `rerun on` toggle button on the top right,

<p align="center">
    <img width="959" alt="Screenshot 2025-05-09 at 22 00 44" src="https://github.com/user-attachments/assets/72547b0a-069f-45ad-82ea-a5cbc354d32f" />
</p>
Toggle once for rerun with execution count. Toggle once more to disable rerun.


### **IMPORTANT NOTES:**

1. Please do not make further modifications while any cells are still running.
2. If this is the first time running your notebook with a new kernel, use the Jupyter built-in rerun all once before toggling on the execution rerun tool. 
3. Please make sure that your notebook opened is the first tab in the Jupyter lab interface. Currently, this extension does not support multiple notebooks in different Jupyter lab tabs opened at the same time. 
4. Please note that if you toggle the extension on and then use the Jupyter built-in rerun all, rerun will be triggered once your current active cell finishes running with rerun all, which may cause unexpected execution counts.
   - To resolve this, toggle rerun off when using the built-in rerun all.
5. Refresh the browser if the toggle button visual is not changing after clicks -- this can be flaky at times as the visual updated by locating the `HTML` tags. 

## [Optional] Install Backend Server Extension (3)

The backend server is necessary for rerunning the entire notebook with a new kernel after each modification, triggering a backend script for this functionality when rerun with execution count is active. This is for checking correctness and taking performance measurements of running the entire notebook top-to-bottom.

Inside `jupyterlab-ext` environment from above, to install the backend extension, run the following, 

```
cd server
pip install -e .
cd ..
```

Run to confirm that the extension installed successfully.

```
jupyter lab extension list
```

You should see,

```
rerun_server enabled
    - Validating rerun_server...
      rerun_server 0.1.0 OK
```

The backend server extension will be running in the background. Open Jupyter lab from the root directory by running,

```
jupyter lab
```

Turn rerun with execution count on, after each modification, the backend server API will be accessed to

1. save the current code and cell content of the notebook,
2. run the notebook top-to-bottom with a new kernel,
3. run the correctness script and time for performance of rerunning all cells, 
4. send back result to frontend API to be printed to the console

With the `inspect` tool in a Chrome browser, the console output should look something like,

```
DATA Found:  Notebook sent in: performance/notebooks/taxi_dest_predict_param.ipynb results: current working directory:  /Users/happy2na/Desktop/NotesFromMushrooms
PERF|RERUN ALL | Set-Up Kernel and Language Info. time: 904.0466659935191ms
PERF|RERUN ALL | Executing (14 cells) total time: 5153.744041002938ms
PERF|RERUN ALL | Total time: 6374.335957996664 ms


============== START DIFF ==============
Original output and reran output differ for cell 1328803e-5167-45e4-872c-1c663cbdd5c2
Output lines only in original:

Output lines only in rerun:
Accuracy: 0.57
----Decision Tree Training Data results (2015 data set)----
Accuracy: 0.11
0:00:01.056437
----Decision Tree Test Data results (2016 data set)----

Original output and reran output differ for cell 8ab17e64-e8cc-46cd-9aa5-c363e08fb67d
Output lines only in original:

Output lines only in rerun:
0:00:00.034819
Accuracy: 0.10
shrink factor:  22
Accuracy: 0.92
----Decision Tree Test Data results (2016 data set)----
----Decision Tree Training Data results (2015 data set)----
```

**IMPORTANT NOTES:**

1. To ensure that the notebook state stays consistent, do not make further modifications before you see console outputs for correctness and rerunning all. 
2. Ensure that your notebook resides inside the `performance/notebooks` directory when running and making modifications. 
3. Ensure that you see the notebook's path on the top of the browser. 
   - If the path is not showing up, change to another notebook and change back should make the path show up.
<p align="center">
    <img width="1017" alt="Screenshot 2025-05-11 at 01 18 27" src="https://github.com/user-attachments/assets/5bf95944-ea08-4e4d-81cb-8b38599e3cb1" />
</p>
4. See the [correctness issue comment](https://github.com/YUUU23/NotesFromMushrooms/issues/8#issuecomment-2860391026) for current caveats on correctness measurements. 

## Running Performance Parser

Once all modifications and rerun experiments has been made to a notebook,

1. Open the `inspect` tool in a Chrome Browser.
2. Save the `console` output to a file.
3. In `performance/perf_parser.py`, modify line 8 to define `perf_log_file` as the path to the file saved in step 2. For example, we saved the console output as `logs/map-ec.log`, so we will define `perf_log_file` as `logs/map-ec.log`. Below is line 8 from `perf_log_file`, 

```Python
perf_log_file = "logs/map-ec.log"
```

4. Run the performance parser with,

```
python performance/perf_parser.py
```
