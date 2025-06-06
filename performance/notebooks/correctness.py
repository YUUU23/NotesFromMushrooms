#!/usr/bin/env python3

import argparse
import nbformat
from process_all.executeAll import ExecutePreprocessor
from typing import Any
from itertools import zip_longest
from copy import deepcopy
import time 
import os

def create_diff(orig: str, rerun: str) -> tuple[list[str], list[str]]:
    """
    Returns a list of lines only in the original string
    and a list of lines only in the rerun string.
    """

    orig_lines = set(orig.split('\n')) 
    rerun_lines = set(rerun.split('\n'))

    orig_only_lines = orig_lines - rerun_lines 
    rerun_only_lines = rerun_lines - orig_lines 
    return list(orig_only_lines), list(rerun_only_lines)

def format_diff_msg(orig_only_lines: list[str], rerun_only_lines: list[str]) -> str:
    """
    Displays which lines are only in original and which are only in rerun. 
    Formats into a diff msg. Example:
    Output lines only in original:
    Hello World!

    Output lines only in rerun:
    Goodbye!
    """
    msg = ""
    if orig_only_lines or rerun_only_lines:
        orig_lines = '\n'.join(orig_only_lines)
        rerun_lines = '\n'.join(rerun_only_lines)
        msg = (
            "Output lines only in original:\n"
            f"{orig_lines}\n"
            "Output lines only in rerun:\n"
            f"{rerun_lines}"
        )
    return msg

def parse_and_compare_cell(
        cell_json_orig: dict[str, Any],
        cell_json_rerun: dict[str, Any]) -> str:

    orig_outputs = cell_json_orig.get("outputs")
    if orig_outputs is None:
        raise ValueError(
            f"Outputs field of orig cell {cell_json_orig.get('id', '')} is missing"
        )
    
    rerun_outputs = cell_json_rerun.get("outputs")
    if rerun_outputs is None:
        raise ValueError(
            f"Outputs field of rerun cell {cell_json_rerun.get('id', '')} is missing"
        )
    
    # print("ORIG OUT: ", orig_outputs)
    # print("RERUN OUT: ", rerun_outputs)
    orig_only_lines, rerun_only_lines = [], []
    for orig_output, rerun_output in zip_longest(orig_outputs, rerun_outputs, fillvalue={}):
        # TODO: make sure it can register text/plain also. 
        orig_only, rerun_only = create_diff(orig_output.get("text", ""), rerun_output.get("text", ""))
        orig_only_lines.extend(orig_only)
        rerun_only_lines.extend(rerun_only)

    # print("orig_only_lines, ", orig_only_lines)
    # print("rerun_only_lines, ", rerun_only_lines)
    return format_diff_msg(orig_only_lines, rerun_only_lines)

def parse_and_compare(nb_json_orig: dict[str, Any], nb_json_rerun: dict[str, Any]):
    orig_cells = nb_json_orig.get("cells")
    if orig_cells is None:
        raise ValueError(
            "Original notebook json does not contain cells list"
            f" Got: {nb_json_orig}")
    orig_code_cells = [
        c for c in orig_cells if c.get("cell_type") == "code"
    ]

    reran_cells = nb_json_rerun.get("cells")
    if reran_cells is None:
        raise ValueError(
            "Reran notebook json does not contain cells list"
            f" Got: {nb_json_rerun}"
        )
    reran_code_cells = [
        c for c in reran_cells if c.get("cell_type") == "code"
    ]
    
    if len(reran_code_cells) != len(orig_code_cells):
        raise ValueError(
            "Reran notebook and original notebook do not contain"
            "the same number of cells"
            f" Original cell count: {len(orig_code_cells)}"
            f" reran cell count: {len(reran_code_cells)}"
        )
    
    msg = []
    for orig_cell, reran_cell in zip(orig_code_cells, reran_code_cells):
        orig_cell_id = orig_cell.get("id")
        if orig_cell_id is None:
            orig_cell_id = 'orig_cell none'
        reran_cell_id = reran_cell.get("id")
        if reran_cell_id is None:
            raise ValueError(f"Reran cell does not have id, cell val: {reran_cell}")
        if reran_cell_id != orig_cell_id:
            raise ValueError(
                "Cell id has changed from original"
                f" Original cell id: {orig_cell_id}"
                f" Reran cell id: {reran_cell_id}")

        diff_msg = parse_and_compare_cell(orig_cell, reran_cell)
        if diff_msg:
            msg.append(
                f"Original output and reran output differ for cell {orig_cell_id}"
                f"\n{diff_msg}\n"
            )
    
    return msg

def load_and_rerun_notebook(notebook_path: str) -> str:
    print("current working directory: ", os.getcwd())
    with open(notebook_path) as fd:
        nb_orig = nbformat.read(fd, as_version=4)
    
    os.chdir('performance/notebooks')
    nb_reran = deepcopy(nb_orig)
    ep = ExecutePreprocessor(timeout=600) # Rerun all cells with copy of modified notebook.
    rerun_all_start_time = time.perf_counter()
    
    # Source code for ExecutePreprocessor: https://github.com/jupyter/nbconvert/blob/2ba58585f649c1a2024aadd58007ec138457cc58/nbconvert/preprocessors/execute.py#L38
    # The preprocess function: 
    # 1. Initializes a notebook client and resets some metadata
    # 2. Calls a setup kernel method
    # 3. Preprocesses every cell => calls execute cell 
    ep.preprocess(nb_reran)
    rerun_all_end_time = time.perf_counter()
    print(f'PERF|RERUN ALL | Total time: {(rerun_all_end_time - rerun_all_start_time) * 1000} ms')
    return "\n".join(parse_and_compare(nb_orig, nb_reran))

if __name__ == "__main__":
    # print('ENTERED CORRECTNESS')
    parser = argparse.ArgumentParser()
    parser.add_argument('notebookpath')

    args = parser.parse_args()
    diffs = load_and_rerun_notebook(args.notebookpath)
    if diffs:
        print('\n')
        print('============== START DIFF ==============') 
        print(diffs)