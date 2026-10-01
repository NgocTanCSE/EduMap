"""Generate the EduMap mobile-web icon + splash PNG assets (PIL).
Re-run only if assets/ is missing (the committed PNGs are the source of truth for Docker)."""
from PIL import Image, ImageDraw, ImageFont
import os
def font(sz, bold=True):
    for p in ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
              "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
              "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]:
        if os.path.exists(p): return ImageFont.truetype(p, sz)
    return ImageFont.load_default()
ACCENT=(37,99,247); DARK=(15,23,42); WHITE=(255,255,255)
os.makedirs("assets", exist_ok=True)
# icon
img=Image.new("RGB",(512,512),DARK); d=ImageDraw.Draw(img)
f=font(230); tw,th=d.textbbox((0,0),"E",font=f)[2:]
d.text(((512-tw)/2,(512-th)/2-10),"E",fill=ACCENT,font=f); img.save("assets/icon.png")
# splash
img=Image.new("RGB",(1280,720),DARK); d=ImageDraw.Draw(img)
f=font(110); tw,th=d.textbbox((0,0),"EduMap",font=f)[2:]
x=(1280-tw)/2; d.text((x,720/2-120),"EduMap",fill=WHITE,font=f)
f2=font(28,False); tw2,th2=d.textbbox((0,0),"Map for Students",font=f2)[2:]
d.text(((1280-tw2)/2,720/2-10),"Map for Students",fill=(200,209,255),font=f2)
d.rectangle([x-30,720/2+60,x+tw+30,720/2+68],fill=ACCENT); img.save("assets/splash.png")
print("assets/generated")
