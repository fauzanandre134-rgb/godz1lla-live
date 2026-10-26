# GODZ1LLA LIVE

Dashboard leaderboard gift TikTok LIVE real-time + overlay untuk TikTok LIVE Studio.

**Branding:** Godz1lla · Gaya gaming/anime · WebSocket real-time

---

## Arsitektur singkat

```
TikTok LIVE (unofficial connector)
        │
        ▼
   Node.js Server (Express + ws)
        │
        ├── HTTP  → Dashboard (/) + Overlay (/overlay)
        └── WebSocket → push leaderboard & gift events ke semua client
```

- **Dashboard** (`/`): input username, Connect/Disconnect, Demo, Reset, salin URL overlay.
- **Overlay** (`/overlay`): halaman transparan untuk sumber Link di TikTok LIVE Studio.
- **WebSocket**: update leaderboard tanpa refresh.
- **Mode DEMO**: data palsu berlabel jelas, untuk uji UI tanpa TikTok.
- **Konektor TikTok**: library `tiktok-live-connector` (unofficial). Tidak meminta password/cookie.

> **Peringatan jujur:** Integrasi TikTok bersifat reverse-engineering. Bisa gagal kapan saja (protokol berubah, signing, IP datacenter diblok). Jangan anggap 100% stabil untuk production. Mode DEMO selalu tersedia.

---

## Daftar file

| File | Fungsi |
|------|--------|
| `server.js` | Server Express, WebSocket, logika leaderboard, konektor TikTok, mode demo |
| `package.json` | Dependensi & script `npm start` |
| `public/index.html` | Halaman dashboard |
| `public/overlay.html` | Halaman overlay transparan |
| `public/style.css` | Gaya dashboard + overlay (tema neon/fire/ice/gold) |
| `public/app.js` | Client dashboard (WebSocket, UI) |
| `public/overlay.js` | Client overlay (WebSocket, render top N) |
| `README.md` | Dokumentasi ini |
| `.gitignore` | Mengabaikan `node_modules`, dll. |

---

## Persyaratan

- **Node.js 18+** (LTS disarankan). Cek: `node -v`
- Browser modern (Chrome / Edge / Firefox)
- Untuk LIVE Studio: PC/laptop yang menjalankan TikTok LIVE Studio

---

## Cara menjalankan lokal (PC / laptop)

1. Install Node.js dari https://nodejs.org (pilih LTS).
2. Unduh / clone folder proyek ini.
3. Buka terminal di folder proyek:
   ```bash
   cd godz1lla-live
   npm install
   npm start
   ```
4. Buka browser:
   - Dashboard: http://localhost:3000/
   - Overlay: http://localhost:3000/overlay
5. Klik **Mode DEMO** untuk uji leaderboard tanpa TikTok.
6. Atau masukkan username yang sedang LIVE → **Connect**.

---

## Tutorial pemula (HP Android + GitHub)

### 1. Dapatkan semua file

- Jika Anda menerima **ZIP**: unduh ke HP.
- Atau dari GitHub: buka repo → tombol **Code** → **Download ZIP**.

### 2. Ekstrak ZIP di Android

1. Buka aplikasi **Files** / **My Files** / **Solid Explorer**.
2. Temukan file `godz1lla-live.zip` di folder Download.
3. Ketuk → **Extract** / **Unzip**.
4. Pastikan struktur folder tetap:
   ```
   godz1lla-live/
     package.json
     server.js
     public/
       index.html
       overlay.html
       style.css
       app.js
       overlay.js
     README.md
     .gitignore
   ```

### 3. Buat repository GitHub

1. Buka https://github.com di browser HP (atau app GitHub).
2. Login / daftar akun.
3. Tombol **+** → **New repository**.
4. Nama: `godz1lla-live` (boleh diganti).
5. Public → **Create repository**.

### 4. Upload file ke GitHub (dari HP)

**Cara termudah (tanpa Git di HP):**

1. Di halaman repo kosong, klik **uploading an existing file**.
2. Buka folder hasil ekstrak di file manager.
3. Pilih **semua file dan folder** di dalam `godz1lla-live` (bukan folder luarnya).
4. Unggah. Pastikan `package.json` dan folder `public/` ada di root repo.
5. Commit changes.

**Catatan:** Beberapa file manager Android sulit mengunggah folder. Alternatif: gunakan PC, atau aplikasi seperti **MGit** / **Working Copy**, atau unduh ZIP lagi setelah diedit di PC.

### 5. Deployment gratis (Render — tanpa kartu kredit)

