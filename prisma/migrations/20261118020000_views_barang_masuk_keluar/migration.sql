-- Read-only views separating item_transactions into barang masuk and barang keluar
CREATE OR REPLACE VIEW "v_barang_masuk" AS
SELECT
    t."id",
    t."transaction_code" AS "id_transaksi",
    t."created_at"::date AS "tanggal_masuk",
    t."reference_no"     AS "no_dokumen",
    i."name"             AS "nama_barang",
    c."name"             AS "kategori",
    t."quantity"         AS "jumlah",
    t."source"           AS "sumber_pengadaan",
    t."recipient"        AS "penerima",
    t."sender"           AS "pengirim",
    t."notes"            AS "catatan",
    t."qr_codes"         AS "kode_qr",
    l."name"             AS "lokasi",
    t."created_at"
FROM "item_transactions" t
JOIN "items" i ON i."id" = t."item_id"
LEFT JOIN "item_categories" c ON c."id" = i."category_id"
LEFT JOIN "locations" l ON l."id" = t."location_id"
WHERE t."type" = 'in'
ORDER BY t."created_at" DESC, t."transaction_code" DESC;

CREATE OR REPLACE VIEW "v_barang_keluar" AS
SELECT
    t."id",
    t."transaction_code" AS "id_transaksi",
    t."created_at"::date AS "tanggal_keluar",
    t."reference_no"     AS "no_dokumen",
    i."name"             AS "nama_barang",
    c."name"             AS "kategori",
    t."quantity"         AS "jumlah",
    t."source"           AS "alasan",
    t."recipient"        AS "penerima",
    t."sender"           AS "tujuan",
    t."notes"            AS "catatan",
    t."qr_codes"         AS "kode_qr",
    l."name"             AS "lokasi",
    t."created_at"
FROM "item_transactions" t
JOIN "items" i ON i."id" = t."item_id"
LEFT JOIN "item_categories" c ON c."id" = i."category_id"
LEFT JOIN "locations" l ON l."id" = t."location_id"
WHERE t."type" = 'out'
ORDER BY t."created_at" DESC, t."transaction_code" DESC;
