# instrument.py <측정 worktree> — 측정 줄을 넣는다(커밋하지 않음): app-boot begin · 런처에 캐릭터가 뜬 때 face · 입은 파츠가 다 붙은 때 parts:n/m
#   window.__twMarks 에 [이름, performance.now()] — measure.js 가 읽는다
import sys,re
root=sys.argv[1]
p=root+'/apps/desktop/app/parts/launcher/launcher-preview.js'
s=open(p,encoding='utf8').read()
M="(window.__twMarks=window.__twMarks||[]).push([%s,performance.now()])"
if '__twMarks' not in s:
  s=s.replace("lScene.add(g); lChar=base;","lScene.add(g); lChar=base; "+M%"'face'"+";",1)
  s=s.replace("        await applyEquippedPartsToSeat(base, def);\n","        await applyEquippedPartsToSeat(base, def);\n        "+(M%"'parts:'+Object.keys(base.equippedPartObjs||{}).length+'/'+Object.keys(def.equippedParts||{}).length")+";\n",1)
  s="try{performance.setResourceTimingBufferSize(20000);}catch(_){}\n"+s
  assert s.count('__twMarks')==4, 'launcher-preview'
  open(p,'w',encoding='utf8').write(s)
p=root+'/apps/desktop/app/parts/launcher/app-boot.js'
s=open(p,encoding='utf8').read()
if '__twMarks' not in s:
  s=s.replace("    began = true;\n","    began = true;\n    "+M%"'begin'"+";\n",1)
  assert '__twMarks' in s
  open(p,'w',encoding='utf8').write(s)
print('ok')
