"""Offline, bounded NBT reader and build converter. Never imports entities or commands."""
import gzip
import io
import json
import struct
import sys
import zlib
from pathlib import Path
import numpy as np

MAX_BYTES = 128 * 1024 * 1024


def nbt(raw):
    if len(raw) > MAX_BYTES:
        raise ValueError('NBT exceeds limit')
    stream = io.BytesIO(raw)
    def read(n):
        if n < 0 or n > MAX_BYTES:
            raise ValueError('Invalid NBT length')
        data = stream.read(n)
        if len(data) != n:
            raise ValueError('Truncated NBT')
        return data
    def number(fmt):
        return struct.unpack('>' + fmt, read(struct.calcsize(fmt)))[0]
    def string():
        return read(number('H')).decode('utf-8')
    def tag(kind, depth=0):
        if depth > 64:
            raise ValueError('NBT nesting exceeds limit')
        if kind in range(1, 7):
            return number({1:'b',2:'h',3:'i',4:'q',5:'f',6:'d'}[kind])
        if kind == 7:
            return read(number('i'))
        if kind == 8:
            return string()
        if kind == 9:
            child, count = number('B'), number('i')
            if count < 0 or count > 16000000:
                raise ValueError('Invalid list length')
            return [tag(child, depth+1) for _ in range(count)]
        if kind == 10:
            out = {}
            while True:
                child = number('B')
                if not child:
                    return out
                name = string()
                out[name] = tag(child, depth+1)
        if kind in (11, 12):
            count = number('i')
            if count < 0 or count > 16000000:
                raise ValueError('Invalid array length')
            return [number('i' if kind == 11 else 'q') for _ in range(count)]
        raise ValueError('Unknown NBT tag ' + str(kind))
    kind = number('B')
    string()
    return tag(kind)


def load(path):
    with gzip.open(path, 'rb') as src:
        raw = src.read(MAX_BYTES+1)
    return nbt(raw)


def state(entry):
    props = entry.get('Properties', {})
    return entry['Name'] + ('[' + ','.join(k+'='+v for k,v in sorted(props.items())) + ']' if props else '')


