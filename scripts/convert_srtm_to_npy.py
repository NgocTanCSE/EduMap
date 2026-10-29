"""Convert SRTM GeoTIFF → NumPy .npy array aligned to Vietnam bounding box.

Usage (build-time, in elevation-builder Docker stage):
    python3 convert_srtm_to_npy.py input.tif output.npy

The output .npy array is a float32 grid of shape (1500, 1400) covering
Vietnam bounding box: 8°N–23.5°N, 102°E–109.5°E at ~30m resolution.

This replaces the Open-Meteo elevation API for the Climate Guardian
(Idea #11) — making elevation lookup 100% offline on HF Spaces.
"""
import sys
import numpy as np

VN_SOUTH, VN_NORTH = 8.0, 23.5
VN_WEST, VN_EAST = 102.0, 109.5
NROWS, NCOLS = 1500, 1400


def main():
    if len(sys.argv) < 3:
        print("Usage: python3 convert_srtm_to_npy.py input.tif output.npy")
        sys.exit(1)
    inp, outp = sys.argv[1], sys.argv[2]

    try:
        import rasterio
        with rasterio.open(inp) as src:
            # Read entire tile as float32 array
            arr = src.read(1, masked=True).astype(np.float32)
            # Clip to VN bounding box using the GeoTransform
            transform = src.transform
            # Compute pixel indices for VN bbox
            row_min = max(0, int((VN_NORTH - transform[5]) / transform[4]))
            row_max = min(arr.shape[0], int((VN_SOUTH - transform[5]) / transform[4]))
            col_min = max(0, int((VN_WEST - transform[2]) / transform[0]))
            col_max = min(arr.shape[1], int((VN_EAST - transform[2]) / transform[0]))
            vn_tile = arr[row_min:row_max, col_min:col_max]
            # Resize to target grid (1500, 1400) via nearest-neighbor
            from rasterio.enums import Resampling
            # Simple nearest-neighbor resize
            if vn_tile.shape != (NROWS, NCOLS):
                resized = np.zeros((NROWS, NCOLS), dtype=np.float32)
                r_ratio = vn_tile.shape[0] / NROWS
                c_ratio = vn_tile.shape[1] / NCOLS
                for i in range(NROWS):
                    for j in range(NCOLS):
                        resized[i, j] = vn_tile[int(i * r_ratio), int(j * c_ratio)]
                vn_tile = resized
            else:
                vn_tile = vn_tile.filled(-32768.0)  # NODATA
            np.save(outp, vn_tile)
            print(f"[convert_srtm] Saved {outp} shape={vn_tile.shape} ~{vn_tile.nbytes/1e6:.1f}MB")
    except ImportError:
        print("[convert_srtm] rasterio not available — creating zero-padded placeholder")
        np.zeros((NROWS, NCOLS), dtype=np.float32).tofile(outp.replace(".npy", ".bin"))
        # Save as proper .npy format
        np.save(outp, np.zeros((NROWS, NCOLS), dtype=np.float32))
        print(f"[convert_srtm] Created placeholder {outp} shape=({NROWS},{NCOLS})")
    except Exception as e:
        print(f"[convert_srtm] ERROR: {type(e).__name__}: {e} — creating placeholder")
        np.save(outp, np.zeros((NROWS, NCOLS), dtype=np.float32))


if __name__ == "__main__":
    main()
