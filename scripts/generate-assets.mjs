import sharp from 'sharp';
import { writeFile, mkdir } from 'node:fs/promises';
await mkdir('public/character', { recursive: true });
await mkdir('public/scenes', { recursive: true });

// 原创动漫风矢量角色：全部 48 帧保持同一成年人物的外观、服装与比例。
function character(emotion, action, mouth, blink) {
  const warm = emotion === 2, guarded = emotion === 1, wistful = emotion === 3;
  const gaze = action === 1 ? -6 : wistful ? 2 : 0;
  const brows = guarded ? 'M191 190 Q209 180 226 190 M265 189 Q284 179 302 185' : wistful ? 'M192 184 Q209 181 225 190 M264 190 Q283 180 300 185' : 'M191 184 Q210 176 227 184 M264 184 Q282 176 300 184';
  const eye = (x, flip) => `<g transform="translate(${x} 204) scale(${flip} 1)">
    <defs><clipPath id="eye${x}"><path d="M-21 0Q-3 -${warm ? 9 : 14} 20 -2Q3 15 -18 7Z"/></clipPath></defs>
    <path d="M-21 0Q-3 -${warm ? 9 : 14} 20 -2Q3 15 -18 7Z" fill="#fff4ea"/><g clip-path="url(#eye${x})">
    <ellipse cx="${gaze * flip}" cy="2" rx="9" ry="12" fill="url(#iris)"/>
    <path d="M-8 4Q0 14 8 4" stroke="#8bbabb" stroke-width="2" fill="none"/>
    <ellipse cx="${gaze * flip}" cy="0" rx="3.6" ry="7" fill="#173742"/>
    <ellipse cx="${gaze * flip - 3}" cy="-3" rx="3.2" ry="4" fill="#fff9e9"/>
    <circle cx="${gaze * flip + 4}" cy="7" r="1.7" fill="#e1f9e5"/></g>
    <path d="M-23 -2Q-4 -${warm ? 11 : 16} 21 -3" fill="none" stroke="#302e39" stroke-width="3.6" stroke-linecap="round"/>
    <path d="M-23 -2l-5 -5M-20 -5l-4 -6M-17 -7l-2 -5" stroke="#302e39" stroke-width="2" stroke-linecap="round"/>
    <path d="M-19 8Q-5 14 10 10" fill="none" stroke="#b37e77" stroke-width="1"/>
  </g>`;
  const eyes = blink ? '<path d="M188 207Q209 218 229 207M264 207Q284 218 305 207" fill="none" stroke="#443444" stroke-width="2.8" stroke-linecap="round"/>' : eye(210, 1) + eye(284, -1);
  const lips = mouth ? '<path d="M235 257Q249 252 261 257Q255 274 244 269Z" fill="#864a59"/><path d="M239 257Q250 260 258 257" stroke="#fff5e9" stroke-width="2"/><path d="M245 267Q251 261 257 265" fill="#df9393"/>' : `<path d="M237 258Q249 ${warm ? 269 : guarded ? 256 : wistful ? 262 : 264} 260 257" fill="none" stroke="#aa6672" stroke-width="1.8" stroke-linecap="round"/>${warm ? '<path d="M240 260Q249 269 259 258" fill="#ae666b" opacity=".45"/>' : ''}`;
  const headTransform = action === 1 ? 'translate(-10 5) rotate(-9 245 230)' : wistful ? 'rotate(2 245 230)' : '';
  const camera = (raised) => `<g transform="translate(${raised ? 200 : 207} ${raised ? 425 : 530}) rotate(${raised ? -3 : 5})">
    <path d="M7 5h18l5-9h26l6 9h31q6 0 6 6v48q0 6-6 6H7q-6 0-6-6V11q0-6 6-6Z" fill="#29313e" stroke="#141e2a" stroke-width="2"/>
    <path d="M5 12h91v14H5Z" fill="#778582"/><path d="M9 30h84v28H9Z" fill="#39424b"/>
    <rect x="70" y="12" width="16" height="9" rx="2" fill="#b7c3b6"/><circle cx="17" cy="18" r="4" fill="#d9b18a"/>
    <circle cx="48" cy="35" r="29" fill="#171f2d" stroke="#8c9690" stroke-width="3"/>
    <circle cx="48" cy="35" r="23" fill="#465463" stroke="#273745" stroke-width="2"/>
    <circle cx="48" cy="35" r="17" fill="#162f49"/><circle cx="48" cy="35" r="11" fill="#366777"/>
    <ellipse cx="42" cy="29" rx="5" ry="7" fill="#a5ddd1" opacity=".7"/><circle cx="54" cy="42" r="3" fill="#8fb8dd" opacity=".6"/>
    <path d="M37 9q-16 5-17 23" fill="none" stroke="#d6d1b8" stroke-width="1.2"/>
  </g>`;
  const arms = action === 2 ? `<path d="M149 389Q125 443 136 504L194 495L226 450L205 423L173 450L182 390" fill="url(#coat)" stroke="#6b443f" stroke-width="2"/>
    <path d="M352 388Q380 443 361 506L299 492L269 450L294 424L328 451L316 390" fill="url(#coat)" stroke="#6b443f" stroke-width="2"/>
    <path d="M183 482L200 447Q202 434 214 436L229 445L238 461L226 480L213 474L201 492Z M314 480L297 446Q292 433 280 438L269 450L264 467L276 482L288 476L299 491Z" fill="url(#skin)" stroke="#b87b75" stroke-width="1.4"/>
    ${camera(true)}<path d="M200 447l8 10m-5-16l10 11m-6-17l11 11M292 442l-7 10m4-15l-9 11" stroke="#b87b75" stroke-width="1.1" fill="none"/>` : `<path d="M149 378Q120 420 125 494L136 578L184 589L203 565L181 461L192 390" fill="url(#coat)" stroke="#71453b" stroke-width="2"/>
    <path d="M350 378Q380 429 376 491L366 579L314 588L296 565L318 462L307 390" fill="url(#coat)" stroke="#71453b" stroke-width="2"/>
    <path d="M130 492L140 560L181 568L173 499Z M327 500L317 568L361 560L369 492Z" fill="#c18a51" opacity=".55"/>
    <path d="M141 573L183 580L180 598L143 592Z M315 580L359 574L357 593L318 599Z" fill="#e0ba79" stroke="#9a6750" stroke-width="1.5"/>
    <path d="M149 593Q170 591 184 599L221 616Q226 622 218 626L202 623L216 634Q218 640 211 640L190 631L201 641Q200 648 193 645L170 632L153 627Z M351 593Q328 594 315 601L283 616Q276 622 284 626L301 623L286 634Q284 641 293 639L313 630L303 641Q304 647 311 644L333 632L349 627Z" fill="url(#skin)" stroke="#b88476" stroke-width="1.2"/>
    ${camera(false)}<path d="M151 446l8 88M348 444l-9 91M149 550l27 7M326 556l28-7" fill="none" stroke="#eccc83" stroke-width="2" opacity=".7"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="700" viewBox="0 0 500 700"><defs>
    <linearGradient id="skin" x1="0" x2="1" y2=".6"><stop stop-color="#f5d7b9"/><stop offset=".65" stop-color="#f5d7c1"/><stop offset="1" stop-color="#dfae9b"/></linearGradient>
    <linearGradient id="hair" x1="0" x2="1" y2=".7"><stop stop-color="#343441"/><stop offset=".45" stop-color="#474351"/><stop offset=".7" stop-color="#2c303d"/><stop offset="1" stop-color="#192837"/></linearGradient>
    <linearGradient id="coat" x1="0" x2="1" y2=".35"><stop stop-color="#c08d50"/><stop offset=".4" stop-color="#e2b46c"/><stop offset=".7" stop-color="#cd9855"/><stop offset="1" stop-color="#aa713f"/></linearGradient>
    <linearGradient id="iris" x2="0" y2="1"><stop stop-color="#263d55"/><stop offset=".5" stop-color="#437a85"/><stop offset="1" stop-color="#b0c7a9"/></linearGradient>
    <radialGradient id="blush"><stop stop-color="#df9289" stop-opacity=".4"/><stop offset="1" stop-color="#df9289" stop-opacity="0"/></radialGradient>
  </defs>
  <path d="M166 150Q164 83 242 80Q331 68 346 157L351 263Q349 362 369 432Q312 464 296 429L158 430Q123 418 147 355Z" fill="url(#hair)" stroke="#282c37" stroke-width="2"/>
  <path d="M169 285L214 283H282L327 287Q356 307 365 349L388 676Q249 709 109 676L133 351Q144 307 169 285Z" fill="url(#coat)" stroke="#724a3e" stroke-width="2.5"/>
  <path d="M159 333L139 620L187 685L193 416Z M322 345L317 679L384 672L364 365Z" fill="#9d653d" opacity=".4"/>
  <path d="M219 260L214 306Q243 333 286 305L281 262" fill="url(#skin)" stroke="#ba8a7b" stroke-width="1.5"/>
  <path d="M221 269Q250 285 281 266L281 289Q248 307 217 285" fill="#cd998b" opacity=".5"/>
  <path d="M215 302Q248 320 286 302L305 405L249 443L189 405Z" fill="#eee4d4"/>
  <path d="M230 311v105m13-101v113m12-113v112m13-117v105m12-111v96" stroke="#d0bfb0" opacity=".7" stroke-width="1.5"/>
  <path d="M175 285L217 294L244 370L199 346L166 381L151 320Z M323 285L283 295L254 370L301 345L331 381L347 319Z" fill="#e3b674" stroke="#9a6849" stroke-width="1.8"/>
  <path d="M175 291L165 318L184 338M325 292L334 319L315 338" fill="none" stroke="#f7d79a" stroke-width="2"/>
  <path d="M242 371L237 687L251 687L253 371Z" fill="#886247"/><path d="M246 380v296" stroke="#e6cf96" stroke-width="2" stroke-dasharray="2 4"/>
  <path d="M184 359L213 560M314 359L286 560" stroke="#302f3a" stroke-width="12"/><path d="M183 359L211 550M311 360L284 550" stroke="#b4a398" stroke-width="1.3" opacity=".7"/>
  <path d="M166 505l40-5-3 54-43 7Z M295 500l43 6 4 55-47-8Z" fill="#b17d48" stroke="#8e5c40" stroke-width="1.5"/>
  <path d="M162 520l40-6M299 514l39 6" stroke="#f0c782" stroke-width="2"/>
  <circle cx="203" cy="386" r="4" fill="#766456"/><circle cx="294" cy="386" r="4" fill="#766456"/>
  <g transform="${headTransform}">
    <path d="M182 164Q174 122 219 111Q280 94 309 138L316 204Q313 257 250 289Q194 264 183 217Z" fill="url(#skin)" stroke="#b7867b" stroke-width="1.2"/>
    <path d="M302 141L314 201Q313 257 250 289L273 259L292 225Z" fill="#d9a995" opacity=".38"/>
    <path d="M182 201Q167 192 173 213Q177 229 188 228M313 201Q329 192 322 217Q320 229 310 227" fill="#e9bba5" stroke="#b7867b" stroke-width="1.2"/>
    <path d="M172 190Q152 160 174 116Q198 79 246 85Q309 72 329 133Q342 175 313 209L302 156Q279 152 272 126Q246 155 210 161L192 192L187 227Z" fill="url(#hair)" stroke="#282b36" stroke-width="1.5"/>
    <path d="M274 126Q250 155 210 161L224 139Q202 156 185 183Q188 139 220 119Q246 99 274 107Q299 105 313 131L298 117Z" fill="#6a5b62" opacity=".5"/>
    <path d="M185 137Q212 103 253 103M184 149Q209 119 237 116M284 108Q307 119 317 148" fill="none" stroke="#d8b998" stroke-width="1.5" opacity=".37"/>
    <path d="M207 112Q190 141 188 177M265 112Q251 143 223 155M285 124Q298 146 309 153" fill="none" stroke="#a48b83" stroke-width="1" opacity=".55"/>
    <path d="${brows}" fill="none" stroke="#69505a" stroke-width="2.2" stroke-linecap="round"/>
    ${eyes}
    <path d="M249 211L245 236L252 238" fill="none" stroke="#bd8b80" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M255 237l4-2" stroke="#efbdad" stroke-width="1.2"/>
    <ellipse cx="204" cy="236" rx="25" ry="14" fill="url(#blush)"/><ellipse cx="289" cy="236" rx="24" ry="13" fill="url(#blush)"/>
    <path d="M196 237l3 3m6-4l3 3M283 235l3 3m6-4l3 3" stroke="#c58b83" opacity=".5" stroke-width="1"/>
    ${lips}<path d="M244 275h12" stroke="#fff3dd" opacity=".65" stroke-width="1.2"/>
    <path d="M176 173Q163 243 184 278Q197 307 175 354Q207 340 204 296Q194 270 191 220L192 179Z" fill="url(#hair)" stroke="#292d39" stroke-width="1.5"/>
    <path d="M312 174Q340 220 319 269Q297 313 330 355Q301 347 296 324Q284 297 301 255L302 192Z" fill="url(#hair)" stroke="#292d39" stroke-width="1.5"/>
    <path d="M176 211Q173 250 190 279Q202 307 187 332M320 216Q323 248 307 279Q296 309 315 335" fill="none" stroke="#ae9290" stroke-width="1.5" opacity=".4"/>
    <path d="M305 138l5 11 12 2-9 8 2 12-11-6-11 5 3-12-9-8 13-1Z" fill="#e6e7e0" stroke="#97b4bd" stroke-width="1.3"/>
    <path d="M305 143l3 8 8 2" fill="none" stroke="#fffde9" stroke-width="2"/><circle cx="309" cy="137" r="1.7" fill="#fffce9"/>
    <circle cx="181" cy="225" r="3.5" fill="#e4c99e"/><circle cx="317" cy="224" r="3.5" fill="#e4c99e"/>
  </g>
  ${arms}
  <path d="M118 676Q250 705 379 676" fill="none" stroke="#f1c685" stroke-width="2"/>
  </svg>`;
}
const composites = [];
for (let emotion = 0; emotion < 4; emotion++) for (let action = 0; action < 3; action++) for (let mouth = 0; mouth < 2; mouth++) for (let blink = 0; blink < 2; blink++) {
  const index = (((emotion * 3 + action) * 2 + mouth) * 2 + blink);
  composites.push({ input: await sharp(Buffer.from(character(emotion, action, mouth, blink))).png().toBuffer(), left: (index % 8) * 500, top: Math.floor(index / 8) * 700 });
}
await sharp({ create: { width: 4000, height: 4200, channels: 4, background: '#00000000' } }).composite(composites).webp({ lossless: true }).toFile('public/character/mira-atlas.webp');
await writeFile('public/character/mira.svg', character(0, 0, 0, 0));
await writeFile('public/character/atlas.json', JSON.stringify({ width: 500, height: 700, columns: 8, frames: 48, emotions: ['calm','guarded','warm','wistful'], actions: ['idle','look_window','show_camera'], order: '(((emotion * 3 + action) * 2 + mouth) * 2 + blink)' }, null, 2));

