from dataclasses import dataclass, field
from copy import copy
import matplotlib.pyplot as plt
import numpy as np

# After performing a set of modifications to a notebook, 
# save the browser console logs to a file and insert it here. 
perf_log_file = "logs/map-ec.log"

# Type definitions: 
CellID = str
TimeStampMS = float

# Life cycle of a rerun. 
# This represents a rerun segment in the log file. 
# 
# PERF T0: Rerun is started
# PERF T1: Kernel receives message to run first cell
#     At this point, all the rerun logic has finished.
#     Any remaining time is up to the kernel => Firsst cell scheduled. 
# PERF T2: Last reran cells have finished running 
#           => Immediately onExectued 
# PERF T3: Rerun reports that all cells have finished running 
#           => Has some overhead with set checking. 
# For the sake of just calcuating overhead, we should just use T1 - T0. 
@dataclass
class RerunPerfStat:
    rerun_start_time: TimeStampMS = None # T0
    rerun_end_time: TimeStampMS = None # T3
    first_cell_schedule_time: TimeStampMS = float('inf') # T1
    last_cell_executed_time: TimeStampMS = -float('inf') # T2

    # reran_cells is used to identify which cell execution events are part
    # of this rerun based on the cell IDs stored by the prints. 
    reran_cells: list[CellID] = field(default_factory=list)
    

