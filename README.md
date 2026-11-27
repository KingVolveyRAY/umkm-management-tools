# Kelola

Aplikasi untuk memantau beberapa outlet atau usaha UMKM dari satu akun pemilik. Panel pemilik menampilkan penjualan, target pendapatan bulanan, laba rugi kotor, pelanggan, promo, katalog dengan HPP, akun karyawan, notifikasi, dan absensi setiap outlet. Panel karyawan menyediakan kasir dengan struk cetak serta absensi masuk dan pulang untuk outlet tempat akunnya dibuat. Antarmuka claymorphism memakai React, GSAP dan ScrollTrigger, Motion, serta Lenis.

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
2. Masuk sebagai pemilik. Gunakan **Semua outlet → Tambah outlet** untuk membuat usaha atau cabang baru. Pemilih outlet di navigasi menentukan ruang kerja untuk penjualan, karyawan, absensi, dan produk. Koneksi database pertama setelah pembaruan memindahkan pengaturan usaha lama ke outlet pertama. Data historis otomatis dikaitkan ke outlet tersebut.
3. Untuk **QRIS statis**, masukkan payload QRIS merchant dalam rupiah atau unggah gambar PNG, JPG, atau WebP untuk membacanya. Pembeli memasukkan nominal di aplikasi pembayaran. Kasir menandai lunas setelah melihat dana masuk di aplikasi merchant. Pemilik mendapat notifikasi konfirmasi kasir.
4. Untuk **QRIS dinamis**, aktifkan QRIS GoPay pada akun merchant Midtrans Core API dan atur `MIDTRANS_SERVER_KEY` di server. Mulai di sandbox dengan `MIDTRANS_PRODUCTION=0` dan gunakan server key produksi bersama `MIDTRANS_PRODUCTION=1` saat siap. Server perlu akses HTTPS ke `api.sandbox.midtrans.com` atau `api.midtrans.com` sesuai mode. Tambahkan URL publik aplikasi dengan path `/api/payments/midtrans/notification` di pengaturan notifikasi Midtrans. Aplikasi memverifikasi tanda tangan notifikasi dan mengambil status dari API Midtrans. Nominal pesanan dan hasil konfirmasi diterapkan di server. Panel pemilik memperbarui data otomatis.

Di **Pengaturan outlet**, masukkan alamat di **Cari berdasarkan alamat** dan pilih hasilnya untuk memasang pin. Pencarian alamat menggunakan Photon dengan data OpenStreetMap. Pin juga bisa dipasang dan digeser pada peta atau diambil lewat **Gunakan lokasi saya**. Setelah pin sesuai, atur radius absensi. Saat absen, karyawan mengikuti instruksi kedip dan senyum, mengambil selfie bertanda waktu WIB, dan mengirim lokasi perangkat. Bingkai kamera dan selfie berbentuk potret di HP. Browser memproses gerakan wajah secara lokal. Server menyimpan selfie akhir, hasil verifikasi gerakan, waktu, dan lokasi serta memeriksa masa berlaku tantangan satu kali. Pemilik dapat meninjau selfie dan pin lokasi di **Absensi**.

Di **Ringkasan**, pilih bulan dan klik **Atur target**. Pencapaian dihitung dari transaksi lunas pada bulan itu. Di **Produk**, masukkan biaya komponen per unit dan Kelola menjumlahkannya menjadi HPP. Di **Laba rugi**, lihat pendapatan setelah diskon dikurangi HPP yang tersimpan saat transaksi dicatat. Laporan menandai transaksi yang belum memiliki HPP lengkap. Di **Penjualan → Ekspor laporan**, pilih CSV, PDF, atau Excel untuk filter dan outlet yang sedang aktif.

Di **Promo**, pemilik menentukan potongan persentase atau rupiah serta waktu mulai dan berakhir dalam WIB. Kasir menerapkan satu promo aktif yang memberi potongan terbesar pada keranjang. Saat checkout, kasir mengisi nama pelanggan dan dapat menambahkan nomor telepon. Pemilik melihat data tersebut di **Pelanggan**. Pembelian dengan nomor yang sama tercatat di satu kontak dalam outlet. Entri tanpa nomor dicatat per transaksi. Setelah transaksi lunas, **Cetak struk** membuka pengaturan cetak browser dengan rincian barang, harga asli, diskon jika berlaku, dan total bayar.

Simpan database di volume persisten. Tanggal, posisi, dan selfie absensi mengikuti kebijakan privasi tempat kerja. Aplikasi ini belum menangani pengembalian dana dari gateway.

[Model MediaPipe Face Landmarker](https://developers.google.com/mediapipe/solutions/vision/face_landmarker)
[Dokumentasi Midtrans Core API untuk QRIS](https://docs.midtrans.com/reference/qris)
