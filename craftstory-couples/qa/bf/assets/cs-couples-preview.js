(function () {
  'use strict';
  var STORE = 'csCouplesPreview', ATTEMPT = 'csCouplesAttempt';
  function read(key) { try { return JSON.parse(sessionStorage.getItem(key) || 'null'); } catch (_) { return null; } }
  function write(key, value) { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch (_) {} }
  async function request(url, options) {
    var response = await fetch(url, Object.assign({signal: AbortSignal.timeout(45000)}, options));
    var data; try { data = await response.json(); } catch (_) { throw new Error('The studio could not be reached. Please try again.'); }
    if (!response.ok) { var e = new Error(data.error || 'The studio could not be reached.'); e.status = response.status; throw e; }
    return data;
  }
  window.CraftStoryCouples = {
    start: async function (url, answers, photos) {
      if (!url) throw new Error('Our preview studio is being connected. Please come back shortly.');
      var endpoint = new URL(url);
      if (endpoint.protocol !== 'https:' || endpoint.pathname !== '/v1/previews') throw new Error('The preview studio is not configured yet.');
      var payload = Object.assign({}, answers, {photo: photos[0], photo2: photos[1] || undefined});
      var digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(payload)))),function(b){return b.toString(16).padStart(2,'0');}).join('');
      var attempt = read(ATTEMPT);
      if (!attempt || attempt.digest !== digest) { attempt = {id:crypto.randomUUID(), digest:digest}; write(ATTEMPT,attempt); }
      var result = await request(url,{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':attempt.id},body:JSON.stringify(payload)});
      if (!/^[a-f0-9]{64}$/.test(result.id || '') || !/^[a-f0-9]{64}$/.test(result.token || '')) throw new Error('The studio did not return a preview. Please try again.');
      var job = {id:result.id,token:result.token,expiresAt:result.expiresAt};
      write(STORE,job);
      try { sessionStorage.removeItem('csDuoPhotos'); sessionStorage.removeItem('csDuoTake'); } catch (_) {}
      return job;
    }
  };
  function setup(root) {
    if (root.dataset.ready) return; root.dataset.ready = '1';
    var status=root.querySelector('[data-status]'), detail=root.querySelector('[data-detail]');
    var title=root.querySelector('[data-title]'), loader=root.querySelector('[data-loader]'), results=root.querySelector('[data-results]');
    var audio=root.querySelector('audio'),play=root.querySelector('[data-play]'),seek=root.querySelector('[data-seek]');
    var clock=root.querySelector('[data-clock]'),hero=root.querySelector('[data-hero]'),caption=root.querySelector('[data-caption]');
    var retry=root.querySelector('[data-reconnect]'),reveal=root.querySelector('[data-reveal]');
    var cards=Array.from(root.querySelectorAll('[data-scene]')),peeks=Array.from(root.querySelectorAll('[data-peek]'));
    var job=read(STORE),match=location.hash.match(/^#preview=([a-f0-9]{64})\.([a-f0-9]{64})$/);
    if(match){job={id:match[1],token:match[2]};write(STORE,job);}
    var endpoint=root.dataset.api.trim().replace(/\/$/,''),timer,frame,hintTimer,current=null,failures=0,stopped=false;
    var terminal=['ready','partial','failed'],revealed=job&&read('csCouplesRevealed')===job.id,hintIndex=0,lastPhase='plan';
    var hints={plan:['Every love story has its own soundtrack.','The little details make this song yours.','Your memories are the heart of the lyrics.'],avatar:['Your photos guide your cartoon characters.','The familiar faces. A whole new world.','Soon, you will meet your cartoon selves.'],song:['Your story is finding its melody.','Imagine the first time they hear their name.','A song made from the memories you shared.'],scenes:['Four still frames. One story: yours.','Your characters stay together through every scene.','Each frame follows a moment in your lyrics.']};
    function time(n){return Math.floor(n/60)+':'+String(Math.floor(n%60)).padStart(2,'0');}
    function view(name){root.dataset.view=name;loader.hidden=name==='result'||name==='empty';results.hidden=name!=='result';}
    function mark(key,state,note){var el=root.querySelector('[data-step="'+key+'"]');el.className='is-'+state;el.querySelector('[data-step-note]').textContent=note||(state==='done'?'Ready':state==='active'?'Creating…':state==='failed'?'Unavailable':'Up next');el.querySelector('.cp-step-icon').textContent=state==='done'?'✓':state==='failed'?'!':String(['plan','avatar','song','scenes','final'].indexOf(key)+1);}
    function select(i){
      if(!current||!current.scenes[i]||!current.scenes[i].url)return;
      if(hero.getAttribute('src')!==current.scenes[i].url)hero.src=current.scenes[i].url;hero.hidden=false;
      hero.alt=current.scenes[i].caption;caption.textContent=current.scenes[i].caption;
      cards.forEach(function(c,n){c.setAttribute('aria-pressed',String(n===i));});
    }
    function tick(){
      cancelAnimationFrame(frame);
      var duration=Math.min(60,Number.isFinite(audio.duration)?audio.duration:60),t=Math.min(duration,audio.currentTime||0);
      if(audio.currentTime>=duration){audio.pause();audio.currentTime=duration;}
      seek.max=duration;seek.value=t;clock.textContent=time(t)+' / '+time(duration);
      play.textContent=audio.paused?(t>=duration?'Replay your song':'Play your song'):'Pause';
      select(Math.min(3,Math.floor(t/15)));
      if(!audio.paused)frame=requestAnimationFrame(tick);
    }
    play.addEventListener('click',async function(){
      if(!audio.getAttribute('src'))return;
      if(!audio.paused){audio.pause();tick();return;}
      if(audio.currentTime>=60||audio.ended)audio.currentTime=0;
      try{await audio.play();tick();}catch(_){detail.textContent='Your browser could not play the song. Tap Play to try again.';}
    });
    audio.addEventListener('timeupdate',function(){if(audio.currentTime>=60){audio.pause();tick();}});
    audio.addEventListener('loadedmetadata',tick);audio.addEventListener('ended',tick);
    audio.addEventListener('error',function(){detail.textContent='The song could not load. Check your connection and tap Check again.';retry.hidden=false;});
    seek.addEventListener('input',function(){if(audio.getAttribute('src')){audio.currentTime=Math.min(60,Number(seek.value));tick();}});
    cards.forEach(function(card,i){card.addEventListener('click',function(){select(i);});});
    function showResults(){
      if(!current)return;
      revealed=true;write('csCouplesRevealed',job.id);view('result');
      title.textContent=current.title||'Your song';status.textContent=current.status==='ready'?'Made from your memories. Just for you.':'Your preview is partly ready';
      detail.textContent=current.error||'Press play and watch your four moments unfold.';
      var first=current.scenes.findIndex(function(s){return !!s.url;});if(first>=0)select(first);
    }
    reveal.addEventListener('click',showResults);
    function hint(){
      if(!current||terminal.includes(current.status)||stopped)return;
      var phase=!current.planReady?'plan':!current.avatar&&current.avatarState!=='failed'?'avatar':!current.music&&current.musicState!=='failed'?'song':'scenes';
      if(lastPhase!==phase){hintIndex=0;lastPhase=phase;}
      var list=hints[phase];root.querySelector('[data-hint]').textContent=list[hintIndex++%list.length];
    }
    function render(data){
      current=data;var done=terminal.includes(data.status),count=0;
      var names=(data.names||[]).filter(Boolean).join(' & ');
      root.setAttribute('aria-busy',done?'false':'true');
      if(data.music&&audio.getAttribute('src')!==data.music){audio.src=data.music;play.disabled=false;seek.disabled=false;}
      root.querySelector('.cp-player').hidden=!data.music;
      cards.forEach(function(card,i){var scene=data.scenes[i],img=card.querySelector('img'),label=card.querySelector('[data-scene-caption]');if(!scene)return;
        if(scene.url){count++;if(img.getAttribute('src')!==scene.url)img.src=scene.url;img.alt=scene.caption;img.hidden=false;card.disabled=false;label.textContent=scene.caption;
          if(peeks[i].getAttribute('src')!==scene.url){peeks[i].onload=function(){this.hidden=false;};peeks[i].src=scene.url;peeks[i].alt=scene.caption;}}
        else label.textContent=scene.state==='failed'?'This scene could not be created.':'Creating scene '+(i+1)+'…';
      });
      hero.closest('.cp-stage').toggleAttribute('data-no-image',count===0);
      root.querySelector('[data-song-progress]').textContent=data.music?'Song ready':data.musicState==='failed'?'Song unavailable':'Composing your song…';
      root.querySelector('[data-images-progress]').textContent=count+' of 4 scenes ready';
      var avatar=root.querySelector('[data-avatar]');
      if(data.avatar&&avatar.getAttribute('src')!==data.avatar){avatar.onload=function(){this.hidden=false;root.querySelector('.cp-heart').hidden=true;root.querySelector('[data-portrait-note]').textContent=names?'Meet '+names+'.':'Meet your cartoon selves.';};avatar.src=data.avatar;}
      var failed=data.status==='failed'||data.status==='partial';
      mark('plan',data.planReady?'done':failed?'failed':'active');
      mark('avatar',data.avatar?'done':data.avatarState==='failed'?'failed':data.planReady?'active':'waiting');
      mark('song',data.music?'done':data.musicState==='failed'?'failed':data.planReady?'active':'waiting');
      mark('scenes',count===4?'done':failed?'failed':data.avatar?'active':'waiting',count+' / 4');
      mark('final',data.status==='ready'?'done':failed?'failed':'waiting');
      var progress=data.status==='ready'?100:Math.round((data.planReady?15:0)+(data.avatar?20:0)+(data.music?25:0)+count*9);
      root.querySelector('[data-fill]').style.width=progress+'%';root.querySelector('[data-percent]').textContent=progress+'%';
      root.querySelector('.cp-meter').setAttribute('aria-valuenow',String(progress));
      reveal.hidden=data.status!=='ready';
      if(data.status==='ready'){
        clearInterval(hintTimer);root.querySelector('[data-hint]').textContent='Everything is ready. This moment is yours.';root.querySelector('[data-stay]').textContent='One minute of music. Four moments from your story.';
        if(revealed){showResults();return;}
        view('ready');title.textContent=names?names+', your moment is here.':'Your moment is here.';status.textContent='Your preview is ready';detail.textContent='Take a breath. Your story has a soundtrack.';
      }else if(data.status==='partial'){
        clearInterval(hintTimer);showResults();retry.hidden=false;
      }else if(data.status==='failed'){
        clearInterval(hintTimer);view('error');title.textContent='Your story is saved.';status.textContent='We could not finish your preview';detail.textContent=data.error||'Please contact CraftStory with this preview link so we can help.';root.querySelector('[data-hint]').textContent='Generation has stopped.';root.querySelector('[data-stay]').textContent='You do not need to fill in the questionnaire again.';retry.hidden=false;
      }else{
        view('loading');title.textContent=names?names+', this one is yours.':'Your story is becoming a song.';status.textContent='A little magic is in the making';detail.textContent='Your words. Your faces. A song only you could inspire.';
        var longWait=data.createdAt&&Date.now()-data.createdAt>240000;
        root.querySelector('[data-stay]').textContent=longWait?'The studio is taking a little longer. Your preview is still being created; you can return to this link.':'This usually takes a few minutes. Your progress is saved if you refresh.';
        if(!hintTimer){hint();hintTimer=setInterval(hint,5000);}
      }
    }
    async function poll(){
      clearTimeout(timer);if(stopped)return;
      try{
        var data=await request(endpoint+'/v1/previews/'+job.id,{headers:{Authorization:'Bearer '+job.token}});
        failures=0;retry.hidden=true;render(data);
        if(!terminal.includes(data.status))timer=setTimeout(poll,4000);
      }catch(e){
        failures++;detail.textContent=e.message;retry.hidden=false;
        if(e.status===403||e.status===410){stopped=true;clearInterval(hintTimer);view('empty');status.textContent='This preview is unavailable';root.setAttribute('aria-busy','false');return;}
        if(failures<6)timer=setTimeout(poll,Math.min(30000,4000*failures));
        else{clearInterval(hintTimer);hintTimer=null;stopped=true;view('error');status.textContent='Connection paused — your preview is saved';root.querySelector('[data-hint]').textContent='Tap Check again to reconnect.';root.setAttribute('aria-busy','false');}
      }
    }
    retry.addEventListener('click',function(){stopped=false;failures=0;clearInterval(hintTimer);hintTimer=null;if(audio.getAttribute('src'))audio.load();poll();});
    window.addEventListener('pagehide',function(){stopped=true;clearTimeout(timer);clearInterval(hintTimer);hintTimer=null;cancelAnimationFrame(frame);audio.pause();});
    window.addEventListener('pageshow',function(e){if(e.persisted&&job&&endpoint){stopped=false;poll();}});
    if(!job){view('empty');status.textContent='Your story starts here';detail.textContent='Complete the questionnaire to create your own song and cartoon scenes.';root.setAttribute('aria-busy','false');return;}
    if(!endpoint){view('empty');status.textContent='Your preview studio is being connected';detail.textContent='Please come back shortly.';root.setAttribute('aria-busy','false');return;}
    poll();
  }
  function boot(scope){scope.querySelectorAll('[data-couples-preview]').forEach(setup);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){boot(document);});else boot(document);
  document.addEventListener('shopify:section:load',function(e){boot(e.target);});
})();
