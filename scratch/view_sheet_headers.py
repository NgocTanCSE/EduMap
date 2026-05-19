import glob
import os

files = glob.glob('scratch/sheet_[9]*.txt') + glob.glob('scratch/sheet_1[0-7]*.txt')
files.sort(key=lambda x: int(x.split('_')[1]))

with open('scratch/sheet_headers.txt', 'w', encoding='utf-8') as out:
    for fpath in files:
        out.write(f"\n================ FILE: {os.path.basename(fpath)} ================\n")
        with open(fpath, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            for line in lines[:15]:
                out.write(line)
print("Done writing headers!")
