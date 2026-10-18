import struct
from PIL import Image
import io

base = "D:\\Hasan\\Work\\life-os-hub-main\\life-os-hub-main\\build"
sizes = [16, 32, 48, 64, 128, 256]
pngs = []
for s in sizes:
    img = Image.open(f"{base}/icon_{s}.png").convert("RGBA")
    pngs.append(img)

ico_path = f"{base}/icon.ico"
with open(ico_path, "wb") as f:
    f.write(struct.pack("<HHH", 0, 1, len(pngs)))
    offset = 6 + 16 * len(pngs)
    entries = []
    for img in pngs:
        w, h = img.size
        bw = 0 if w >= 256 else w
        bh = 0 if h >= 256 else h
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        png_data = buf.getvalue()
        entries.append((bw, bh, png_data))
    for bw, bh, data in entries:
        f.write(struct.pack("<BBBBHHII", bw, bh, 0, 0, 1, 32, len(data), offset))
        offset += len(data)
    for _, _, data in entries:
        f.write(data)

print(f"ICO written: {ico_path}")
ico = Image.open(ico_path)
frames = ico.n_frames if hasattr(ico, "n_frames") else 1
print(f"Frames: {frames}, sizes:")
ico.seek(0)
for i in range(frames):
    ico.seek(i)
    print(f"  {ico.size}")
ico.seek(0)