class PerfStat:
    PERF_LINE_DELIM = "|"
    
    def __init__(self, file_path: str) -> None:
        """
        Upon creation, PerfStat parses the input file
        and generates the RerunPerfStats for further use.
        """
        self._cell_scheduled_times = []
        self._cell_executed_times = []

        self._rerun_stats = [] # Holds all rerunPerfStats for the entire log file. 
        self._rerun_all_stats = [] # Holds all the rerunAllStats

        # Two stage parsing process
        # First _parse() populates _cell_scheduled_times, _cell_executed_times
        # and _rerun_stats (effectively divids log file up into unique reran events). 
        self._parse(file_path)
        # Then _match_cells_to_reruns sets the first_cell_schedule_time (T1)
        # and last_cell_executed_time (T2) fields for each rerun found
        # by _parse. 
        self._match_cells_to_reruns()

    @staticmethod
    def _parse_cell_event(tokens: list[str]) -> tuple[CellID, TimeStampMS]:
        """
        There are two cell events:
         -Scheduled: occurs when the kernel recieves the request
                     to queue a cell for execution. 
         -Executed: emitted by the kernel once a cell has finished. 
         
        The perf messages for cell events follow the format of
        PERF|<Event> time=...|exec id=...|cell_id_token=...
        """
        time_token, _, cell_id_token, _ = tokens
        _, timestamp = time_token.split("=")
        _, cell_id = cell_id_token.split("=")

        return cell_id, float(timestamp)

    def _handle_perf_line(self, line: str) -> None:
        """
        Given a raw perf log line, parses it based on the perf event
        and updates the parser datastructures. 
        """
        # First token is always PERF, skip
        tokens = line.split(self.PERF_LINE_DELIM)[1:] # => Scheduled time=...|exec id=...|cell_id_token=...
        print(tokens)
        event_name_token = tokens[0] # Scheduled time
        name, value = event_name_token.split("=") # => Scheduled time, TIME 
        if name == "Scheduled time":
            # Scheduled time=%f|exec id=%d|cell id=%s
            # NOTE: We may have other cells not having to do with reran here. 
            cell_id, timestamp = self._parse_cell_event(tokens)
            self._cell_scheduled_times.append((cell_id.strip(), timestamp)) # add to all cell scheduled time 
            
        elif name == "Executed time":
            # Executed time=%f|exec_id=%d|cell_id=%s
            # NOTE: We may have other cells not having to do with reran here. 
            cell_id, timestamp = self._parse_cell_event(tokens)
            self._cell_executed_times.append((cell_id.strip(), timestamp)) # add to all cell executed time
            
        elif name == "Rerun start":
            # Rerun start=%d|Rerun cells=%s
            rerun_stat = RerunPerfStat() # Create a new representation of a rerun event (segment). 
            rerun_stat.rerun_start_time = float(value)
            _, rerun_cell_tokens = tokens[1].split("=") # Get cells reran. 
            # print("RERUN CELL TOKENS: ", [rerun_cell_tokens.strip()])
            clean_rerun_cell_tokens = rerun_cell_tokens.strip()
            if not clean_rerun_cell_tokens: 
                 rerun_stat.reran_cells = []
                 rerun_stat.last_cell_executed_time = rerun_stat.rerun_start_time
                 rerun_stat.first_cell_schedule_time = rerun_stat.rerun_start_time
                 self._rerun_stats.append(rerun_stat)
                 return 
            rerun_stat.reran_cells = [cell_id.strip() for cell_id in clean_rerun_cell_tokens.split(',')]
            if (len(rerun_stat.reran_cells) == 0):
                return 
            self._rerun_stats.append(rerun_stat)
            
        elif name == "Rerun end":
            # Rerun end=%f
            # This one is the rerun end time that has a little bit overhead. 
            latest_rerun = self._rerun_stats[-1] # Get the latest reran object. 
            latest_rerun.rerun_end_time = float(value) # Set their end time => this marks the end of a rerun segment.  

        else:
            raise ValueError(f"Invalid perf event: {line}")
        
    def _parse(self, file_path: str) -> None:
        """
        Iterates over each line of the log file 
        for perf events
        """
        rerun_all_temp_holder = []
        with open(file_path) as fd:
            for line in fd:
                line_start_idx = line.find("PERF")
                if line_start_idx != -1:
                    if 'RERUN ALL' in line: 
                        line = ' '.join(token.strip() for token in line.split('|')[1:])
                        rerun_all_temp_holder.append(line) 
                        if len(rerun_all_temp_holder) == 3: 
                            self._rerun_all_stats.append(copy(rerun_all_temp_holder))
                            rerun_all_temp_holder.clear()
                    else: 
                        self._handle_perf_line(line[line_start_idx:])

    def _match_cell_start(self, cur_rerun: RerunPerfStat):
        """
        Iterates through the list of Scheduled events (scheduled_times)
        to find the Schedule event time of each reran cell in
        cur_rerun.
        
        First cell to be scheduled for rerun: 
        Sets the first_cell_schedule_time using the
        earliest Schedule event timestamp of reran cells. 
        """
        to_remove_idx = []
        reran_cells = set(cur_rerun.reran_cells)
        for idx, (cell_id, timestamp) in enumerate(self._cell_scheduled_times):
            if not reran_cells:
                break
            
            # Time is organized top (recent) -> bottom (past)
            if cell_id in reran_cells and timestamp >= cur_rerun.rerun_start_time:
                reran_cells.remove(cell_id)
                cur_rerun.first_cell_schedule_time = min(
                    cur_rerun.first_cell_schedule_time, timestamp
                )
                to_remove_idx.append(idx)
        
        # Remove all of this rerun segment cell's on schedule time since 
        # we already got the first scheduled cell's time. 
        self._cell_scheduled_times = [
            cell for idx, cell in enumerate(self._cell_scheduled_times) if idx not in to_remove_idx
        ]

    def _match_cell_end(self, cur_rerun: RerunPerfStat):
        """
        Iterates through the list of Executed events
        to find the Executed event time of each reran cell in
        cur_rerun. 
        
        Sets the last_cell_executed_time using the
        latest Exexcuted event timestamp of reran cells
        """
        to_remove_idx = []
        reran_cells = set(cur_rerun.reran_cells)
        for idx, (cell_id, timestamp) in enumerate(self._cell_executed_times):
            if not reran_cells:
                break
            
            # All seen executed times will for sure be part of our rerun. 
            # Which means that they are the cells that got reran for this 
            # segment of the log file. 
            if cell_id in reran_cells:
                reran_cells.remove(cell_id)
                cur_rerun.last_cell_executed_time = max(
                    cur_rerun.last_cell_executed_time, timestamp
                )
                to_remove_idx.append(idx)

        # Remove all cells related to this rerun segment since we are done 
        # with it (extracted the last cell executed time). 
        self._cell_executed_times = [
            cell for idx, cell in enumerate(self._cell_executed_times) if idx not in to_remove_idx
        ]
        
    def _match_cells_to_reruns(self):
        """
        For each rerun, match cell events to the rerun the
        event was part of.
        """

        # the earliest reruns are at the beginning of _rerun_stats list
        # reverse the list so the earliest events are at the end
        # then we pop the events off the end until rerun_queue is empty
        rerun_queue = copy(self._rerun_stats)
        rerun_queue.reverse()
        
        while rerun_queue:
            cur_rerun = rerun_queue.pop()
            self._match_cell_start(cur_rerun)
            self._match_cell_end(cur_rerun)

    @property
    def rerun_perf_stats(self) -> list[RerunPerfStat]:
        """ Public getter method to use the rerun stats for analysis. """
        return self._rerun_stats

    def pretty_print_rerun_stats(self) -> None:
        """ Formatted print of all rerun stats, cell ids are excluded. """
        out_msg = ["Reruns:"]
        for idx, rerun in enumerate(self._rerun_stats):
            rerun_msg = (
                f"Rerun idx: {idx}\n"
                f"Number of cells reran: {len(rerun.reran_cells)}\n"
                f"Rerun start timestamp: {rerun.rerun_start_time}ms\n"
                f"First cell scheduled timestamp: {rerun.first_cell_schedule_time}ms\n"
                f"Last cell executed timestamp: {rerun.last_cell_executed_time}ms\n"
                f"Rerun end timestamp: {rerun.rerun_end_time}ms\n"
            )
            out_msg.append(rerun_msg)
        print("\n".join(out_msg))

    def average_overhead(self) -> dict[int, list[float, int]]:
        """
        Returns a dict
        num cells in rerun -> average overhead of rerun in ms, num reruns. 
        see how rerun overhead changes as we get more cells that we need to rerun. 
        """
        ret = {}
        for rerun in self._rerun_stats:
            n_cells = len(rerun.reran_cells)
            overhead = rerun.first_cell_schedule_time - rerun.rerun_start_time
            if info := ret.get(n_cells):
                info[0] += overhead
                info[1] += 1 # accumulate reruns with this exact num of cells to rerun. 
            else:
                ret[n_cells] = [overhead, 1]

        return ret
    
    def average_totalRerunTime(self) -> dict[int, list[float, int]]:
        """
        Returns a dict
        modification -> average overhead of rerun in ms, cells reran  
        see how rerun overhead changes as we get more cells that we need to rerun. 
        """
        ret = {}
        for rerun in self._rerun_stats:
            n_cells = len(rerun.reran_cells)
            overhead = rerun.first_cell_schedule_time - rerun.rerun_start_time
            if info := ret.get(n_cells):
                info[0] += overhead
                info[1] += 1 # accumulate reruns with this exact num of cells to rerun. 
            else:
                ret[n_cells] = [overhead, 1]

        return ret

    def print_rerun_all_stats(self) -> dict[int, str]: 
        for idx, modification_set in enumerate(self._rerun_all_stats): 
            perf = '\n'.join(modification_set) 
            print(f'Modification {idx}:\n{perf}\n')

    def total_rerun_execution_time(self) -> dict[int, list[float, int]]: 
        """ 
        Returns a dict 
        modification id -> time taken for all scheduled rerun cells to rerun, number of cells reran 
        
        visualize total time to execute scheduled rerun cells 
        idenitfy if we can get better performance by not reruning unnecessary cells. 
        """ 
        ret = {}
       
        for rerun_id, rerun in enumerate(self._rerun_stats): 
            n_cells = len(rerun.reran_cells) 
            execution_time = rerun.last_cell_executed_time - rerun.first_cell_schedule_time 
            ret[rerun_id] = [execution_time, n_cells] 
        return ret
    
    def rerun_specific_overhead(self) -> dict[int, list[float, int]]: 
        """ 
        Returns a dict 
        modification id -> time taken to prepare for rerun, number of cells reran 
        
        get each rerun specific overhead
        help us visualize how long each rerun method takes to calculate 
        which cells should be reran. 
        """ 
        ret = {}
       
        for rerun_id, rerun in enumerate(self._rerun_stats): 
            n_cells = len(rerun.reran_cells) 
            overhead = rerun.first_cell_schedule_time - rerun.rerun_start_time
            ret[rerun_id] = [overhead, n_cells] 
        return ret
    
