# Pelan Akhir Upgrade VoxelCraft 3D

Tarikh: 23 Oktober 2026  
Sumber audit: `voxel_craft_3d.html` — 1,339 baris, kira-kira 59 KB.  
Sasaran hosting: GitHub Pages melalui repository GitHub.  
Status: Pelan rujukan. Kod permainan baharu, build, ujian automatik dan workflow GitHub Pages telah disediakan pada 23 Oktober 2026. Deployment awam serta QA peranti dan prestasi sebenar masih belum dibuat; lihat `docs/QA.md`.  
Rujukan pelaksanaan: keputusan dalam seksyen utama, roadmap F0–F8 dan backlog T01–T26 ialah satu skop yang selaras.

## 1. Hala tuju dan keputusan utama

Jadikan VoxelCraft sebuah game voxel sandbox dalam browser yang lancar, boleh menyimpan dunia, selesa dimainkan pada komputer dan telefon, serta mudah dikemas kini melalui GitHub.

Keputusan asas untuk memulakan kerja:

- **Versi 1.0 mengutamakan Creative single-player.** Pemain meneroka, membina dan menyimpan dunia tanpa akaun.
- **Hosting menggunakan GitHub Pages.** Semua kod game berjalan dalam browser; build menghasilkan fail statik.
- **Asas chunk dibina sebelum sistem save.** Selepas baseline dan modul asas, terus gunakan data chunk serta face meshing; tidak perlu membina renderer `InstancedMesh` per-chunk sebagai peringkat sementara.
- **Simpanan dunia berada pada peranti pemain.** Simpan snapshot lengkap chunk yang pernah diubah dalam IndexedDB; sediakan eksport/import untuk pindah peranti dan backup.
- **Versi generator kekal terikat pada dunia.** Snapshot chunk terubah tidak menggantikan versioning bagi terrain yang belum disimpan.
- **Prestasi disahkan melalui ukuran.** AO, pemampatan RLE/palette, worker dan greedy meshing ditambah mengikut keperluan dan bajet.
- **Survival, crafting kompleks dan multiplayer ialah pengembangan selepas asas stabil.** Setiap satunya mempunyai skop dan kriteria tersendiri dalam pelan ini.

Ini ialah andaian kerja kerana gaya gameplay akhir dan spesifikasi peranti sasaran belum ditetapkan. Pelan boleh diteruskan dengan keputusan ini tanpa menunggu nama repository atau domain.

## 2. Audit projek semasa

Audit ini berdasarkan pembacaan kod, bukan ujian bermain atau benchmark. Risiko yang memerlukan pengesahan runtime ditandakan secara khusus.

### 2.1 Ciri yang sudah tersedia

| Bahagian | Keadaan dalam kod |
| --- | --- |
| Rendering | Three.js r128 melalui CDN, `InstancedMesh` mengikut jenis blok |
| Dunia | Terrain asas 53 × 53 kolum melalui `WORLD_RADIUS = 26`, bukit, pasir, air dan pokok |
| Kandungan | 11 jenis blok; 10 boleh dipilih, air tidak boleh dipilih |
| Interaksi | Pecah/letak blok, highlight sasaran dan DDA raycast sejauh 6.5 unit |
| Pemain | Jalan, lompat, graviti, collision AABB, terbang dan pergerakan dalam air |
| Suasana | Tiga preset langit, awan, partikel dan audio sintesis Web Audio |
| Antara muka | HUD, koordinat, label biome, FPS, hotbar, menu dan toast |
| Input | Keyboard/mouse, pointer lock, drag look dan butang sentuh |
| Struktur | HTML, CSS dan JavaScript terkumpul dalam satu fail |
| Infrastruktur | Folder semasa belum menjadi repository Git; tiada build, ujian atau workflow deployment |

### 2.2 Masalah dan tindakan yang diperlukan

| ID | Penemuan daripada kod | Kesan | Tindakan |
| --- | --- | --- | --- |
| A01 | Tiada save/load | Refresh membuang binaan sesi semasa | IndexedDB, autosave dan eksport/import |
| A02 | `rebuildMeshes()` melalui seluruh `worldData` setiap kali pecah/letak blok | Kos perubahan bertambah apabila dunia besar | Chunk dan dirty mesh setempat |
| A03 | `MAX_INSTANCES_PER_TYPE = 18000`; lebihan tidak dimasukkan ke mesh | Blok boleh wujud dalam data tetapi tidak kelihatan | Hapus had global senyap; kapasiti per chunk dan pemantauan |
| A04 | `frustumCulled = false`; blok terdedah masih dilukis sebagai kubus penuh | Kerja rendering berlebihan | Mesh muka terdedah dan bounds per chunk |
| A05 | Pokok menggunakan `Math.random()` walaupun terrain menerima seed | Seed sama belum menjamin dunia sama | Generator deterministik mengikut seed dan koordinat |
| A06 | `KeyG` terus menjana dunia; tiada pengesahan atau simpanan | Binaan boleh hilang kerana tersalah tekan atau key repeat | Dialog New World, autosave dan abaikan `event.repeat` |
| A07 | Tiada reset input pada `blur`, `visibilitychange` atau `touchcancel` | Risiko pemain terus bergerak selepas kehilangan fokus | Input lifecycle dan reset menyeluruh |
| A08 | `lockPointer()` menutup menu sebelum hasil permintaan; tiada `pointerlockerror` | Risiko UI tersangkut apabila lock ditolak | State game jelas dan kendali kejayaan/kegagalan lock |
| A09 | Fungsi pecah/letak tidak memeriksa state aktif; sasaran lama masih disimpan | Risiko tindakan ketika pause atau selepas pertukaran dunia | Guard state dan sahkan raycast semula semasa tindakan |
| A10 | Fizik menggunakan delta berubah, maksimum 0.1 saat | Risiko tunneling, jatuh atau collision tidak konsisten ketika lag | Fixed timestep dan collision substep |
| A11 | DDA mengira komponen arah sifar menggunakan `Infinity` | Pada sempadan integer, `0 * Infinity` boleh menjadi `NaN` | Tetapkan `tMax` paksi sifar terus kepada `Infinity`; uji kes sempadan |
| A12 | `initInstancedMeshes()` memanggil `.dispose()` pada mesh lama | Keserasian API dengan r128 perlu disahkan; berpotensi menggagalkan New World | Uji laluan regenerasi dan disposal mengikut versi yang dipilih |
| A13 | Three.js, Tailwind runtime dan font diambil daripada perkhidmatan luar | Startup bergantung pada beberapa rangkaian; offline belum lengkap | Bundle dependency, bina CSS dan hos font secara lokal |
| A14 | Label biome ditentukan daripada ketinggian pemain | Label boleh berubah hanya kerana pemain terbang | Tentukan biome daripada data terrain pada koordinat dunia |
| A15 | Tiada `index.html` di akar projek | Laluan utama hosting belum disediakan | Wujudkan entry point build `index.html` |
| A16 | Crouch cuma merendahkan kamera; layer bawah ialah cobblestone yang dilindungi melalui `y === 0` | Peraturan blok dan label UI belum seragam | Definisi sifat blok dan tingkah laku crouch yang jelas |

## 3. Skop keluaran dan keutamaan

**P0:** wajib sebelum pautan awam awal. **P1:** wajib untuk versi 1.0. **P2:** pengembangan selepas 1.0.