Render (https://render.com) mendukung Node.js + WebSocket, HTTPS gratis, tanpa kartu untuk free tier.

**Batasan free tier (jujur):**
- Service **tidur** setelah ~15 menit tanpa traffic (HTTP atau pesan WebSocket).
- Bangun lagi ~30–60 detik saat request baru.
- 750 jam instance / bulan.
- Cocok untuk uji & stream sesekali, **bukan** 24/7 tanpa gangguan.

Langkah:

1. Daftar di https://render.com dengan GitHub.
2. **New +** → **Web Service**.
3. Hubungkan repo `godz1lla-live`.
4. Isi:
   - **Name:** `godz1lla-live` (bebas)
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance type:** Free
5. **Create Web Service**.
6. Tunggu deploy selesai. URL contoh: `https://godz1lla-live-xxxx.onrender.com`

**Penting tentang konektor TikTok di hosting:**
- Server di datacenter sering diblok / gagal signing oleh TikTok.
- Jika Connect gagal di Render, itu **bukan** bug dashboard Anda — batasan jaringan/IP.
- Solusi praktis: jalankan server di **PC rumah** (localhost atau tunnel), pakai mode DEMO di cloud, atau coba hosting lain.

Alternatif free (cek syarat terbaru sendiri):
- Beberapa panel bot hosting (Sillydev, Waifly, dll.) — sering 24/7 tapi RAM kecil.
- Jangan pakai Vercel/Netlify untuk WebSocket server panjang (mereka serverless).

### 6. URL dashboard & overlay

Setelah deploy berhasil:

- Dashboard: `https://NAMA-SERVICE.onrender.com/`
- Overlay: `https://NAMA-SERVICE.onrender.com/overlay`
- Tema:  
  - `/overlay?theme=neon` (default)  
  - `/overlay?theme=fire`  
  - `/overlay?theme=ice`  
  - `/overlay?theme=gold`  
- Batasi baris: `/overlay?top=5`

### 7. Memasukkan overlay ke TikTok LIVE Studio

1. Buka **TikTok LIVE Studio** di PC.
2. Di scene, pilih **Add source** / **Tambah sumber** → **Link** (browser/link source).
3. Tempel URL overlay (HTTPS dari hosting, atau `http://localhost:3000/overlay` jika server jalan di PC yang sama).
4. Atur ukuran & posisi di preview.
5. **Transparansi:** background overlay sudah transparan. Jika masih hitam, pastikan LIVE Studio mendukung transparansi sumber Link.
6. **Localhost:** tidak semua versi LIVE Studio bisa memuat `localhost` dari mesin yang sama. Jika gagal:
   - Jalankan server di PC yang sama dengan LIVE Studio.
   - Atau pakai URL HTTPS dari hosting.
   - Atau tunnel (mis. Cloudflare Tunnel / ngrok) ke port 3000.

Uji dulu di browser sebelum masuk LIVE.

### 8. Menguji gift & koneksi

1. **Mode DEMO** di dashboard → pastikan leaderboard & recent gift bergerak.
2. Buka overlay di tab lain → harus ikut update.
3. Untuk TikTok nyata: pastikan akun target **sedang LIVE**, lalu Connect.
4. Kirim gift (atau minta viewer) → cek poin naik (hanya hitung saat streak selesai untuk gift combo).

### 9. Error umum & solusi

| Gejala | Kemungkinan | Solusi |
|--------|-------------|--------|
| `npm install` gagal | Node terlalu lama / jaringan | Pakai Node 18+ LTS, coba lagi |
| Port already in use | Port 3000 terpakai | `PORT=3001 npm start` |
| Connect gagal / error library | User tidak LIVE, atau TikTok blok IP/signing | Coba username lain yang LIVE; pakai DEMO; jalankan di PC rumah |
| Overlay hitam / tidak update | WebSocket terputus, atau URL salah | Cek dashboard dulu; pastikan URL sama host; refresh sumber di LIVE Studio |
| Render sleep | Idle 15 menit | Buka dashboard sekali untuk “bangunkan”; atau gunakan PC lokal saat streaming |
| Leaderboard dobel poin | Streak dihitung berulang | Kode sudah filter `repeatEnd`; update library jika masih terjadi |

---

## Checklist pengujian

- [ ] `npm install` selesai tanpa error
- [ ] `npm start` menampilkan banner Godz1lla + port
- [ ] http://localhost:3000/ membuka dashboard
- [ ] http://localhost:3000/overlay membuka overlay
- [ ] http://localhost:3000/health mengembalikan JSON `ok: true`
- [ ] WebSocket terhubung (status Offline → berubah saat demo/connect)
- [ ] Mode DEMO mengisi leaderboard & recent gifts
- [ ] Tombol Reset mengosongkan leaderboard (dengan konfirmasi)
- [ ] Salin URL overlay berhasil
- [ ] Connect ke username LIVE: sukses **atau** pesan error yang jelas (bukan crash server)
- [ ] Disconnect menghentikan update
- [ ] Deploy Render: URL HTTPS bisa dibuka
- [ ] Overlay di LIVE Studio: terlihat & update (uji dengan DEMO dulu)

**Yang belum diuji di lingkungan ini:**  
Koneksi nyata ke TikTok LIVE (butuh akun yang sedang siaran). Library unofficial dapat berubah. Hasil Connect di hosting cloud sering gagal karena IP datacenter.

---

## Keamanan

- Tidak ada password TikTok yang diminta.
- Username divalidasi (karakter aman, panjang terbatas).
- Tidak ada endpoint admin terbuka.
- Reset hanya lewat WebSocket client (bukan URL publik berbahaya).
- Error ditangani agar server tidak crash.

---

## Lisensi & kredit

- Proyek ini: MIT (boleh dimodifikasi).
- `tiktok-live-connector`: lihat lisensi paket di npm (versi 1.x biasanya MIT; versi baru bisa AGPL).
- Tidak berafiliasi dengan TikTok / ByteDance.

---

## Catatan akhir

Godz1lla LIVE dirancang agar **pemula bisa jalanin** dengan DEMO, lalu mencoba koneksi LIVE.  
Jika konektor TikTok tidak stabil, tetap gunakan dashboard + overlay + DEMO untuk latihan layout stream, lalu hubungkan konektor saat berjalan di mesin lokal.

Selamat streaming. 👑
