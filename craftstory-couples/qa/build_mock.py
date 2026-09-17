import re, os, json, html

SEC = "/tmp/claude-0/-home-user-tweet-to-biz/0f745d77-01e7-52b5-af58-7952d84aecf6/scratchpad/build/sections"
SKILL = "/tmp/claude-0/-home-user-tweet-to-biz/0f745d77-01e7-52b5-af58-7952d84aecf6/scratchpad/skill/craftstory-project/code/theme"
OUT = "/tmp/claude-0/-home-user-tweet-to-biz/0f745d77-01e7-52b5-af58-7952d84aecf6/scratchpad/qa"

def stylesheet(path):
    s = open(path, encoding="utf-8").read()
    m = re.search(r"\{%\s*stylesheet\s*%\}(.*?)\{%\s*endstylesheet\s*%\}", s, re.S)
    return m.group(1) if m else ""

# CSS de base reel (cs-head) + CSS de chaque section
css = [stylesheet(f"{SKILL}/sections/cs-head.liquid")]
for f in ["cs-duo-hero","cs-duo-vsl","cs-duo-demos","cs-duo-steps","cs-duo-offer","cs-duo-faq","cs-duo-bar"]:
    p = f"{SEC}/{f}.liquid"
    if os.path.exists(p):
        css.append(f"\n/* ===== {f} ===== */\n" + stylesheet(p))
CSS = "\n".join(css)

# poster de substitution (data-URI, aucun reseau)
def poster(c1, c2, label=""):
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">'
           f'<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">'
           f'<stop offset="0" stop-color="{c1}"/><stop offset="1" stop-color="{c2}"/>'
           f'</linearGradient></defs><rect width="640" height="360" fill="url(#g)"/>'
           f'<text x="320" y="190" font-family="sans-serif" font-size="26" fill="#ffffffcc" '
           f'text-anchor="middle">{label}</text></svg>')
    import base64
    return "data:image/svg+xml;base64," + base64.b64encode(svg.encode()).decode()

PLAY = '<span class="%s-play"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>'
CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/></svg>'

def stage(prefix, cover, label):
    return (f'<div class="cs-{prefix}-stage">'
            f'<button type="button" class="cs-{prefix}-cover">'
            f'<img src="{cover}" alt="">'
            f'<span class="cs-{prefix}-scrim"></span>'
            f'{PLAY % ("cs-"+prefix)}'
            f'<span class="cs-{prefix}-{"playlabel" if prefix in ("dh","dv") else "lab"}">{label}</span>'
            f'</button></div>')

# ---------- HERO ----------
hero_points = ["Their name and your story in the lyrics",
               "A music video with the two of you in it",
               "Any genre — you pick the style",
               "Hear your free preview before you pay anything"]
HERO = f'''<div class="cs cs-duo-hero"><div class="cs-wrap cs-dh-in">
<div class="cs-dh-copy">
<span class="cs-eyebrow">✦ For couples</span>
<h1 class="cs-h1 cs-dh-h">Turn your love story into a song — and a music video they'll watch on repeat.</h1>
<p class="cs-lead cs-dh-body">Answer five questions about the two of you. We write it, record it and film it.</p>
<ul class="cs-dh-list cs-dh-bullets">{"".join(f"<li>{CHECK}<span>{html.escape(p)}</span></li>" for p in hero_points)}</ul>
<div class="cs-dh-cta"><a class="cs-btn cs-btn-primary cs-btn-lg" href="#">Create Your Free Preview</a><span class="cs-dh-note">Takes about 2 minutes</span></div>
<p class="cs-dh-trust">No payment up front · Full refund if you don't love it</p>
</div>
<div class="cs-dh-media">{stage("dh", poster("#2b1f47","#6b3b52","reaction clip"), "Watch her hear it for the first time")}</div>
</div></div>'''

# ---------- VSL ----------
marks = [("0:12","A full song written from one couple's story"),
         ("0:48","The music video, with the two of them on screen"),
         ("1:30","Her face the moment she hears her own name")]
