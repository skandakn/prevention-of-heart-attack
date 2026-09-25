import glob
import os
import numpy as np
import pandas as pd
import vitaldb

def compute_consecutive_runs(series_1hz, threshold=-1.0, max_allowed_gap_sec=2):
    """
    Compute max contiguous duration in seconds where series_1hz <= threshold.
    Gaps <= max_allowed_gap_sec are bridged; > max_allowed_gap_sec terminates run.
    """
    values = series_1hz.values
    is_event = (values <= threshold)
    is_nan = np.isnan(values)
    
    max_consec = 0
    curr_consec = 0
    curr_gap = 0
    
    for val, nan in zip(is_event, is_nan):
        if nan:
            curr_gap += 1
            if curr_gap > max_allowed_gap_sec:
                curr_consec = 0
        elif val:
            curr_consec += 1 + curr_gap
            curr_gap = 0
            if curr_consec > max_consec:
                max_consec = curr_consec
        else:
            curr_consec = 0
            curr_gap = 0
            
    return max_consec

def evaluate_pilot_cases():
    pilot_files = sorted(glob.glob('data/raw/vitaldb_pilot/*.vital'), key=lambda x: int(os.path.splitext(os.path.basename(x))[0]))
    print(f"Total pilot files found: {len(pilot_files)}")
    
    results = []
    
    # Parameters
    T_obs = 300      # 5 min
    T_gap = 300      # 5 min
    T_target = 300   # 5 min
    stride = 60      # 1 min
    total_span = T_obs + T_gap + T_target # 900 seconds
    
    for fpath in pilot_files:
        caseid = int(os.path.splitext(os.path.basename(fpath))[0])
        vf = vitaldb.VitalFile(fpath)
        
        # Load ST_II at 1 Hz
        st_data = vf.to_pandas(['Solar8000/ST_II'], interval=1.0)
        if 'Solar8000/ST_II' not in st_data.columns:
            print(f"Case {caseid}: Solar8000/ST_II not found!")
            continue
            
        st_series = st_data['Solar8000/ST_II']
        n_samples = len(st_series)
        duration_sec = n_samples
        duration_min = duration_sec / 60.0
        
        # 1. Full recording sustained ST episodes (>= 60s contiguous <= -1.0 mm)
        # Identify episodes across the full case
        values = st_series.values
        is_event = (values <= -1.0)
        is_nan = np.isnan(values)
        
        episodes = []
        curr_len = 0
        curr_gap = 0
        start_idx = None
        for i, (val, nan) in enumerate(zip(is_event, is_nan)):
            if nan:
                curr_gap += 1
                if curr_gap > 2:
                    if curr_len >= 60:
                        episodes.append((start_idx, curr_len))
                    curr_len = 0
                    start_idx = None
            elif val:
                if curr_len == 0:
                    start_idx = i - curr_gap
                curr_len += 1 + curr_gap
                curr_gap = 0
            else:
                if curr_len >= 60:
                    episodes.append((start_idx, curr_len))
                curr_len = 0
                curr_gap = 0
                start_idx = None
        if curr_len >= 60:
            episodes.append((start_idx, curr_len))
            
        # 2. Window-level evaluation WITHOUT prediction gap (concurrent detection):
        # Window of 300s, stride 60s
        concurrent_pos = 0
        concurrent_neg = 0
        total_concurrent_windows = 0
        
        for w_start in range(0, duration_sec - T_obs + 1, stride):
            total_concurrent_windows += 1
            w_series = st_series.iloc[w_start : w_start + T_obs]
            # Valid observations check: need at least some non-nan
            valid_count = (~np.isnan(w_series.values)).sum()
            if valid_count < 30: # missingness exclusion
                continue
            max_c = compute_consecutive_runs(w_series, threshold=-1.0)
            if max_c >= 60:
                concurrent_pos += 1
            else:
                concurrent_neg += 1
                
        # 3. Early-warning architecture WITH prediction gap:
        # T_obs: [w_start, w_start + 300)
        # T_gap: [w_start + 300, w_start + 600)
        # T_target: [w_start + 600, w_start + 900)
        # Positive requirements:
        # - No target information enters T_obs:
        #   Specifically, T_obs must NOT already contain a sustained ST event!
        # - 5-min gap occurs
        # - sustained ST event occurs in T_target (max_consec in T_target >= 60)
        #
        # Negative requirements:
        # - T_target does not contain sustained ST event (or indeterminate buffer)
        # - T_obs valid
        ew_pos_windows = []
        ew_neg_windows = []
        ew_excluded_windows = []
        
        for w_start in range(0, duration_sec - total_span + 1, stride):
            t_obs_start = w_start
            t_obs_end = w_start + T_obs
            t_gap_start = t_obs_end
            t_gap_end = t_obs_end + T_gap
            t_target_start = t_gap_end
            t_target_end = t_gap_end + T_target
            
            obs_series = st_series.iloc[t_obs_start : t_obs_end]
            target_series = st_series.iloc[t_target_start : t_target_end]
            
            # Check valid counts
            valid_obs = (~np.isnan(obs_series.values)).sum()
            valid_target = (~np.isnan(target_series.values)).sum()
            
            if valid_obs < 30 or valid_target < 30:
                ew_excluded_windows.append((w_start, "insufficient_data"))
                continue
                
            obs_max_c = compute_consecutive_runs(obs_series, threshold=-1.0)
            target_max_c = compute_consecutive_runs(target_series, threshold=-1.0)
            
            # Condition: No target event in T_obs
            if obs_max_c >= 60:
                # If T_obs already has a sustained event, it's not an early warning before an event;
                # the patient is ALREADY in an ischemic event!
                ew_excluded_windows.append((w_start, "event_already_in_obs"))
                continue
                
            if target_max_c >= 60:
                # Target sustained event occurs!
                ew_pos_windows.append(w_start)
            else:
                # Negative window: check if target is indeterminate buffer (-1.0 < min <= -0.8)
                target_vals = target_series.dropna().values
                if len(target_vals) > 0 and np.min(target_vals) <= -0.8:
                    # In buffer zone or transient dip without sustained 60s
                    # Check whether excluded as ambiguous or pure negative
                    ew_excluded_windows.append((w_start, "buffer_ambiguity"))
                else:
                    ew_neg_windows.append(w_start)
                    
        results.append({
            'caseid': caseid,
            'duration_min': round(duration_min, 1),
            'n_episodes': len(episodes),
            'episodes': episodes,
            'concurrent_pos': concurrent_pos,
            'concurrent_neg': concurrent_neg,
            'ew_pos': len(ew_pos_windows),
            'ew_neg': len(ew_neg_windows),
            'ew_excluded': len(ew_excluded_windows),
            'pos_start_times_sec': ew_pos_windows,
            'pos_start_times_min': [round(t/60.0, 1) for t in ew_pos_windows]
        })
        
    df_res = pd.DataFrame(results)
    print("\nSummary per case:")
    for r in results:
        print(f"Case {r['caseid']:2d}: Dur={r['duration_min']:5.1f}m | Episodes={r['n_episodes']} | ConcPos={r['concurrent_pos']} | EW_Pos={r['ew_pos']} | EW_Neg={r['ew_neg']} | EW_Excl={r['ew_excluded']} | EW_Pos_Min={r['pos_start_times_min']}")
        
    print("\n================== TOTALS ==================")
    print(f"Total corrected sustained ST episodes: {df_res['n_episodes'].sum()}")
    print(f"Total concurrent positive windows (no gap): {df_res['concurrent_pos'].sum()}")
    print(f"Total valid early-warning positive windows (with 5-min gap): {df_res['ew_pos'].sum()}")
    print(f"Total negative windows after exclusions: {df_res['ew_neg'].sum()}")
    print(f"Total cases containing valid early-warning positives: {(df_res['ew_pos'] > 0).sum()}")
    print(f"Cases with positives: {df_res[df_res['ew_pos'] > 0][['caseid', 'ew_pos']].to_dict(orient='records')}")

if __name__ == '__main__':
    evaluate_pilot_cases()
