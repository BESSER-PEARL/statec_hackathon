# Minimal app/script entry point (if not using notebooks)
# Usage: python app.py --input data/sample.csv --out outputs/

import argparse
from pathlib import Path

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', type=str, default='data/sample.csv')
    parser.add_argument('--out', type=str, default='outputs/')
    args = parser.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    # TODO: implement logic
    (out_dir / 'hello.txt').write_text('Hello STATEC Hackathon!\n')

if __name__ == '__main__':
    main()
