"""Composite brand type onto the generated banner art.
Type is drawn here rather than asked of the image model so the letterforms are exact."""
from PIL import Image, ImageDraw, ImageFont
import os

HERE = os.path.dirname(os.path.abspath(__file__))
F = os.path.join(HERE, "fonts")
SRC = os.environ.get("BANNER_SRC", r"C:\Users\User\Downloads\banner_1021992.png")

AMBER   = (255, 157, 24)
AMBER_2 = (255, 181, 71)
CREAM   = (246, 236, 214)
DIM     = (168, 160, 140)

def archivo(size, wght=800, wdth=100):
    f = ImageFont.truetype(os.path.join(F, "Archivo-var.ttf"), size)
    f.set_variation_by_axes([wght, wdth])   # axis order is [Weight, Width]
    return f

def fit_archivo(draw, text, max_w, start, wght=800):
    """Largest size whose rendered width fits max_w."""
    size = start
    while size > 12:
        f = archivo(size, wght=wght)
        if draw.textlength(text, font=f) <= max_w:
            return f
        size -= 2
    return archivo(12, wght=wght)

def tracked(d, xy, text, font, fill, track):
    """PIL has no letter-spacing; draw glyph by glyph."""
    x, y = xy
    for ch in text:
        d.text((x, y), ch, font=font, fill=fill)
        x += d.textlength(ch, font=font) + track
    return x

def build(W, H, out, scale):
    im = Image.open(SRC).convert("RGB")
    # cover-crop the art to exactly 3:1
    tw, th = W, H
    ar_src, ar_dst = im.width / im.height, tw / th
    if ar_src > ar_dst:
        nw = int(im.height * ar_dst); im = im.crop(((im.width - nw) // 2, 0, (im.width - nw) // 2 + nw, im.height))
    else:
        nh = int(im.width / ar_dst); im = im.crop((0, (im.height - nh) // 2, im.width, (im.height - nh) // 2 + nh))
    im = im.resize((tw, th), Image.LANCZOS)

    d = ImageDraw.Draw(im)
    L = int(120 * scale)          # left margin
    cy = H // 2

    f_eyebrow = ImageFont.truetype(os.path.join(F, "BarlowCondensed-Medium.ttf"), int(30 * scale))
    f_head    = fit_archivo(d, "SCHRÖDINGER'S BOX", int(W * 0.545), int(128 * scale))
    f_sub     = ImageFont.truetype(os.path.join(F, "IBMPlexMono-Regular.ttf"), int(28 * scale))
    f_url     = ImageFont.truetype(os.path.join(F, "BarlowCondensed-Medium.ttf"), int(26 * scale))

    # eyebrow: short amber rule + tracked caps
    ey = cy - int(150 * scale)
    rule_w = int(56 * scale)
    d.line([(L, ey + int(15 * scale)), (L + rule_w, ey + int(15 * scale))], fill=AMBER, width=max(1, int(2 * scale)))
    tracked(d, (L + rule_w + int(20 * scale), ey), "QUANTUM OBSERVATION CHAMBER", f_eyebrow, AMBER_2, int(6 * scale))

    # headline
    hy = cy - int(96 * scale)
    d.text((L, hy), "SCHRÖDINGER'S BOX", font=f_head, fill=CREAM)

    # subline
    sy = hy + int(150 * scale)
    d.text((L, sy), "A live phase-space experiment — real Wigner physics, in the browser.", font=f_sub, fill=DIM)

    # url
    uy = sy + int(52 * scale)
    tracked(d, (L, uy), "OSMANTECHNOLOGIES.GITHUB.IO/SCHRODINGERS-BOX", f_url, (140, 120, 92), int(4 * scale))

    im.save(out, optimize=True)
    print(f"{os.path.basename(out):32s} {W}x{H}  {os.path.getsize(out)/1024:7.1f} KB")

build(2400, 800, os.path.join(HERE, "banner-3x1-2400.png"), 1.0)
build(1500, 500, os.path.join(HERE, "banner-3x1-1500.png"), 0.625)