| Keutamaan | Skop | Hasil untuk pemain |
| --- | --- | --- |
| P0 | Entry point, build statik dan Pages deployment | Pautan game boleh dibuka terus |
| P0 | New World selamat, pause/input, pointer lock, raycast dan collision kritikal | Sesi asas boleh dimainkan dengan stabil |
| P0 | Paparan loading, kegagalan WebGL dan ralat startup | Pemain faham jika game belum atau tidak boleh dimulakan |
| P1 | Save/load, beberapa dunia, autosave, eksport/import | Binaan boleh disambung pada sesi lain |
| P0 | Asas chunk, generator deterministik dan face meshing setempat | Alpha menggunakan seni bina dunia sasaran sejak awal |
| P1 | Dunia 256 × 256 × 64, culling dan profiling | Saiz dan kelancaran disahkan pada peranti sasaran |
| P1 | Creative inventory, hotbar, lebih banyak blok dan undo/redo | Membina lebih selesa dan menarik |
| P1 | Kawalan telefon, settings, tutorial ringkas, BM/English | Game lebih mudah digunakan |
| P1 | Polish visual/audio, QA dan release workflow | Keluaran 1.0 yang konsisten |
| P2 | Baked vertex AO, compression lanjutan dan pengoptimuman tambahan | Penambahbaikan selepas bottleneck dan kos diketahui |
| P2 | PWA/offline selepas lawatan pertama | Main tanpa rangkaian selepas aset dicache |
| P2 | Survival, crafting, resource gathering dan mob asas | Progression dan cabaran tambahan |
| P2 | Multiplayer, cloud save dan akaun | Bermain bersama atau menyambung melalui cloud |

P0 ialah alpha untuk semakan. Jangan pasarkan alpha sebagai sudah mempunyai simpanan dunia; versi awam utama disasarkan selepas P1 siap.

## 4. Reka bentuk gameplay

### 4.1 Kitaran permainan versi 1.0

1. Buka game dan pilih dunia sedia ada atau cipta dunia baharu.
2. Pilih nama dunia, seed, preset terrain dan kualiti grafik.
3. Muncul di lokasi selamat dengan tutorial kawalan yang boleh dilangkau.
4. Teroka, pilih bahan daripada inventory dan bina menggunakan hotbar.
5. Gunakan fly, tukar masa dan undo/redo untuk memudahkan pembinaan.
6. Autosave menyimpan kemajuan; pemain boleh kembali ke menu atau eksport dunia.

### 4.2 Kandungan Creative

- Kekalkan blok sedia ada dan tambah stone, bedrock sebenar, wool berwarna, variasi planks, sandstone serta lampu dekorasi; sasaran awal 24–32 jenis blok.
- Inventory berkategori: Terrain, Building, Wood, Colour dan Decoration; carian nama blok.
- Hotbar 9 slot boleh ditukar kandungan; semua blok tambahan dipilih melalui inventory. Migrasi pilihan Gold lama ke slot atau inventory secara jelas.
- Klik/tekan tahan untuk bina atau pecah berulang dengan sela terkawal; ulang melalui action scheduler, bukan pertindihan event mouse/touch. Setiap tindakan menyemak sasaran semasa.
- Undo/redo sehingga 100 arahan terakhir bagi sesi semasa; kumpulkan operasi berterusan agar tidak memenuhi sejarah terlalu cepat.
- Butang screenshot, respawn dan salin seed/link.
- Preset wajib 1.0: Hills dan Flat. Island ialah pengembangan P2 selepas generator diuji.
- Had dunia dan ketinggian dinyatakan dalam UI; jangan menjanjikan dunia infinite dalam 1.0.

### 4.3 Peraturan dunia

- `air = 0`; kekalkan ID blok lama supaya format data tidak mudah bercanggah.
- Asingkan sifat `solid`, `opaque`, `selectable`, `breakable`, `replaceable` dan `liquid` dalam registry blok.
- Tetapkan bedrock bawah sebagai tidak boleh dipecahkan; elakkan bergantung pada nama cobblestone atau satu syarat tersebar.
- Air kekal statik untuk 1.0; ada kesan berenang dan paparan bawah air, tanpa simulasi aliran.
- Placement menyemak jarak, ruang kosong/replaceable, bounds dunia dan pertindihan pemain.
- Respawn memilih tanah kukuh dengan ruang kepala; jika tiada lokasi sesuai, guna platform selamat yang ditentukan generator.
- New World mencipta rekod dunia baharu. Pemadaman dunia ialah tindakan berasingan dengan pengesahan.

## 5. Antara muka dan kawalan

### 5.1 Skrin utama

| Skrin | Kandungan |
| --- | --- |
| Main menu | Play, Worlds, Settings, How to Play dan versi |
| World list | Nama, tarikh main terakhir, seed, Play, Rename, Export dan Delete |
| Create World | Nama, seed manual/rawak, preset, penerangan saiz dunia |
| Pause | Resume, Save, Settings, Controls, Export dan Save & Quit |
| Settings | Volume, sensitiviti, invert Y, FOV, render distance, pixel ratio, bahasa dan susun atur sentuh |
| Inventory | Kategori, carian, preview blok dan penetapan hotbar |

Gunakan state `BOOT → MENU → LOADING → PLAYING ↔ PAUSED`, dengan `ERROR` untuk kegagalan yang memerlukan pemulihan. Saving ialah proses async berasingan (`idle/saving/saved/failed`) supaya autosave tidak menghentikan permainan setiap 15 saat. Input gameplay hanya aktif dalam `PLAYING`; UI menerima inputnya sendiri. Save & Quit menunggu transaksi selesai atau memaparkan pilihan apabila ia gagal.

### 5.2 Desktop

- WASD/arrow untuk bergerak, Space untuk lompat, mouse untuk pandangan.
- Klik kiri pecah, kanan letak, scroll/1–9 pilih slot, E buka inventory.
- F untuk fly dalam Creative, Esc untuk pause, Ctrl+Z/Ctrl+Y untuk undo/redo semasa bermain.
- New World hanya melalui menu; shortcut pilihan membuka dialog dan tidak terus memadam atau menjana.
- UI form boleh menerima teks, termasuk nombor seed, tanpa mencetuskan shortcut game.
- Kendali pointer lock melalui gesture pemain, `pointerlockchange` dan `pointerlockerror`; sediakan drag look apabila perlu. API ini mempunyai perbezaan sokongan browser dan bentuk pulangan promise/non-promise. [Rujukan Pointer Lock](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API)

### 5.3 Telefon dan tablet

