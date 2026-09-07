"""Announcement card: PAIRED WITH SPCX ON PONS. Art = existing GPT cube-cat render;
every letter set here in the brand fonts (image models don't get type)."""
from PIL import Image, ImageDraw, ImageFont
import os

HERE=os.path.dirname(os.path.abspath(__file__)); F=os.path.join(HERE,"fonts")
AMBER=(255,157,24); AMBER2=(255,181,71); CREAM=(246,236,214); DIM=(168,160,140); FAINT=(140,120,92)

def archivo(size,wght=800):
    f=ImageFont.truetype(os.path.join(F,"Archivo-var.ttf"),size)
    f.set_variation_by_axes([wght,100]); return f
def barlow(size): return ImageFont.truetype(os.path.join(F,"BarlowCondensed-Medium.ttf"),size)
def mono(size):   return ImageFont.truetype(os.path.join(F,"IBMPlexMono-Regular.ttf"),size)
def tracked(d,xy,t,font,fill,track):
    x,y=xy
    for ch in t:
        d.text((x,y),ch,font=font,fill=fill); x+=d.textlength(ch,font=font)+track
    return x

W,H=2400,1350
im=Image.new("RGB",(W,H),(5,4,3))

# art: straight-on cube+cat avatar, right side, large.
# GPT "pure black" is ~#010101 noise, so a straight paste leaves a visible seam box —
# screen-blend through a radial fade instead (house recipe for black renders on dark pages).
from PIL import ImageChops
art=Image.open(os.path.join(HERE,"avatar-source.png")).convert("RGB")
S=1150
art=art.resize((S,S),Image.LANCZOS)
ax,ay=W-S-95,(H-S)//2
region=im.crop((ax,ay,ax+S,ay+S))
blend=ImageChops.screen(region,art)
mask=Image.new("L",(S,S),0)
md=ImageDraw.Draw(mask)
md.ellipse((-S*0.12,-S*0.12,S*1.12,S*1.12),fill=255)
mask=mask.resize((S,S)).filter(__import__("PIL.ImageFilter",fromlist=["GaussianBlur"]).GaussianBlur(60))
im.paste(blend,(ax,ay),mask)

d=ImageDraw.Draw(im)
L=140; cy=H//2

# eyebrow
ey=cy-260
d.line([(L,ey+17),(L+64,ey+17)],fill=AMBER,width=2)
tracked(d,(L+86,ey),"LAUNCH PAIR — ROBINHOOD CHAIN",barlow(34),AMBER2,7)

# headline, two lines
h1=archivo(150); h2=archivo(150)
d.text((L,cy-190),"PAIRED WITH",font=h1,fill=CREAM)
d.text((L,cy-30),"SPCX",font=h2,fill=AMBER)
w_spcx=d.textlength("SPCX",font=h2)
d.text((L+w_spcx+44,cy-30),"ON PONS",font=h2,fill=CREAM)

# subline
d.text((L,cy+170),"The box gets a ticker. The pair is the observer.",font=mono(34),fill=DIM)

# brand footer
by=H-135
d.line([(L,by-28),(W-95,by-28)],fill=(255,157,24,30),width=1)
mk=18
d.polygon([(L+mk//2,by),(L+mk,by+mk//2),(L+mk//2,by+mk),(L,by+mk//2)],outline=AMBER)
tracked(d,(L+mk+18,by-6),"SCHRÖDINGER'S BOX",barlow(30),CREAM,6)
tracked(d,(L+560,by-4),"OSMANTECHNOLOGIES.GITHUB.IO/SCHRODINGERS-BOX",barlow(26),FAINT,4)

im.save(os.path.join(HERE,"paired-spcx-2400.png"),optimize=True)
im.resize((1600,900),Image.LANCZOS).save(os.path.join(HERE,"paired-spcx-1600.jpg"),"JPEG",quality=92,optimize=True)
for f in ("paired-spcx-2400.png","paired-spcx-1600.jpg"):
    print(f, round(os.path.getsize(os.path.join(HERE,f))/1024,1),"KB")
