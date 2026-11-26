# Kelola

Aplikasi satu outlet untuk pemilik dan karyawan UMKM. Panel pemilik menampilkan penjualan harian dan historis, notifikasi, katalog, akun karyawan, dan absensi. Panel karyawan menyediakan kasir dan absensi masuk serta pulang. Antarmuka memakai React, GSAP dan ScrollTrigger untuk judul per kata, Motion untuk kartu, serta Lenis untuk smooth scroll.

## Menjalankan demo

Gunakan Node.js 24 atau lebih baru dari direktori repositori.

```sh
npm ci
npm run dev
```

Buka aplikasi di port 5173. Demo masuk sebagai pemilik. Pilih **Panel karyawan** di navigasi untuk mencoba kasir dan absensi, lalu **Panel pemilik** untuk melihat hasilnya. Data demo berupa contoh Kopi Sudut dan disimpan di `data/demo.sqlite`. QR demo hanya menjalankan alur simulasi.

```sh
npm test
npm run build
npm start
```

`npm start` menyajikan build dan API dari satu alamat. `PORT` dan `DB_PATH` dapat diubah di lingkungan proses atau di berkas `.env` lokal. Gunakan database yang sama untuk mempertahankan data antar-restart. Basis data demo dan operasional harus terpisah.

## Deploy demo di Vercel

Gunakan root repositori, preset Vite, dan Node.js 24. Konfigurasi `vercel.json` menyajikan build dari `dist` dan meneruskan `/api/*` ke satu Vercel Function. Setelah deploy, buka `/api/session` pada domain proyek untuk memeriksa bahwa API mengembalikan JSON. Mode demo bawaan di Vercel menggunakan SQLite di memori dan membuat ulang data contoh saat instance Function berganti.

## Menyimpan data di Neon pada Vercel

1. Dari Neon, buka proyek dan salin **pooled connection string**. Jika proyek baru diklaim, salin koneksi yang muncul setelah klaim.
2. Di Vercel, buka **Settings → Environment Variables** pada proyek Kelola. Simpan koneksi sebagai `DATABASE_URL` untuk lingkungan yang akan dipakai. Untuk operasional, tambahkan `DEMO_MODE=0`, `OWNER_USERNAME`, dan `OWNER_PASSWORD`. Nama pengguna memakai 3–40 huruf, angka, titik, garis bawah, atau tanda hubung. Kata sandi memakai 12–128 karakter.
3. Redeploy aplikasi. API membuat tabel yang diperlukan saat koneksi pertama. Masuk dengan akun pemilik yang diatur pada deployment pertama, lalu atur outlet dan akun karyawan.

Setelan nama pengguna dan kata sandi pemilik hanya dipakai saat pertama kali menyiapkan basis data kosong. Gunakan basis data yang berbeda untuk demo persisten dan data operasional. Demo SQLite lokal tetap menggunakan `DB_PATH` selama `DATABASE_URL` kosong.

## Menyiapkan outlet

1. Untuk instalasi lokal, salin `.env.example` ke `.env`, set `DEMO_MODE=0`, lalu buat akun pemilik awal dengan `OWNER_USERNAME` dan `OWNER_PASSWORD` sepanjang 12–128 karakter. Jalankan aplikasi dengan HTTPS untuk penggunaan di perangkat karyawan, dan atur `COOKIE_SECURE=1` saat HTTPS tersedia. Browser juga mengizinkan kamera dan lokasi pada localhost untuk pengembangan.
2. Masuk sebagai pemilik, tambahkan akun karyawan dan produk, lalu atur titik lokasi serta radius di **Pengaturan outlet**. Absensi menyimpan selfie bertanda waktu WIB dan mencatat waktu penerimaan di server. Status radius mempertimbangkan jarak dan akurasi GPS yang dilaporkan perangkat. Periksa selfie dan GPS yang ditandai dari daftar absensi.
3. Untuk **QRIS statis**, masukkan payload QRIS merchant dalam rupiah atau unggah gambar PNG, JPG, atau WebP untuk membacanya. Pembeli memasukkan nominal di aplikasi pembayaran. Kasir menandai lunas setelah melihat dana masuk di aplikasi merchant. Pemilik mendapat notifikasi konfirmasi kasir.
4. Untuk **QRIS dinamis**, aktifkan QRIS GoPay pada akun merchant Midtrans Core API dan atur `MIDTRANS_SERVER_KEY` di server. Mulai di sandbox dengan `MIDTRANS_PRODUCTION=0` dan gunakan server key produksi bersama `MIDTRANS_PRODUCTION=1` saat siap. Server perlu akses HTTPS ke `api.sandbox.midtrans.com` atau `api.midtrans.com` sesuai mode. Tambahkan URL publik aplikasi dengan path `/api/payments/midtrans/notification` di pengaturan notifikasi Midtrans. Aplikasi memverifikasi tanda tangan notifikasi dan mengambil status dari API Midtrans. Nominal pesanan dan hasil konfirmasi diterapkan di server. Panel pemilik memperbarui data otomatis.

Simpan database di volume persisten. Dataset ini berisi tanggal, posisi, dan selfie absensi yang harus dikelola sesuai kebijakan privasi tempat kerja. Karyawan memakai izin kamera dan lokasi yang diberikan browser, dan pemilik dapat meninjau bukti. Aplikasi ini belum menangani pengembalian dana dari gateway.

[Dokumentasi Midtrans Core API untuk QRIS](https://docs.midtrans.com/reference/qris)
