# Notes 
some exploration for computational notebook reactivity 🍄

# Running Rerun as Jupyter Lab Extension: 
## Install conda environment (1) 
1. Clone this repository.
```
git clone https://github.com/YUUU23/NotesFromMushrooms
```
2. Run to create a conda environment named `jupyterlab-ext`. This will install all dependencies to run jupyter lab. 
```
conda create -n jupyterlab-ext --override-channels --strict-channel-priority -c conda-forge -c nodefaults jupyterlab=4 nodejs=20 git copier=9 jinja2-time
```
3. Run to activate environment.
```
conda activate jupyterlab-ext
```

## Install Frontend Extension (2)
Inside `jupyterlab-ext` environment, to install the rerun extension using rerun with execution count, run
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
<img width="959" alt="Screenshot 2025-05-09 at 22 00 44" src="https://github.com/user-attachments/assets/72547b0a-069f-45ad-82ea-a5cbc354d32f" />
Toggle once for rerun with execution count. Toggle once more to disable rerun. 

**NOTE:** 
1. Please make sure that your notebook opened is the first tab in the Jupyter lab interface. Currently, this extension does not support multiple notebooks in different Jupyter lab tabs opened at the same time. 
2. Please note that if you toggle the extension on and then use the Jupyter built-in rerun all, rerun will be triggered once your current active cell finishes running with rerun all, which may cause unexpected execution counts. 
   - To resolve this, toggle rerun off when using the built-in rerun all. 


## [Optional] Install Backend Server Extension (3)
 
