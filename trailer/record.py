"""SHIFT LOCK trailer recorder.

Plays the game with scripted input in virtual time (trailer/harness.js + director.js),
pipes every frame into ffmpeg, renders the game's own synthesized sound offline,
muxes both and cuts a few GIFs for the itch.io page.

  python record.py --edge --nvenc            (the RTX PC: Edge + h264_nvenc)
  python record.py --chromium PATH --small   (a quick CPU preview)
"""
import argparse, base64, functools, http.server, json, os, subprocess, sys, threading, time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)                      # the repository root (the game) 

ap = argparse.ArgumentParser()
ap.add_argument('--edge', action='store_true', help='use the installed Microsoft Edge')
ap.add_argument('--chromium', help='path to a Chromium binary')
ap.add_argument('--nvenc', action='store_true', help='encode with h264_nvenc (NVIDIA GPU)')
ap.add_argument('--small', action='store_true', help='960x540 at 30 fps preview')
ap.add_argument('--out', default=os.path.join(HERE, 'out'))
ap.add_argument('--max-seconds', type=float, default=90)
a = ap.parse_args()

W, H, FPS = (960, 540, 30) if a.small else (1920, 1080, 60)
os.makedirs(a.out, exist_ok=True)
video = os.path.join(a.out, 'trailer_video.mp4')
wav = os.path.join(a.out, 'trailer_audio.wav')
final = os.path.join(a.out, 'shiftlock_trailer.mp4')

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
url = f'http://127.0.0.1:{srv.server_address[1]}/index.html'

vcodec = (['-c:v', 'h264_nvenc', '-preset', 'p7', '-tune', 'hq', '-rc', 'vbr', '-cq', '17', '-b:v', '0', '-profile:v', 'high']
          if a.nvenc else ['-c:v', 'libx264', '-preset', 'medium', '-crf', '18'])
ff = subprocess.Popen(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', str(FPS), '-c:v', 'png', '-i', '-',
                       *vcodec, '-pix_fmt', 'yuv420p', '-r', str(FPS), video], stdin=subprocess.PIPE)

from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    opts = dict(headless=True, args=['--autoplay-policy=no-user-gesture-required', '--hide-scrollbars'])
    if a.edge: opts['channel'] = 'msedge'
    elif a.chromium: opts['executable_path'] = a.chromium
    b = p.chromium.launch(**opts)
    pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=1)
    errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    pg.add_init_script(path=os.path.join(HERE, 'harness.js'))
    pg.goto(url)
    pg.wait_for_function('() => document.fonts.status === "loaded" && window.__ready && window.__ready()', timeout=30000)
    pg.evaluate('() => window.__installSoundLog()')
    with open(os.path.join(HERE, 'plans.json'), encoding='utf-8') as f:
        pg.evaluate('(p) => { window.__PLANS = p; }', json.load(f))
    with open(os.path.join(HERE, 'director.js'), encoding='utf-8') as f:
        pg.evaluate(f.read())
    t0 = time.time(); n = 0; step = 1000.0 / FPS
    while n < a.max_seconds * FPS:
        done = pg.evaluate('(ms) => window.__frame(ms)', step)
        ff.stdin.write(pg.screenshot(type='png'))
        n += 1
        if n % (FPS * 5) == 0: print(f'  {n / FPS:.0f} s recorded ({time.time() - t0:.0f} s)', flush=True)
        if done: break
    ff.stdin.close(); ff.wait()
    dur = n / FPS
    cues = pg.evaluate('() => window.__cues')
    res = pg.evaluate('(d) => window.__renderAudio(d)', dur)
    with open(wav, 'wb') as f: f.write(base64.b64decode(res['b64']))
    b.close()
srv.shutdown()

subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', video, '-i', wav, '-c:v', 'copy', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '48000', '-c:a', 'aac', '-b:a', '192k',
                '-shortest', '-movflags', '+faststart', final], check=True)
# GIFs for the itch.io page (no sound there anyway)
gifs = [('gif_1_shift', cues.get('l3', 10), 4.6), ('gif_2_dash', cues.get('l5', 17), 6.0), ('gif_3_redpen', cues.get('l6', 25.5), 6.5), ('gif_4_ending', cues.get('ending', 43) + 0.3, 4.5)]
for name, start, length in gifs:
    out = os.path.join(a.out, name + '.gif')
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-ss', f'{start:.2f}', '-t', f'{length:.2f}', '-i', final, '-vf',
                    'fps=15,scale=640:-1:flags=lanczos,hqdn3d=3:2:4:3,split[a][b];[a]palettegen=max_colors=40:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle',
                    out], check=True)
info = {'frames': n, 'fps': FPS, 'size': [W, H], 'seconds': round(dur, 2), 'cues': cues, 'sound_events': res['events'], 'audio_peak': round(res['peak'], 3),
        'encoder': 'h264_nvenc' if a.nvenc else 'libx264', 'errors': errors}
with open(os.path.join(a.out, 'trailer_info.json'), 'w', encoding='utf-8') as f: json.dump(info, f, indent=1)
print(json.dumps(info, indent=1))