VSL = f'''<div class="cs cs-duo-vsl"><div class="cs-wrap cs-dv-in">
<div class="cs-sec-head cs-dv-head">
<span class="cs-eyebrow cs-on-night">✦ Watch this first</span>
<h2 class="cs-dv-h">Here is what they get — and how they react when it plays.</h2>
<p class="cs-dv-body">Three real songs, three music videos, three first listens. Sound on.</p>
</div>
<div class="cs-dv-stage-wrap">{stage("dv", poster("#151024","#4a2d5c","VSL 1:45"), "Play with sound on")}</div>
<ul class="cs-dv-marks">{"".join(f'<li><span class="cs-dv-t">{t}</span><span>{html.escape(x)}</span></li>' for t,x in marks)}</ul>
<div class="cs-dv-cta"><a class="cs-btn cs-btn-primary cs-btn-lg" href="#">Create Your Free Preview</a><span class="cs-dv-note">Free preview first — pay only if you love it</span></div>
</div></div>'''

# ---------- DEMOS ----------
mv = [("Written from how they met","#3a2340","#7a4a3a"),("Their first dance, made for them","#23303a","#4a6a7a"),("Ten years, one song","#3a2a23","#7a5a3a")]
rx = [("She hears her name in the second line","#2a233a","#5a4a7a"),("He did not know it existed","#233a2f","#4a7a5f"),("Played at the reception","#3a2333","#7a3a5a")]
def card(cap, c1, c2, lbl="Play"):
    return f'<figure class="cs-dd-card">{stage("dd", poster(c1,c2,""), lbl)}<figcaption class="cs-dd-cap">{html.escape(cap)}</figcaption></figure>'
DEMOS = f'''<div class="cs cs-duo-demos"><div class="cs-wrap"><div class="cs-sec cs-dd-sec">
<div class="cs-sec-head"><span class="cs-eyebrow">✦ Real songs, real reactions</span>
<h2 class="cs-h2">Hear three of them. Then watch three people hear theirs.</h2>
<p>Every song below came from one couple answering five questions.</p></div>
<div class="cs-dd-group"><h3 class="cs-dd-gt">The music videos</h3><span class="cs-dd-swipe"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>Swipe to see all 3</span><div class="cs-dd-grid">{"".join(card(c,a,b) for c,a,b in mv)}</div></div>
<div class="cs-dd-group"><h3 class="cs-dd-gt">The first listen</h3><span class="cs-dd-swipe"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>Swipe to see all 3</span><div class="cs-dd-grid">{"".join(card(c,a,b) for c,a,b in rx)}</div></div>
<div class="cs-dd-cta"><a class="cs-btn cs-btn-primary cs-btn-lg" href="#">Create Your Free Preview</a></div>
</div></div></div>'''

# ---------- STEPS ----------
steps = [("Tell us about the two of you","Five questions: how you met, what you call each other, the moment you would keep, the style you want. Type it the way you would say it.","2 minutes"),
         ("We write and record the song","Your answers become real lyrics with their name in them, then a finished track in the genre you picked.","Nothing for you to do"),
         ("We film the music video","The two of you become the couple on screen, so the video tells your story and not a stock one.","Included"),
         ("Hear your free preview","You get a preview before you decide anything. If it is not right, you pay nothing and you can tell us to start over.","Free")]
STEPS = f'''<div class="cs cs-duo-steps"><div class="cs-wrap"><div class="cs-sec">
<div class="cs-sec-head"><span class="cs-eyebrow">✦ How it works</span>
<h2 class="cs-h2">You answer five questions. We do the rest.</h2>
<p>No writing, no recording, no musical skill. You will not be asked to be creative — only to tell us about the two of you.</p></div>
<ol class="cs-ds-grid">{"".join(f'<li class="cs-ds-card"><span class="cs-ds-num">{i+1}</span><h3 class="cs-ds-t">{html.escape(t)}</h3><p class="cs-ds-b">{html.escape(b)}</p><span class="cs-chip cs-ds-chip">{html.escape(n)}</span></li>' for i,(t,b,n) in enumerate(steps))}</ol>
<div class="cs-ds-cta"><a class="cs-btn cs-btn-primary cs-btn-lg" href="#">Start With Five Questions</a><span class="cs-ds-note">Nothing to pay until you have heard it</span></div>
</div></div></div>'''

