import pandas as pd
df = pd.read_excel('EduMap_Documentationedited.xlsx', sheet_name=None)
for k, v in df.items():
    print(f'--- Sheet: {k} ---')
    print(v.to_string())