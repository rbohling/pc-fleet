// Code 39: alternating bar/space widths, nine elements per character.
const alphabet='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%*';
const patterns=['nnnwwnwnn','wnnwnnnnw','nnwwnnnnw','wnwwnnnnn','nnnwwnnnw','wnnwwnnnn','nnwwwnnnn','nnnwnnwnw','wnnwnnwnn','nnwwnnwnn','wnnnnwnnw','nnwnnwnnw','wnwnnwnnn','nnnnwwnnw','wnnnwwnnn','nnwnwwnnn','nnnnnwwnw','wnnnnwwnn','nnwnnwwnn','nnnnwwwnn','wnnnnnnww','nnwnnnnww','wnwnnnnwn','nnnnwnnww','wnnnwnnwn','nnwnwnnwn','nnnnnnwww','wnnnnnwwn','nnwnnnwwn','nnnnwnwwn','wwnnnnnnw','nwwnnnnnw','wwwnnnnnn','nwnnwnnnw','wwnnwnnnn','nwwnwnnnn','nwnnnnwnw','wwnnnnwnn','nwwnnnwnn','nwnwnwnnn','nwnwnnnwn','nwnnnwnwn','nnnwnwnwn','nwnnwnwnn'];
export function barcode(tag){
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');let x=12;
  svg.setAttribute('role','img');svg.setAttribute('aria-label','Barcode '+tag);
  for(const c of '*'+tag+'*'){const p=patterns[alphabet.indexOf(c)];if(!p)throw Error('Unsupported barcode character');[...p].forEach((v,i)=>{const w=v==='w'?3:1;if(i%2===0){const r=document.createElementNS(ns,'rect');r.setAttribute('x',x);r.setAttribute('y',0);r.setAttribute('width',w);r.setAttribute('height',48);svg.append(r);}x+=w;});x++;}
  svg.setAttribute('viewBox',`0 0 ${x+12} 48`);svg.setAttribute('preserveAspectRatio','none');return svg;
}
