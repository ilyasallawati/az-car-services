"""Generate AZ Car Services PWA icons (192 + 512)."""
from PIL import Image, ImageDraw

BG = (14, 17, 22)        # #0e1116
BODY = (245, 166, 35)    # #f5a623 amber
CABIN = (255, 194, 75)   # #ffc24b lighter amber
WHEEL = (14, 17, 22)
WHEEL_RIM = (120, 130, 145)

def draw_car(d, S):
    def rr(x0, y0, x1, y1, r, fill):
        d.rounded_rectangle([x0, y0, x1, y1], radius=r, fill=fill)

    # ground shadow
    d.ellipse([S*0.22, S*0.88, S*0.78, S*0.95], fill=(0, 0, 0, 90))

    # cabin (glass)
    rr(S*0.34, S*0.44, S*0.66, S*0.62, S*0.05, CABIN)
    # body
    rr(S*0.16, S*0.58, S*0.84, S*0.74, S*0.05, BODY)
    # door line hint
    d.line([S*0.5, S*0.58, S*0.5, S*0.74], fill=BG, width=max(2, int(S*0.012)))
    # wheels
    for cx in (S*0.33, S*0.67):
        d.ellipse([cx - S*0.065, S*0.76 - S*0.065, cx + S*0.065, S*0.76 + S*0.065], fill=WHEEL)
        d.ellipse([cx - S*0.03, S*0.76 - S*0.03, cx + S*0.03, S*0.76 + S*0.03], fill=WHEEL_RIM)

for S in (512, 192):
    img = Image.new("RGBA", (S, S), BG)
    draw_car(ImageDraw.Draw(img), S)
    img.save(f"public/icons/icon-{S}.png")
    print(f"icon-{S}.png written, {img.size}")