const buildings = Array.from({length: 24}, (_,i) => {
  const x=200+i*44, h=100+(i*59)%190, y=595-h;
  const windows=Array.from({length: 16},(_,j)=>`<rect x="${x+6+(j%3)*11}" y="${y+15+Math.floor(j/3)*25}" width="5" height="9" fill="${(i+j)%4===0?'#f5c184':'#507a9b'}" opacity="${(i+j)%4===0?'.85':'.5'}"/>`).join('');
  return `<path d="M${x} 618V${y}h35v${618-y}Z" fill="${i%2?'#263d58':'#1c304a'}"/>${windows}`;
}).join('');
const drops=Array.from({length:140},(_,i)=>`<path d="M${190+(i*71)%1020} ${105+(i*113)%615}q-2 9-2 17" stroke="#bdd2df" stroke-width="${i%4===0?2:1}" opacity="${.08+(i%5)*.035}"/>`).join('');
const bokeh=Array.from({length:28},(_,i)=>`<circle cx="${260+(i*129)%910}" cy="${410+(i*83)%250}" r="${3+i%8}" fill="${i%3===0?'#f3bb77':'#a1ced1'}" opacity="${.08+(i%3)*.05}"/>`).join('');
const leaves=Array.from({length:15},(_,i)=>`<ellipse cx="${1380+(i%2?-1:1)*(15+i*3)}" cy="${435-i*16}" rx="${12+i%5}" ry="27" transform="rotate(${i%2?-45:45} ${1380+(i%2?-1:1)*(15+i*3)} ${435-i*16})" fill="${i%3?'#52765f':'#779574'}"/>`).join('');
await writeFile('public/scenes/cafe.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1100" viewBox="0 0 1800 1100"><defs>
<linearGradient id="wall" x2="1" y2="1"><stop stop-color="#776350"/><stop offset=".45" stop-color="#4a4548"/><stop offset="1" stop-color="#282e3b"/></linearGradient>
<linearGradient id="night" x2="0" y2="1"><stop stop-color="#263955"/><stop offset=".6" stop-color="#4a6882"/><stop offset="1" stop-color="#86949c"/></linearGradient>
<linearGradient id="wood" x2="0" y2="1"><stop stop-color="#7c5542"/><stop offset=".5" stop-color="#533c35"/><stop offset="1" stop-color="#322c30"/></linearGradient>
<linearGradient id="street" x2="0" y2="1"><stop stop-color="#46677b"/><stop offset="1" stop-color="#1c344b"/></linearGradient>
<radialGradient id="lamp"><stop stop-color="#ffe0a3" stop-opacity=".55"/><stop offset="1" stop-color="#ffd393" stop-opacity="0"/></radialGradient>
<linearGradient id="curtain"><stop stop-color="#43525e"/><stop offset=".5" stop-color="#65707a"/><stop offset="1" stop-color="#303d4d"/></linearGradient>
<filter id="blur"><feGaussianBlur stdDeviation="4"/></filter>
<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".55" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".035"/></feComponentTransfer><feBlend in="SourceGraphic" mode="soft-light"/></filter>
</defs><g filter="url(#grain)">
<path d="M0 0h1800v1100H0Z" fill="url(#wall)"/>
<path d="M0 790h1800v310H0Z" fill="url(#wood)"/>
<path d="M0 845h1800M0 941h1800M0 1035h1800M120 790L0 1100M500 790L400 1100M880 790L950 1100M1260 790L1470 1100M1600 790L1800 1030" stroke="#b28d6a" stroke-width="2" opacity=".15"/>
<path d="M155 91h1090v664H155Z" fill="#251f25" stroke="#aa7e59" stroke-width="8"/>
<path d="M178 113h1045v616H178Z" fill="url(#night)"/>
<path d="M179 410Q320 337 431 398T692 377T962 392T1222 357V591H179Z" fill="#344960" opacity=".65"/>
${buildings}<path d="M178 619h1045v110H178Z" fill="url(#street)"/>
<path d="M179 699L1223 671M179 726L1223 702M300 619L199 729M450 619L418 729M600 619L637 729M780 619L930 729M990 619L1200 729" fill="none" stroke="#91adb7" stroke-width="1" opacity=".3"/>
<g filter="url(#blur)">${bokeh}<path d="M487 626l-19 69h24l12-69M718 623l-3 73h15l-3-73M1009 623l18 71h21l-24-71" fill="#eebc84" opacity=".3"/></g>
<path d="M415 601V483m-14 0h29m-20-5q6-8 11 0" stroke="#c4b19d" stroke-width="4"/><circle cx="416" cy="481" r="22" fill="url(#lamp)"/><circle cx="416" cy="481" r="5" fill="#fff0be"/>
${drops}<path d="M178 114L534 114L178 491Z M567 114L680 114L325 728H178Z" fill="#c2dde7" opacity=".035"/>
<path d="M522 112v619M881 112v619M176 486h1047" stroke="#252b33" stroke-width="14"/>
<path d="M514 112v618M873 112v618M177 480h1047" stroke="#b5a08c" stroke-width="2" opacity=".5"/>
<path d="M149 740h1104v29H149Z" fill="#b68e65"/><path d="M149 766h1104v17H149Z" fill="#513d35"/>
<path d="M146 93Q174 221 154 479L112 744H182Q216 422 211 92Z" fill="url(#curtain)"/><path d="M1209 93Q1164 417 1217 744H1307L1248 93Z" fill="url(#curtain)"/>
<path d="M166 124Q188 397 140 710M1234 128Q1201 421 1270 711" stroke="#a1a5a4" opacity=".17" stroke-width="3" fill="none"/>
<path d="M1417 106h383v431h-383Z" fill="#3c3231" stroke="#947257" stroke-width="5"/>
<path d="M1436 126h345v385h-345Z" fill="#48413c"/>
<path d="M1432 260h350v11h-350M1432 407h350v12h-350" fill="#9b7658"/>
${Array.from({length:12},(_,i)=>`<rect x="${1450+i*21}" y="${169+(i%3)*9}" width="${12+i%6}" height="${87-(i%3)*9}" rx="1" fill="${['#aa8169','#6c8390','#bca386','#72816e'][i%4]}"/><path d="M${1454+i*21} 191v47" stroke="#efe0bd" opacity=".35"/>`).join('')}
<g fill="#e1c9a7"><path d="M1480 350h43v51h-43Z"/><path d="M1537 350h43v51h-43Z"/><path d="M1594 350h43v51h-43Z"/></g><g fill="none" stroke="#beac93" stroke-width="5"><path d="M1523 359q22-4 17 17q-2 11-17 10M1580 359q22-4 17 17q-2 11-17 10M1637 359q22-4 17 17q-2 11-17 10"/></g>
<path d="M1379 455V221" stroke="#688b6e" stroke-width="3"/>${leaves}<path d="M1338 450h86l-12 75h-62Z" fill="#b59377"/><path d="M1343 460h78" stroke="#ddbd96" stroke-width="2"/>
<path d="M1320 528h451v21h-451Z" fill="#9e7754"/><path d="M1341 550v165M1749 550v165" stroke="#544037" stroke-width="9"/>
<path d="M1414 594h245v152h-245Z" fill="#40332e" stroke="#ac8764" stroke-width="6"/>
<path d="M1426 606h221v128h-221Z" fill="#4d5e68"/><path d="M1426 708l62-49 38 27 53-61 68 57v52h-221Z" fill="#91a49c"/><circle cx="1469" cy="639" r="16" fill="#e5c99b"/>
<path d="M95 0v132M1353 0v112" stroke="#29252b" stroke-width="5"/>
<ellipse cx="96" cy="194" rx="171" ry="143" fill="url(#lamp)"/><ellipse cx="1353" cy="183" rx="209" ry="180" fill="url(#lamp)"/>
<path d="M27 159Q39 114 95 112Q153 114 166 159Z" fill="#80785f"/><ellipse cx="96" cy="158" rx="69" ry="12" fill="#f4d797"/>
<path d="M1277 150Q1293 105 1353 105Q1413 105 1429 150Z" fill="#7c7861"/><ellipse cx="1353" cy="150" rx="76" ry="13" fill="#fbe1a0"/>
<path d="M86 175L0 675H363L111 175Z M1342 166L1110 749H1641L1365 166Z" fill="#f7cc88" opacity=".035"/>
<path d="M45 710Q133 660 244 697L276 1002H27Z M1330 730Q1447 675 1572 740L1600 1047H1303Z" fill="#34444c" stroke="#273139" stroke-width="8"/>
<path d="M55 724Q140 680 233 713L250 908H43Z M1340 744Q1450 703 1560 752L1575 949H1320Z" fill="#596467"/>
<path d="M384 803Q826 708 1206 815L1482 1047Q817 1210 176 1042Z" fill="url(#wood)" stroke="#977455" stroke-width="3"/>
<path d="M220 1030Q828 1179 1440 1030M416 830Q821 754 1197 837" fill="none" stroke="#d0a47a" opacity=".35" stroke-width="2"/>
<ellipse cx="558" cy="913" rx="72" ry="18" fill="#c4b5a2"/><path d="M519 857h74l-5 49q-30 13-62 0Z" fill="#ddd0b4"/><ellipse cx="556" cy="857" rx="37" ry="10" fill="#eaddbd"/><ellipse cx="556" cy="858" rx="30" ry="6" fill="#654d3e"/><path d="M593 865q26-4 21 19q-3 14-24 11" stroke="#d2c4aa" fill="none" stroke-width="7"/>
<path d="M542 837q-13-22 0-38t0-34M564 834q12-20 0-37" fill="none" stroke="#ffead5" stroke-width="2" opacity=".23"/>
<path d="M1118 875l94 10-37 75-105-14Z" fill="#d3bc96"/><path d="M1100 892l78 8m-90 7l78 8m-90 7l57 6" stroke="#816d5b" stroke-width="2" opacity=".5"/>
</g></svg>`);
// 剧情照片使用随项目交付的原创插画，不冒充运行时生成的媒体。
await writeFile('public/scenes/travel.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#728bb9"/><stop offset=".5" stop-color="#ebbbaa"/><stop offset="1" stop-color="#f4d5a5"/></linearGradient><linearGradient id="sea" x2="0" y2="1"><stop stop-color="#688d9f"/><stop offset="1" stop-color="#b9bdb6"/></linearGradient></defs><path d="M0 0h900v600H0Z" fill="url(#sky)"/><path d="M0 140Q160 108 290 156T600 122T900 133" fill="none" stroke="#fae2ca" stroke-width="29" opacity=".35"/><circle cx="667" cy="213" r="43" fill="#ffe5bd"/><path d="M0 299h900v200H0Z" fill="url(#sea)"/>
${Array.from({length:18},(_,i)=>`<path d="M${(i*137)%600} ${316+i*8}h${25+(i*79)%240}" stroke="#e9d4bb" opacity=".45" stroke-width="${i%3+1}"/>`).join('')}
<path d="M0 437L900 385V600H0Z" fill="#86787d"/><path d="M0 496L900 433M0 533L900 461M0 543L900 471" stroke="#39434f" stroke-width="5"/><path d="M107 257h401v169H107Z" fill="#c5b7a6"/><path d="M76 260L307 159L538 259Z" fill="#535f75"/><path d="M92 268h432" stroke="#f1d3ae" stroke-width="7"/><path d="M160 300h63v126h-63ZM279 300h66v126h-66ZM399 300h65v72h-65Z" fill="#536c7c"/><path d="M170 309h43v42h-43ZM408 309h45v48h-45Z" fill="#d3c7b1"/><path d="M280 378h66" stroke="#9fa0a0" stroke-width="3"/>
<path d="M542 332L786 320Q854 325 864 375L550 404Z" fill="#91a8a4"/><path d="M549 369L859 345" stroke="#f1d9b2" stroke-width="10"/><path d="M569 338l36-3v22l-36 3ZM625 333l37-3v22l-37 3ZM681 329l37-3v22l-37 3ZM739 325l35-2v20l-35 3Z" fill="#485f79"/>
<path d="M62 219v260M519 217v228M61 233h458" stroke="#4e5364" stroke-width="7"/><path d="M62 219L519 217" stroke="#d1c0aa" stroke-width="2"/><path d="M0 392q120-46 167-13v61H0Z" fill="#718581"/><path d="M547 114q12-12 25 0q12-12 25 0M744 91q10-9 20 0q10-9 20 0" fill="none" stroke="#746e86" stroke-width="2"/>
</svg>`);
console.log('Generated original anime-inspired Mira (48 frames), detailed rain café and seaside story illustration.');