- Mod lalai: joystick kiri untuk bergerak, kawasan kanan untuk pandangan dan butang mine/place/jump/fly; sasaran menggunakan crosshair.
- Mod pilihan Touch-to-Interact: tap untuk place dan hold sekitar 350 ms untuk mine. Raycast menggunakan koordinat sentuhan pada canvas; placement menggunakan muka blok yang disentuh dan had jarak pemain yang sama.
- Ambang gerakan awal 10 CSS px membezakan tap/hold daripada drag. Apabila drag bermula, batalkan aksi blok; pelepasan selepas hold yang berjaya tidak mencetuskan place. Laraskan ambang melalui ujian peranti.
- Guna Pointer Events dan pointer capture; asingkan pointer gerakan, pandangan dan tindakan supaya multitouch tidak bercampur.
- Reset pointer pada `pointercancel`, kehilangan capture, pause dan kehilangan fokus.
- Auto-jump/step-up satu blok ialah setting boleh dimatikan, lalai aktif bagi touch. Semak ruang kepala, ruang mendarat dan collision sepanjang laluan; jangan teleport pemain melalui dinding atau siling. Matikan dalam fly dan gunakan peraturan berenang yang berasingan.
- Butang sasaran sekurang-kurangnya 44 × 44 CSS px; laraskan safe area dan ruang hotbar.
- Landscape disyorkan, tetapi portrait masih mempunyai UI yang boleh digunakan.
- Paparkan cadangan putar telefon secara ringan; jangan menjadikan orientation lock syarat untuk bermain.
- Layout menggunakan fallback `100vh` diikuti `100dvh`, `viewport-fit=cover` dan padding `env(safe-area-inset-*)`. Resize renderer berdasarkan saiz container sebenar; uji perubahan bar browser dan orientation.
- Fullscreen ialah pilihan berdasarkan feature detection dan hasil permintaan. Game mesti boleh digunakan dalam tab biasa; `100dvh` membantu layout dan tidak mengaktifkan fullscreen.
- Haptic ialah enhancement boleh dimatikan: semak fungsi wujud, contohnya `navigator.vibrate?.(25)`, dan jangan bergantung padanya untuk maklum balas tindakan. Safari/iOS tidak menyediakan Vibration API; audio/visual kekal berfungsi. [Laporan pelaksanaan W3C](https://w3c.github.io/vibration/reports/implementation.html)

### 5.4 Kebolehgunaan

- Sokongan BM/English melalui kamus teks, dengan BM sebagai lalai awal.
- Fokus keyboard yang kelihatan, label untuk ikon, kontras yang jelas dan tooltip kawalan.
- Mute, reduced motion serta pilihan mematikan camera bob/partikel.
- Paparkan status `Menyimpan…`, `Disimpan` atau kegagalan sebenar; elakkan toast berjaya sebelum transaksi selesai.

## 6. Stack dan struktur kod

Cadangan: **JavaScript ES modules + Three.js + Vite + CSS lokal**. Tidak perlu framework UI besar untuk saiz game ini. Gunakan Vitest bagi logik penting dan Playwright bagi aliran browser.

1. Rekod baseline, kemudian asingkan modul core, input, world dan render dengan kontrak data yang jelas. Kekalkan mekanik pemain yang berguna; jangan menulis sistem save yang terikat pada mesh global lama.
2. Bundle Three.js daripada npm dan commit lockfile; hapuskan kebergantungan CDN runtime.
3. Selepas baseline modular lulus, pilih dan bekukan versi Three.js sasaran dalam F1, sebelum mesher baharu dibina. Jika versi dinaik taraf, buat commit berasingan dan semak renderer, warna, material, transparency, WebGL serta disposal mengikut [panduan migrasi rasmi](https://github.com/mrdoob/three.js/wiki/Migration-Guide).
4. Pilih versi dependency dan Node yang serasi ketika pelaksanaan, kemudian rekod versi tepat dalam lockfile dan `.nvmrc`.
5. Gantikan Tailwind CDN dengan CSS lokal; jika utility Tailwind masih diperlukan, compile semasa build.

Struktur sasaran, diwujudkan mengikut fasa:

```text
Minecraft/
├── index.html
├── package.json
├── package-lock.json
├── vite.config.js
├── .nvmrc
├── .gitignore
├── README.md
├── CHANGELOG.md
├── LICENSE
├── THIRD_PARTY_NOTICES.md
├── PLAN_UPGRADE.md
├── docs/
│   ├── BASELINE.md
│   ├── QA.md
│   └── RELEASE.md
├── public/
│   ├── icons/
│   └── fonts/
├── src/
│   ├── main.js
│   ├── styles.css
│   ├── core/          # game state, loop, settings, events
│   ├── render/        # scene, materials, chunk mesher, effects
│   ├── world/         # block registry, chunks, seed, terrain, revisions
│   ├── player/        # movement, collision, raycast, input
│   ├── gameplay/      # inventory, build commands, undo/redo
│   ├── storage/       # IndexedDB, chunk snapshots, schema, export/import
│   ├── ui/            # menu, HUD, inventory, touch, translations
│   ├── audio/         # synth, sound settings
│   └── workers/       # generation/meshing jika profiling memerlukan
├── tests/
│   ├── unit/
│   └── e2e/
└── .github/workflows/
    ├── ci.yml
    └── deploy.yml
```

Nama folder di atas ialah cadangan struktur, bukan fail yang sudah wujud. Salinan asal kekal sebagai rujukan tempatan atau tag baseline; jangan sertakan fail arkib dalam output `dist`.

## 7. Enjin dunia dan prestasi

### 7.1 Chunk dan had versi 1.0

- Saiz chunk awal: 16 × 16 × 16 blok, data `Uint16Array`; koordinat chunk menggunakan floor division supaya koordinat negatif betul.
- Kontrak chunk: `worldId`, koordinat chunk, array 4,096 ID blok, `revision`, `savedRevision` dan status dirty mesh/save berasingan. Renderer membaca data ini; storan tidak menyimpan objek Three.js.
- Sasaran dunia 1.0: 256 × 256 blok mendatar, tinggi 64 blok, dengan batas jelas. Uji dahulu sebelum menaikkan saiz.
- Render distance awal 2–4 chunk mendatar mengikut preset. Tetapkan had chunk aktif dan bajet geometry berdasarkan ukuran sebenar.
- Bezakan chunk data yang disimpan, chunk yang dimuat dalam memori dan chunk yang mempunyai mesh.
- Pecah/letak menandakan chunk terlibat sebagai dirty. Face meshing memerlukan jiran muka; apabila AO ditambah, semak juga jiran tepi/sudut yang diperlukan stencil AO.
- Unload mesh jauh; snapshot chunk yang belum disimpan mesti berjaya ditulis sebelum datanya dibuang. Jika gagal, kekalkan data dalam memori dan tawarkan retry/eksport.

### 7.2 Rendering

1. Terus bina face mesher pada data chunk; renderer `InstancedMesh` global lama hanya menjadi rujukan baseline.
2. Sasarkan satu `BufferGeometry` dan satu material atlas untuk lapisan opaque setiap chunk. Asingkan cutout dan transparent apabila sifat rendering memerlukannya; chunk kosong tidak mempunyai mesh.
3. Gunakan tile tekstur 16 × 16 piksel dalam atlas yang lebih besar, dengan gutter/padding dan UV betul. Saiz tile bukan saiz keseluruhan atlas. Gunakan filtering pixel yang sesuai dan uji bleed termasuk pada jarak jauh.
4. Tambah bounds dan frustum culling per chunk.
5. Utamakan dirty chunk berhampiran pemain; gabungkan perubahan berulang sebelum rebuild.
6. Pertimbangkan greedy meshing hanya selepas face meshing diukur. Pastikan tekstur muka yang digabung tidak meregang.
7. Jika generation/meshing masih mengganggu input, pindahkan pengiraan ke Web Worker menggunakan transferable buffers; kerja GPU kekal di main thread.
8. Tag tugasan dengan `worldId` dan revision chunk; abaikan hasil worker lama selepas edit atau tukar dunia.

Worker biasa tidak memerlukan SharedArrayBuffer. Reka bentuk awal mengelakkan kebergantungan pada shared memory atau header hosting khas.

Satu geometry bukan jaminan satu draw call: material groups menghasilkan draw call berasingan; pass bayang atau efek juga boleh menambah kerja rendering. Ukur `renderer.info.render.calls`, triangles, frame time serta kerja meshing pada scene sebenar. Jangan kira semua chunk dalam dunia sebagai sentiasa kelihatan, atau menjanjikan FPS berdasarkan draw call sahaja. [Dokumentasi BufferGeometry](https://threejs.org/docs/pages/BufferGeometry.html)

Texture array boleh dinilai kemudian jika versi renderer, material/shader dan peranti sasaran menyokongnya. Ia bukan pertukaran terus bagi atlas dalam semua material; atlas kekal keputusan asas 1.0.

### 7.3 Terrain deterministik

- Simpan seed sebagai string yang dinormalisasi dan hash stabil kepada generator.
- Gunakan PRNG/hash mengikut seed, koordinat dan lapisan kandungan; asingkan terrain, pokok dan dekorasi.
- Utamakan hash/PRNG integer yang ditentukan algoritmanya dan uji hash blok tetap pada Chrome, Firefox serta Safari sasaran. Seed sama sahaja belum membuktikan determinisme rentas browser bagi formula noise/floating-point.
- Seed serta `generatorVersion` yang sama mesti menghasilkan blok asas yang sama walaupun urutan chunk dimuat berbeza.
- Pokok ditentukan daripada titik asal global; chunk jiran boleh menghasilkan bahagian kanopi tanpa menimpa edit pemain atau menghasilkan pokok berbeza.
- Jangan gunakan `Math.random()` untuk kandungan dunia yang perlu dijana semula; ia masih boleh digunakan bagi audio atau partikel sementara.
- Perubahan algoritma terrain menghasilkan `generatorVersion` baharu; kekalkan generator lama bagi save lama atau buat migrasi eksplisit.
- Dunia lama terus menjana chunk belum tersimpan menggunakan generator lamanya. Memuat snapshot chunk terubah tidak memberi kebenaran untuk menukar generator baki dunia secara senyap.

### 7.4 Fizik dan loop

- Fixed timestep 1/60 saat dengan accumulator dan had substep; buang backlog selepas tab lama tidak aktif.
- Subdivide displacement atau gunakan swept collision supaya pergerakan pantas tidak melangkaui blok.
- Snap kaki tepat ke permukaan collision, semak kepala ketika melompat dan stabilkan keadaan `onGround`.
- Simpan vektor kerja untuk mengurangkan allocation setiap frame.
- Kemas kini teks HUD sekitar 5–10 kali sesaat, bukan semua teks setiap frame.
- Kurangkan rendering ketika pause/hidden dan reset input sebaik kehilangan fokus.
- Dispose geometry/material yang dimiliki sahaja; sumber berkongsi mempunyai lifecycle yang jelas.

## 8. Save/load dan pemilikan data

Gunakan **IndexedDB** untuk dunia dan `localStorage` hanya untuk tetapan kecil. Kapasiti dan eviction berbeza antara browser; save lokal memerlukan eksport backup, pengendalian quota dan mesej kegagalan. [Rujukan storan browser](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)

### 8.1 Model simpanan dan format chunk

| Rekod | Data penting |
| --- | --- |
| World metadata | `worldId`, nama, seed, `schemaVersion`, `generatorVersion`, masa cipta/kemas kini, preset dan bounds |
| Player state | Posisi, yaw/pitch, mod, spawn, hotbar dan selected slot |
| World state | Masa dunia dan tetapan gameplay dunia |
| Chunk snapshot | Koordinat chunk, revision, `encoding`, panjang data dan semua 4,096 ID blok selepas perubahan |
| Settings | Bahasa, grafik, audio dan kawalan; berasingan daripada dunia |

Keputusan 1.0: simpan **snapshot penuh bagi chunk yang pernah diubah**, sebagai salinan buffer `Uint16Array` dengan encoding `raw-u16`. Setiap chunk menggunakan 8 KiB data blok mentah. Chunk yang belum pernah diubah boleh dijana semula daripada seed, preset dan generator version dunia.

- Nilai `air = 0` kekal dalam snapshot; blok yang dibuang tidak muncul semula selepas reload.
- Tiada senarai besar objek `{x,y,z,blockId}` sebagai format utama save. Arahan bina/undo boleh merekod perubahan setempat dalam memori dengan had sejarah yang ditetapkan.
- RLE/paletted encoding ialah pengoptimuman P2 berdasarkan ukuran saiz dan masa encode/decode. Kekalkan fallback raw apabila hasil compression lebih besar atau terlalu mahal.
- Palette `Uint8Array` hanya sesuai apabila indeks palette muat dalam 256 nilai; format mesti mempunyai fallback atau palette indeks lebih lebar. Runtime kekal `Uint16Array` untuk satu kontrak yang mudah.
- RLE/palette tidak menggantikan `schemaVersion` atau `generatorVersion`. Chunk belum disimpan masih bergantung pada generator lama.

- Asingkan `schemaVersion`, `generatorVersion` dan versi aplikasi.
- Nama database/localStorage mempunyai namespace projek; project Pages berlainan pada hostname sama berkongsi origin, jadi nama umum seperti `worlds` perlu dielakkan.
- Autosave setiap 15 saat apabila ada perubahan dan semasa Save & Quit; serialize penulisan agar autosave lama tidak menimpa data baharu. Ambil snapshot buffer dan revision yang sepadan; perubahan selepas snapshot kekal dirty untuk transaksi seterusnya.
- Tulis perubahan berkaitan dalam transaksi konsisten; pertahankan rekod sah terakhir jika transaksi gagal.
- `visibilitychange` mencetuskan percubaan flush; jangan menganggap `beforeunload` menjamin penulisan async selesai.
- Sokong konflik dua tab melalui revision atau amaran bahawa dunia dibuka di tab lain; elakkan dua penulis serentak.
- Kuota penuh mengekalkan sesi dalam memori dan menawarkan eksport; jangan paparkan status Disimpan.
- Memuat save menyemak posisi selamat; pulihkan ke spawn jika pemain berada di dalam blok atau luar bounds.
- Minta persistent storage selepas pemain memilih untuk menyimpan dunia, jika API disokong; periksa boolean hasil `navigator.storage.persist()` dan kendali rejection. Browser boleh menolak permintaan, dan pengguna masih boleh memadam data. Eksport backup kekal diperlukan. [Dokumentasi persist](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist)

### 8.2 Eksport, import dan perkongsian

- Format awal JSON berstruktur dengan identiti format/versi; snapshot `raw-u16` dieksport sebagai base64 byte little-endian yang ditentukan formatnya, bukan format byte order tersirat peranti.
- Eksport merangkumi metadata, player/world state dan semua snapshot chunk yang pernah diubah; sertakan identiti generator supaya chunk lain boleh dijana semula.
- Eksport menggabungkan snapshot tersimpan dengan buffer terbaharu dalam memori, termasuk perubahan yang gagal autosave. Ambil snapshot keseluruhan yang konsisten dengan membekukan edit seketika; eksport backup tidak boleh bergantung pada kejayaan menulis ke IndexedDB.
- Import menyemak saiz fail, versi, ID blok, koordinat chunk integer/unik, bounds, encoding dan panjang decoded chunk tepat 8,192 byte bagi `raw-u16`. Tolak nilai bukan finite dan encoding tidak dikenali.
- Had awal import: 20 MiB fail JSON, maksimum 1,024 snapshot chunk bagi dunia 256 × 256 × 64, dan 8 MiB jumlah decoded data blok raw. Semak had sebelum allocation/decode besar dan rekod penggunaan memori parsing sebenar.
- Import ke `worldId` baharu selepas validasi; kegagalan tidak mengubah dunia sedia ada.
- Nama dunia dipaparkan menggunakan teks selamat, bukan HTML mentah.
- Link seed menggunakan query/hash bersama preset dan generator version. **Link seed berkongsi terrain asal; ia tidak mengandungi binaan pemain.**
- Perkongsian binaan menggunakan fail eksport pada 1.0; akaun/cloud ialah P2.
- Pindah domain, profil browser atau peranti tidak memindahkan save secara automatik; sediakan panduan eksport/import.

## 9. Visual, audio dan identiti

- Kekalkan gaya voxel pixel yang mudah dikenal, dengan palet dan ikon VoxelCraft sendiri.
- Seragamkan skala panel, spacing, typography dan keadaan hover/focus/disabled.
- Lighting lebih lembut, fog mengikut render distance dan peralihan siang/malam; kawalan masa manual kekal dalam Creative.
- Air mempunyai tint bawah air; daun menggunakan cutout jika sesuai; uji sorting kaca dan air.
- Baked vertex AO ialah enhancement P2 selepas mesher asas stabil. Ia menambah masa pembinaan mesh dan data warna vertex; jangan menganggap kosnya sifar. Uji empat tahap AO, diagonal segi tiga dan kemas kini jiran tepi/sudut supaya shading tidak berjahit. [Algoritma voxel AO](https://0fps.net/2013/07/03/ambient-occlusion-for-minecraft-like-worlds/)
- Tetapan Low/Medium/High mengawal pixel ratio, render distance, awan, partikel dan bayang pilihan.
- Elakkan bayang dinamik mahal sebagai lalai telefon; ukur sebelum mengaktifkannya.
- Audio mempunyai master volume/mute dan variasi ringan mengikut bahan; hidupkan/resume AudioContext melalui gesture pemain.
- Semua tekstur, ikon dan bunyi ialah hasil sendiri atau berlesen sesuai; rekod attribution dan lesen font/dependency.
- Nama folder Minecraft boleh kekal untuk kerja lokal. Identiti yang dipaparkan dan repository awam dicadangkan sebagai VoxelCraft; nama akhir disemak sebelum penerbitan.

## 10. Pelan hosting GitHub Pages

GitHub Pages menerbitkan fail HTML/CSS/JavaScript statik. Ia sesuai untuk game client-side ini; server multiplayer, API peribadi dan database cloud memerlukan perkhidmatan tambahan. [Dokumentasi GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)

### 10.1 Repository dan URL

- Cadangan nama repository: `voxelcraft`, tertakluk pada nama yang dipilih pemilik.
- URL project site: `https://<owner>.github.io/<repo>/`.
- Untuk GitHub Free, rancang repository public; sokongan repository private bergantung pada pelan akaun. [Ketersediaan GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- Gunakan branch utama sebenar sebagai sumber release; contoh pelan ini menggunakan `main`.
- Wujudkan `.gitignore` bagi `node_modules`, `dist`, laporan ujian dan fail lokal.
- README menerangkan cara main, kawalan, cara menjalankan projek, lokasi save dan pautan live.

### 10.2 Build dan laluan aset

- Vite membina `index.html` dan dependency kepada `dist/`.
- Untuk project site, tetapkan `base: '/<repo>/'`; bagi domain akar/custom domain, gunakan `base: '/'`.
- Import aset melalui bundler; bagi aset `public`, bina URL menggunakan `import.meta.env.BASE_URL`.
- Semak URL font, ikon, worker dan screenshot resources; elakkan hardcode `/assets/...` yang terlepas subpath repository.
- Gunakan modal/state atau hash untuk navigasi menu; elakkan history routing yang memerlukan rewrite server.
- Uji build pada subpath sebenar, termasuk trailing slash dan refresh.

Panduan build, nilai `base` dan publish `dist` tersedia dalam [dokumentasi deployment Vite](https://vite.dev/guide/static-deploy.html#github-pages).

### 10.3 Workflow CI dan deployment

`ci.yml` berjalan pada pull request dan push:

1. Checkout kod dan setup versi Node yang direkodkan.
2. `npm ci` menggunakan lockfile.
3. `npm run lint`, `npm run test:unit` dan `npm run build`.
4. Uji aliran browser pada production preview dengan `npm run test:e2e`; sediakan browser/dependency ujian pada runner.
5. Simpan laporan hanya jika ujian gagal; kegagalan menghalang release.

`deploy.yml` berjalan pada push ke `main` atau `workflow_dispatch`:

1. Jalankan/panggil semula job CI untuk commit yang sama.
2. Selepas lulus, setup Pages dan upload **`dist/` sahaja** menggunakan action artifact Pages.
3. Job deploy memerlukan job build, menggunakan environment `github-pages` dan memaparkan URL hasil deployment.
4. Berikan `contents: read`; hadkan `pages: write` dan `id-token: write` kepada job yang memerlukan.
5. Gunakan concurrency deployment untuk mengelakkan penerbitan bertindih.
6. Ambil release action rasmi yang serasi ketika pelaksanaan, pin kepada commit SHA yang disahkan dan rekod tujuan pin tersebut.

Pilih **Settings → Pages → Source: GitHub Actions**. Keperluan artifact, permissions dan environment dirujuk dalam [panduan workflow Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

Pull request menjalankan semakan tanpa deploy production. Preview PR bukan ciri yang diandaikan tersedia; guna artifact build atau preview lokal untuk review awal.

### 10.4 Pengesahan selepas deploy

- Untuk alpha F3, semak ciri P0 yang tersedia dan label ketiadaan save; semakan save di bawah wajib selepas F4 dan pada release 1.0.
- Buka URL live melalui sesi browser baharu dan periksa tiada asset 404 atau exception startup.
- Cipta dunia, bina beberapa blok, refresh dan sambung save.
- Uji input desktop dan telefon pada URL production, termasuk menu dan pointer lock.
- Semak eksport/import, quota failure yang disimulasi dan paparan versi aplikasi.
- Rekod commit/tag yang benar-benar diterbitkan.

### 10.5 Batas hosting dan kos

Had semasa yang relevan ialah saiz site terbitan maksimum 1 GB, bandwidth soft limit 100 GB sebulan dan timeout deployment 10 minit. Sasarkan build jauh lebih kecil daripada had ini dan semak semula sebelum release besar. [Had rasmi GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)

Versi single-player tidak memerlukan backend berbayar. Custom domain, perkhidmatan tambahan atau penggunaan melebihi kemudahan akaun boleh mempunyai kos tersendiri. Jangan simpan token GitHub atau secret dalam kod browser atau pemboleh ubah build yang dieksport ke client.

## 11. Manifest, PWA dan offline

- Manifest dan ikon asas boleh disediakan bersama polish UI dalam F6; tetapkan `display: standalone` jika sesuai. Ini sahaja tidak menjamin pemasangan, fullscreen atau sokongan offline pada semua browser.
- Service worker dan jaminan aliran offline ialah P2, selepas deployment dan save/load stabil.
- Manifest mempunyai nama, ikon dan `start_url`/scope mengikut base path projek.
- Service worker hanya mengawal subpath game ini dan cache aset build; save kekal dalam IndexedDB.
- Cache aset berhash, sediakan strategi update HTML dan buang cache lama selepas update selamat.
- Apabila versi baharu tersedia, simpan sesi sebelum reload; jangan paksa update di tengah pembinaan.
- Uji lawatan pertama online, penggunaan offline seterusnya, update dan rollback.
- Jelaskan bahawa offline memerlukan aset berjaya dicache terlebih dahulu; jangan janjikan pemasangan PWA pada semua browser.

## 12. Survival dan pengembangan — P2

### 12.1 Survival asas

Hanya dimulakan selepas release 1.0 Creative memenuhi kriteria penerimaan.

1. Tambah mod dunia `survival` yang disimpan bersama metadata.
2. Resource drop, stack item dan inventory berjumlah; registry item dibezakan daripada registry blok.
3. Pecahan blok mengambil masa berdasarkan bahan/alat; input tahan mempunyai progress yang jelas.
4. Recipe data untuk planks, sticks, crafting table dan alat asas; UI menunjukkan bahan diperlukan.
5. Health, fall damage, respawn dan dasar item selepas mati yang konsisten.
6. Tambah satu mob pasif dahulu; had entity aktif dan simulation distance.
7. Musuh, hunger, furnace dan progression lanjut hanya selepas balance loop asas diuji.

Kriteria: pemain boleh mengumpul kayu → membuat bahan/alat → membina perlindungan → save → sambung semula dengan inventory dan health yang sama. Creative terus boleh dimainkan tanpa sistem survival.

### 12.2 Multiplayer/cloud

- GitHub Pages terus menghos client; pilih backend atau signaling berasingan selepas sasaran pemain ditentukan.
- Tentukan model authority, room capacity, validasi edit, persistence dan kos sebelum menulis networking.
- Sasaran percubaan kecil: 2–4 pemain satu room, kemudian ukur latency dan konflik edit.
- Peer-to-peer masih memerlukan penyelesaian signaling dan mungkin relay; jangan anggap ia berjalan hanya melalui Pages.
- Cloud save memerlukan identiti dan peraturan akses; fail save pemain tidak ditulis terus ke repository awam.
- Buat keputusan backend melalui dokumen reka bentuk berasingan berdasarkan keperluan semasa; multiplayer bukan syarat release 1.0.

## 13. Roadmap pelaksanaan

Ini ialah satu-satunya roadmap pelaksanaan. Anggaran untuk seorang pembangun yang biasa dengan JavaScript/Three.js, dalam hari kerja fokus; semak semula selepas baseline dan profiling awal. Ujian logik berisiko ditambah bersama fasa berkaitan; F7 ialah QA menyeluruh, bukan kali pertama projek diuji.

| Fasa | Anggaran | Kerja utama | Syarat selesai |
| --- | --- | --- | --- |
| F0 — Baseline | 1 hari | Jalankan game, reproduksi risiko audit, rekod screenshot, kawalan, errors dan FPS | `docs/BASELINE.md` serta salinan/tag asal tersedia |
| F1 — Modul dan build | 2–3 hari | Vite, kontrak world/render/input, CSS/aset lokal, versi Three.js/Node, Git dan rangka CI | Build/preview lulus; versi renderer sasaran dibekukan |
| F2 — Asas dunia chunk | 3–5 hari | Registry blok, PRNG/versioned generator, Hills/Flat, chunk typed array, atlas, face mesher dan bounds | Hash terrain stabil; edit membina semula chunk/jiran berkaitan; tiada had instance global |
| F3 — Kestabilan + alpha | 2–3 hari | State/input, fixed timestep, raycast/collision, New World, startup errors dan CI/Pages | P0 lulus; URL alpha menggunakan enjin chunk dan menyatakan save belum tersedia |
| F4 — Save lengkap | 3–4 hari | Snapshot IndexedDB, schema, world list, autosave, konflik dua tab, eksport/import dan pemulihan gagal | Refresh/round-trip serta transaksi gagal lulus; fixture save tersedia |
| F5 — Creative lengkap | 3–5 hari | Inventory berkategori, 9 slot, sekurang-kurangnya 24 blok, action scheduler, undo/redo | Semua arahan bina melalui satu laluan yang mengemas kini data, mesh dan status save |
| F6 — Mobile dan polish | 2–3 hari | Dua mod touch, auto-jump pilihan, settings, BM/English, tutorial, audio, screenshot/seed link dan manifest asas | Input peranti sasaran boleh digunakan; feature yang tidak disokong mempunyai fallback |
| F7 — Prestasi dan QA | 3–4 hari | Profiling, culling/unload, soak test, peranti sebenar, fixture save, failure cases dan subpath | Semua blocker ditutup; bajet prestasi/skop akhir direkodkan dalam QA |
| F8 — Release 1.0 | 1–2 hari | README, lesen/aset, changelog, tag, deploy, semakan live dan prosedur rollback | Semua kriteria 1.0 lulus pada commit terbitan |

Jumlah asas: **20–30 hari kerja**. Dengan buffer 20%: **24–36 hari kerja**, sekitar **5–8 minggu**. Pemilihan chunk lebih awal mengurangkan kerja migrasi sementara; ia tidak membuktikan tempoh siap menjadi separuh. Jika F1 atau F2 mendedahkan kerja keserasian/generation yang lebih besar, anggarkan semula sebelum menjanjikan tarikh release.

Urutan kebergantungan: **baseline → modul/build → chunk + generator + face mesher → kestabilan/alpha → snapshot save → Creative → mobile/polish → prestasi/QA → release**.

Anggaran penuh termasuk eksport/import, autosave, konflik dua tab, undo/redo, bahasa dan QA. AO, RLE/palette, Island, service worker/offline, Survival dan multiplayer ialah P2 dan tidak termasuk dalam tempoh ini. Worker/greedy meshing hanya dimasukkan jika profiling menunjukkan ia perlu untuk sasaran 1.0; jika kosnya melebihi buffer, kecilkan skop dunia/preset atau semak anggaran secara jelas.

## 14. Backlog kerja yang boleh terus digunakan

| ID | P | Tugasan | Bergantung pada | Bukti siap |
| --- | --- | --- | --- | --- |
| T01 | P0 | Baseline dan reproduksi audit | — | Senarai risiko disahkan/tidak direproduksi |
| T02 | P0 | Entry point, Vite, ES modules dan kontrak sistem | T01 | Build/preview dan data world bebas daripada objek render |
| T03 | P0 | Bundle dependency/CSS/aset dan bekukan versi Three.js | T02 | Tiada runtime CDN wajib; semakan compatibility direkodkan |
| T04 | P0 | Registry, seed/versioned generator dan chunk typed array | T03 | Hash blok sama merentas urutan chunk dan browser sasaran |
| T05 | P0 | Atlas, face mesher, bounds dan dirty propagation | T04 | Opaque/cutout/transparent betul; jiran sempadan dikemas kini |
| T06 | P0 | State machine, pause, pointer lock dan reset input | T02 | Pause/blur/lock gagal tidak meninggalkan gerakan atau aksi |
| T07 | P0 | Fixed timestep, DDA, placement dan collision | T04, T06 | Kes sempadan dan gerakan pantas lulus |
| T08 | P0 | New World, loading, startup errors dan lifecycle | T05–T07 | Regenerasi berulang tidak crash; ralat mempunyai UI pemulihan |
| T09 | P0 | CI dan Pages alpha | T03–T08 | Build commit sama lulus; URL subpath dan label alpha betul |
| T10 | P1 | Schema, snapshot chunk IndexedDB dan fixture migrasi | T04, T08 | Buffer/revision konsisten; fail write tidak menimpa save sah |
| T11 | P1 | World list, autosave, persistent storage dan konflik dua tab | T10 | Simpanan benar-benar selesai; permintaan persist ditolak tidak mematahkan game |
| T12 | P1 | Eksport/import snapshot dan validasi format/had | T10 | Round-trip, fail rosak dan versi tidak disokong dikendalikan |
| T13 | P1 | Inventory, 9 slot hotbar dan sekurang-kurangnya 24 blok | T07, T10 | Semua ID/sifat blok dan pemilihan konsisten |
| T14 | P1 | Action scheduler dan undo/redo | T05, T11, T13 | Undo turut mengemas kini snapshot, mesh dan revision; tiada input berganda |
| T15 | P1 | Dua mod touch dan auto-jump boleh dimatikan | T06, T07, T14 | Drag/tap/hold dibezakan; multitouch dan ruang kepala lulus |
| T16 | P1 | Settings, BM/English dan tutorial | T13, T15 | Form input tidak mencetuskan shortcut; tetapan kekal selepas reload |
| T17 | P1 | Visual/audio, screenshot, seed link dan manifest asas | T03, T16 | Grafik boleh dilaras; haptic/fullscreen tiada sokongan tidak menggagalkan aliran |
| T18 | P1 | Profiling, dunia sasaran, culling/unload dan memory lifecycle | T05, T11, T17 | Bajet diukur; snapshot belum tersimpan tidak dibuang semasa unload |
| T19 | P1 | QA akhir, failure cases, peranti dan dokumentasi release | T09–T18 | Laporan QA tanpa blocker; fixture save lama lulus |
| T20 | P1 | Tag dan deploy 1.0 | T19 | URL live pada commit release disahkan dengan save sebenar |
| T21 | P2 | Baked vertex AO | T18, T20 | Masa meshing, diagonal shading dan jiran tepi/sudut diuji |
| T22 | P2 | Compression RLE/palette jika berfaedah | T10, T18, T20 | Encode/decode round-trip dan fallback raw lulus; versi format direkodkan |
| T23 | P2 | Service worker dan offline | T20 | Offline/update/rollback serta scope subpath diuji |
| T24 | P2 | Preset Island | T04, T20 | Generator version dan spawn selamat diuji |
| T25 | P2 | Survival asas | T20 | Resource → crafting → save loop lulus |
| T26 | P2 | Reka bentuk multiplayer/cloud | T20 | Architecture, kos dan ujian prototype dipersetujui |

## 15. Pelan ujian

### 15.1 Unit untuk logik berisiko

- Determinisme seed, generator version dan urutan generation yang berbeza.
- Koordinat negatif, sempadan chunk serta mapping index typed array.
- DDA pada arah paksi sifar, origin integer, sudut blok, jarak maksimum dan tiada sasaran.
- Collision lantai/kepala/dinding, respawn, placement bertindih pemain dan batas dunia.
- Dirty propagation ketika edit di tepi/sudut chunk.
- Snapshot penuh termasuk blok `air`, undo/redo, byte order eksport dan pemulihan selepas unload/load.
- Validasi/migrasi save, ID blok tidak dikenali, chunk pendua, panjang buffer salah, had decoded data, koordinat tidak sah dan transaksi gagal.
- Snapshot/revision ketika pemain terus membina semasa autosave; hanya revision yang selesai ditulis ditanda bersih.
- Tap berbanding drag/hold, tiada place selepas mine, sasaran sentuhan dan auto-jump dengan siling rendah.
- Jika AO atau compression dilaksanakan dalam P2: jiran tepi/sudut, arah diagonal, decode bounds dan fallback raw.

### 15.2 Integrasi dan browser

| Senario | Hasil yang mesti berlaku |
| --- | --- |
| First visit → Create → Play | Loading selesai, spawn selamat dan input berfungsi |
| Bina/pecah → tunggu autosave → refresh | Edit, posisi, masa dan hotbar dipulihkan |
| New World ketika ada edit | Pengesahan/aliran simpan jelas; dunia lama kekal dalam senarai |
| Eksport → import sebagai dunia baharu | Data blok/metadata setara, ID dunia berbeza |
| Fail save rosak/versi masa depan | Ralat berguna dan rekod lama tidak ditimpa |
| Storan penuh/tidak tersedia | Game masih memberi pilihan eksport; tiada status save palsu |
| Dua tab membuka dunia sama | Tiada overwrite senyap |
| Edit semasa autosave sedang menulis | Perubahan baharu kekal dirty dan disimpan pada transaksi seterusnya |
| `persist()` ditolak atau `vibrate` tiada | Save/gameplay terus berfungsi dengan status dan fallback yang betul |
| Esc/blur/tukar tab → kembali | Pause dan input reset; tiada lonjakan fizik |
| Pointer lock ditolak | Fallback/menu boleh digunakan |
| Bergerak + lihat + mine pada telefon | Semua pointer berfungsi tanpa butang tersangkut |
| Drag kamera dalam mod tap/hold | Tiada place/mine tidak sengaja; sasaran tindakan ialah sentuhan sebenar |
| Auto-jump dimatikan atau siling rendah | Tiada step-up tanpa izin dan tiada tembus collision |
| Edit di sempadan chunk → unload → kembali | Muka jiran betul dan edit kekal |
| Tukar dunia ketika worker sibuk | Hasil lama tidak masuk ke dunia baharu |
| URL `/<repo>/` → refresh | Aset, font dan worker berjaya dimuat |
| Kehilangan konteks WebGL | Sesi tidak ditanda telah disimpan secara palsu; ada aliran pemulihan/reload |

Automasi menjalankan aliran dan logik yang boleh diulang. Pointer lock, prestasi GPU, Safari dan multitouch tetap memerlukan semakan interaktif/peranti sebenar; lulus headless sahaja belum mencukupi.

### 15.3 Matriks peranti sasaran

- Windows: Chrome dan Edge; Firefox untuk semakan compatibility.
- Android: Chrome pada sekurang-kurangnya satu telefon kelas pertengahan.
- iPhone/iPad: Safari pada satu peranti sebenar jika hendak diiklankan sebagai disokong.
- Semak resize, orientation, skala paparan dan nisbah skrin berbeza.
- Catat model peranti, OS, versi browser, resolusi dan preset pada laporan; sokongan akhir mengikut bukti ujian.

## 16. Bajet prestasi dan cara mengukur

Semua nilai di bawah ialah **sasaran awal yang belum diukur**, bukan dakwaan prestasi game semasa.

| Ukuran | Sasaran awal |
| --- | --- |
| Desktop 1080p Medium | Median sekurang-kurangnya 60 FPS, p95 frame time ≤25 ms |
| Telefon kelas pertengahan Low | Median sekurang-kurangnya 30 FPS, p95 frame time ≤50 ms |
| Binaan awal dimuat | ≤5 MB transfer termampat tanpa aset pilihan |
| Startup pada sambungan ujian 10 Mbps | Menu ≤3 saat, dunia boleh dimainkan ≤8 saat |
| Respons edit blok | Perubahan setempat terlihat ≤100 ms dalam workload biasa |
| Mesh update | Sasaran kerja main thread sekitar ≤4 ms per frame; baki diagih/dipindah ke worker |
| Sesi berulang | Memori stabil selepas warm-up/unload; tiada pertumbuhan tanpa had |

Protokol: rekod baseline 53 × 53, kemudian dunia sasaran 256 × 256 × 64; guna sekurang-kurangnya tiga seed tetap, dunia dengan 10,000 tindakan bina/pecah yang direkod sebagai snapshot, perjalanan merentas chunk dan sesi 20 minit. Ulang New World/load/unload 20 kali untuk menilai resource lifecycle. Asingkan masa cold load, generation, meshing, save dan frame rendering. Rekod draw calls mengikut chunk/lapisan/pass yang benar-benar dirender, triangles, memori serta p95 frame time; tiada jumlah draw call atau FPS yang dijamin sebelum ukuran.

Jika sasaran gagal, turunkan render distance/pixel ratio, hadkan partikel dan kecilkan saiz dunia dahulu. Worker atau greedy meshing ditambah berdasarkan bottleneck yang diukur. Rekod sebarang sasaran yang diubah dalam QA sebelum release.

## 17. Risiko dan mitigasi

| Risiko | Mitigasi |
| --- | --- |
| Upgrade Three.js mengubah hasil visual/API | Perubahan berasingan, semak migration guide dan banding screenshot/interaksi baseline |
| Save hilang atau tidak serasi | Transaksi, schema/generator version, backup eksport dan ujian migrasi |
| Storan browser dipadam/evicted | Status lokal jelas, eksport mudah dan kendali quota/availability |
| Snapshot selamat tetapi chunk belum disimpan berubah selepas update generator | Dunia lama kekal menggunakan generator version asal bagi semua chunk prosedur |
| Chunk besar menyebabkan lag | Face meshing, dirty queue, render distance, profiling dan worker bila perlu |
| Pokok/mesh pecah pada sempadan | Hash koordinat global, margin jiran dan ujian chunk boundary |
| Kaca/air sorting salah | Mesh transparent berasingan dan ujian sudut pandang; hadkan efek rumit |
| UI telefon bertindih/stuck | Safe area, pointer capture dan semakan peranti sebenar |
| Tap/hold mencetuskan aksi ketika pemain mahu drag | Ambang gerakan, pembatalan gesture dan dua mod kawalan boleh dipilih |
| Pages memuat aset pada path salah | Base path khusus dan ujian preview/production subpath |
| Release baharu merosakkan dunia lama | Fixture save lama dan generator versi lama sebelum deploy |
| Skop terlalu besar | Bekukan Creative 1.0; pindahkan Survival/multiplayer/PWA ke milestone selepasnya |

## 18. Kriteria penerimaan versi 1.0

- [ ] URL GitHub Pages membuka menu dan game tanpa asset 404 atau exception yang menghalang permainan.
- [ ] Dunia boleh dicipta, dinamakan, dimainkan, disimpan, dibuka semula dan dipadam secara terkawal.
- [ ] Seed + preset + generator version yang sama menghasilkan terrain asas sama, termasuk pokok.
- [ ] Dunia lama menggunakan generator asal bagi chunk belum disimpan; snapshot chunk terubah dipulihkan tepat termasuk `air`.
- [ ] Binaan kekal selepas refresh, unload chunk dan pertukaran dunia.
- [ ] Eksport/import lulus round-trip; input rosak ditolak tanpa merosakkan dunia lama.
- [ ] Eksport backup merangkumi perubahan dalam memori ketika storan penuh atau transaksi save gagal.
- [ ] Inventory, hotbar, sekurang-kurangnya 24 blok dan undo/redo berfungsi.
- [ ] Desktop dan telefon sasaran boleh bergerak, melihat, membina dan pause dengan betul.
- [ ] Kedua-dua mod touch, setting auto-jump, BM/English dan settings lulus; API haptic/fullscreen/persist yang tiada atau ditolak tidak menggagalkan game.
- [ ] Edit semasa autosave dan konflik dua tab tidak menyebabkan save lama menimpa perubahan baharu; unload gagal simpan tidak membuang data.
- [ ] New World, kehilangan fokus dan pointer lock gagal tidak menyebabkan tindakan tidak sengaja.
- [ ] Tiada blok ghaib akibat had instance global senyap.
- [ ] Collision/raycast kes sempadan dan perjalanan merentas chunk lulus.
- [ ] Sasaran prestasi dicapai pada peranti yang direkodkan, atau skop/preset diselaraskan secara jelas.
- [ ] CI lulus pada commit yang diterbitkan; README, lesen dan changelog lengkap.
- [ ] Save versi sebelumnya boleh dimuat atau mempunyai migrasi yang telah diuji.
- [ ] Laporan QA tidak mempunyai isu P0/P1 terbuka yang menghalang skop release.

## 19. Release, penyelenggaraan dan rollback

- Simpan baseline sebagai `v0.1.0` selepas pengesahan; alpha modular/stabil sebagai `v0.2.0`; sasaran Creative lengkap sebagai `v1.0.0`.
- Setiap perubahan berkaitan gameplay, save dan generator diterangkan dalam changelog.
- Gunakan branch kerja dan PR dengan ringkasan masalah, perubahan dan bukti ujian; production deploy hanya commit branch release yang lulus.
- Paparkan versi aplikasi dan cara eksport maklumat ralat tanpa mengumpul data pemain secara automatik.
- Bug report meminta browser/peranti, versi game, seed dan langkah reproduksi; fail dunia hanya jika pemain memilih untuk berkongsi.
- Rollback melalui revert commit atau build semula tag release yang diketahui baik, kemudian deploy semula.
- Semak keserasian schema sebelum rollback. Jika versi lama tidak boleh membaca save baharu, keluarkan hotfix forward atau kekalkan reader yang serasi; jangan menimpa rekod dengan format lama.
- Selepas PWA wujud, uji juga cache update supaya rollback tidak meninggalkan aset bercampur.
- Semak dependency dan workflow secara berkala mengikut perubahan sebenar, dan uji fixture save sebelum mengemas kini production.

## 20. Langkah pertama yang disyorkan

Mulakan dengan **F0 → F1 → F2**: sahkan baseline, bina modul/build dan terus sediakan chunk typed array, generator deterministik serta face mesher. Seterusnya **F3** menstabilkan pemain/input dan menyediakan URL alpha, diikuti **F4** untuk snapshot save lengkap. Besarkan dunia hanya selepas asas ini diukur; lengkapkan Creative, mobile dan QA sebelum release 1.0.

Keputusan yang hanya diperlukan menjelang pelaksanaan berkaitan: nama repository/owner dan visibility semasa setup Pages; model telefon/browser semasa QA; nama serta lesen projek sebelum release. Ketiadaan keputusan ini tidak menghalang kerja struktur, kestabilan dan storan lokal.

Kod prototaip asal `voxel_craft_3d.html` dikekalkan untuk rujukan. Status semasa pelaksanaan dan baki kerja release direkod dalam `docs/QA.md`; tiada deployment awam disahkan setakat dokumen ini dikemas kini.
