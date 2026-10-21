from http.server import BaseHTTPRequestHandler
import urllib.parse
import asyncio
import edge_tts

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        text = query.get('text', ['Arrey boss, Rox hazir hai. Boliye!'])[0]
        rate = query.get('rate', ['+5%'])[0]
        pitch = query.get('pitch', ['+2Hz'])[0]
        voice = query.get('voice', ['hi-IN-MadhurNeural'])[0]

        async def get_audio():
            comm = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
            buf = bytearray()
            async for chunk in comm.stream():
                if chunk['type'] == 'audio':
                    buf.extend(chunk['data'])
            return bytes(buf)

        try:
            audio_bytes = asyncio.run(get_audio())
            self.send_response(200)
            self.send_header('Content-Type', 'audio/mpeg')
            self.send_header('Cache-Control', 'public, max-age=86400')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(audio_bytes)
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'text/plain')
            self.end_headers()
            self.wfile.write(str(e).encode())
