import json, math
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
arena_root=Path(__file__).resolve().parents[1]
maps=json.loads((arena_root/'target/map-v6-previews.json').read_text())['maps']
colors={'GRASS_BLOCK':(83,121,64),'MOSS_BLOCK':(71,104,57),'STONE':(112,120,122),'ANDESITE':(138,145,143),'MOSSY_COBBLESTONE':(100,117,93),'SAND':(218,196,142),'SANDSTONE':(196,172,120),'SMOOTH_SANDSTONE':(234,212,161),'CUT_SANDSTONE':(205,183,135),'CHISELED_SANDSTONE':(188,162,112),'SNOW_BLOCK':(228,237,236),'SNOW':(244,248,247),'BLUE_ICE':(106,166,211),'RED_SAND':(183,99,57),'RED_TERRACOTTA':(148,66,46),'ORANGE_TERRACOTTA':(189,112,55),'YELLOW_TERRACOTTA':(208,163,65),'OAK_LEAVES':(48,91,50),'SPRUCE_LEAVES':(39,74,64),'JUNGLE_LEAVES':(38,109,53),'CHERRY_LEAVES':(221,151,177),'PINK_PETALS':(227,165,184),'OAK_LOG':(115,87,53),'JUNGLE_LOG':(112,85,48),'CHERRY_LOG':(104,65,73),'SPRUCE_LOG':(81,62,40),'STONE_BRICKS':(131,139,139),'SEA_LANTERN':(206,237,217),'SHORT_GRASS':(76,114,59),'FERN':(69,108,54),'DEAD_BUSH':(133,103,63),'DIRT':(109,85,61)}
canvas=Image.new('RGB',(2100,1230),(19,27,30));d=ImageDraw.Draw(canvas)
try: title=ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf',25);small=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',17)
except: title=small=ImageFont.load_default()
d.text((36,22),'V6 TERRAIN REVIEW  /  geometry generated from ArenaLandscape',font=title,fill=(230,239,229))
d.text((36,60),'Top-surface preview with flat material colours. Native Minecraft textures and rendering are not represented.',font=small,fill=(153,176,173))
for n,m in enumerate(maps):
 ox=(n%3)*700+350;oy=(n//3)*560+330
 d.rounded_rectangle(((n%3)*700+15,(n//3)*560+105,(n%3)*700+685,(n//3)*560+650),radius=18,fill=(28,39,41),outline=(50,66,65))
 d.text(((n%3)*700+38,(n//3)*560+123),m['name'],font=title,fill=(223,232,217))
 def p(x,z,h):return(ox+(x-z)*1.48,oy+(x+z)*.75-(h-64)*3)
 for x,z,h,mat in sorted(m['cells'],key=lambda c:c[0]+c[1]):
  color=colors.get(mat,(113,123,106));top=[p(x,z,h),p(x+3,z,h),p(x+3,z+3,h),p(x,z+3,h)]
  if h>64:
   d.polygon([top[1],top[2],p(x+3,z+3,64),p(x+3,z,64)],fill=tuple(int(v*.67) for v in color))
   d.polygon([top[2],top[3],p(x,z+3,64),p(x+3,z+3,64)],fill=tuple(int(v*.82) for v in color))
  d.polygon(top,fill=color)
canvas.save(arena_root/'target/map-v6-overview.png')