# ---------- OFFER ----------
items = ["A full-length song with their name and your story in the lyrics",
         "A music video where the couple on screen is the two of you",
         "The genre you choose, not a template","Yours to keep, share and replay",
         "A free preview before you pay anything"]
SHIELD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3l7 3v6c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6l7-3z" stroke-linejoin="round"/><path d="M9 12l2.2 2.2L15.5 10" stroke-linecap="round" stroke-linejoin="round"/></svg>'
OFFER = f'''<div class="cs cs-duo-offer"><div class="cs-wrap"><div class="cs-sec"><div class="cs-do-card">
<div class="cs-do-left"><span class="cs-eyebrow">✦ What you get</span>
<h2 class="cs-h2 cs-do-h">One song. One music video. Both about them.</h2>
<p class="cs-do-body">This is the one gift they cannot get for themselves, and the one they cannot guess.</p>
<ul class="cs-do-list">{"".join(f"<li>{CHECK}<span>{html.escape(i)}</span></li>" for i in items)}</ul></div>
<div class="cs-do-right"><p class="cs-do-free">Your preview is free</p>
<a class="cs-btn cs-btn-primary cs-btn-lg cs-do-btn" href="#">Create Your Free Preview</a>
<span class="cs-do-note">You decide after you have heard it</span>
<div class="cs-do-guar">{SHIELD}<span>Full refund if you are not happy with it</span></div></div>
</div></div></div></div>'''

# ---------- FAQ ----------
qas = [("Do I have to be good with words?","No. You are not writing anything. You answer five plain questions about the two of you, in your own words, and we turn those answers into lyrics.",True),
       ("Do the two of us really appear in the music video?","Yes — that is the part nobody else does. The couple on screen is built to look like you, so the video tells your story instead of a stock one.",False),
       ("Can I choose the style?","You pick the genre and the mood. Country, soul, pop, acoustic, rap — whatever they would actually put on.",False),
       ("What if I do not like it?","You hear a free preview before you pay anything. If it is not right, you owe nothing, and if you have already ordered and you are not happy with it, you get a full refund.",False),
       ("What exactly do I receive?","A full-length song and a music video, both about the two of you, yours to keep and to share.",False),
       ("Is it a good wedding gift?","It is made for the moments where a card is not enough: a first dance, a wedding morning, an anniversary, or the gift the guests give together.",False)]
FAQ = f'''<div class="cs cs-duo-faq"><div class="cs-wrap"><div class="cs-sec">
<div class="cs-sec-head"><span class="cs-eyebrow">✦ Before you start</span><h2 class="cs-h2">The questions everyone asks</h2></div>
<div class="cs-df-list">{"".join(f'<details class="cs-df-item"{" open" if o else ""}><summary class="cs-df-q"><span>{html.escape(q)}</span><span class="cs-df-mark"></span></summary><div class="cs-df-a"><p>{html.escape(a)}</p></div></details>' for q,a,o in qas)}</div>
<div class="cs-df-cta"><a class="cs-btn cs-btn-primary cs-btn-lg" href="#">Create Your Free Preview</a></div>
</div></div></div>'''

page = f'''<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>QA mock</title><style>{CSS}
html,body{{margin:0;padding:0;background:var(--cs-paper)}}
</style></head><body>{HERO}{VSL}{DEMOS}{STEPS}{OFFER}{FAQ}<div class="cs cs-duo-bar cs-dbar-mobile-only cs-dbar-on"><div class="cs-dbar-in">
<div class="cs-dbar-txt"><span class="cs-dbar-t">Your preview is free</span><span class="cs-dbar-n">No payment up front</span></div>
<a class="cs-btn cs-btn-primary cs-dbar-btn" href="#">Start</a></div></div></body></html>'''

open(f"{OUT}/mock.html","w",encoding="utf-8").write(page)
print(f"mock.html ecrit : {len(page)} octets, CSS {len(CSS)} octets")