def unpack(longs, count, bits, padded=False):
    mask = (1 << bits)-1
    values = np.zeros(count, dtype=np.uint16)
    words = [v & ((1<<64)-1) for v in longs]
    for i in range(count):
        word, shift = (i//(64//bits), i%(64//bits)*bits) if padded else divmod(i*bits,64)
        value = words[word] >> shift
        if not padded and shift+bits > 64:
            value |= words[word+1] << (64-shift)
        values[i] = value & mask
    return values


def schematic(path):
    d = load(path)
    if 'Regions' in d:
        if len(d['Regions']) != 1:
            raise ValueError('Expected one Litematica region')
        r = next(iter(d['Regions'].values()))
        w,h,l = [abs(r['Size'][a]) for a in ('x','y','z')]
        if min(w,h,l)<1 or w*h*l>16000000:raise ValueError('Invalid Litematica volume')
        palette = [state(e) for e in r['BlockStatePalette']]
        blocks = unpack(r['BlockStates'],w*h*l,max(2,(len(palette)-1).bit_length())).reshape(h,l,w)
        return palette, blocks
    d=d.get('Schematic',d)
    w,h,l = [d[a] for a in ('Width','Height','Length')]
    if w*h*l > 16000000:
        raise ValueError('Build exceeds volume limit')
    if isinstance(d.get('Blocks'),bytes):
        ids=np.frombuffer(d['Blocks'],np.uint8).astype(np.uint16)
        if 'AddBlocks' in d:
            extra=np.frombuffer(d['AddBlocks'],np.uint8)
            ids |= np.array([(extra[i//2] >> (4*(i%2))) & 15 for i in range(len(ids))],np.uint16)<<8
        meta=np.frombuffer(d['Data'],np.uint8)
        pairs=ids*16+meta
        unique, inverse=np.unique(pairs,return_inverse=True)
        return ['legacy:%d:%d'%(v//16,v%16) for v in unique], inverse.astype(np.uint16).reshape(h,l,w)
    b=d.get('Blocks',d)
    palette=['']*len(b['Palette'])
    for s,i in b['Palette'].items(): palette[i]=s
    raw=b.get('Data',b.get('BlockData'))
    values=[]; value=shift=0
    for byte in raw:
        value |= (byte&127)<<shift
        if byte&128:
            shift+=7
            if shift>28: raise ValueError('Invalid palette varint')
        else:
            values.append(value); value=shift=0
    if shift or len(values)!=w*h*l or max(values)>=len(palette): raise ValueError('Invalid block data')
    return palette,np.array(values,np.uint16).reshape(h,l,w)


def chunks(root):
    root=Path(root)
    region=root/'region'
    if not region.is_dir(): region=root/'dimensions/minecraft/overworld/region'
    for path in sorted(region.glob('r.*.*.mca')):
        raw=path.read_bytes()
        for i in range(1024):
            offset=int.from_bytes(raw[i*4:i*4+3],'big')*4096
            if not offset: continue
            size=int.from_bytes(raw[offset:offset+4],'big')
            kind=raw[offset+4]
            if size>MAX_BYTES or kind not in (1,2,3): raise ValueError('Unsupported region compression')
            payload=raw[offset+5:offset+4+size]
            if kind==1:
                with gzip.GzipFile(fileobj=io.BytesIO(payload)) as src:payload=src.read(MAX_BYTES+1)
            if kind==2:
                dec=zlib.decompressobj(); payload=dec.decompress(payload,MAX_BYTES+1)
            yield nbt(payload)


def world_summary(root):
    sections=[]
    for d in chunks(root):
        d=d.get('Level',d)
        for s in d.get('sections',d.get('Sections',[])):
            b=s.get('block_states',{})
            palette=b.get('palette',s.get('Palette',[]))
            names=[state(e) for e in palette]
            if 'Blocks' in s:
                names=['legacy:%d'%v for v in set(s['Blocks'])]
            if any(n not in ('minecraft:air','minecraft:cave_air','minecraft:void_air','legacy:0') for n in names):
                sections.append((d['xPos'],s['Y'],d['zPos'],names))
    print(Path(root).name, 'nonempty sections',len(sections),'bounds', [(min(v[i] for v in sections),max(v[i] for v in sections)) for i in range(3)])
    Path('arena/tools/'+Path(root).name.replace(' ','_')+'-sections.json').write_text(json.dumps(sections))


def world_crop(root, bounds):
    x0,x1,y0,y1,z0,z1=bounds
    volume=np.zeros((y1-y0,z1-z0,x1-x0),np.uint16)
    palette=['minecraft:air']; index={palette[0]:0}
    mapping=json.loads(Path('arena/tools/legacy-blocks.json').read_text())['blocks']
    for d in chunks(root):
        d=d.get('Level',d); cx,cz=d['xPos']*16,d['zPos']*16
        if cx>=x1 or cx+16<=x0 or cz>=z1 or cz+16<=z0: continue
        for s in d.get('sections',d.get('Sections',[])):
            cy=s['Y']*16
            if cy>=y1 or cy+16<=y0:continue
            if 'Blocks' in s:
                ids=np.frombuffer(s['Blocks'],np.uint8).astype(np.uint16)
                meta=np.frombuffer(s['Data'],np.uint8)
                pairs=ids*16+np.array([(meta[i//2]>>(4*(i%2)))&15 for i in range(4096)],np.uint16)
                keys, inverse=np.unique(pairs,return_inverse=True)
                names=[mapping.get('%d:%d'%(v//16,v%16)) for v in keys]
                if any(v is None for v in names):raise ValueError('Unknown legacy pair')
                blockids=inverse
            else:
                b=s.get('block_states',{})
                names=[state(e) for e in b.get('palette',s.get('Palette',[{'Name':'minecraft:air'}]))]
                longs=b.get('data',s.get('BlockStates',[]))
                blockids=unpack(longs,4096,max(4,(len(names)-1).bit_length()),d.get('DataVersion',0)>=2529) if longs else np.zeros(4096,np.uint16)
            remap=[]
            for name in names:
                if name not in index:index[name]=len(palette);palette.append(name)
                remap.append(index[name])
            blocks=np.array(remap,np.uint16)[blockids].reshape(16,16,16)
            xa,xb=max(x0,cx),min(x1,cx+16);ya,yb=max(y0,cy),min(y1,cy+16);za,zb=max(z0,cz),min(z1,cz+16)
            volume[ya-y0:yb-y0,za-z0:zb-z0,xa-x0:xb-x0]=blocks[ya-cy:yb-cy,za-cz:zb-cz,xa-cx:xb-cx]
    return palette,volume


def preview(name,palette,blocks):
    from PIL import Image
    import hashlib
    solid=np.array([s not in ('minecraft:air','minecraft:cave_air','minecraft:void_air') for s in palette])
    top=np.argmax(solid[blocks][::-1],axis=0)
    y=blocks.shape[0]-1-top
    zz,xx=np.indices(y.shape)
    colors=[]
    for s in palette:
        c=list(hashlib.md5(s.split('[')[0].encode()).digest()[:3])
        for key,col in [('air',(16,20,29)),('grass',(75,143,65)),('leaves',(35,98,49)),('sand',(216,195,139)),('quartz',(225,220,215)),('stone',(125,132,139)),('water',(48,95,188)),('planks',(163,117,67)),('dirt',(112,79,51)),('snow',(223,238,246))]:
            if key in s:c=col
        colors.append(c)
    rgb=np.array(colors,np.uint8)[blocks[y,zz,xx]]
    Image.fromarray(rgb).resize((rgb.shape[1]*3,rgb.shape[0]*3)).save('arena/tools/'+name+'.png')
    np.savez_compressed('arena/tools/'+name+'.npz',palette=np.array(palette),blocks=blocks)
    print(name,blocks.shape,'nonair',int(np.sum(solid[blocks])), 'palette',len(palette))


def compile_builds():
    """Build-time only. The shipped plugin reads this small, entity-free format."""
    specs=[('arena','Frost Ring',0,7,'packed_ice','stone_bricks'),
           ('fighter-island','Fighter Circle',0,6,'iron_sword','stone_bricks'),
           ('clash royale arena','Royal Bridges',0,6,'blue_banner','blue_concrete'),
           ('1-1 castle','Castle Gardens',1,3,'mossy_stone_bricks','stone_bricks'),
           ('small arena','Sandstone Hall',1,7,'sandstone','cut_sandstone'),
           ('woodland','Woodland Court',1,3,'spruce_sapling','dark_oak_planks'),
           ('c6100af5-9b06-4a9f-8ec6-8854f91b3cf9','Sky Blossom',1,39,'cherry_sapling','quartz_block'),
           ('medium arena','Sunstone Sanctuary',2,18,'sunflower','smooth_sandstone'),
           ('coloseum','Grand Colosseum',2,1,'chiseled_sandstone','sandstone'),
           ('lobby','Colorful Citadel',-1,70,'nether_star','stone_bricks')]
    out=Path('arena/src/main/resources/builds');out.mkdir(parents=True,exist_ok=True)
    report=[]
    for number,(source,name,size,floor,icon,trim) in enumerate(specs):
        d=np.load('arena/tools/'+source+'.npz');p=list(d['palette']);b=d['blocks'].copy()
        # Trim accidental flat-world apron, without introducing opaque terrain below the island.
        if source=='woodland':b=b[:,28:228,16:112]
        if source=='fighter-island':
            z,x=np.indices(b.shape[1:]);b[:,(x-52)**2+(z-52)**2>50**2]=0
        def block(s):
            s='minecraft:'+s if ':' not in s else s
            if s not in p:p.append(s)
            return p.index(s)
        air=block('air')
        for i,s in enumerate(p):
            s=s.replace('minecraft:grass_path','minecraft:dirt_path').replace('minecraft:grass[','minecraft:short_grass[')
            if s=='minecraft:grass':s='minecraft:short_grass'
            for old,new in [('wall_sign','oak_wall_sign'),('sign','oak_sign'),('stone_slab','smooth_stone_slab'),('stone_brick_slab','stone_brick_slab')]:
                if s.split('[')[0]=='minecraft:'+old:s=s.replace('minecraft:'+old,'minecraft:'+new,1)
            if s.split('[')[0].endswith('_wall'):
                import re
                s=re.sub(r'(north|south|east|west)=false',r'\1=none',s)
                s=re.sub(r'(north|south|east|west)=true',r'\1=low',s)
            # Freeze vegetation and remove executable, scheduled and portal blocks.
            if 'leaves[' in s:
                import re
                s=re.sub('persistent=false','persistent=true',s)
            if any(k in s.split('[')[0] for k in ('command_block','structure_block','jigsaw','spawner','portal','end_gateway','repeater','comparator','redstone_wire','observer','piston','hopper','sculk_sensor')):
                b[b==i]=air
            p[i]=s
        h,l,w=b.shape
        if size>=0:
            # A pair of matching, protected entry rooms on actual open walking floors.
            openids=np.array([s in ('minecraft:air','minecraft:cave_air','minecraft:void_air') for s in p])
            safe=(~openids[b[floor]])&openids[b[floor+1]]&openids[b[floor+2]]&openids[b[floor+3]]
            candidates=[]
            for z in range(12,l-12):
                for x in range(11,w-11):
                    if safe[z-7:z+8,x-5:x+6].all():candidates.append((x,z))
            if not candidates:
                # Gardens can be uneven; use the largest verified open patch and level only the entry rooms.
                for z,x in np.argwhere(safe):
                    if 11<x<w-11 and 12<z<l-12:candidates.append((int(x),int(z)))
            if not candidates:raise ValueError('No safe spawn floor for '+name)
            left=min(candidates,key=lambda q:(q[0]-w*.24)**2+(q[1]-l*.5)**2)
            right=min(candidates,key=lambda q:(q[0]-w*.76)**2+(q[1]-left[1])**2)
            if right[0]-left[0]<22:
                candidates=[(int(x),int(z)) for z,x in np.argwhere(safe) if 11<x<w-11 and 12<z<l-12]
                left=min(candidates,key=lambda q:(q[0]-w*.24)**2+(q[1]-l*.5)**2)
                right=min(candidates,key=lambda q:(q[0]-w*.76)**2+(q[1]-left[1])**2)
            if right[0]-left[0]<22:raise ValueError('Insufficient spawn separation '+name)
            gates=[]
            for side,(x,z) in enumerate((left,right)):
                wall=block(trim);glass=block('tinted_glass');bars=block('iron_bars');light=block('sea_lantern')
                b[floor,z-8:z+9,x-5:x+6]=wall
                b[floor+1:floor+6,z-8:z+9,x-5:x+6]=air
                b[floor+6,z-8:z+9,x-5:x+6]=glass
                for zz in (z-8,z+8):b[floor+1:floor+6,zz,x-5:x+6]=wall
                back=x-5 if side==0 else x+5;gate=x+5 if side==0 else x-5
                b[floor+1:floor+6,z-8:z+9,back]=wall
                b[floor+1:floor+6,z-8:z+9,gate]=bars
                b[floor+6,z,x]=light
                # An open, matching exit landing gives the closing gate a guaranteed safe ejection point.
                a,c=(gate+1,gate+5) if side==0 else (gate-4,gate)
                b[floor,z-8:z+9,a:c]=wall
                b[floor+1:floor+4,z-8:z+9,a:c]=air
                gates.append([x,z,gate])
        else:
            # Choose a clear central walking tile, never the roofs shown by a height-map preview.
            openids=np.array([s.endswith(':air') or s.endswith(':cave_air') or s.endswith(':void_air') for s in p])
            safe=(~openids[b[floor]])&openids[b[floor+1]]&openids[b[floor+2]]&openids[b[floor+3]]
            z,x=min(np.argwhere(safe),key=lambda q:(q[0]-l*.5)**2+(q[1]-w*.5)**2)
            gates=[[int(x),int(z),int(x)]]*2
        # Compact palette, exact unsigned shorts, deterministic gzip output.
        used, inverse=np.unique(b,return_inverse=True);p=[p[i] for i in used];b=inverse.astype(np.uint16).reshape(b.shape)
        payload=io.BytesIO();payload.write(b'CA8B');payload.write(struct.pack('>HHHHH',w,h,l,floor,len(p)))
        for s in p:
            encoded=s.encode();payload.write(struct.pack('>H',len(encoded)));payload.write(encoded)
        for gate in gates:payload.write(struct.pack('>HHH',*gate))
        payload.write(b.astype('>u2').tobytes())
        target=out/(str(number)+'.bin.gz');target.write_bytes(gzip.compress(payload.getvalue(),mtime=0))
        entry={'id':number,'source':source,'name':name,'size':size,'width':w,'length':l,'height':h,'floor':floor,'gates':gates,'icon':icon,'sha256':__import__('hashlib').sha256(target.read_bytes()).hexdigest()}
        report.append(entry);preview('final-'+str(number),p,b)
    (out/'catalogue.json').write_text(json.dumps(report,indent=2)+'\n',newline='\n')
    print(json.dumps(report,indent=2))


def self_test():
    for padded in (False,True):
        for bits in (4,5,9):
            expected=[(i*17+3)% (1<<bits) for i in range(137)]
            words=[0]*((len(expected)+(64//bits)-1)//(64//bits) if padded else (len(expected)*bits+63)//64)
            for i,value in enumerate(expected):
                word,shift=(i//(64//bits),i%(64//bits)*bits) if padded else divmod(i*bits,64)
                words[word]|=value<<shift
                if not padded and shift+bits>64:words[word+1]|=value>>(64-shift)
            words=[v&((1<<64)-1) for v in words]
            assert unpack(words,len(expected),bits,padded).tolist()==expected
    assert nbt(b'\x0a\x00\x00\x03\x00\x01x\x00\x00\x00\x2a\x00')=={'x':42}
    for bad in (b'',b'\x0a\x00\x00\x07\x00\x01x\xff\xff\xff\xff',b'\x0a\x00\x00\x09\x00\x01x\x01\xff\xff\xff\xff'):
        try:nbt(bad)
        except ValueError:pass
        else:raise AssertionError('Invalid NBT accepted')
    for path in Path('arena/src/main/resources/builds').glob('*.bin.gz'):
        with gzip.open(path,'rb') as src:
            assert src.read(4)==b'CA8B'
            w,h,l,floor,count=struct.unpack('>HHHHH',src.read(10))
            palette=[]
            for i in range(count):palette.append(src.read(struct.unpack('>H',src.read(2))[0]).decode())
            entries=[struct.unpack('>HHH',src.read(6)) for _ in range(2)]
            data=np.frombuffer(src.read(),'>u2').reshape(h,l,w)
            assert data.max()<count
            if path.stem.split('.')[0]!='9':
                for x,z,gate in entries:
                    assert palette[data[floor,z,x]]!='minecraft:air'
                    assert all(palette[data[y,z,x]]=='minecraft:air' for y in (floor+1,floor+2))
                    assert palette[data[floor+2,z,gate]]=='minecraft:iron_bars'
    print('Converter self-check passed: dense/padded palettes, bounded NBT and bundled entry floors/gates.')


def inspect(paths):
    for p in paths:
        p = Path(p)
        data = load(p / 'level.dat' if p.is_dir() else p)
        if p.is_dir():
            d = data.get('Data', data)
            print(p.name, json.dumps({k:v for k,v in d.items() if k in ('SpawnX','SpawnY','SpawnZ','spawn','Version','DataVersion','LevelName','WorldGenSettings','generatorName')}, default=str)[:1800])
        else:
            print(p.name, [(k, len(v) if isinstance(v, (list,bytes,dict)) else v) for k,v in data.items()])
            d = data.get('Schematic',data)
            print('dimensions', {k:d[k] for k in ('Width','Height','Length','Offset','Version','Metadata','Regions') if k in d and k not in ('Metadata','Regions')})
            if 'Palette' in d:
                print('palette',list(d['Palette'])[:8])
            if 'Blocks' in d and isinstance(d['Blocks'],dict):
                print('block keys',d['Blocks'].keys())
            if 'Regions' in d:
                print('regions', [(k,{x:v[x] for x in ('Position','Size')}) for k,v in d['Regions'].items()])


if __name__ == '__main__':
    if sys.argv[1]=='--self-test':self_test()
    elif sys.argv[1]=='--compile':compile_builds()
    elif sys.argv[1]=='--preview':
        p=Path(sys.argv[2]); preview(sys.argv[3],*schematic(p))
    elif sys.argv[1]=='--crop':
        preview(sys.argv[3],*world_crop(sys.argv[2],list(map(int,sys.argv[4:]))))
    elif sys.argv[1]=='--worlds':
        for p in sys.argv[2:]: world_summary(p)
    else: inspect(sys.argv[1:])
