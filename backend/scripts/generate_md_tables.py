import pandas as pd
import numpy as np

df_prop_a = pd.read_csv('scratch/cohort_a_raw_audit.csv')
df_final_a = pd.read_csv('scratch/cohort_a_final_verified.csv')
df_prop_b = pd.read_csv('scratch/cohort_b_raw_audit.csv')
df_final_b = pd.read_csv('scratch/cohort_b_final_verified.csv')

# Format a markdown table from a dataframe
def format_md_table(df, rejected_ids=None):
    if rejected_ids is None:
        rejected_ids = []
    lines = []
    lines.append("| Case ID | Status | Dur (h) | Dept | Age | HTN | DM | CAD/CABG | ECG_II | PLETH | SpO2 | ST_II | ECG_V5 | ST_V5 |")
    lines.append("| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |")
    for _, r in df.iterrows():
        cid = int(r['caseid'])
        status = "**REJECTED**" if cid in rejected_ids else "VERIFIED"
        dur = f"{r['duration_hrs']:.2f}" if pd.notnull(r['duration_hrs']) else "N/A"
        dept = str(r['department'])[:16]
        age = f"{int(r['age'])}" if pd.notnull(r['age']) else "N/A"
        htn = "Yes" if r['preop_htn'] == 1 else "No"
        dm = "Yes" if r['preop_dm'] == 1 else "No"
        cad = "Yes" if r['cad_cabg'] else "No"
        
        e2 = "✓" if r['has_ecg_ii'] else "✗"
        pl = "✓" if r['has_pleth'] else "✗"
        sp = "✓" if r['has_spo2'] else "✗"
        s2 = "✓" if r['has_st_ii'] else "✗"
        v5 = "✓" if r['has_ecg_v5'] else "✗"
        sv5 = "✓" if r['has_st_v5'] else "✗"
        
        lines.append(f"| {cid} | {status} | {dur} | {dept} | {age} | {htn} | {dm} | {cad} | {e2} | {pl} | {sp} | {s2} | {v5} | {sv5} |")
    return "\n".join(lines)

rej_a = [2772, 3192, 3042, 4246]
rej_b = [3687, 1374, 1344, 3398, 3486, 6081, 2146, 5130, 3450, 5262]

md_a = format_md_table(df_prop_a, rej_a)
md_b = format_md_table(df_prop_b, rej_b)

with open('scratch/table_cohort_a.md', 'w', encoding='utf-8') as f:
    f.write(md_a)
with open('scratch/table_cohort_b.md', 'w', encoding='utf-8') as f:
    f.write(md_b)

# Table for final verified 100 cases
md_final_a = format_md_table(df_final_a)
md_final_b = format_md_table(df_final_b)
with open('scratch/table_final_a.md', 'w', encoding='utf-8') as f:
    f.write(md_final_a)
with open('scratch/table_final_b.md', 'w', encoding='utf-8') as f:
    f.write(md_final_b)

print("Markdown tables written successfully to scratch/")
