/* 서비스 워커 — 한 번 연 뒤에는 인터넷 없이도 열리게 한다.
   원칙 두 가지:
   1) index.html은 '인터넷 먼저'(network-first). 캐시를 먼저 주면 고쳐 올려도
      사람들이 옛 판을 계속 본다. 인터넷이 없을 때만 캐시를 쓴다.
   2) lib/ 안의 라이브러리는 '캐시 먼저'. 내용이 바뀌지 않는 파일이라
      매번 받을 이유가 없다. 새 판을 올리면 CACHE 이름이 바뀌어 통째로 갈린다.
   ※ BUILD는 배포할 때마다 build.py가 바꿔 넣는다. */
var BUILD='1.0-beta (2026-09-20b)+3be91a91';
var CACHE='submaker-'+BUILD;

/* 처음 열 때 미리 받아두는 것 — 첫 화면에 필요한 것만.
   무거운 라이브러리는 여기 넣지 않는다(쓸 때 받아서 그때 캐시된다). */
var CORE=['./','./index.html','./manifest.webmanifest',
          './icons/icon-192.png','./icons/icon-512.png'];

self.addEventListener('install',function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      /* 하나가 실패해도 설치 자체는 되게 — 개별로 담는다 */
      return Promise.all(CORE.map(function(u){
        return c.add(new Request(u,{cache:'reload'})).catch(function(){});
      }));
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate',function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        if(k!==CACHE) return caches.delete(k);   /* 옛 판 찌꺼기 청소 */
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

/* 페이지가 "지금 바로 새 판으로 갈아타라"고 시킬 때 */
self.addEventListener('message',function(e){
  if(e.data&&e.data.type==='SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch',function(e){
  var req=e.request;
  if(req.method!=='GET') return;

  var url;
  try{ url=new URL(req.url); }catch(err){ return; }
  if(url.origin!==self.location.origin) return;   /* 남의 주소는 건드리지 않는다 */

  var isPage=(req.mode==='navigate')||/\.html$/i.test(url.pathname);

  if(isPage){
    /* 인터넷 먼저 — 새 판이 있으면 바로 보이게 */
    e.respondWith(
      fetch(req).then(function(res){
        if(res&&res.ok){
          var copy=res.clone();
          caches.open(CACHE).then(function(c){ c.put(req,copy); });
        }
        return res;
      }).catch(function(){
        return caches.match(req).then(function(hit){
          return hit||caches.match('./index.html');
        });
      })
    );
    return;
  }

  /* 나머지(라이브러리·아이콘) — 캐시 먼저, 없으면 받아서 담아둔다 */
  e.respondWith(
    caches.match(req).then(function(hit){
      if(hit) return hit;
      return fetch(req).then(function(res){
        if(res&&res.ok&&res.type==='basic'){
          var copy=res.clone();
          caches.open(CACHE).then(function(c){ c.put(req,copy); });
        }
        return res;
      });
    })
  );
});
