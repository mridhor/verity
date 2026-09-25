from verity_core.redact import redact


def test_redacts_identifiers():
    text = "NIK 3174055707910004 NPWP 12.345.678.9-012.345 email laras@contoh.id telp 081234567890"
    out = redact(text)
    assert "3174055707910004" not in out and "laras@contoh.id" not in out and "081234567890" not in out
    assert "[NIK]" in out and "[NPWP]" in out and "[EMAIL]" in out and "[TELP]" in out
