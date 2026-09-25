import vitaldb
import numpy as np
import pandas as pd

vf = vitaldb.VitalFile('data/raw/vitaldb_pilot/1.vital')
st = vf.to_pandas(['Solar8000/ST_II'], interval=1.0)['Solar8000/ST_II']

def max_consec(sub):
    values = sub.values
    is_event = (values <= -1.0)
    is_nan = np.isnan(values)
    max_c = 0
    curr_c = 0
    curr_gap = 0
    for val, nan in zip(is_event, is_nan):
        if nan:
            curr_gap += 1
            if curr_gap > 2:
                curr_c = 0
        elif val:
            curr_c += 1 + curr_gap
            curr_gap = 0
            if curr_c > max_c:
                max_c = curr_c
        else:
            curr_c = 0
            curr_gap = 0
    return max_c

print("=== Case 1 Timeline Inspection ===")
# Episode occurred around 10663 to 10848s (min 177.7 to 180.8)
for t_min in [163.0, 164.0, 165.0, 166.0, 167.0, 168.0, 169.0, 170.0]:
    t_sec = int(t_min * 60)
    obs = st.iloc[t_sec : t_sec + 300]
    gap = st.iloc[t_sec + 300 : t_sec + 600]
    target = st.iloc[t_sec + 600 : t_sec + 900]
    
    obs_c = max_consec(obs)
    gap_c = max_consec(gap)
    target_c = max_consec(target)
    
    print(f"Window start {t_min:5.1f}m ({t_sec:5d}s):")
    print(f"   Obs   [{t_sec:5d} - {t_sec+300:5d}s | {t_min:5.1f} - {t_min+5:5.1f}m]: min={np.nanmin(obs.values):.2f}, consec={obs_c}s")
    print(f"   Gap   [{t_sec+300:5d} - {t_sec+600:5d}s | {t_min+5:5.1f} - {t_min+10:5.1f}m]: min={np.nanmin(gap.values):.2f}, consec={gap_c}s")
    print(f"   Target[{t_sec+600:5d} - {t_sec+900:5d}s | {t_min+10:5.1f} - {t_min+15:5.1f}m]: min={np.nanmin(target.values):.2f}, consec={target_c}s")
