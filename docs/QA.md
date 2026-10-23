# Status QA VoxelCraft 3D

Tarikh: 23 Oktober 2026.

## Semakan automatik yang lulus

- ESLint (`npm run lint`).
- Vitest: 8 ujian unit merentas 4 fail (`npm run test:unit`).
- Vite production build (`npm run build`).
- Playwright Chromium: cipta/simpan/buka semula dunia, letak blok serta eksport/import, dan kawalan/setting paparan telefon (3 ujian).
- Build dan ujian pelayar untuk base path GitHub Pages `/<repo>/` dengan `GITHUB_REPOSITORY=example/voxelcraft`.
- `npm audit --omit=dev`: 0 vulnerability ketika semakan.
- Fail prototaip asal dikekalkan tanpa perubahan; SHA256 `A34CD6C48678B7294BB74FB18E27FA201538432EC16629B1907D4F32D43D454C`.

## Masih perlu disahkan sebelum release awam 1.0

- Cipta repository GitHub, jalankan workflow pada branch `main`, kemudian buka URL Pages sebenar dan semak save selepas refresh.
- Uji pointer lock, multitouch, orientasi dan prestasi pada Chrome/Edge/Firefox desktop, Android Chrome dan iOS Safari peranti sebenar.
- Ukur FPS, p95 masa frame, penggunaan memori dan masa loading dengan protokol dalam `PLAN_UPGRADE.md`.
- Uji storage penuh, dua tab serentak, konteks WebGL hilang dan dunia eksport rosak dalam browser sasaran.
- Pilih lesen projek dan selesaikan laporan QA akhir sebelum menandakan keluaran 1.0.

Ujian Chromium headless mengesahkan aliran utama, tetapi tidak menggantikan semakan peranti atau URL production sebenar.
