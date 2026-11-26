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

## Menyiapkan outlet

1. Salin `.env.example` ke `.env`, set `DEMO_MODE=0`, lalu buat akun pemilik awal dengan `OWNER_USERNAME` dan `OWNER_PASSWORD` minimal 12 karakter. Jalankan aplikasi dengan HTTPS untuk penggunaan di perangkat karyawan, dan atur `COOKIE_SECURE=1` saat HTTPS tersedia. Browser juga mengizinkan kamera dan lokasi pada localhost untuk pengembangan.
2. Masuk sebagai pemilik, tambahkan akun karyawan dan produk, lalu atur titik lokasi serta radius di **Pengaturan outlet**. Absensi menyimpan selfie bertanda waktu WIB dan mencatat waktu penerimaan di server. Status radius mempertimbangkan jarak dan akurasi GPS yang dilaporkan perangkat. Periksa selfie dan GPS yang ditandai dari daftar absensi.
3. Untuk **QRIS statis**, masukkan payload QRIS merchant dalam rupiah atau unggah gambar PNG, JPG, atau WebP untuk membacanya. Pembeli memasukkan nominal di aplikasi pembayaran. Kasir menandai lunas setelah melihat dana masuk di aplikasi merchant. Pemilik mendapat notifikasi konfirmasi kasir.
4. Untuk **QRIS dinamis**, aktifkan QRIS GoPay pada akun merchant Midtrans Core API dan atur `MIDTRANS_SERVER_KEY` di server. Mulai di sandbox dengan `MIDTRANS_PRODUCTION=0` dan gunakan server key produksi bersama `MIDTRANS_PRODUCTION=1` saat siap. Server perlu akses HTTPS ke `api.sandbox.midtrans.com` atau `api.midtrans.com` sesuai mode. Tambahkan URL publik aplikasi dengan path `/api/payments/midtrans/notification` di pengaturan notifikasi Midtrans. Aplikasi memverifikasi tanda tangan notifikasi dan mengambil status dari API Midtrans. Nominal pesanan dan hasil konfirmasi diterapkan di server. Panel pemilik memperbarui data otomatis.

Simpan database di volume persisten. Dataset ini berisi tanggal, posisi, dan selfie absensi yang harus dikelola sesuai kebijakan privasi tempat kerja. Karyawan memakai izin kamera dan lokasi yang diberikan browser, dan pemilik dapat meninjau bukti. Aplikasi ini belum menangani pengembalian dana dari gateway.

[Dokumentasi Midtrans Core API untuk QRIS](https://docs.midtrans.com/reference/qris)
