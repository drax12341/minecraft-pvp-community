import json, math, sys
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
arena_root=Path(__file__).resolve().parents[1]
lobby='--lobby' in sys.argv
maps=json.loads((arena_root/('target/courtyard-v7-preview.json' if lobby else 'target/map-v7-previews.json')).read_text())['maps']
cols=1 if lobby else 3
panel_w=1100 if lobby else 700
row_h=720 if lobby else 560
step=1 if lobby else 3
colors={'GRASS_BLOCK':(83,121,64),'MOSS_BLOCK':(71,104,57),'STONE':(112,120,122),'ANDESITE':(138,145,143),'MOSSY_COBBLESTONE':(100,117,93),'SAND':(218,196,142),'SANDSTONE':(196,172,120),'SMOOTH_SANDSTONE':(234,212,161),'CUT_SANDSTONE':(205,183,135),'CHISELED_SANDSTONE':(188,162,112),'SNOW_BLOCK':(228,237,236),'SNOW':(244,248,247),'BLUE_ICE':(106,166,211),'RED_SAND':(183,99,57),'RED_TERRACOTTA':(148,66,46),'ORANGE_TERRACOTTA':(189,112,55),'YELLOW_TERRACOTTA':(208,163,65),'OAK_LEAVES':(48,91,50),'SPRUCE_LEAVES':(39,74,64),'JUNGLE_LEAVES':(38,109,53),'CHERRY_LEAVES':(221,151,177),'PINK_PETALS':(227,165,184),'OAK_LOG':(115,87,53),'JUNGLE_LOG':(112,85,48),'CHERRY_LOG':(104,65,73),'SPRUCE_LOG':(81,62,40),'STONE_BRICKS':(131,139,139),'SEA_LANTERN':(206,237,217),'SHORT_GRASS':(76,114,59),'FERN':(69,108,54),'DEAD_BUSH':(133,103,63),'DIRT':(109,85,61)}
colors.update({'MOSSY_STONE_BRICKS':(111,127,104),'CRACKED_STONE_BRICKS':(124,126,118),'PACKED_ICE':(152,193,219),'CHERRY_PLANKS':(221,165,155),'DARK_OAK_PLANKS':(64,49,37),'QUARTZ_BRICKS':(225,225,215),'SMOOTH_QUARTZ':(234,234,223),'QUARTZ_PILLAR':(218,221,209),'CHISELED_QUARTZ_BLOCK':(201,209,198),'DARK_PRISMARINE':(40,85,81),'COPPER_BLOCK':(181,105,73),'GOLD_BLOCK':(231,190,55),'LIGHT_BLUE_STAINED_GLASS':(134,180,202),'POLISHED_DEEPSLATE':(57,63,65),'GRAVEL':(123,117,110),'WATER':(63,116,162),'PRISMARINE_BRICKS':(100,157,144),'SMOOTH_STONE_SLAB':(150,154,151),'AZURE_BLUET':(226,227,206)})
canvas=Image.new('RGB',(cols*panel_w,row_h*math.ceil(len(maps)/cols)+110),(19,27,30));d=ImageDraw.Draw(canvas)
try: title=ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf',25);small=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',17)
except: title=small=ImageFont.load_default()
d.text((36,22),'V7 TERRAIN REVIEW  /  actual generator geometry',font=title,fill=(230,239,229))
d.text((36,60),'Top-surface preview with flat material colours. Native Minecraft textures and rendering are not represented.',font=small,fill=(153,176,173))
for n,m in enumerate(maps):
 ox=(n%cols)*panel_w+panel_w/2;oy=(n//cols)*row_h+(450 if lobby else 330)
 d.rounded_rectangle(((n%cols)*panel_w+15,(n//cols)*row_h+105,(n%cols)*panel_w+panel_w-15,(n//cols)*row_h+row_h+90),radius=18,fill=(28,39,41),outline=(50,66,65))
 d.text(((n%cols)*panel_w+38,(n//cols)*row_h+123),m['name'],font=title,fill=(223,232,217))
 def p(x,z,h):return(ox+(x-z)*(3.5 if lobby else 1.48),oy+(x+z)*(1.75 if lobby else .75)-(h-64)*(5 if lobby else 3))
 for x,z,h,mat in sorted(m['cells'],key=lambda c:c[0]+c[1]):
  color=colors.get(mat,(113,123,106));top=[p(x,z,h),p(x+step,z,h),p(x+step,z+step,h),p(x,z+step,h)]
  if h>64:
   d.polygon([top[1],top[2],p(x+step,z+step,64),p(x+step,z,64)],fill=tuple(int(v*.67) for v in color))
   d.polygon([top[2],top[3],p(x,z+step,64),p(x+step,z+step,64)],fill=tuple(int(v*.82) for v in color))
  d.polygon(top,fill=color)
canvas.save(arena_root/('target/courtyard-v7-overview.png' if lobby else 'target/map-v7-overview.png'))