def plot_average_runtime_chart(rerun: RerunPerfStat) -> None:
        processes = [
            {
                "name": "Handling Rerun Signal",
                "start": 0,
                "stop": rerun.first_cell_schedule_time - rerun.rerun_start_time,
            }, 
            {
                "name": "Cells executing (Rerun)",
                "start": rerun.first_cell_schedule_time - rerun.rerun_start_time,
                "stop": rerun.last_cell_executed_time - rerun.first_cell_schedule_time,
            },
        ]

        process_names = [p["name"] for p in processes]
        start_times = [p["start"] for p in processes]
        durations = [p["stop"] - p["start"] for p in processes]
        y_positions = np.arange(len(processes))
        
        # Create a figure and axis
        plt.figure(figsize=(10, 6))
        
        # Plot horizontal bars (Gantt chart)
        plt.barh(y_positions, durations, left=start_times, height=0.4, color='skyblue', edgecolor='black')
        
        # Customize the plot
        plt.yticks(y_positions, process_names)
        plt.xlabel('Time (milliseconds)')
        plt.ylabel('Processes')
        plt.title('Process Latency (Start and Stop Times)')
        plt.grid(True, axis='x', linestyle='--', alpha=0.7)
        
        # Adjust layout to prevent label clipping
        plt.tight_layout()

if __name__ == "__main__": 
    stat = PerfStat(perf_log_file) # Defined up there ^^
    stat.pretty_print_rerun_stats()

    print('Average rerun overhead: number of cells -> [avg time, number of reruns]')
    print(stat.average_overhead())

    print('All Total Reran Cell Execution time: rerun_id -> [time (ms), number of cells reran]')
    print(stat.total_rerun_execution_time())

    print('All Rerun Overhead: rerun_id -> [time (ms), number of cells reran]') 
    print(stat.rerun_specific_overhead())
    
    print('\n')
    print('RERUN ALL TIMES: ')
    stat.print_rerun_all_stats()
    
    # Print out stats information in a bar chart. 
    # plot_average_runtime_chart(stat.rerun_perf_stats[-1])


