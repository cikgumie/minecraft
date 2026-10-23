# VoxelCraft 3D

Game voxel Creative untuk browser. Dunia dijana daripada seed, boleh dibina, disimpan secara lokal, dieksport dan diimport. Versi ini sesuai dihos sebagai laman statik GitHub Pages.

## Jalankan di komputer

Perlukan Node.js versi dalam `.nvmrc` atau versi serasi.

```bash
npm ci
npm run dev
```

Buka URL yang dipaparkan Vite. Untuk semak binaan production:

```bash
npm run build
npm run preview
```

## Kawalan

| Input | Fungsi |
| --- | --- |
| WASD / arrow | Bergerak |
| Mouse / leret skrin | Pandang |
| Klik kiri / PECAH | Pecah blok |
| Klik kanan / LETAK | Letak blok |
| Space | Lompat / terbang naik |
| Shift | Tunduk / terbang turun |
| E | Inventori blok |
| 1–9 / scroll | Pilih slot hotbar |
| F | Terbang |
| T | Tukar waktu |
| Ctrl+Z / Ctrl+Y | Undo / redo |
| Esc | Menu jeda |

Pada telefon, gunakan joystick di kiri, leret kawasan game untuk melihat dan butang aksi di kanan. Dalam Tetapan terdapat mod alternatif: tap blok untuk letak dan tekan tahan untuk pecah. Auto-jump boleh diubah.

## Simpanan

Dunia disimpan melalui IndexedDB pada browser dan peranti yang digunakan. Autosave berjalan semasa bermain, tetapi kuota, mod peribadi atau pemadaman data browser boleh menghilangkan simpanan lokal. Gunakan **Eksport** sebagai backup; **Import Dunia** memulihkan fail tersebut. Pautan seed hanya berkongsi terrain asal, bukan binaan. Multiplayer dan cloud save belum tersedia.

## Semakan

```bash
npm run lint
npm run test:unit
npm run build
npx playwright install chromium
npm run test:e2e
```

Keputusan semakan yang sudah dibuat dan baki QA untuk keluaran awam ada dalam `docs/QA.md`.

## GitHub Pages

1. Cipta repository GitHub dan letakkan fail projek di branch `main`.
2. Buka **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push ke `main`. Workflow menjalankan semakan dan menerbitkan folder `dist`.
4. Buka `https://<owner>.github.io/<repo>/` selepas workflow selesai.

`vite.config.js` membaca `GITHUB_REPOSITORY` di GitHub Actions dan membina base path `/<repo>/` secara automatik. Pada komputer, base path `/` digunakan.

## Struktur

- `src/world/`: jenis blok, generator dan data chunk.
- `src/render/`: tekstur prosedur, mesher dan Three.js.
- `src/player/`: fizik dan raycast.
- `src/storage/`: IndexedDB, import dan eksport.
- `src/main.js`: UI, input dan aliran game.
- `voxel_craft_3d.html`: prototaip asal sebagai rujukan.
- `PLAN_UPGRADE.md`: pelan penuh dan skop pengembangan.

## Had versi ini

Dunia terhad kepada 256 × 256 blok mendatar dan tinggi 64 blok. Air statik. Simpanan wujud pada origin browser semasa sahaja. Manifest aplikasi tersedia, tetapi offline selepas lawatan pertama belum dilaksanakan kerana service worker belum ditambah. Perkakasan dan browser yang berbeza boleh menghasilkan prestasi berlainan.

## Lesen

Kod projek ini belum diberikan lesen penggunaan semula. Pemilik projek boleh menetapkan lesen sebelum menerbitkan repository. Lesen dependency kekal di bawah pemiliknya; lihat `THIRD_PARTY_NOTICES.md`.
