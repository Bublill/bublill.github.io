const CACHE_NAME = 'mafia-v1';
const ASSETS = [
    './',
    './index.html',
    './css/styles.css',
    './js/app.js',
    './manifest.json',
    './Assets/Rolecards/agent.webp',
    './Assets/Rolecards/avenger.webp',
    './Assets/Rolecards/bodyguard.webp',
    './Assets/Rolecards/boss.webp',
    './Assets/Rolecards/cartel.webp',
    './Assets/Rolecards/detective.webp',
    './Assets/Rolecards/doctor.webp',
    './Assets/Rolecards/fangirl.webp',
    './Assets/Rolecards/journalist.webp',
    './Assets/Rolecards/judge.webp',
    './Assets/Rolecards/lawyer.webp',
    './Assets/Rolecards/leader.webp',
    './Assets/Rolecards/lucky.webp',
    './Assets/Rolecards/mafia.webp',
    './Assets/Rolecards/maniac.webp',
    './Assets/Rolecards/mistress.webp',
    './Assets/Rolecards/patrol.webp',
    './Assets/Rolecards/peaceful.webp',
    './Assets/Rolecards/poisoner.webp',
    './Assets/Rolecards/psychic.webp',
    './Assets/Rolecards/revolutionary.webp',
    './Assets/Rolecards/sectant.webp',
    './Assets/Rolecards/sleuth.webp',
    './Assets/Rolecards/tracker.webp',
    './Assets/Rolecards/werewolf.webp'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(cached => cached || fetch(event.request))
    );
});