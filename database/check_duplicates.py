from sql_alchemy import SessionLocal, Dimension, Category
from collections import Counter

session = SessionLocal()

# Check dimensions
dims = session.query(Dimension).all()
dim_codes = [d.code for d in dims]
print(f'Total dimensions: {len(dims)}')
print(f'Unique dimension codes: {len(set(dim_codes))}')

dupes = {k: v for k, v in Counter(dim_codes).items() if v > 1}
if dupes:
    print(f'\nDuplicate dimensions found:')
    for code, count in sorted(dupes.items(), key=lambda x: x[1], reverse=True)[:10]:
        print(f'  {code}: {count} instances')
else:
    print('No duplicate dimensions found')

# Check categories
cats = session.query(Category).all()
cat_codes = [c.code for c in cats]
print(f'\nTotal categories: {len(cats)}')
print(f'Unique category codes: {len(set(cat_codes))}')

cat_dupes = {k: v for k, v in Counter(cat_codes).items() if v > 1}
if cat_dupes:
    print(f'\nDuplicate categories: {len(cat_dupes)} unique codes with duplicates')
    print('Top 10 most duplicated categories:')
    for code, count in sorted(cat_dupes.items(), key=lambda x: x[1], reverse=True)[:10]:
        print(f'  {code}: {count} instances')
else:
    print('No duplicate categories found')

session.close()
