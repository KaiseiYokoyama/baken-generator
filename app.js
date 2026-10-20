'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const canvas = $('ticket'), ctx = canvas.getContext('2d'), form = $('editor');
  const venues = ['札幌','函館','福島','新潟','東京','中山','中京','京都','阪神','小倉'];
  $('venue').replaceChildren(...venues.map(v => new Option(v,v,v==='東京',v==='東京')));
  const japanDate = new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  $('date').value = japanDate;
  $('purchaseDate').value = japanDate;
  const fonts = {sans:'"Noto Sans JP"', serif:'"Noto Serif JP"', number:'"Jost"', money:'"Roboto Condensed"', cheer:'"Dela Gothic One"'};
  let ready = false, valid = false, lastValid = null, background = null, imageRequest = 0, imageLoading = false, imageProblem = false;
  const imageDefaults = {x:50,y:50,zoom:100,fade:35};
  const number = value => Number(value).toLocaleString('ja-JP');
  function validate() {
    const data = Object.fromEntries(new FormData(form));
    const errors = {};
    for (const [key,min,max,title] of [['race',1,12,'レース番号'],['horse',1,18,'馬番'],['meeting',1,99,'開催回'],['day',1,99,'開催日目'],['amount',100,999900,'金額']]) {
      const value = Number(data[key]);
      if (!String(data[key]).trim() || !Number.isInteger(value) || value < min || value > max) errors[key] = `${title}は${number(min)}〜${number(max)}${key==='amount'?'円':''}で入力してください。`;
      else if(key==='amount' && value%100) errors[key] = '金額は100円単位で入力してください。';
      data[key] = value;
    }
    for(const [key,title] of [['date','開催日'],['purchaseDate','購入日']]){
      if(!/^\d{4}-\d{2}-\d{2}$/.test(data[key] || '') || !$(key).validity.valid) errors[key] = `有効な${title}を入力してください。`;
    }
    for(const [key,title] of [['horseName','馬名'],['issuePlace','発券場所'],['serial','管理番号']]) {
      data[key] = data[key].trim();
      if(!data[key]) errors[key] = `${title}を入力してください。`;
    }
    for(const key of ['race','horse','meeting','day','amount','date','purchaseDate','horseName','issuePlace','serial']) {
      $(key+'-error').textContent = errors[key] || '';
      $(key).setAttribute('aria-invalid',Boolean(errors[key]));
      $(key).setAttribute('aria-describedby',key+'-error');
    }
    valid = !Object.keys(errors).length;
    $('download').disabled = !valid || !ready || imageLoading || imageProblem;
    $('download-mobile').disabled = $('download').disabled;
    $('cancel-background').hidden = !imageProblem;
    $('amount-label').textContent = data.type==='cheer'?'単勝・複勝 それぞれ同額':'100円単位';
    $('amount-note').textContent = data.type==='cheer'?'合計金額（単勝 ＋ 複勝）':'合計金額';
    $('total').replaceChildren(document.createTextNode(errors.amount?'—':number(data.amount*(data.type==='cheer'?2:1))),Object.assign(document.createElement('span'),{textContent:' 円'}));
    $('preview-status').textContent = !ready?'フォントを読み込んでいます…':imageLoading?'背景画像を読み込んでいます…':imageProblem?'背景画像を確認してください':valid?'保存できます':'入力内容を確認してください';
    if(valid) lastValid = data;
    if(ready && lastValid) drawTicket(lastValid);
  }
  function setFont(size, family='sans', weight=500) {ctx.font = `${weight} ${size}px ${fonts[family]}`;}
  function text(value,x,y,size=20,family='sans',weight=500,maxWidth=Infinity) {
    ctx.save();setFont(size,family,weight);ctx.fillStyle='#101512';ctx.textBaseline='alphabetic';
    const s=String(value), width=ctx.measureText(s).width;
    ctx.translate(x,y);ctx.scale(Math.min(1,maxWidth/Math.max(1,width)),1);ctx.fillText(s,0,0);ctx.restore();
  }
  function rightBottomText(value,right,bottom,size=20,family='number',weight=500,maxWidth=580){
    ctx.save();setFont(size,family,weight);ctx.fillStyle='#101512';ctx.textBaseline='alphabetic';
    const s=String(value),m=ctx.measureText(s);
    const scaleX=Math.min(1,maxWidth/Math.max(1,m.actualBoundingBoxLeft+m.actualBoundingBoxRight));
    ctx.translate(right,bottom);ctx.scale(scaleX,1);
    ctx.fillText(s,-m.actualBoundingBoxRight,-m.actualBoundingBoxDescent);ctx.restore();
  }
  // Center on the painted glyph bounds, including asymmetric digits such as 1.
  function centeredText(value,cx,cy,size=20,family='sans',weight=500,maxWidth=Infinity,color='#101512',outline=false) {
    ctx.save();setFont(size,family,weight);ctx.textBaseline='alphabetic';ctx.fillStyle=color;
    const s=String(value), m=ctx.measureText(s), visible=m.actualBoundingBoxLeft+m.actualBoundingBoxRight;
    const scale=Math.min(1,maxWidth/Math.max(1,visible));
    ctx.translate(cx,cy);ctx.scale(scale,1);
    const x=(m.actualBoundingBoxLeft-m.actualBoundingBoxRight)/2,y=(m.actualBoundingBoxAscent-m.actualBoundingBoxDescent)/2;
    if(outline){ctx.strokeStyle='#fff';ctx.lineWidth=5;ctx.lineJoin='round';ctx.strokeText(s,x,y);}
    ctx.fillText(s,x,y);ctx.restore();
  }
  function line(x1,y1,x2,y2,width=1.8) {ctx.beginPath();ctx.lineWidth=width;ctx.strokeStyle='#111712';ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
  function rect(x,y,w,h,width=1.8){ctx.strokeStyle='#101512';ctx.lineWidth=width;ctx.strokeRect(x,y,w,h);}
  function blackBox(x,y,w,h){ctx.fillStyle='#101512';ctx.fillRect(x,y,w,h);}
  function horseName(value,x,top,height,maxWidth){
    ctx.save();setFont(48,'sans',700);ctx.textBaseline='alphabetic';ctx.fillStyle='#101512';
    const m=ctx.measureText(value), glyphHeight=m.actualBoundingBoxAscent+m.actualBoundingBoxDescent;
    const scaleY=height/Math.max(1,glyphHeight);
    const scaleX=Math.min(scaleY*.8,maxWidth/Math.max(1,m.actualBoundingBoxLeft+m.actualBoundingBoxRight));
    ctx.translate(x,top+height/2);ctx.scale(scaleX,scaleY);
    ctx.fillText(value,m.actualBoundingBoxLeft,(m.actualBoundingBoxAscent-m.actualBoundingBoxDescent)/2);
    ctx.restore();
  }
  const digitCell=14, commaCell=7;
  function numericWidth(value){return [...String(value)].reduce((width,ch)=>width+(ch===','?commaCell:digitCell),0);}
  function numericText(value,x,y,size){
    ctx.save();setFont(size,'money',700);ctx.fillStyle='#101512';ctx.textBaseline='alphabetic';
    // One shared advance for every digit, independent of its value or the number of digits.
    const scaleX=digitCell/ctx.measureText('0').width;
    const first=ctx.measureText(String(value)[0]);
    const inkLeft=x+digitCell/2-(first.width/2+first.actualBoundingBoxLeft)*scaleX;
    for(const ch of String(value)){
      const cell=ch===','?commaCell:digitCell;
      ctx.save();ctx.translate(x+cell/2,y);ctx.scale(scaleX,1);
      ctx.fillText(ch,-ctx.measureText(ch).width/2,0);ctx.restore();x+=cell;
    }
    ctx.restore();
    return inkLeft;
  }
  function money(amount,right,y,size=45,maxWidth=285,starCount=3,star='☆',label=null,each=false){
    ctx.save();const s=number(amount), yen=20, gap=7;
    const left=right-yen-gap-numericWidth(s);
    const numberInkLeft=numericText(s,left,y,size);text('円',right-yen,y-1,20,'serif',700);
    let starLeft=Math.max(right-maxWidth,left-(starCount===4?98:85));
    if(label){
      text(label,521,y-2,23,'serif',700,61);setFont(23,'serif',700);
      const labelRight=521+ctx.measureText(label).actualBoundingBoxRight;
      starLeft=labelRight+(starLeft-labelRight)/2;
    }
    const stars=star.repeat(starCount), starMaxWidth=Math.max(20,left-starLeft-6);
    let starGap;
    if(star==='☆'){
      setFont(size,'money',700);const digits=ctx.measureText(String(amount));
      const centerY=y+(digits.actualBoundingBoxDescent-digits.actualBoundingBoxAscent)/2;
      setFont(24,'number',500);const m=ctx.measureText(stars);
      const width=Math.min(starMaxWidth,m.actualBoundingBoxLeft+m.actualBoundingBoxRight);
      const centerX=label?starLeft+width/2:numberInkLeft-width/2;
      centeredText(stars,centerX,centerY,24,'number',500,width);
      if(each)text('各',centerX-width/2-26,y,24,'serif',700,24);
    }else{
      text(stars,starLeft,y-1,24,'number',500,starMaxWidth);
      setFont(24,'number',500);const m=ctx.measureText(stars);
      starGap=numberInkLeft-(starLeft+m.actualBoundingBoxRight*Math.min(1,starMaxWidth/m.width));
    }
    ctx.restore();
    return starGap;
  }
  function drawTotals(total){
    const y=452, right=774, available=right-291;
    function group(value,unit,size,starSize){
      const s=number(value);
      setFont(size,'money',700);const first=ctx.measureText(s[0]);
      const inkOffset=digitCell/2-(first.width/2+first.actualBoundingBoxLeft)*digitCell/ctx.measureText('0').width;
      setFont(starSize,'number',500);const stars=ctx.measureText('★★★★');
      setFont(20,'serif',700);const unitRight=ctx.measureText(unit).actualBoundingBoxRight;
      return {s,unit,size,starSize,stars,inkOffset,starWidth:stars.actualBoundingBoxLeft+stars.actualBoundingBoxRight,
        fixedWidth:6-inkOffset+numericWidth(s)+7+unitRight};
    }
    ctx.save();
    const count=group(total/10,'枚',30,24), amount=group(total,'円',32,24);
    setFont(20,'serif',700);const label=ctx.measureText('合計');
    const labelWidth=label.actualBoundingBoxLeft+label.actualBoundingBoxRight;
    let groupGap=amount.starWidth/4;
    const fixedWidth=labelWidth+count.fixedWidth+amount.fixedWidth;
    const flexWidth=count.starWidth+amount.starWidth+2*groupGap;
    const scale=Math.min(1,(available-fixedWidth)/flexWidth);
    count.starWidth*=scale;amount.starWidth*=scale;groupGap*=scale;
    const width=fixedWidth+count.starWidth+amount.starWidth+2*groupGap;
    let x=right-width;
    text('合計',x+label.actualBoundingBoxLeft,y,20,'serif',700);x+=labelWidth+groupGap;
    for(const g of [count,amount]){
      ctx.save();setFont(g.starSize,'number',500);ctx.fillStyle='#101512';ctx.textBaseline='alphabetic';
      ctx.translate(x,y-1);ctx.scale(g.starWidth/(g.stars.actualBoundingBoxLeft+g.stars.actualBoundingBoxRight),1);
      ctx.fillText('★★★★',g.stars.actualBoundingBoxLeft,0);ctx.restore();
      const numberX=x+g.starWidth+6-g.inkOffset;
      numericText(g.s,numberX,y,g.size);
      text(g.unit,numberX+numericWidth(g.s)+7,y-1,20,'serif',700);
      x+=g.starWidth+g.fixedWidth+groupGap;
    }
    ctx.restore();
  }
  // QR for https://kaiseiyokoyama.github.io/baken-generator/ with high error correction. Light modules and the quiet zone stay transparent.
  const siteQrRows=[
    '11111110010000111101010101101011001111111',
    '10000010010110011000101101001100101000001',
    '10111010001111111011001110000010101011101',
    '10111010010110001100010010110011001011101',
    '10111010101101110010011110111011001011101',
    '10000010010001000110111001100101001000001',
    '11111110101010101010101010101010101111111',
    '00000000111010100011101110101111000000000',
    '00110011101010111000110000001110011010000',
    '10100001010110000011101110101011111110101',
    '01101010111011001000001011001010011110110',
    '10101001110000011001111001100010110000011',
    '10101110101011001001000111111101010001110',
    '01111100100000001101100001000000000001001',
    '11010011010101010001000001000010001100111',
    '00110101100001010011001110010001101001011',
    '11010010111110010001100100000011100010011',
    '10010000000000111111000010010100110101100',
    '00101010111111001011011101110100110011000',
    '11001101001000100110111000111000010101110',
    '00100110101010011011100111010011011011100',
    '11101101101011001011101111101011011011011',
    '01001111100011110000111001000100000110110',
    '01111001101000111011000101101011011000011',
    '01101010001001100110101001100100000000110',
    '10001000011101011111101100011001101001101',
    '01100111000100100010000001000001110111011',
    '10111101000000100011010100000001111101011',
    '11011011001100000101000010100011011011000',
    '00000100011001110001110101000011001101100',
    '10001111110011100011100011100100111101110',
    '00101101110011001000100011011110101011101',
    '01110010011011100110001010011111111111101',
    '00000000111000011100000011101010100011101',
    '11111110110010000101100001001101101011010',
    '10000010000001111000110010100010100011011',
    '10111010000100111011000111110010111110111',
    '10111010110101010101111001011011000011011',
    '10111010110011110011111011101001100100101',
    '10000010000110001110100111011000101011010',
    '11111110000110001000111000101011110001010'
  ];
  function siteQr(x,y){
    const unit=2, quietZone=4;
    ctx.fillStyle='#111812';
    siteQrRows.forEach((row,r)=>{
      for(let c=0;c<row.length;c++)if(row[c]==='1'){
        ctx.fillRect(x+(c+quietZone)*unit,y+(r+quietZone)*unit,unit,unit);
      }
    });
  }
  function watermark(){
    ctx.save();ctx.strokeStyle='#d5e9df';ctx.lineWidth=1.1;
    for(let y=-90;y<590;y+=36){ctx.beginPath();for(let x=-20;x<=840;x+=3){const dy=Math.sin(x/32+y/19)*8;x===-20?ctx.moveTo(x,y+dy):ctx.lineTo(x,y+dy);}ctx.stroke();}
    ctx.globalAlpha=.62;
    for(const [x,y] of [[128,143],[483,136],[680,380],[150,407]]){
      ctx.save();ctx.translate(x,y);ctx.rotate(-.3);ctx.lineWidth=10;ctx.strokeStyle='#aed6c4';ctx.beginPath();ctx.ellipse(0,0,43,64,.2,0,Math.PI*2);ctx.stroke();
      ctx.beginPath();ctx.moveTo(-32,25);ctx.bezierCurveTo(0,-54,28,-42,34,-17);ctx.lineTo(8,-3);ctx.lineTo(27,41);ctx.stroke();ctx.restore();
    }
    for(const [x,y] of [[588,72],[385,335],[62,253]]){ctx.save();ctx.fillStyle='#b7dbc9';setFont(47,'serif',900);ctx.fillText('JRA',x,y);ctx.restore();}
    ctx.restore();
  }
  function drawBackground(){
    ctx.fillStyle='#fffef9';ctx.fillRect(0,0,800,490);
    if(background){
      const x=+$('image-x').value/100,y=+$('image-y').value/100,z=+$('image-zoom').value/100;
      const scale=Math.max(800/background.naturalWidth,490/background.naturalHeight)*z;
      const w=background.naturalWidth*scale,h=background.naturalHeight*scale;
      ctx.drawImage(background,(800-w)*x,(490-h)*y,w,h);
      ctx.fillStyle=`rgba(255,255,255,${+$('image-fade').value/100})`;ctx.fillRect(0,0,800,490);
    }else watermark();
  }
  function drawBand(type){
    const x=291,w=91,top=34,bottom=424;
    if(type==='place'){
      // Exactly 15 black and 15 white vertical stripes.
      ctx.fillStyle='#fff';ctx.fillRect(x,90,w,268);
      for(let i=0;i<30;i++)if(i%2===0){blackBox(x+i*w/30,90,w/30,268);}
      blackBox(x,top,w,56);blackBox(x,358,w,66);
      for(const y of [48,373]){centeredText('PLACE',x+w/2,y+6,16,'number',600,w-8,'#fff');centeredText('SHOW',x+w/2,y+26,16,'number',600,w-8,'#fff');}
      centeredText('複',x+w/2,182,60,'serif',900,72,'#111',true);centeredText('勝',x+w/2,274,60,'serif',900,72,'#111',true);
    }else if(type==='cheer'){
      centeredText('WIN',x+w/2,57,27,'number',500,w-12);
      for(const [s,y] of [['単',112],['勝',169],['＋',223],['複',277],['勝',334]])centeredText(s,x+w/2,y,s==='＋'?35:48,'serif',900,75);
      blackBox(x,358,w,66);centeredText('PLACE',x+w/2,379,16,'number',600,w-8,'#fff');centeredText('SHOW',x+w/2,405,16,'number',600,w-8,'#fff');
    }else{
      centeredText('WIN',x+w/2,57,27,'number',500,w-12);
      centeredText('単',x+w/2,181,64,'serif',900,78);centeredText('勝',x+w/2,277,64,'serif',900,78);
      centeredText('WIN',x+w/2,399,27,'number',500,w-12);
    }
    rect(x,top,w,bottom-top,1.4);
  }
  function drawTicket(d){
    ctx.setTransform(2,0,0,2,0,0);ctx.clearRect(0,0,800,490);drawBackground();
    const year=d.date.split('-')[0];
    text(`${year}年${d.meeting}回${d.day}日`,24,48,23,'sans',700,250);
    text(`${d.venue}`,24,91,33,'sans',700,230);
    blackBox(24,105,100,53);centeredText(d.race,74,131.5,58,'number',700,88,'#fff');text('レース',135,147,26,'sans',700,136);
    siteQr(25,179);siteQr(155,179);
    const title=d.raceName.trim();
    const gradePattern=/[（(]\s*(?:[GＧ]|Jpn)\s*(?:[123１２３]|[ⅠⅡⅢ]|I{1,3})\s*[）)]/i;
    const grade=title.match(gradePattern)?.[0] || '';
    const plainTitle=title.includes('回')?title.replace(gradePattern,'').trim():title;
    const breakAt=plainTitle.indexOf('回');
    const titleLines=breakAt>=0?[
      plainTitle.slice(0,breakAt+1)+(grade?' '+grade:''),
      plainTitle.slice(breakAt+1).trim()
    ].filter(Boolean):title?[title]:[];
    const [,purchaseMonth,purchaseDay]=d.purchaseDate.split('-');
    const purchaseText=`${Number(purchaseMonth)}月${Number(purchaseDay)}日`;
    setFont(21,'sans',700);const purchaseY=480-ctx.measureText(purchaseText).actualBoundingBoxDescent;
    const issueY=purchaseY-34, titleY=issueY-40-Math.max(0,titleLines.length-1)*43.5;
    titleLines.forEach((part,index)=>text(part,24,titleY+index*43.5,34.5,'sans',700,244));
    text(`${d.issueType} ${d.issuePlace}`,24,issueY,21,'sans',700,244);
    text(purchaseText,24,purchaseY,21,'sans',700,244);
    drawBand(d.type);
    const horseTop=d.type==='cheer'?138:164;
    if(d.type==='cheer'){
      rect(397,34,376,67,1.6);const chars=[...'がんばれ！'];chars.forEach((s,i)=>centeredText(s,409+(i+.5)*70,66,43,'cheer',400,65));
    }
    rect(404,horseTop,52,47,1.7);centeredText(d.horse,430,horseTop+23.5,48,'number',700,44);
    horseName(d.horseName,467,horseTop-.85,48.7,305);
    const subtotalSize=d.type==='cheer'?51:58;
    setFont(subtotalSize,'money',700);
    const subtotalY=horseTop+47.85+4+ctx.measureText(String(d.amount)).actualBoundingBoxAscent;
    if(d.type==='cheer'){
      money(d.amount,774,subtotalY,subtotalSize,282,3,'☆',null,true);
      money(d.amount,774,386,36,188,3,'☆','単勝');
      money(d.amount,774,420,36,188,3,'☆','複勝');
    }else money(d.amount,774,subtotalY,subtotalSize,314);
    drawTotals(d.amount*(d.type==='cheer'?2:1));
    rightBottomText(d.serial,774,480);
  }
  form.addEventListener('submit',e=>e.preventDefault());
  form.addEventListener('input',e=>{if(e.target.id!=='background')validate();});
  const mobileLayout=matchMedia('(max-width:1119px)'), sheet=$('editor-sheet');
  function syncMobileViewport(){
    const viewport=window.visualViewport;
    if(!mobileLayout.matches){
      document.body.style.removeProperty('--app-height');document.body.style.removeProperty('--app-top');return;
    }
    if(viewport && viewport.scale!==1)return;
    document.body.style.setProperty('--app-height',`${viewport?.height || innerHeight}px`);
    document.body.style.setProperty('--app-top',`${viewport?.offsetTop || 0}px`);
  }
  function setTicketFocused(focused){
    focused=mobileLayout.matches && focused;
    if(focused && sheet.contains(document.activeElement))document.activeElement.blur();
    document.body.classList.toggle('ticket-focused',focused);
    sheet.inert=focused;
    if(focused)sheet.setAttribute('aria-hidden','true');else sheet.removeAttribute('aria-hidden');
    if(mobileLayout.matches){
      canvas.setAttribute('role','button');canvas.tabIndex=0;
      canvas.setAttribute('aria-controls','editor-sheet');canvas.setAttribute('aria-expanded',String(!focused));
      canvas.setAttribute('aria-label',focused?'馬券。タップして編集に戻る':'馬券。タップして全体を表示');
    }else{
      canvas.removeAttribute('role');canvas.removeAttribute('tabindex');canvas.removeAttribute('aria-controls');canvas.removeAttribute('aria-expanded');
      canvas.setAttribute('aria-label','作成中の馬券');
    }
    syncMobileViewport();
  }
  canvas.addEventListener('click',()=>{if(mobileLayout.matches)setTicketFocused(!document.body.classList.contains('ticket-focused'));});
  canvas.addEventListener('keydown',e=>{
    if(mobileLayout.matches && (e.key==='Enter' || e.key===' ')){e.preventDefault();setTicketFocused(!document.body.classList.contains('ticket-focused'));}
  });
  $('sheet-hide').addEventListener('click',()=>setTicketFocused(true));
  $('sheet-preview-toggle').addEventListener('click',()=>setTicketFocused(true));
  mobileLayout.addEventListener('change',()=>setTicketFocused(false));
  window.addEventListener('resize',syncMobileViewport);
  window.visualViewport?.addEventListener('resize',syncMobileViewport);
  window.visualViewport?.addEventListener('scroll',syncMobileViewport);
  setTicketFocused(false);
  $('download-mobile').addEventListener('click',()=>$('download').click());
  $('download').addEventListener('click',()=>{
    validate();if(!ready||!valid||imageLoading||imageProblem)return;
    canvas.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`baken-${lastValid.date}-${lastValid.venue}${lastValid.race}R-${lastValid.type}.png`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},'image/png');
  });
  function resetImage(){for(const [k,v]of Object.entries(imageDefaults)){$('image-'+k).value=v;$('image-'+k+'-value').textContent=v+'%';}if(ready&&lastValid)drawTicket(lastValid);}
  for(const k of Object.keys(imageDefaults))$('image-'+k).addEventListener('input',()=>{$('image-'+k+'-value').textContent=$('image-'+k).value+'%';});
  $('reset-image').addEventListener('click',resetImage);
  $('remove-image').addEventListener('click',()=>{imageRequest++;imageLoading=false;imageProblem=false;background=null;$('background').value='';$('background-error').textContent='';$('file-label').textContent='画像を選択';$('image-controls').hidden=true;resetImage();validate();});
  $('cancel-background').addEventListener('click',()=>$('remove-image').click());
  $('background').addEventListener('change',async e=>{
    const file=e.target.files[0];if(!file)return;const request=++imageRequest;
    $('background-error').textContent='';imageProblem=false;imageLoading=false;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)){$('background-error').textContent='JPEG・PNG・WebPの画像を選択してください。';e.target.value='';imageProblem=true;validate();return;}
    if(file.size>20*1024*1024){$('background-error').textContent='20MB以下の画像を選択してください。';e.target.value='';imageProblem=true;validate();return;}
    imageLoading=true;validate();
    const url=URL.createObjectURL(file),img=new Image();
    try{img.src=url;await img.decode();if(request!==imageRequest)return;background=img;resetImage();$('image-controls').hidden=false;$('file-label').textContent=file.name;}
    catch{if(request===imageRequest){$('background-error').textContent='画像を読み込めませんでした。別の画像を選択してください。';e.target.value='';imageProblem=true;}}
    finally{URL.revokeObjectURL(url);if(request===imageRequest){imageLoading=false;validate();}}
  });
  validate();
  Promise.all([document.fonts.load('700 32px "Jost"'),document.fonts.load('700 32px "Roboto Condensed"'),document.fonts.load('400 32px "Dela Gothic One"'),document.fonts.load('700 32px "Noto Sans JP"'),document.fonts.load('700 24px "Noto Serif JP"'),document.fonts.load('900 32px "Noto Serif JP"')]).then(()=>{ready=true;validate();}).catch(()=>{$('preview-status').textContent='フォントを読み込めませんでした。再読み込みしてください。';});
})();
